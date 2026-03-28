import { supabaseAdmin } from '../config/supabase.js';
import { PDFParse } from 'pdf-parse';

const supabase = supabaseAdmin;

const IDEA_STATUSES = new Set(['draft', 'submitted', 'revision_required', 'approved', 'rejected']);
const EDITABLE_STATUSES = new Set(['draft', 'revision_required', 'rejected']);
const REVIEW_ACTIONS = new Set(['approved', 'rejected', 'revision_required']);
const IDEA_ASSISTANT_PROVIDER = String(
  process.env.IDEA_ASSISTANT_PROVIDER ||
  (process.env.GOOGLE_API_KEY ? 'gemini' : (process.env.OLLAMA_BASE_URL ? 'ollama' : 'openai'))
).trim().toLowerCase();
const OPENAI_IDEA_MODEL = process.env.OPENAI_IDEA_MODEL || 'gpt-5-mini';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const GEMINI_IDEA_MODEL = process.env.GEMINI_IDEA_MODEL || 'gemini-2.5-flash';
const OLLAMA_BASE_URL = String(process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const OLLAMA_IDEA_MODEL = process.env.OLLAMA_IDEA_MODEL || 'llava:7b';
const PROJECT_STATUS_MAP = {
  draft: 'pending',
  submitted: 'pending',
  revision_required: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  completed: 'completed',
};

const IDEA_ASSISTANT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    technologies: {
      type: 'array',
      items: { type: 'string' },
    },
    domain: { type: 'string' },
    subdomain: { type: 'string' },
    confidence_score: { type: 'number' },
    keywords: {
      type: 'array',
      items: { type: 'string' },
    },
    summary: { type: 'string' },
    readiness: { type: 'string', enum: ['ready', 'needs_more_detail'] },
    missing_details: {
      type: 'array',
      items: { type: 'string' },
    },
    mentor_pitch: { type: 'string' },
    follow_up_questions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: [
    'title',
    'description',
    'technologies',
    'domain',
    'subdomain',
    'confidence_score',
    'keywords',
    'summary',
    'readiness',
    'missing_details',
    'mentor_pitch',
    'follow_up_questions',
  ],
};

const GEMINI_IDEA_ASSISTANT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    description: { type: 'STRING' },
    technologies: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    domain: { type: 'STRING' },
    subdomain: { type: 'STRING' },
    confidence_score: { type: 'NUMBER' },
    keywords: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    summary: { type: 'STRING' },
    readiness: {
      type: 'STRING',
      enum: ['ready', 'needs_more_detail'],
    },
    missing_details: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    mentor_pitch: { type: 'STRING' },
    follow_up_questions: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
  },
  required: [
    'title',
    'description',
    'technologies',
    'domain',
    'subdomain',
    'confidence_score',
    'keywords',
    'summary',
    'readiness',
    'missing_details',
    'mentor_pitch',
    'follow_up_questions',
  ],
  propertyOrdering: [
    'title',
    'description',
    'technologies',
    'domain',
    'subdomain',
    'confidence_score',
    'keywords',
    'summary',
    'readiness',
    'missing_details',
    'mentor_pitch',
    'follow_up_questions',
  ],
};

const IDEA_ASSISTANT_CHAT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    message: { type: 'string' },
    draft_patch: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        technologies: {
          type: 'array',
          items: { type: 'string' },
        },
        domain: { type: 'string' },
        subdomain: { type: 'string' },
        confidence_score: { type: 'number' },
        keywords: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['title', 'description', 'technologies', 'domain', 'subdomain', 'confidence_score', 'keywords'],
    },
    readiness: { type: 'string', enum: ['exploring', 'ready_to_apply'] },
    follow_up_questions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['message', 'draft_patch', 'readiness', 'follow_up_questions'],
};

const GEMINI_IDEA_ASSISTANT_CHAT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    message: { type: 'STRING' },
    draft_patch: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        description: { type: 'STRING' },
        technologies: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
        domain: { type: 'STRING' },
        subdomain: { type: 'STRING' },
        confidence_score: { type: 'NUMBER' },
        keywords: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
      },
      required: ['title', 'description', 'technologies', 'domain', 'subdomain', 'confidence_score', 'keywords'],
      propertyOrdering: ['title', 'description', 'technologies', 'domain', 'subdomain', 'confidence_score', 'keywords'],
    },
    readiness: {
      type: 'STRING',
      enum: ['exploring', 'ready_to_apply'],
    },
    follow_up_questions: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
  },
  required: ['message', 'draft_patch', 'readiness', 'follow_up_questions'],
  propertyOrdering: ['message', 'draft_patch', 'readiness', 'follow_up_questions'],
};

function keepTitleWithinWordLimit(value, maxWords = 6) {
  const normalized = normalizeTextField(value, { maxLength: 200 }) || '';
  if (!normalized) return '';
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(' ');
}

function keepChatTitleWithinLimit(value, maxChars = 40) {
  const normalized = normalizeTextField(value, { maxLength: 160 }) || '';
  if (!normalized) return '';
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

const safeProfileName = (profile, fallback = 'User') => {
  return profile?.full_name || profile?.email || fallback;
};

const normalizeTextField = (value, { required = false, maxLength = 5000 } = {}) => {
  if (value === undefined) return undefined;
  if (value === null) return required ? null : null;
  const normalized = String(value).trim();
  if (!normalized) return required ? null : null;
  return normalized.slice(0, maxLength);
};

const normalizeTechnologyStacks = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  return [...new Set(
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  )];
};

const normalizeIdeaDomain = (value, { fallback = null } = {}) => {
  if (value === undefined) return undefined;
  if (value === null) return fallback;
  const normalized = String(value).trim();
  if (!normalized) return fallback;
  return normalized.slice(0, 120);
};

const normalizeIdeaSubdomain = (value, { fallback = null } = {}) => {
  if (value === undefined) return undefined;
  if (value === null) return fallback;
  const normalized = String(value).trim();
  if (!normalized) return fallback;
  return normalized.slice(0, 120);
};

const normalizeIdeaKeywords = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .map((item) => item.slice(0, 40))
  )].slice(0, 10);
};

const normalizeConfidenceScore = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric > 1) return Math.max(0, Math.min(1, Number((numeric / 100).toFixed(2))));
  return Math.max(0, Math.min(1, Number(numeric.toFixed(2))));
};

const normalizeIdeaStatus = (value, allowed = IDEA_STATUSES) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!allowed.has(normalized)) return null;
  return normalized;
};

function normalizeAssistantDraftPatch(value, project = null) {
  return {
    title:
      keepTitleWithinWordLimit(value?.title)
      || keepTitleWithinWordLimit(project?.title || project?.team_name)
      || 'Untitled Idea',
    description: normalizeTextField(value?.description, { maxLength: 3000 }) || '',
    technologies: normalizeTechnologyStacks(value?.technologies),
    domain:
      normalizeIdeaDomain(value?.domain, { fallback: project?.domain || 'General' })
      || project?.domain
      || 'General',
    subdomain: normalizeIdeaSubdomain(value?.subdomain, { fallback: '' }) || '',
    confidence_score: normalizeConfidenceScore(value?.confidence_score, 0),
    keywords: normalizeIdeaKeywords(value?.keywords),
  };
}

function buildAssistantCurrentDraft(source = {}, project = null) {
  const normalized = normalizeAssistantDraftPatch(source, project);
  return {
    ...normalized,
    title: normalized.title || '',
    description: normalized.description || '',
    domain: normalized.domain || '',
  };
}

function deriveChatTitleFromMessages(messages = [], assistantDraft = null, fallback = '') {
  const firstUserMessage = sanitizeAssistantMessages(messages).find((message) => message.role === 'user')?.content || '';
  return (
    keepChatTitleWithinLimit(firstUserMessage)
    || keepChatTitleWithinLimit(assistantDraft?.title)
    || keepChatTitleWithinLimit(fallback)
  );
}

const clampScore = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)));

function scoreIdeaSubmission(idea) {
  const title = String(idea?.title || '').trim();
  const description = String(idea?.description || '').trim().toLowerCase();
  const technologies = Array.isArray(idea?.technologies) ? idea.technologies.filter(Boolean) : [];

  // Effectiveness: problem clarity + expected impact.
  let effectiveness = 40;
  if (title.length >= 10) effectiveness += 8;
  if (description.length >= 80) effectiveness += 12;
  if (/(problem|challenge|issue|inefficient|delay|manual|error)/i.test(description)) effectiveness += 20;
  if (/(improve|optimize|reduce|increase|efficiency|accuracy|speed)/i.test(description)) effectiveness += 10;

  // Feasibility: practical implementation details.
  let feasibility = 40;
  if (technologies.length >= 1) feasibility += 12;
  if (technologies.length >= 2) feasibility += 8;
  if (/(api|database|module|implementation|deploy|prototype|integration)/i.test(description)) feasibility += 20;
  if (description.length >= 40) feasibility += 8;

  effectiveness = clampScore(effectiveness);
  feasibility = clampScore(feasibility);
  const score = clampScore((effectiveness + feasibility) / 2);
  const status = score >= 70 ? 'Good' : 'Needs Improvement';

  const feedback = [];
  feedback.push(
    effectiveness >= 70
      ? 'Effectiveness is strong. The problem statement and expected impact are clear.'
      : 'Effectiveness needs work. Clarify the core problem and measurable impact (especially efficiency gains).'
  );
  feedback.push(
    feasibility >= 70
      ? 'Feasibility looks practical with a workable scope and technical direction.'
      : 'Feasibility needs improvement. Add concrete implementation steps and realistic technical scope.'
  );

  return {
    score,
    status,
    criteria: { effectiveness, feasibility },
    feedback,
  };
}

function extractFirstJsonObject(text) {
  const source = String(text || '');
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return source.slice(start, end + 1);
}

function parseAiEvaluationText(text) {
  try {
    const jsonBlock = extractFirstJsonObject(text);
    if (!jsonBlock) return null;
    const parsed = JSON.parse(jsonBlock);
    const effectiveness = clampScore(parsed?.effectiveness);
    const feasibility = clampScore(parsed?.feasibility);
    const score = clampScore(parsed?.score ?? ((effectiveness + feasibility) / 2));
    const status = String(parsed?.status || '').trim() === 'Good' ? 'Good' : 'Needs Improvement';
    const feedback = Array.isArray(parsed?.feedback)
      ? parsed.feedback.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 4)
      : [];
    if (!feedback.length) return null;
    return {
      score,
      status,
      criteria: { effectiveness, feasibility },
      feedback,
    };
  } catch {
    return null;
  }
}

async function scoreIdeaSubmissionWithAI(idea) {
  const heuristic = scoreIdeaSubmission(idea);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return heuristic;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const prompt = [
    'Evaluate this student project idea.',
    'Criteria: Effectiveness (0-100), Feasibility (0-100).',
    'Output ONLY valid JSON with keys: effectiveness, feasibility, score, status, feedback.',
    'status must be exactly "Good" or "Needs Improvement".',
    'feedback must be an array of 2-4 concise points.',
    'If uncertain, be conservative.',
  ].join('\n');

  const payload = {
    model,
    input: [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: JSON.stringify({
          title: idea?.title || '',
          description: idea?.description || '',
          technologies: Array.isArray(idea?.technologies) ? idea.technologies : [],
        }),
      },
    ],
    temperature: 0.1,
    max_output_tokens: 350,
  };

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return heuristic;
    const data = await response.json();
    const text = data?.output_text || JSON.stringify(data?.output || '');
    const parsed = parseAiEvaluationText(text);
    return parsed || heuristic;
  } catch {
    return heuristic;
  }
}

async function saveAutoIdeaEvaluation({ projectId, evaluatorId, evaluation }) {
  const AUTO_EVAL_PREFIX = '[AUTO IDEA EVAL]';

  // Keep latest auto-evaluation per project to avoid duplicate rows across resubmissions.
  await supabase
    .from('evaluations')
    .delete()
    .eq('project_id', projectId)
    .eq('evaluation_type', 'approval_feedback')
    .like('feedback', `${AUTO_EVAL_PREFIX}%`);

  const { error } = await supabase
    .from('evaluations')
    .insert({
      project_id: projectId,
      evaluator_id: evaluatorId,
      evaluation_type: 'approval_feedback',
      max_marks: 100,
      obtained_marks: evaluation.score,
      feedback: [
        AUTO_EVAL_PREFIX,
        `Status: ${evaluation.status}`,
        `Effectiveness: ${evaluation.criteria.effectiveness}/100`,
        `Feasibility: ${evaluation.criteria.feasibility}/100`,
        ...evaluation.feedback,
      ].join('\n'),
    });

  if (error) throw error;
}

const createNotifications = async (rows) => {
  const validRows = (rows || []).filter((row) => row?.user_id && row?.type && row?.title && row?.message);
  if (!validRows.length) return;
  const { error } = await supabase.from('notifications').insert(validRows);
  if (error) {
    console.error('Idea notification insert skipped:', error.message);
  }
};

async function fetchIdeaReviews(ideaIds) {
  if (!ideaIds.length) return [];

  const { data, error } = await supabase
    .from('idea_reviews')
    .select(`
      id,
      idea_id,
      reviewer_id,
      action,
      comment,
      created_at,
      reviewer:profiles!idea_reviews_reviewer_id_fkey(id, full_name, email)
    `)
    .in('idea_id', ideaIds)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

function attachReviewHistory(ideas, reviews) {
  const reviewsByIdea = new Map();
  (reviews || []).forEach((review) => {
    if (!reviewsByIdea.has(review.idea_id)) {
      reviewsByIdea.set(review.idea_id, []);
    }
    reviewsByIdea.get(review.idea_id).push(review);
  });

  return (ideas || []).map((idea) => {
    const ideaReviews = reviewsByIdea.get(idea.id) || [];
    return {
      ...idea,
      reviews: ideaReviews,
      latest_review: ideaReviews[0] || null,
    };
  });
}

async function listIdeasForProject(projectId) {
  const { data: ideas, error } = await supabase
    .from('project_ideas')
    .select(`
      id,
      project_id,
      version_no,
      title,
      domain,
      subdomain,
      description,
      technologies,
      confidence_score,
      keywords,
      status,
      submitted_at,
      created_by,
      created_at,
      updated_at,
      creator:profiles!project_ideas_created_by_fkey(id, full_name, email)
    `)
    .eq('project_id', projectId)
    .order('version_no', { ascending: false });

  if (error) throw error;
  const reviews = await fetchIdeaReviews((ideas || []).map((idea) => idea.id));
  return attachReviewHistory(ideas || [], reviews);
}

async function getProjectRow(projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, team_name, domain, description, technology_stacks, status, guide_id, mentor_id, coordinator_id, approved_idea_id, current_idea_id')
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return data;
}

async function getIdeaRow(ideaId) {
  const { data, error } = await supabase
    .from('project_ideas')
    .select('id, project_id, version_no, title, domain, subdomain, description, technologies, confidence_score, keywords, status, submitted_at, created_by, created_at, updated_at')
    .eq('id', ideaId)
    .single();

  if (error) throw error;
  return data;
}

async function getProjectAccessRow(projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id,
      title,
      team_name,
      domain,
      description,
      technology_stacks,
      status,
      guide_id,
      mentor_id,
      coordinator_id,
      approved_idea_id,
      current_idea_id,
      team_members(student_id, role)
    `)
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return data;
}

async function assertStudentCanAccessIdea(ideaId, userId) {
  const idea = await getIdeaRow(ideaId);
  const project = await getProjectAccessRow(idea.project_id);
  const isMember = (project.team_members || []).some((member) => member.student_id === userId);

  if (!isMember) {
    const error = new Error('You do not have access to this idea.');
    error.statusCode = 403;
    throw error;
  }

  return { idea, project };
}

async function getProjectIdeaChatSession(chatId) {
  const { data, error } = await supabase
    .from('idea_chats')
    .select('id, project_id, title, latest_draft, created_at, updated_at')
    .eq('id', chatId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function listProjectIdeaChats(projectId) {
  const { data, error } = await supabase
    .from('idea_chats')
    .select('id, project_id, title, latest_draft, created_at, updated_at')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function createProjectIdeaChatRecord(projectId) {
  const { data, error } = await supabase
    .from('idea_chats')
    .insert({
      project_id: projectId,
      title: null,
      latest_draft: null,
    })
    .select('id, project_id, title, latest_draft, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

async function listProjectIdeaChatMessages(chatId) {
  const { data, error } = await supabase
    .from('idea_chat_messages')
    .select('id, chat_id, role, content, attachments, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function createProjectIdeaChatMessage(chatId, role, content, attachments = []) {
  const { data, error } = await supabase
    .from('idea_chat_messages')
    .insert({
      chat_id: chatId,
      role,
      content,
      attachments,
    })
    .select('id, chat_id, role, content, attachments, created_at')
    .single();

  if (error) throw error;
  return data;
}

async function updateProjectIdeaChatSession(chatId, updates) {
  const { data, error } = await supabase
    .from('idea_chats')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chatId)
    .select('id, project_id, title, latest_draft, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

async function deleteProjectIdeaChatSessionRecord(chatId) {
  const { error } = await supabase
    .from('idea_chats')
    .delete()
    .eq('id', chatId);

  if (error) throw error;
}

async function assertStudentCanAccessProjectChat(chatId, userId) {
  const chat = await getProjectIdeaChatSession(chatId);
  if (!chat) {
    const error = new Error('Chat not found.');
    error.statusCode = 404;
    throw error;
  }

  const project = await getProjectAccessRow(chat.project_id);
  const isMember = (project.team_members || []).some((member) => member.student_id === userId);

  if (!isMember) {
    const error = new Error('You do not have access to this chat.');
    error.statusCode = 403;
    throw error;
  }

  return { chat, project };
}

async function getIdeaAssistantChat(ideaId) {
  const { data, error } = await supabase
    .from('idea_assistant_chats')
    .select('id, idea_id, title, latest_draft, created_at, updated_at')
    .eq('idea_id', ideaId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function ensureIdeaAssistantChat(ideaId) {
  const existing = await getIdeaAssistantChat(ideaId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('idea_assistant_chats')
    .insert({ idea_id: ideaId, latest_draft: null })
    .select('id, idea_id, title, latest_draft, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

async function listIdeaAssistantMessages(chatId) {
  const { data, error } = await supabase
    .from('idea_assistant_messages')
    .select('id, chat_id, role, content, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function createIdeaAssistantMessage(chatId, role, content) {
  const { data, error } = await supabase
    .from('idea_assistant_messages')
    .insert({
      chat_id: chatId,
      role,
      content,
    })
    .select('id, chat_id, role, content, created_at')
    .single();

  if (error) throw error;
  return data;
}

async function updateIdeaAssistantChat(chatId, updates) {
  const { data, error } = await supabase
    .from('idea_assistant_chats')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chatId)
    .select('id, idea_id, title, latest_draft, created_at, updated_at')
    .single();

  if (error) throw error;
  return data;
}

async function syncProjectFromIdea(project, idea, nextStatus, { currentIdeaId, approvedIdeaId } = {}) {
  const updates = {
    updated_at: new Date().toISOString(),
  };

  if (currentIdeaId !== undefined) updates.current_idea_id = currentIdeaId;
  if (approvedIdeaId !== undefined) updates.approved_idea_id = approvedIdeaId;
  if (nextStatus) updates.status = PROJECT_STATUS_MAP[String(nextStatus || '').toLowerCase()] || 'pending';

  const shouldMirrorIdea =
    nextStatus === 'approved' ||
    nextStatus === 'submitted' ||
    nextStatus === 'revision_required' ||
    nextStatus === 'rejected' ||
    !project?.approved_idea_id;

  if (shouldMirrorIdea && idea) {
    updates.title = idea.title;
    updates.domain = idea.domain || project?.domain || 'General';
    updates.description = idea.description || null;
    updates.technology_stacks = Array.isArray(idea.technologies) ? idea.technologies : [];
  }

  const { error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', project.id);

  if (error) throw error;
}

async function notifyMentorsOfSubmission(project, teamName, idea, actorName) {
  const recipientIds = [...new Set([
    project.guide_id,
    project.mentor_id,
    project.coordinator_id,
  ].filter(Boolean))];

  await createNotifications(recipientIds.map((userId) => ({
    user_id: userId,
    type: 'idea_submitted',
    title: 'New Idea Submitted',
    message: `${actorName} submitted "${idea.title}" for ${teamName || project.team_name || project.title || 'a team'}.`,
  })));
}

async function notifyTeamOfReview(projectId, action, comment, actorName, ideaTitle) {
  const { data: members, error } = await supabase
    .from('team_members')
    .select('student_id')
    .eq('project_id', projectId);

  if (error) throw error;

  const titleByAction = {
    approved: 'Idea Approved',
    rejected: 'Idea Rejected',
    revision_required: 'Idea Revision Requested',
  };

  const verbByAction = {
    approved: 'approved',
    rejected: 'rejected',
    revision_required: 'requested revision for',
  };

  await createNotifications((members || []).map((member) => ({
    user_id: member.student_id,
    type: `idea_${action}`,
    title: titleByAction[action] || 'Idea Reviewed',
    message: comment
      ? `${actorName} ${verbByAction[action] || 'reviewed'} "${ideaTitle}". Feedback: ${comment}`
      : `${actorName} ${verbByAction[action] || 'reviewed'} "${ideaTitle}".`,
  })));
}

function mentorCanReviewProject(project, req) {
  if (req.userRole === 'admin') return true;
  const assignedGuideId = project.guide_id ?? project.mentor_id;
  return assignedGuideId === req.user.id || project.coordinator_id === req.user.id;
}

function buildIdeaAssistantSystemPrompt() {
  return [
    'You are Etnova Idea Assistant, helping students turn rough academic project concepts into mentor-review-ready idea drafts.',
    'Take student notes and optional image/sketch context, then produce a practical mini-project idea draft.',
    'Keep the idea realistic for an academic project team.',
    'Write concise but complete content suitable for a mentor review workflow.',
    'Infer a single best-fit project domain.',
    'Also infer a useful subdomain, a confidence_score between 0 and 1, and short keywords that describe the idea.',
    'Generate a short, professional title with a maximum of 6 words.',
    'Technologies should be specific and relevant, without overloading the stack.',
    'If important information is missing, still produce the best possible draft and list the missing details separately.',
    'Do not use markdown in the structured fields.',
  ].join(' ');
}

function buildIdeaAssistantChatSystemPrompt() {
  return [
    'You are an AI Idea Mentor inside ETNOVA, a project development platform.',
    'Your goal is to help students transform rough, unclear ideas into clear, practical, and innovative project proposals through natural conversation.',
    'Behave like a friendly, intelligent mentor, not a robotic form-filling assistant.',
    'Talk naturally like a human mentor, keep responses short to medium length, and avoid rigid sections or headings unless absolutely necessary.',
    'Guide the idea step by step instead of dumping everything at once.',
    'If the idea is vague, ask thoughtful follow-up questions. If it is clear, improve it with better naming, scope, feasibility, innovation, and technology choices.',
    'Use previous messages to maintain continuity and build on what the student already said.',
    'Internally maintain and improve a structured draft with title, domain, subdomain, description, technologies, confidence_score, and keywords, but do not expose that structure in the conversational message.',
    'The title in draft_patch must be short, clear, professional, and no more than 6 words.',
    'Infer a strong best-fit domain, a specific subdomain, a confidence_score between 0 and 1, and concise keywords. Choose practical technologies without overloading the stack.',
    'When helpful, naturally suggest improvements or ask whether the student wants to apply the refined idea to the workspace.',
    'Always return valid JSON with message, draft_patch, readiness, and follow_up_questions.',
    'The message must sound like a natural mentor reply, not like JSON or form labels.',
    'Use readiness=ready_to_apply only when the idea is clear enough for mentor review; otherwise use exploring.',
    'Do not use markdown in the structured fields.',
  ].join(' ');
}

function parseAssistantResponseText(responseJson) {
  if (typeof responseJson?.output_text === 'string' && responseJson.output_text.trim()) {
    return responseJson.output_text.trim();
  }

  const outputItems = Array.isArray(responseJson?.output) ? responseJson.output : [];
  for (const item of outputItems) {
    const contentItems = Array.isArray(item?.content) ? item.content : [];
    for (const content of contentItems) {
      if (typeof content?.text === 'string' && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return '';
}

function parseJsonDraft(parsedText) {
  let parsedDraft;
  try {
    parsedDraft = JSON.parse(parsedText);
  } catch {
    throw new Error('AI assistant response could not be parsed.');
  }

  const normalizedDraft = normalizeAssistantDraftPatch(parsedDraft);
  return {
    ...normalizedDraft,
    summary: normalizeTextField(parsedDraft.summary, { maxLength: 1500 }) || '',
    readiness: String(parsedDraft.readiness || '').toLowerCase() === 'ready' ? 'ready' : 'needs_more_detail',
    missing_details: Array.isArray(parsedDraft.missing_details)
      ? parsedDraft.missing_details.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    mentor_pitch: normalizeTextField(parsedDraft.mentor_pitch, { maxLength: 1500 }) || '',
    follow_up_questions: Array.isArray(parsedDraft.follow_up_questions)
      ? parsedDraft.follow_up_questions.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 5)
      : [],
  };
}

function parseJsonChatResponse(parsedText, project) {
  let parsedResponse;
  try {
    parsedResponse = JSON.parse(parsedText);
  } catch {
    throw new Error('AI assistant chat response could not be parsed.');
  }

  const normalizedDraft = normalizeAssistantDraftPatch(parsedResponse?.draft_patch, project);
  return {
    message: normalizeTextField(parsedResponse.message, { required: true, maxLength: 3000 })
      || 'I refined the idea based on your latest message.',
    draft_patch: normalizedDraft,
    readiness:
      String(parsedResponse.readiness || '').toLowerCase() === 'ready_to_apply'
        ? 'ready_to_apply'
        : 'exploring',
    follow_up_questions: Array.isArray(parsedResponse.follow_up_questions)
      ? parsedResponse.follow_up_questions.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 3)
      : [],
  };
}

function extractBase64Image(imageDataUrl) {
  if (!imageDataUrl) return '';
  const parts = String(imageDataUrl).split(',');
  return parts.length > 1 ? parts[1] : '';
}

function extractImageMimeType(imageDataUrl) {
  const match = String(imageDataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  return match?.[1] || 'image/png';
}

function decodeDataUrlToBuffer(dataUrl) {
  const source = String(dataUrl || '');
  const base64 = source.includes(',') ? source.split(',')[1] : '';
  if (!base64) return Buffer.alloc(0);
  return Buffer.from(base64, 'base64');
}

async function extractAttachmentText(attachment) {
  if (!attachment?.dataUrl) return '';
  const mimeType = String(attachment.mimeType || '').toLowerCase();

  try {
    if (mimeType === 'application/pdf') {
      const buffer = decodeDataUrlToBuffer(attachment.dataUrl);
      if (!buffer.length) return '';
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        return normalizeTextField(parsed?.text, { maxLength: 8000 }) || '';
      } finally {
        await parser.destroy();
      }
    }

    if (
      mimeType.startsWith('text/')
      || ['application/json', 'application/csv', 'text/csv'].includes(mimeType)
    ) {
      const buffer = decodeDataUrlToBuffer(attachment.dataUrl);
      return normalizeTextField(buffer.toString('utf8'), { maxLength: 8000 }) || '';
    }
  } catch (error) {
    console.error('Attachment text extraction skipped:', error.message);
  }

  return '';
}

async function enrichAttachmentForChat(attachment) {
  if (!attachment?.dataUrl) return null;
  const textExcerpt = await extractAttachmentText(attachment);
  return {
    name: attachment.name || 'Attachment',
    mimeType: attachment.mimeType || 'application/octet-stream',
    dataUrl: attachment.dataUrl,
    textExcerpt,
  };
}

function buildIdeaAssistantUserPrompt({ project, prompt, currentDraft }) {
  return [
    `Team name: ${project.team_name || project.title || 'Untitled Team'}`,
    `Existing project domain: ${project.domain || 'General'}`,
    `Existing project title: ${project.title || 'Not set'}`,
    `Existing project description: ${project.description || 'Not set'}`,
    `Existing technologies: ${Array.isArray(project.technology_stacks) && project.technology_stacks.length ? project.technology_stacks.join(', ') : 'Not set'}`,
    `Current draft title: ${currentDraft?.title || 'Not set'}`,
    `Current draft description: ${currentDraft?.description || 'Not set'}`,
    `Current draft technologies: ${Array.isArray(currentDraft?.technologies) && currentDraft.technologies.length ? currentDraft.technologies.join(', ') : 'Not set'}`,
    `Current draft domain: ${currentDraft?.domain || 'Not set'}`,
    `Student prompt: ${prompt || 'No additional prompt provided.'}`,
  ].join('\n');
}

function sanitizeAssistantMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => ({
      role: String(message?.role || '').trim().toLowerCase(),
      content: normalizeTextField(message?.content, { maxLength: 2500 }) || '',
      attachments: Array.isArray(message?.attachments)
        ? message.attachments
          .map((attachment) => ({
            name: normalizeTextField(attachment?.name, { maxLength: 120 }) || 'Attachment',
            mimeType: normalizeTextField(attachment?.mimeType, { maxLength: 120 }) || 'application/octet-stream',
            dataUrl: normalizeTextField(attachment?.dataUrl, { maxLength: 10_000_000 }) || '',
            textExcerpt: normalizeTextField(attachment?.textExcerpt, { maxLength: 4000 }) || '',
          }))
          .filter((attachment) => attachment.dataUrl)
          .slice(0, 3)
        : [],
    }))
    .filter((message) => ['user', 'assistant'].includes(message.role) && (message.content || message.attachments.length));
}

function buildAttachmentNarration(attachments = []) {
  return (Array.isArray(attachments) ? attachments : [])
    .map((attachment) => {
      const label = attachment?.mimeType?.startsWith('image/') ? 'Attached image' : 'Attached file';
      const excerpt = attachment?.textExcerpt ? ` Excerpt: ${attachment.textExcerpt.slice(0, 1200)}` : '';
      return `${label}: ${attachment?.name || 'Attachment'}${excerpt}`;
    })
    .join(' | ');
}

function collectRecentImageAttachments(messages = [], limit = 3) {
  return sanitizeAssistantMessages(messages)
    .flatMap((message) => message.attachments || [])
    .filter((attachment) => attachment?.mimeType?.startsWith('image/') && attachment?.dataUrl)
    .slice(-limit);
}

function buildIdeaAssistantConversationText({ project, currentDraft, messages }) {
  const currentDraftJson = JSON.stringify({
    title: currentDraft?.title || '',
    domain: currentDraft?.domain || '',
    subdomain: currentDraft?.subdomain || '',
    description: currentDraft?.description || '',
    technologies: Array.isArray(currentDraft?.technologies) ? currentDraft.technologies : [],
    confidence_score: currentDraft?.confidence_score ?? 0,
    keywords: Array.isArray(currentDraft?.keywords) ? currentDraft.keywords : [],
  });
  const transcript = sanitizeAssistantMessages(messages)
    .map((message) => {
      const attachmentNarration = buildAttachmentNarration(message.attachments);
      const content = message.content || 'Shared an attachment for context.';
      return `${message.role === 'assistant' ? 'Assistant' : 'Student'}: ${content}${attachmentNarration ? ` [${attachmentNarration}]` : ''}`;
    })
    .join('\n');

  return [
    `Team name: ${project.team_name || project.title || 'Untitled Team'}`,
    `Existing project domain: ${project.domain || 'General'}`,
    `Existing project title: ${project.title || 'Not set'}`,
    `Existing project description: ${project.description || 'Not set'}`,
    `Existing technologies: ${Array.isArray(project.technology_stacks) && project.technology_stacks.length ? project.technology_stacks.join(', ') : 'Not set'}`,
    `Current draft title: ${currentDraft?.title || 'Not set'}`,
    `Current draft description: ${currentDraft?.description || 'Not set'}`,
    `Current draft technologies: ${Array.isArray(currentDraft?.technologies) && currentDraft.technologies.length ? currentDraft.technologies.join(', ') : 'Not set'}`,
    `Current draft domain: ${currentDraft?.domain || 'Not set'}`,
    `Current draft subdomain: ${currentDraft?.subdomain || 'Not set'}`,
    `Current extracted idea JSON: ${currentDraftJson}`,
    'Conversation so far:',
    transcript || 'No conversation yet.',
  ].join('\n');
}

async function generateIdeaAssistantDraftWithOpenAI({ project, prompt, imageDataUrl, currentDraft }) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is not configured on the backend.');
    error.statusCode = 503;
    throw error;
  }

  const content = [
    {
      type: 'input_text',
      text: buildIdeaAssistantUserPrompt({ project, prompt, currentDraft }),
    },
  ];

  if (imageDataUrl) {
    content.push({
      type: 'input_image',
      image_url: imageDataUrl,
    });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_IDEA_MODEL,
      reasoning: { effort: 'low' },
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: buildIdeaAssistantSystemPrompt() }],
        },
        {
          role: 'user',
          content,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'idea_workspace_draft',
          strict: true,
          schema: IDEA_ASSISTANT_SCHEMA,
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Failed to generate AI idea draft.');
    error.statusCode = response.status;
    throw error;
  }

  const parsedText = parseAssistantResponseText(data);
  if (!parsedText) {
    throw new Error('AI assistant returned an empty response.');
  }

  const normalized = parseJsonDraft(parsedText);
  return {
    provider: 'openai',
    model: OPENAI_IDEA_MODEL,
    suggestion: {
      ...normalized,
      title: normalized.title || keepTitleWithinWordLimit(project.title || project.team_name) || 'Untitled Idea',
      domain: normalized.domain || project.domain || 'General',
    },
  };
}

async function generateIdeaAssistantDraftWithOllama({ project, prompt, imageDataUrl, currentDraft }) {
  const message = {
    role: 'user',
    content: buildIdeaAssistantUserPrompt({ project, prompt, currentDraft }),
  };

  const base64Image = extractBase64Image(imageDataUrl);
  if (base64Image) {
    message.images = [base64Image];
  }

  let response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_IDEA_MODEL,
        stream: false,
        format: IDEA_ASSISTANT_SCHEMA,
        options: {
          temperature: 0.2,
        },
        messages: [
          {
            role: 'system',
            content: buildIdeaAssistantSystemPrompt(),
          },
          message,
        ],
      }),
    });
  } catch {
    const error = new Error(
      'Ollama is not running. Install Ollama, start it, and pull the configured model before using the AI assistant.'
    );
    error.statusCode = 503;
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || 'Failed to generate AI idea draft with Ollama.');
    error.statusCode = response.status;
    throw error;
  }

  const parsedText = String(data?.message?.content || '').trim();
  if (!parsedText) {
    throw new Error('Ollama returned an empty response.');
  }

  const normalized = parseJsonDraft(parsedText);
  return {
    provider: 'ollama',
    model: OLLAMA_IDEA_MODEL,
    suggestion: {
      ...normalized,
      title: normalized.title || keepTitleWithinWordLimit(project.title || project.team_name) || 'Untitled Idea',
      domain: normalized.domain || project.domain || 'General',
    },
  };
}

async function generateIdeaAssistantDraftWithGemini({ project, prompt, imageDataUrl, currentDraft }) {
  if (!GOOGLE_API_KEY) {
    const error = new Error('GOOGLE_API_KEY is not configured on the backend.');
    error.statusCode = 503;
    throw error;
  }

  const parts = [
    {
      text: buildIdeaAssistantUserPrompt({ project, prompt, currentDraft }),
    },
  ];

  const base64Image = extractBase64Image(imageDataUrl);
  if (base64Image) {
    parts.push({
      inlineData: {
        mimeType: extractImageMimeType(imageDataUrl),
        data: base64Image,
      },
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_IDEA_MODEL)}:generateContent?key=${encodeURIComponent(GOOGLE_API_KEY)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildIdeaAssistantSystemPrompt() }],
        },
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_IDEA_ASSISTANT_SCHEMA,
        },
      }),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage =
      data?.error?.message ||
      data?.error?.status ||
      'Failed to generate AI idea draft with Gemini.';
    const error = new Error(errorMessage);
    error.statusCode = response.status;
    throw error;
  }

  const parsedText = String(
    data?.candidates?.[0]?.content?.parts?.find((part) => typeof part?.text === 'string')?.text || ''
  ).trim();

  if (!parsedText) {
    throw new Error('Gemini returned an empty response.');
  }

  const normalized = parseJsonDraft(parsedText);
  return {
    provider: 'gemini',
    model: GEMINI_IDEA_MODEL,
    suggestion: {
      ...normalized,
      title: normalized.title || keepTitleWithinWordLimit(project.title || project.team_name) || 'Untitled Idea',
      domain: normalized.domain || project.domain || 'General',
    },
  };
}

async function generateIdeaAssistantChatWithOpenAI({ project, messages, currentDraft }) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is not configured on the backend.');
    error.statusCode = 503;
    throw error;
  }

  const content = [
    {
      type: 'input_text',
      text: buildIdeaAssistantConversationText({ project, currentDraft, messages }),
    },
  ];

  const recentImages = collectRecentImageAttachments(messages);
  for (const attachment of recentImages) {
    content.push({
      type: 'input_image',
      image_url: attachment.dataUrl,
    });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_IDEA_MODEL,
      reasoning: { effort: 'low' },
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: buildIdeaAssistantChatSystemPrompt() }],
        },
        {
          role: 'user',
          content,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'idea_workspace_chat',
          strict: true,
          schema: IDEA_ASSISTANT_CHAT_SCHEMA,
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Failed to generate AI idea chat response.');
    error.statusCode = response.status;
    throw error;
  }

  const parsedText = parseAssistantResponseText(data);
  if (!parsedText) {
    throw new Error('AI assistant returned an empty chat response.');
  }

  return {
    provider: 'openai',
    model: OPENAI_IDEA_MODEL,
    ...parseJsonChatResponse(parsedText, project),
  };
}

async function generateIdeaAssistantChatWithOllama({ project, messages, currentDraft }) {
  const message = {
    role: 'user',
    content: buildIdeaAssistantConversationText({ project, currentDraft, messages }),
  };

  const recentImages = collectRecentImageAttachments(messages)
    .map((attachment) => extractBase64Image(attachment.dataUrl))
    .filter(Boolean);
  if (recentImages.length) {
    message.images = recentImages;
  }

  let response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_IDEA_MODEL,
        stream: false,
        format: IDEA_ASSISTANT_CHAT_SCHEMA,
        options: {
          temperature: 0.3,
        },
        messages: [
          {
            role: 'system',
            content: buildIdeaAssistantChatSystemPrompt(),
          },
          message,
        ],
      }),
    });
  } catch {
    const error = new Error(
      'Ollama is not running. Install Ollama, start it, and pull the configured model before using the AI assistant.'
    );
    error.statusCode = 503;
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || 'Failed to generate AI idea chat response with Ollama.');
    error.statusCode = response.status;
    throw error;
  }

  const parsedText = String(data?.message?.content || '').trim();
  if (!parsedText) {
    throw new Error('Ollama returned an empty chat response.');
  }

  return {
    provider: 'ollama',
    model: OLLAMA_IDEA_MODEL,
    ...parseJsonChatResponse(parsedText, project),
  };
}

async function generateIdeaAssistantChatWithGemini({ project, messages, currentDraft }) {
  if (!GOOGLE_API_KEY) {
    const error = new Error('GOOGLE_API_KEY is not configured on the backend.');
    error.statusCode = 503;
    throw error;
  }

  const parts = [
    {
      text: buildIdeaAssistantConversationText({ project, currentDraft, messages }),
    },
  ];

  const recentImages = collectRecentImageAttachments(messages);
  for (const attachment of recentImages) {
    const base64Image = extractBase64Image(attachment.dataUrl);
    if (!base64Image) continue;
    parts.push({
      inlineData: {
        mimeType: attachment.mimeType || extractImageMimeType(attachment.dataUrl),
        data: base64Image,
      },
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_IDEA_MODEL)}:generateContent?key=${encodeURIComponent(GOOGLE_API_KEY)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildIdeaAssistantChatSystemPrompt() }],
        },
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_IDEA_ASSISTANT_CHAT_SCHEMA,
        },
      }),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage =
      data?.error?.message ||
      data?.error?.status ||
      'Failed to generate AI idea chat response with Gemini.';
    const error = new Error(errorMessage);
    error.statusCode = response.status;
    throw error;
  }

  const parsedText = String(
    data?.candidates?.[0]?.content?.parts?.find((part) => typeof part?.text === 'string')?.text || ''
  ).trim();

  if (!parsedText) {
    throw new Error('Gemini returned an empty chat response.');
  }

  return {
    provider: 'gemini',
    model: GEMINI_IDEA_MODEL,
    ...parseJsonChatResponse(parsedText, project),
  };
}

async function generateIdeaAssistantDraft({ project, prompt, imageDataUrl, currentDraft }) {
  if (IDEA_ASSISTANT_PROVIDER === 'gemini') {
    return generateIdeaAssistantDraftWithGemini({ project, prompt, imageDataUrl, currentDraft });
  }

  if (IDEA_ASSISTANT_PROVIDER === 'ollama') {
    return generateIdeaAssistantDraftWithOllama({ project, prompt, imageDataUrl, currentDraft });
  }

  return generateIdeaAssistantDraftWithOpenAI({ project, prompt, imageDataUrl, currentDraft });
}

async function generateIdeaAssistantChat({ project, messages, currentDraft }) {
  if (IDEA_ASSISTANT_PROVIDER === 'gemini') {
    return generateIdeaAssistantChatWithGemini({ project, messages, currentDraft });
  }

  if (IDEA_ASSISTANT_PROVIDER === 'ollama') {
    return generateIdeaAssistantChatWithOllama({ project, messages, currentDraft });
  }

  return generateIdeaAssistantChatWithOpenAI({ project, messages, currentDraft });
}

export const getProjectIdeaChats = async (req, res) => {
  try {
    const chats = await listProjectIdeaChats(req.params.id);
    res.json(chats);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

export const createProjectIdeaChatSession = async (req, res) => {
  try {
    const chat = await createProjectIdeaChatRecord(req.params.id);
    res.status(201).json(chat);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

export const getProjectIdeaChatMessages = async (req, res) => {
  try {
    const { chat } = await assertStudentCanAccessProjectChat(req.params.chatId, req.user.id);
    const messages = await listProjectIdeaChatMessages(chat.id);

    res.json({
      chat,
      messages,
      latest_draft: chat.latest_draft || null,
      readiness: 'exploring',
      follow_up_questions: [],
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

export const renameProjectIdeaChatSession = async (req, res) => {
  try {
    const title = normalizeTextField(req.body?.title, { required: true, maxLength: 120 });
    if (!title) {
      return res.status(400).json({ message: 'Chat title is required.' });
    }

    const { chat } = await assertStudentCanAccessProjectChat(req.params.chatId, req.user.id);
    const updatedChat = await updateProjectIdeaChatSession(chat.id, { title });
    res.json(updatedChat);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

export const deleteProjectIdeaChatSession = async (req, res) => {
  try {
    const { chat } = await assertStudentCanAccessProjectChat(req.params.chatId, req.user.id);
    await deleteProjectIdeaChatSessionRecord(chat.id);
    res.status(204).send();
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

export const sendProjectIdeaChatMessage = async (req, res) => {
  try {
    const message = normalizeTextField(req.body?.message, { maxLength: 2500 });
    const attachment = req.body?.attachment && typeof req.body.attachment === 'object'
      ? {
          name: normalizeTextField(req.body.attachment?.name, { maxLength: 120 }) || 'Attachment',
          mimeType: normalizeTextField(req.body.attachment?.mimeType, { maxLength: 120 }) || 'application/octet-stream',
          dataUrl: normalizeTextField(req.body.attachment?.dataUrl, { maxLength: 10_000_000 }) || '',
        }
      : null;
    const requestCurrentDraft = req.body?.currentDraft || {};

    if (!message && !attachment?.dataUrl) {
      return res.status(400).json({ message: 'Send a message or upload an attachment before asking the assistant.' });
    }

    if (attachment?.dataUrl && !/^data:[a-zA-Z0-9.+/-]+\/[a-zA-Z0-9.+-]+;base64,/.test(attachment.dataUrl)) {
      return res.status(400).json({ message: 'Unsupported attachment format.' });
    }

    const { chat, project } = await assertStudentCanAccessProjectChat(req.params.chatId, req.user.id);
    const persistedMessages = await listProjectIdeaChatMessages(chat.id);
    const normalizedPersistedMessages = sanitizeAssistantMessages(persistedMessages);
    const attachments = attachment?.dataUrl ? [await enrichAttachmentForChat(attachment)].filter(Boolean) : [];
    const nextMessages = [
      ...normalizedPersistedMessages,
      {
        role: 'user',
        content: message || `Please analyze the attached ${attachment?.mimeType?.startsWith('image/') ? 'image' : 'file'} and help refine the idea.`,
        attachments,
      },
    ];

    const currentDraft = buildAssistantCurrentDraft({
      title: requestCurrentDraft?.title || chat?.latest_draft?.title || project.title || '',
      description: requestCurrentDraft?.description || chat?.latest_draft?.description || project.description || '',
      technologies: requestCurrentDraft?.technologies || chat?.latest_draft?.technologies || project.technology_stacks,
      domain: requestCurrentDraft?.domain || chat?.latest_draft?.domain || project.domain || '',
      subdomain: requestCurrentDraft?.subdomain || chat?.latest_draft?.subdomain || '',
      confidence_score: requestCurrentDraft?.confidence_score ?? chat?.latest_draft?.confidence_score ?? 0,
      keywords: requestCurrentDraft?.keywords || chat?.latest_draft?.keywords || [],
    }, project);

    const assistantReply = await generateIdeaAssistantChat({
      project,
      messages: nextMessages,
      currentDraft,
    });

    const savedUserMessage = await createProjectIdeaChatMessage(
      chat.id,
      'user',
      message || `Please analyze the attached ${attachment?.mimeType?.startsWith('image/') ? 'image' : 'file'} and help refine the idea.`,
      attachments
    );
    const savedAssistantMessage = await createProjectIdeaChatMessage(
      chat.id,
      'assistant',
      assistantReply.message
    );

    const nextTitle =
      chat.title
      || deriveChatTitleFromMessages(nextMessages, assistantReply?.draft_patch, 'New Idea Chat')
      || 'New Idea Chat';
    const updatedChat = await updateProjectIdeaChatSession(chat.id, {
      title: nextTitle,
      latest_draft: assistantReply.draft_patch,
    });

    res.json({
      chat: updatedChat,
      user_message: savedUserMessage,
      assistant_message: savedAssistantMessage,
      reply: assistantReply.message,
      draft_patch: assistantReply.draft_patch,
      title: updatedChat.title || null,
      readiness: assistantReply.readiness,
      follow_up_questions: assistantReply.follow_up_questions,
      provider: assistantReply.provider,
      model: assistantReply.model,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

export const getProjectIdeas = async (req, res) => {
  try {
    const ideas = await listIdeasForProject(req.params.id);
    res.json(ideas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createProjectIdea = async (req, res) => {
  try {
    const title = normalizeTextField(req.body?.title, { required: true, maxLength: 200 });
    const domain = normalizeIdeaDomain(req.body?.domain, { fallback: 'General' });
    const subdomain = normalizeIdeaSubdomain(req.body?.subdomain, { fallback: '' }) || null;
    const description = normalizeTextField(req.body?.description, { maxLength: 3000 });
    const technologies = normalizeTechnologyStacks(req.body?.technologies);
    const confidence_score = normalizeConfidenceScore(req.body?.confidence_score, 0);
    const keywords = normalizeIdeaKeywords(req.body?.keywords);

    if (!title) {
      return res.status(400).json({ message: 'Idea title is required.' });
    }

    const project = await getProjectRow(req.params.id);
    const { data: latestIdea, error: latestIdeaError } = await supabase
      .from('project_ideas')
      .select('version_no')
      .eq('project_id', project.id)
      .order('version_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestIdeaError) throw latestIdeaError;

    const versionNo = Number(latestIdea?.version_no || 0) + 1;
    const { data: inserted, error } = await supabase
      .from('project_ideas')
      .insert({
        project_id: project.id,
        version_no: versionNo,
        title,
        domain,
        subdomain,
        description,
        technologies,
        confidence_score,
        keywords,
        status: 'draft',
        created_by: req.user.id,
      })
      .select(`
        id,
        project_id,
        version_no,
        title,
        domain,
        subdomain,
        description,
        technologies,
        confidence_score,
        keywords,
        status,
        submitted_at,
        created_by,
        created_at,
        updated_at,
        creator:profiles!project_ideas_created_by_fkey(id, full_name, email)
      `)
      .single();

    if (error) throw error;

    if (!project.approved_idea_id) {
      await syncProjectFromIdea(project, inserted, project.approved_idea_id ? project.status : 'draft', {
        currentIdeaId: inserted.id,
        approvedIdeaId: project.approved_idea_id || null,
      });
    } else {
      await syncProjectFromIdea(project, null, project.status, { currentIdeaId: inserted.id });
    }

    res.status(201).json({ ...inserted, reviews: [], latest_review: null });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProjectIdea = async (req, res) => {
  try {
    const title = normalizeTextField(req.body?.title, { required: true, maxLength: 200 });
    const domain = normalizeIdeaDomain(req.body?.domain, { fallback: 'General' });
    const subdomain = normalizeIdeaSubdomain(req.body?.subdomain, { fallback: '' }) || null;
    const description = normalizeTextField(req.body?.description, { maxLength: 3000 });
    const technologies = normalizeTechnologyStacks(req.body?.technologies);
    const confidence_score = normalizeConfidenceScore(req.body?.confidence_score, 0);
    const keywords = normalizeIdeaKeywords(req.body?.keywords);

    const { data: existing, error: ideaError } = await supabase
      .from('project_ideas')
      .select('*')
      .eq('id', req.params.ideaId)
      .eq('project_id', req.params.id)
      .single();

    if (ideaError || !existing) {
      return res.status(404).json({ message: 'Idea not found.' });
    }

    if (!EDITABLE_STATUSES.has(String(existing.status || '').toLowerCase())) {
      return res.status(400).json({ message: 'Only draft or revision ideas can be edited.' });
    }

    if (!title) {
      return res.status(400).json({ message: 'Idea title is required.' });
    }

    const { data: updated, error } = await supabase
      .from('project_ideas')
      .update({
        title,
        domain,
        subdomain,
        description,
        technologies,
        confidence_score,
        keywords,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select(`
        id,
        project_id,
        version_no,
        title,
        domain,
        subdomain,
        description,
        technologies,
        confidence_score,
        keywords,
        status,
        submitted_at,
        created_by,
        created_at,
        updated_at,
        creator:profiles!project_ideas_created_by_fkey(id, full_name, email)
      `)
      .single();

    if (error) throw error;

    const project = await getProjectRow(req.params.id);
    if (!project.approved_idea_id && project.current_idea_id === updated.id) {
      await syncProjectFromIdea(project, updated, project.approved_idea_id ? project.status : 'draft', {
        currentIdeaId: updated.id,
        approvedIdeaId: project.approved_idea_id || null,
      });
    }

    const reviews = await fetchIdeaReviews([updated.id]);
    res.json(attachReviewHistory([updated], reviews)[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const submitProjectIdea = async (req, res) => {
  try {
    const { data: idea, error: ideaError } = await supabase
      .from('project_ideas')
      .select('*')
      .eq('id', req.params.ideaId)
      .eq('project_id', req.params.id)
      .single();

    if (ideaError || !idea) {
      return res.status(404).json({ message: 'Idea not found.' });
    }

    if (!EDITABLE_STATUSES.has(String(idea.status || '').toLowerCase())) {
      return res.status(400).json({ message: 'Only draft or revision ideas can be submitted.' });
    }

    const { data: updated, error } = await supabase
      .from('project_ideas')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', idea.id)
      .select(`
        id,
        project_id,
        version_no,
        title,
        domain,
        subdomain,
        description,
        technologies,
        confidence_score,
        keywords,
        status,
        submitted_at,
        created_by,
        created_at,
        updated_at,
        creator:profiles!project_ideas_created_by_fkey(id, full_name, email)
      `)
      .single();

    if (error) throw error;

    const project = await getProjectRow(req.params.id);
    await syncProjectFromIdea(project, updated, 'submitted', {
      currentIdeaId: updated.id,
      approvedIdeaId: project.approved_idea_id || null,
    });

    const autoEvaluation = await scoreIdeaSubmissionWithAI(updated);
    await saveAutoIdeaEvaluation({
      projectId: project.id,
      evaluatorId: req.user.id,
      evaluation: autoEvaluation,
    });

    await notifyMentorsOfSubmission(project, project.team_name || project.title, updated, safeProfileName(req.userProfile, 'Student'));

    const reviews = await fetchIdeaReviews([updated.id]);
    res.json({
      ...attachReviewHistory([updated], reviews)[0],
      auto_evaluation: autoEvaluation,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const generateProjectIdeaDraft = async (req, res) => {
  try {
    const prompt = normalizeTextField(req.body?.prompt, { maxLength: 4000 });
    const imageDataUrl = normalizeTextField(req.body?.imageDataUrl, { maxLength: 10_000_000 });
    const currentDraft = {
      title: normalizeTextField(req.body?.currentDraft?.title, { maxLength: 200 }) || '',
      description: normalizeTextField(req.body?.currentDraft?.description, { maxLength: 3000 }) || '',
      technologies: normalizeTechnologyStacks(req.body?.currentDraft?.technologies),
      domain: normalizeIdeaDomain(req.body?.currentDraft?.domain, { fallback: '' }) || '',
    };

    if (!prompt && !imageDataUrl) {
      return res.status(400).json({ message: 'Add notes or upload an image before asking the assistant.' });
    }

    if (imageDataUrl && !/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(imageDataUrl)) {
      return res.status(400).json({ message: 'Only image uploads are supported for AI analysis.' });
    }

    const project = await getProjectRow(req.params.id);
    const assistantDraft = await generateIdeaAssistantDraft({
      project,
      prompt,
      imageDataUrl,
      currentDraft,
    });

    res.json({
      suggestion: assistantDraft.suggestion,
      model: assistantDraft.model,
      provider: assistantDraft.provider,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

export const generateProjectIdeaChat = async (req, res) => {
  try {
    const message = normalizeTextField(req.body?.message, { maxLength: 2500 });
    const imageDataUrl = normalizeTextField(req.body?.imageDataUrl, { maxLength: 10_000_000 });
    const requestCurrentDraft = req.body?.currentDraft || {};
    if (!message && !imageDataUrl) {
      return res.status(400).json({ message: 'Send a message or upload an image before asking the assistant.' });
    }

    if (imageDataUrl && !/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(imageDataUrl)) {
      return res.status(400).json({ message: 'Only image uploads are supported for AI analysis.' });
    }

    const { idea, project } = await assertStudentCanAccessIdea(req.params.ideaId, req.user.id);
    const chat = await ensureIdeaAssistantChat(idea.id);
    const persistedMessages = await listIdeaAssistantMessages(chat.id);
    const normalizedPersistedMessages = sanitizeAssistantMessages(persistedMessages);
    const nextMessages = [
      ...normalizedPersistedMessages,
      {
        role: 'user',
        content: message || `Please analyze the attached image for idea version ${idea.version_no}.`,
      },
    ];
    const currentDraft = buildAssistantCurrentDraft({
      title: requestCurrentDraft?.title || chat?.latest_draft?.title || idea.title || '',
      description: requestCurrentDraft?.description || chat?.latest_draft?.description || idea.description || '',
      technologies: requestCurrentDraft?.technologies || chat?.latest_draft?.technologies || idea.technologies,
      domain: requestCurrentDraft?.domain || chat?.latest_draft?.domain || idea.domain || '',
      subdomain: requestCurrentDraft?.subdomain || chat?.latest_draft?.subdomain || '',
      confidence_score: requestCurrentDraft?.confidence_score ?? chat?.latest_draft?.confidence_score ?? 0,
      keywords: requestCurrentDraft?.keywords || chat?.latest_draft?.keywords || [],
    }, project);

    const assistantReply = await generateIdeaAssistantChat({
      project,
      messages: nextMessages,
      imageDataUrl,
      currentDraft,
    });

    const savedUserMessage = await createIdeaAssistantMessage(
      chat.id,
      'user',
      message || `Please analyze the attached image for idea version ${idea.version_no}.`
    );
    const savedAssistantMessage = await createIdeaAssistantMessage(
      chat.id,
      'assistant',
      assistantReply.message
    );

    const nextTitle =
      chat.title
      || deriveChatTitleFromMessages(nextMessages, assistantReply?.draft_patch, `Idea Chat V${idea.version_no}`)
      || `Idea Chat V${idea.version_no}`;
    const updatedChat = await updateIdeaAssistantChat(chat.id, {
      title: nextTitle,
      latest_draft: assistantReply.draft_patch,
    });

    res.json({
      chat: updatedChat,
      user_message: savedUserMessage,
      assistant_message: savedAssistantMessage,
      draft_patch: assistantReply.draft_patch,
      readiness: assistantReply.readiness,
      follow_up_questions: assistantReply.follow_up_questions,
      provider: assistantReply.provider,
      model: assistantReply.model,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

export const getProjectIdeaChat = async (req, res) => {
  try {
    const { idea } = await assertStudentCanAccessIdea(req.params.ideaId, req.user.id);
    const chat = await getIdeaAssistantChat(idea.id);

    if (!chat) {
      return res.json({
        chat: null,
        messages: [],
        latest_draft: null,
        readiness: 'exploring',
        follow_up_questions: [],
      });
    }

    const messages = await listIdeaAssistantMessages(chat.id);
    res.json({
      chat,
      messages,
      latest_draft: chat.latest_draft || null,
      readiness: 'exploring',
      follow_up_questions: [],
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

export const getMentorIdeas = async (req, res) => {
  try {
    const { data: projectRows, error: projectError } = await supabase
      .from('projects')
      .select('id, title, team_name, status, guide_id, mentor_id, coordinator_id')
      .or(`guide_id.eq.${req.user.id},mentor_id.eq.${req.user.id},coordinator_id.eq.${req.user.id}`);

    if (projectError) throw projectError;

    const projectIds = (projectRows || []).map((row) => row.id).filter(Boolean);
    if (!projectIds.length) return res.json([]);

    const projectMap = new Map((projectRows || []).map((row) => [row.id, row]));
    const { data: ideas, error } = await supabase
      .from('project_ideas')
      .select(`
        id,
        project_id,
        version_no,
        title,
        domain,
        subdomain,
        description,
        technologies,
        confidence_score,
        keywords,
        status,
        submitted_at,
        created_by,
        created_at,
        updated_at,
        creator:profiles!project_ideas_created_by_fkey(id, full_name, email)
      `)
      .in('project_id', projectIds)
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    const reviews = await fetchIdeaReviews((ideas || []).map((idea) => idea.id));
    const enriched = attachReviewHistory(ideas || [], reviews).map((idea) => ({
      ...idea,
      project: projectMap.get(idea.project_id) || null,
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const reviewProjectIdea = async (req, res) => {
  try {
    const action = normalizeIdeaStatus(req.body?.action, REVIEW_ACTIONS);
    const comment = normalizeTextField(req.body?.comment, { maxLength: 3000 });

    if (!action) {
      return res.status(400).json({ message: 'Valid review action is required.' });
    }

    const { data: ideaRow, error: ideaError } = await supabase
      .from('project_ideas')
      .select(`
        *,
        project:projects!project_ideas_project_id_fkey(
          id,
          title,
          team_name,
          status,
          guide_id,
          mentor_id,
          coordinator_id,
          current_idea_id,
          approved_idea_id
        )
      `)
      .eq('id', req.params.ideaId)
      .single();

    if (ideaError || !ideaRow?.project) {
      return res.status(404).json({ message: 'Idea not found.' });
    }

    if (!mentorCanReviewProject(ideaRow.project, req)) {
      return res.status(403).json({ message: 'You do not have access to review this idea.' });
    }

    if (action === 'approved') {
      const { error: demoteError } = await supabase
        .from('project_ideas')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('project_id', ideaRow.project_id)
        .eq('status', 'approved')
        .neq('id', ideaRow.id);

      if (demoteError) throw demoteError;
    }

    const { data: review, error: reviewError } = await supabase
      .from('idea_reviews')
      .insert({
        idea_id: ideaRow.id,
        reviewer_id: req.user.id,
        action,
        comment,
      })
      .select(`
        id,
        idea_id,
        reviewer_id,
        action,
        comment,
        created_at,
        reviewer:profiles!idea_reviews_reviewer_id_fkey(id, full_name, email)
      `)
      .single();

    if (reviewError) throw reviewError;

    const { data: updatedIdea, error: ideaUpdateError } = await supabase
      .from('project_ideas')
      .update({
        status: action,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ideaRow.id)
      .select(`
        id,
        project_id,
        version_no,
        title,
        domain,
        subdomain,
        description,
        technologies,
        confidence_score,
        keywords,
        status,
        submitted_at,
        created_by,
        created_at,
        updated_at,
        creator:profiles!project_ideas_created_by_fkey(id, full_name, email)
      `)
      .single();

    if (ideaUpdateError) throw ideaUpdateError;

    const approvedIdeaId = action === 'approved'
      ? updatedIdea.id
      : ideaRow.project.approved_idea_id === updatedIdea.id
        ? null
        : ideaRow.project.approved_idea_id || null;

    await syncProjectFromIdea(ideaRow.project, updatedIdea, action, {
      currentIdeaId: updatedIdea.id,
      approvedIdeaId,
    });

    await notifyTeamOfReview(
      ideaRow.project_id,
      action,
      comment,
      safeProfileName(req.userProfile, 'Mentor'),
      updatedIdea.title
    );

    res.json({
      ...updatedIdea,
      latest_review: review,
      reviews: [review],
      project: ideaRow.project,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
