import { supabaseAdmin } from '../config/supabase.js';

const supabase = supabaseAdmin;

const IDEA_STATUSES = new Set(['draft', 'submitted', 'revision_required', 'approved', 'rejected']);
const EDITABLE_STATUSES = new Set(['draft', 'revision_required', 'rejected']);
const REVIEW_ACTIONS = new Set(['approved', 'rejected', 'revision_required']);
const PROJECT_STATUS_MAP = {
  draft: 'pending',
  submitted: 'pending',
  revision_required: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  completed: 'completed',
};

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

const normalizeIdeaStatus = (value, allowed = IDEA_STATUSES) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!allowed.has(normalized)) return null;
  return normalized;
};

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
      description,
      technologies,
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
    .select('id, title, team_name, description, technology_stacks, status, guide_id, mentor_id, coordinator_id, approved_idea_id, current_idea_id')
    .eq('id', projectId)
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
    const description = normalizeTextField(req.body?.description, { maxLength: 3000 });
    const technologies = normalizeTechnologyStacks(req.body?.technologies);

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
        description,
        technologies,
        status: 'draft',
        created_by: req.user.id,
      })
      .select(`
        id,
        project_id,
        version_no,
        title,
        description,
        technologies,
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
    const description = normalizeTextField(req.body?.description, { maxLength: 3000 });
    const technologies = normalizeTechnologyStacks(req.body?.technologies);

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
        description,
        technologies,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select(`
        id,
        project_id,
        version_no,
        title,
        description,
        technologies,
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
        description,
        technologies,
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

    await notifyMentorsOfSubmission(project, project.team_name || project.title, updated, safeProfileName(req.userProfile, 'Student'));

    const reviews = await fetchIdeaReviews([updated.id]);
    res.json(attachReviewHistory([updated], reviews)[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
        description,
        technologies,
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
        description,
        technologies,
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
