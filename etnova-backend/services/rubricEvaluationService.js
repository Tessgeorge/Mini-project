import { supabaseAdmin } from '../config/supabase.js';

const supabase = supabaseAdmin;

export const EVALUATION_STAGE_CONFIG = {
  review: { table: 'review_marks', total: 40, label: 'Review' },
  guide: { table: 'guide_marks', total: 15, label: 'Guide' },
  ese: { table: 'ese_marks', total: 75, label: 'External' },
};

const STAGE_ORDER = ['review', 'guide', 'ese'];
const REVIEW_ROUNDS = ['zeroth_review', 'first_review', 'second_review', 'final_review'];
const REVIEW_TOTAL_ROUNDS = ['zeroth_review', 'first_review', 'second_review'];
const INTERNAL_LIMITS = {
  attendance: 10,
  report: 10,
};
const GUIDE_TOTAL_RUBRIC = {
  id: 'guide-total',
  stage: 'guide',
  title: 'Guide Total',
  max_marks: 15,
  order_no: 1,
  is_active: true,
};
const DEFAULT_REVIEW_RUBRICS = [
  { title: 'Problem Statement', max_marks: 5, order_no: 1, is_active: true },
  { title: 'Requirement Analysis', max_marks: 10, order_no: 2, is_active: true },
  { title: 'Design', max_marks: 10, order_no: 3, is_active: true },
  { title: 'Module Description', max_marks: 5, order_no: 4, is_active: true },
  { title: 'Technology Stack', max_marks: 5, order_no: 5, is_active: true },
  { title: 'Presentation', max_marks: 5, order_no: 6, is_active: true },
];
const DEFAULT_ZEROTH_REVIEW_RUBRICS = [
  { title: 'Problem Statement', max_marks: 10, order_no: 1, is_active: true },
  { title: 'Requirement Analysis', max_marks: 15, order_no: 2, is_active: true },
  { title: 'Technology Stack', max_marks: 10, order_no: 3, is_active: true },
  { title: 'Presentation', max_marks: 5, order_no: 4, is_active: true },
];
const DEFAULT_EXTERNAL_RUBRICS = [
  { title: 'Presentation', max_marks: 30, order_no: 1, is_active: true },
  { title: 'Demo', max_marks: 20, order_no: 2, is_active: true },
  { title: 'Viva', max_marks: 25, order_no: 3, is_active: true },
];

const createHttpError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeLockReviewStage = (stage, reviewStage = null) => {
  if (stage === 'ese') return 'final_review';
  if (stage === 'review') return normalizeReviewStage(reviewStage);
  return null;
};

const applyOptionalReviewStageFilter = (query, reviewStage) => (
  reviewStage == null ? query.is('review_stage', null) : query.eq('review_stage', reviewStage)
);

const roundMarks = (value) => Number(Number(value || 0).toFixed(2));

const getReviewRubricCounts = async () => {
  const [zerothRubrics, sharedRubrics] = await Promise.all([
    getActiveRubricsByStage('review', 'zeroth_review'),
    getActiveRubricsByStage('review', 'first_review'),
  ]);

  return {
    zeroth_review: zerothRubrics.length,
    first_review: sharedRubrics.length,
    second_review: sharedRubrics.length,
    final_review: 0,
  };
};

const buildReviewRoundAverages = async (rows = []) => {
  const rubricCounts = await getReviewRubricCounts();
  const roundAverages = {};

  REVIEW_ROUNDS.forEach((reviewStage) => {
    const expectedRubricCount = Number(rubricCounts?.[reviewStage] || 0);
    if (expectedRubricCount <= 0) return;

    const roundRows = (rows || []).filter((row) => row.review_stage === reviewStage);
    if (!roundRows.length) return;

    const reviewerBuckets = new Map();
    roundRows.forEach((row) => {
      const reviewerKey = row.evaluator_id || `anonymous:${reviewStage}`;
      if (!reviewerBuckets.has(reviewerKey)) {
        reviewerBuckets.set(reviewerKey, {
          total: 0,
          rubricIds: new Set(),
        });
      }
      const bucket = reviewerBuckets.get(reviewerKey);
      bucket.total += Number(row.marks || 0);
      if (row.rubric_id) bucket.rubricIds.add(row.rubric_id);
    });

    const completedTotals = [...reviewerBuckets.values()]
      .filter((bucket) => bucket.rubricIds.size === expectedRubricCount)
      .map((bucket) => bucket.total);

    if (completedTotals.length > 0) {
      roundAverages[reviewStage] = roundMarks(
        completedTotals.reduce((sum, value) => sum + value, 0) / completedTotals.length
      );
    }
  });

  return roundAverages;
};

const getCompletedEvaluatorRows = (rows = [], expectedRubricCount = 0) => {
  if (!expectedRubricCount || expectedRubricCount <= 0) return [];

  const evaluatorBuckets = new Map();
  (rows || []).forEach((row) => {
    const evaluatorKey = row.evaluator_id || 'anonymous';
    if (!evaluatorBuckets.has(evaluatorKey)) {
      evaluatorBuckets.set(evaluatorKey, {
        rows: [],
        rubricIds: new Set(),
      });
    }
    const bucket = evaluatorBuckets.get(evaluatorKey);
    bucket.rows.push(row);
    if (row.rubric_id) bucket.rubricIds.add(row.rubric_id);
  });

  return [...evaluatorBuckets.values()]
    .filter((bucket) => bucket.rubricIds.size === expectedRubricCount)
    .flatMap((bucket) => bucket.rows);
};

const buildSimpleStageAverageTotal = async ({ stage, studentId }) => {
  const rubrics = await getActiveRubricsByStage(stage);
  const expectedRubricCount = rubrics.length;
  if (expectedRubricCount === 0) return 0;

  const { data, error } = await supabase
    .from(EVALUATION_STAGE_CONFIG[stage].table)
    .select('rubric_id, marks, evaluator_id')
    .eq('student_id', studentId);

  if (error) throw error;

  const completedRows = getCompletedEvaluatorRows(data || [], expectedRubricCount);
  if (completedRows.length === 0) return 0;

  const evaluatorTotals = new Map();
  completedRows.forEach((row) => {
    const evaluatorKey = row.evaluator_id || 'anonymous';
    evaluatorTotals.set(evaluatorKey, (evaluatorTotals.get(evaluatorKey) || 0) + Number(row.marks || 0));
  });

  const totals = [...evaluatorTotals.values()];
  return totals.length
    ? roundMarks(totals.reduce((sum, value) => sum + value, 0) / totals.length)
    : 0;
};

const createNotifications = async (rows) => {
  const validRows = (rows || []).filter((row) => row?.user_id && row?.title && row?.message && row?.type);
  if (!validRows.length) return;
  const { error } = await supabase.from('notifications').insert(validRows);
  if (error) throw error;
};

const getStageConfig = (stage) => {
  const normalizedStage = String(stage || '').trim().toLowerCase();
  const config = EVALUATION_STAGE_CONFIG[normalizedStage];
  if (!config) {
    throw createHttpError('Invalid evaluation stage.', 400);
  }
  return { stage: normalizedStage, ...config };
};

const normalizeReviewStage = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!REVIEW_ROUNDS.includes(normalized)) {
    throw createHttpError('Review round must be zeroth_review, first_review, second_review, or final_review.', 400);
  }
  return normalized;
};

const formatReviewStageLabel = (value) => {
  if (value === 'zeroth_review') return 'Zeroth Review';
  if (value === 'first_review') return 'First Review';
  if (value === 'second_review') return 'Second Review';
  if (value === 'final_review') return 'Final Review';
  return value;
};

const getRubricReviewRound = (stage, reviewStage = null) => {
  if (stage !== 'review') return null;
  if (!reviewStage) return null;
  const normalizedReviewStage = normalizeReviewStage(reviewStage);
  return normalizedReviewStage === 'zeroth_review' ? 'zeroth_review' : null;
};

const getProjectTeamMemberIds = async (projectId) => {
  const { data, error } = await supabase
    .from('team_members')
    .select('student_id')
    .eq('project_id', projectId);

  if (error) throw error;
  return [...new Set((data || []).map((row) => row.student_id).filter(Boolean))];
};

export const publishCoordinatorMarks = async ({ classId, publishType }) => {
  const studentIds = await getClassStudentIds(classId);
  if (studentIds.length === 0) return { updatedCount: 0 };

  const { data: finalRows, error: fetchError } = await supabase
    .from('final_results')
    .select('student_id, status')
    .in('student_id', studentIds);

  if (fetchError) throw fetchError;

  let count = 0;
  for (const row of (finalRows || [])) {
    let newStatus = row.status;
    if (publishType === 'internal') {
      if (newStatus === 'sent_to_admin' || newStatus === 'internal_and_sent') newStatus = 'internal_and_sent';
      else newStatus = 'internal_published';
    } else if (publishType === 'admin') {
      if (newStatus === 'internal_published' || newStatus === 'internal_and_sent') newStatus = 'internal_and_sent';
      else newStatus = 'sent_to_admin';
    } else if (publishType === 'unpublish_internal') {
      // Revoke internal marks - can revoke even after admin publishes final
      if (newStatus === 'internal_and_sent') newStatus = 'published';
      else if (newStatus === 'internal_published') newStatus = 'frozen';
    } else if (publishType === 'unpublish_admin') {
      if (newStatus === 'internal_and_sent') newStatus = 'internal_published';
      else if (newStatus === 'sent_to_admin') newStatus = 'frozen';
    }

    if (newStatus !== row.status) {
      await supabase.from('final_results').update({ status: newStatus }).eq('student_id', row.student_id);
      count++;
    }
  }

  return { updatedCount: count };
};

const getClassStudentIds = async (classId) => {
  const [{ data: projects, error: projectError }, { data: classProfiles, error: profileError }] = await Promise.all([
    supabase
      .from('projects')
      .select('id')
      .eq('class_id', classId),
    supabase
      .from('profiles')
      .select('id')
      .eq('role', 'student')
      .eq('class_id', classId),
  ]);

  if (projectError) throw projectError;
  if (profileError) throw profileError;

  const profileIds = (classProfiles || []).map((row) => row.id).filter(Boolean);
  const projectIds = (projects || []).map((row) => row.id);
  if (projectIds.length === 0) return [...new Set(profileIds)];

  const { data: teamMembers, error: teamError } = await supabase
    .from('team_members')
    .select('student_id')
    .in('project_id', projectIds);

  if (teamError) throw teamError;
  return [...new Set([
    ...profileIds,
    ...(teamMembers || []).map((row) => row.student_id).filter(Boolean),
  ])];
};

const getProjectRow = async (projectId) => {
  const { data, error } = await supabase
    .from('projects')
    .select('id, class_id, title, batch')
    .eq('id', projectId)
    .single();

  if (error || !data) {
    throw createHttpError('Project not found.', 404);
  }

  if (data.class_id && data.batch != null) {
    return data;
  }

  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select(`
      role,
      profiles!team_members_student_id_fkey(class_id, class_section, batch)
    `)
    .eq('project_id', projectId);

  if (membersError || !members?.length) {
    return data;
  }

  const leader = members.find((member) => member.role === 'leader');
  const anchor = leader?.profiles || members[0]?.profiles || null;

  return {
    ...data,
    class_id: data.class_id || anchor?.class_id || null,
    batch: data.batch ?? anchor?.batch ?? null,
  };
};

const hasActiveReviewerStageAccess = async ({ project, evaluatorId, reviewStage }) => {
  if (!project?.class_id || !evaluatorId || !reviewStage) return false;

  const { data, error } = await supabase
    .from('reviewer_access')
    .select('id, batch, is_open')
    .eq('class_id', project.class_id)
    .eq('mentor_id', evaluatorId)
    .eq('stage', reviewStage)
    .eq('is_open', true);

  if (error) throw error;

  const accessRows = data || [];
  if (!accessRows.length) return false;

  if (project.batch == null) {
    return accessRows.some((row) => row.batch == null);
  }

  return accessRows.some((row) => row.batch == null || Number(row.batch) === Number(project.batch));
};

const sendStageFeedbackNotifications = async ({ projectId, stage, reviewStage = null, feedbackEntries, senderName }) => {
  const cleanedEntries = (feedbackEntries || [])
    .map((entry) => ({
      student_id: entry?.student_id,
      feedback: String(entry?.feedback || '').trim(),
    }))
    .filter((entry) => entry.student_id && entry.feedback);

  if (!cleanedEntries.length) return;

  const studentIds = [...new Set(cleanedEntries.map((entry) => entry.student_id))];
  const teamMemberIds = new Set(await getProjectTeamMemberIds(projectId));
  const safeEntries = cleanedEntries.filter((entry) => teamMemberIds.has(entry.student_id));
  if (!safeEntries.length) return;

  const project = await getProjectRow(projectId);
  const actorName = String(senderName || (stage === 'guide' ? 'Guide' : 'Reviewer')).trim() || (stage === 'guide' ? 'Guide' : 'Reviewer');
  const projectTitle = project?.title || 'your project';
  const feedbackType = stage === 'guide' ? 'guide_individual_feedback' : 'review_individual_feedback';
  const feedbackTitle = stage === 'guide'
    ? 'Guide Feedback Received'
    : `${formatReviewStageLabel(reviewStage || 'review')} Feedback Received`;
  const feedbackMessagePrefix = stage === 'guide'
    ? `${actorName} shared individual guide feedback for ${projectTitle}:`
    : `${actorName} shared individual ${formatReviewStageLabel(reviewStage || 'review')} feedback for ${projectTitle}:`;

  await createNotifications(safeEntries.map((entry) => ({
    user_id: entry.student_id,
    type: feedbackType,
    title: feedbackTitle,
    message: `${feedbackMessagePrefix} ${entry.feedback}`,
  })));
};

const getClassDeadlineMap = async (classId) => {
  if (!classId) return {};

  const { data, error } = await supabase
    .from('class_submission_deadlines')
    .select('stage, deadline')
    .eq('class_id', classId)
    .in('stage', STAGE_ORDER);

  if (error) throw error;

  return (data || []).reduce((acc, row) => {
    acc[row.stage] = row.deadline || null;
    return acc;
  }, {});
};

const getSystemDeadlineMap = async () => {
  const keys = STAGE_ORDER.map((stage) => `${stage}_evaluation_deadline`);

  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', keys);

  if (error) return {};

  return (data || []).reduce((acc, row) => {
    const stage = String(row.setting_key || '').replace('_evaluation_deadline', '');
    acc[stage] = row.setting_value || null;
    return acc;
  }, {});
};

const getStageDeadline = async ({ stage, classId }) => {
  const classDeadlines = await getClassDeadlineMap(classId);
  if (classDeadlines[stage]) {
    return classDeadlines[stage];
  }

  const systemDeadlines = await getSystemDeadlineMap();
  return systemDeadlines[stage] || null;
};

const isDatePast = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
};

const getStudentClassId = async (studentId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('class_id')
    .eq('id', studentId)
    .single();

  if (error) throw error;
  return data?.class_id || null;
};

const getDeadlineStateForStudent = async (studentId) => {
  const classId = await getStudentClassId(studentId);
  const classDeadlines = await getClassDeadlineMap(classId);
  const systemDeadlines = await getSystemDeadlineMap();

  return STAGE_ORDER.reduce((acc, stage) => {
    const deadline = classDeadlines[stage] || systemDeadlines[stage] || null;
    acc[stage] = {
      deadline,
      locked: isDatePast(deadline),
    };
    return acc;
  }, {});
};

const computeResultStatus = ({ attendanceMarks, reportMarks, reviewTotal, guideTotal, eseTotal, lockedAt, isPublished, existingStatus }) => {
  if (isPublished) return 'published';
  if (existingStatus === 'internal_published') return 'internal_published';
  if (existingStatus === 'sent_to_admin') return 'sent_to_admin';
  if (existingStatus === 'internal_and_sent') return 'internal_and_sent';
  if (lockedAt) return 'frozen';
  if (Number(attendanceMarks) || Number(reportMarks) || Number(reviewTotal) || Number(guideTotal) || Number(eseTotal)) {
    return 'calculated';
  }
  return 'pending';
};

const getFinalResultRow = async (studentId) => {
  const { data, error } = await supabase
    .from('final_results')
    .select('student_id, attendance_marks, report_marks, is_published, status')
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

const sumSimpleStageMarks = async ({ stage, studentId }) => {
  if (stage === 'ese') {
    return buildSimpleStageAverageTotal({ stage, studentId });
  }

  const tableName = EVALUATION_STAGE_CONFIG[stage].table;
  const { data, error } = await supabase
    .from(tableName)
    .select('marks')
    .eq('student_id', studentId);

  if (error) throw error;
  return roundMarks((data || []).reduce((sum, row) => sum + Number(row.marks || 0), 0));
};

const calculateReviewTotal = async (studentId) => {
  const { data, error } = await supabase
    .from('review_marks')
    .select('student_id, rubric_id, marks, evaluator_id, review_stage')
    .eq('student_id', studentId)
    .in('review_stage', REVIEW_ROUNDS);

  if (error) throw error;

  const roundAverages = await buildReviewRoundAverages(data || []);

  const completedRoundValues = REVIEW_ROUNDS
    .filter((reviewStage) => REVIEW_TOTAL_ROUNDS.includes(reviewStage))
    .map((reviewStage) => roundAverages[reviewStage])
    .filter((value) => value != null);

  const reviewTotal = completedRoundValues.length
    ? roundMarks(completedRoundValues.reduce((sum, value) => sum + value, 0) / completedRoundValues.length)
    : 0;

  return {
    reviewTotal,
    roundAverages,
  };
};

const fetchRubricsByStage = async (normalizedStage, { activeOnly = false, reviewStage = null } = {}) => {
  const rubricReviewRound = getRubricReviewRound(normalizedStage, reviewStage);
  let query = supabase
    .from('rubrics')
    .select('id, stage, review_round, title, max_marks, order_no, is_active, created_by, created_at')
    .eq('stage', normalizedStage);

  if (normalizedStage === 'review') {
    query = rubricReviewRound
      ? query.eq('review_round', rubricReviewRound)
      : query.is('review_round', null);
  }

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query
    .order('order_no', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

const ensureDefaultRubricsForStage = async (normalizedStage, reviewStage = null) => {
  if (normalizedStage !== 'review' && normalizedStage !== 'ese') {
    return fetchRubricsByStage(normalizedStage);
  }

  const rubricReviewRound = getRubricReviewRound(normalizedStage, reviewStage);
  const existingRows = await fetchRubricsByStage(normalizedStage, { reviewStage });
  if (existingRows.length > 0) {
    return existingRows;
  }

  const defaultRows = normalizedStage === 'review'
    ? (rubricReviewRound === 'zeroth_review' ? DEFAULT_ZEROTH_REVIEW_RUBRICS : DEFAULT_REVIEW_RUBRICS)
    : DEFAULT_EXTERNAL_RUBRICS;

  const { error } = await supabase
    .from('rubrics')
    .insert(defaultRows.map((row) => ({
      stage: normalizedStage,
      review_round: normalizedStage === 'review' ? rubricReviewRound : null,
      title: row.title,
      max_marks: row.max_marks,
      order_no: row.order_no,
      is_active: row.is_active,
    })));

  if (error) throw error;
  return fetchRubricsByStage(normalizedStage, { reviewStage });
};

export const getActiveRubricsByStage = async (stage, reviewStage = null) => {
  const { stage: normalizedStage } = getStageConfig(stage);
  const rows = await ensureDefaultRubricsForStage(normalizedStage, reviewStage);
  return rows.filter((row) => row.is_active !== false);
};

export const getRubricsForAdmin = async (stage, reviewStage = null) => {
  const { stage: normalizedStage } = getStageConfig(stage);
  return ensureDefaultRubricsForStage(normalizedStage, reviewStage);
};

const validateRubricDefinitions = (stage, rubrics) => {
  const { total } = getStageConfig(stage);

  if (!Array.isArray(rubrics) || rubrics.length === 0) {
    throw createHttpError('At least one rubric is required.', 400);
  }

  const activeRubrics = rubrics.filter((rubric) => rubric?.is_active !== false);
  const activeTotal = activeRubrics.reduce((sum, rubric) => sum + Number(rubric.max_marks || 0), 0);
  if (activeTotal !== total) {
    throw createHttpError(`Active rubric total for ${stage} must equal ${total}.`, 400);
  }

  rubrics.forEach((rubric, index) => {
    if (!String(rubric?.title || '').trim()) {
      throw createHttpError(`Rubric title is required for row ${index + 1}.`, 400);
    }
    if (!Number.isFinite(Number(rubric?.max_marks)) || Number(rubric.max_marks) <= 0) {
      throw createHttpError(`Rubric max marks must be greater than zero for row ${index + 1}.`, 400);
    }
    if (!Number.isInteger(Number(rubric?.order_no))) {
      throw createHttpError(`Rubric order must be an integer for row ${index + 1}.`, 400);
    }
  });
};

export const saveRubricsForStage = async ({ stage, rubrics, adminId, reviewStage = null }) => {
  const { stage: normalizedStage } = getStageConfig(stage);
  validateRubricDefinitions(normalizedStage, rubrics);
  const rubricReviewRound = getRubricReviewRound(normalizedStage, reviewStage);

  const existingRubrics = await getRubricsForAdmin(normalizedStage, reviewStage);
  const existingIds = new Set(existingRubrics.map((rubric) => rubric.id));
  const payloadIds = new Set(rubrics.map((rubric) => rubric.id).filter(Boolean));

  const staleIds = existingRubrics
    .filter((rubric) => !payloadIds.has(rubric.id))
    .map((rubric) => rubric.id);

  if (staleIds.length > 0) {
    const { count, error: marksError } = await supabase
      .from(EVALUATION_STAGE_CONFIG[normalizedStage].table)
      .select('id', { count: 'exact', head: true })
      .in('rubric_id', staleIds);

    if (marksError) throw marksError;
    if ((count || 0) > 0) {
      throw createHttpError('Rubrics with submitted marks cannot be removed. Deactivate them in a balanced rubric set instead.', 409);
    }

    const { error: deleteError } = await supabase
      .from('rubrics')
      .delete()
      .in('id', staleIds);

    if (deleteError) throw deleteError;
  }

  const upsertRows = rubrics.map((rubric) => {
    if (rubric.id && !existingIds.has(rubric.id)) {
      throw createHttpError('One or more rubrics do not belong to this stage.', 400);
    }

    return {
      id: rubric.id || undefined,
      stage: normalizedStage,
      review_round: normalizedStage === 'review' ? rubricReviewRound : null,
      title: String(rubric.title).trim(),
      max_marks: Number(rubric.max_marks),
      order_no: Number(rubric.order_no),
      is_active: rubric.is_active !== false,
      created_by: rubric.id ? undefined : adminId,
    };
  });

  const { error } = await supabase
    .from('rubrics')
    .upsert(upsertRows, { onConflict: 'id' });

  if (error) throw error;

  return getRubricsForAdmin(normalizedStage, reviewStage);
};

export const deleteRubric = async (rubricId) => {
  const { data: rubric, error: rubricError } = await supabase
    .from('rubrics')
    .select('id, stage, review_round')
    .eq('id', rubricId)
    .single();

  if (rubricError || !rubric) {
    throw createHttpError('Rubric not found.', 404);
  }

  const tableName = getStageConfig(rubric.stage).table;
  const { count, error: marksError } = await supabase
    .from(tableName)
    .select('id', { count: 'exact', head: true })
    .eq('rubric_id', rubricId);

  if (marksError) throw marksError;
  if ((count || 0) > 0) {
    throw createHttpError('Rubrics with marks cannot be deleted.', 409);
  }

  const remainingRubrics = (await getRubricsForAdmin(rubric.stage, rubric.review_round)).filter((row) => row.id !== rubricId);
  validateRubricDefinitions(rubric.stage, remainingRubrics);

  const { error } = await supabase
    .from('rubrics')
    .delete()
    .eq('id', rubricId);

  if (error) throw error;
};

const validateMarksPayload = async ({ stage, projectId, entries, reviewStage = null }) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw createHttpError('At least one rubric mark entry is required.', 400);
  }

  const teamMemberIds = new Set(await getProjectTeamMemberIds(projectId));
  if (teamMemberIds.size === 0) {
    throw createHttpError('Project has no team members to evaluate.', 400);
  }

  const normalizedReviewStage = stage === 'review' ? normalizeReviewStage(reviewStage) : null;
  if (stage === 'guide') {
    return entries.map((entry) => {
      const studentId = entry?.student_id;
      const marks = Number(entry?.marks);

      if (!studentId || !teamMemberIds.has(studentId)) {
        throw createHttpError('Marks can only be submitted for students in the selected project.', 403);
      }
      if (!Number.isFinite(marks) || marks < 0 || marks > EVALUATION_STAGE_CONFIG.guide.total) {
        throw createHttpError(`Guide marks must be between 0 and ${EVALUATION_STAGE_CONFIG.guide.total}.`, 400);
      }

      return {
        student_id: studentId,
        rubric_id: null,
        marks,
        review_stage: null,
      };
    });
  }

  const rubrics = await getActiveRubricsByStage(stage, normalizedReviewStage);
  if (rubrics.length === 0) {
    throw createHttpError(`No active rubrics configured for ${stage}.`, 400);
  }

  const rubricMap = new Map(rubrics.map((rubric) => [rubric.id, rubric]));
  const normalizedEntries = entries.map((entry) => {
    const studentId = entry?.student_id;
    const rubricId = entry?.rubric_id;
    const marks = Number(entry?.marks);
    const rubric = rubricMap.get(rubricId);

    if (!studentId || !teamMemberIds.has(studentId)) {
      throw createHttpError('Marks can only be submitted for students in the selected project.', 403);
    }
    if (!rubric) {
      throw createHttpError('Invalid rubric selected for this stage.', 400);
    }
    if (!Number.isFinite(marks) || marks < 0 || marks > Number(rubric.max_marks)) {
      throw createHttpError(`Marks for "${rubric.title}" must be between 0 and ${rubric.max_marks}.`, 400);
    }

    return {
      student_id: studentId,
      rubric_id: rubricId,
      marks,
      review_stage: normalizedReviewStage,
    };
  });

  return normalizedEntries;
};

export const assertStageWritable = async ({ stage, projectId }) => {
  const { stage: normalizedStage } = getStageConfig(stage);
  const project = await getProjectRow(projectId);
  const deadline = await getStageDeadline({ stage: normalizedStage, classId: project.class_id });

  if (isDatePast(deadline)) {
    throw createHttpError(`${normalizedStage.toUpperCase()} marks are locked because the evaluation deadline has passed.`, 423);
  }
};

export const autoCalculateStudent = async (studentId) => {
  const existing = await getFinalResultRow(studentId);
  const attendanceMarks = roundMarks(existing?.attendance_marks ?? 0);
  const reportMarks = roundMarks(existing?.report_marks ?? 0);
  const { reviewTotal } = await calculateReviewTotal(studentId);
  const [guideTotal, eseTotal] = await Promise.all([
    sumSimpleStageMarks({ stage: 'guide', studentId }),
    sumSimpleStageMarks({ stage: 'ese', studentId }),
  ]);

  const cieTotal = roundMarks(attendanceMarks + reportMarks + reviewTotal + guideTotal);
  const finalMarks = roundMarks(cieTotal + eseTotal);
  const deadlineState = await getDeadlineStateForStudent(studentId);
  const fullyLocked = STAGE_ORDER.every((stage) => deadlineState[stage]?.locked);
  const lockedAt = fullyLocked ? new Date().toISOString() : null;

  const status = computeResultStatus({
    attendanceMarks,
    reportMarks,
    reviewTotal,
    guideTotal,
    eseTotal,
    lockedAt,
    isPublished: Boolean(existing?.is_published),
    existingStatus: existing?.status,
  });

  const payload = {
    student_id: studentId,
    attendance_marks: attendanceMarks,
    report_marks: reportMarks,
    review_total: reviewTotal,
    guide_total: guideTotal,
    ese_total: eseTotal,
    cie_total: cieTotal,
    final_marks: finalMarks,
    status,
    locked_at: lockedAt,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('final_results')
    .upsert(payload, { onConflict: 'student_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const autoCalculateProject = async (projectId) => {
  const studentIds = await getProjectTeamMemberIds(projectId);
  return Promise.all(studentIds.map((studentId) => autoCalculateStudent(studentId)));
};

export const upsertStageMarks = async ({ stage, projectId, evaluatorId, entries, reviewStage = null, feedbackEntries = [], senderName = '' }) => {
  const { stage: normalizedStage, table } = getStageConfig(stage);
  const project = await getProjectRow(projectId);
  await assertStageWritable({ stage: normalizedStage, projectId });

  if (normalizedStage === 'review' || normalizedStage === 'ese') {
    const accessReviewStage = normalizedStage === 'ese'
      ? 'final_review'
      : normalizeReviewStage(reviewStage);
    const canWriteReview = await hasActiveReviewerStageAccess({
      project,
      evaluatorId,
      reviewStage: accessReviewStage,
    });

    if (!canWriteReview) {
      throw createHttpError(
        normalizedStage === 'ese'
          ? 'External mark entry is read-only because coordinator access for final review is closed.'
          : 'Review mark entry is read-only because coordinator access for this review round is closed.',
        423
      );
    }
  }

  const entryLock = await getEvaluatorEntryLock({
    projectId,
    evaluatorId,
    stage: normalizedStage,
    reviewStage,
  });
  if (entryLock?.is_locked) {
    throw createHttpError('Marks are locked for this review entry. Unlock to make changes.', 423);
  }

  const normalizedEntries = await validateMarksPayload({
    stage: normalizedStage,
    projectId,
    entries,
    reviewStage,
  });

  const rows = normalizedEntries.map((entry) => {
    const baseRow = {
      student_id: entry.student_id,
      rubric_id: entry.rubric_id,
      marks: entry.marks,
      evaluator_id: evaluatorId,
      updated_at: new Date().toISOString(),
    };

    if (normalizedStage === 'review') {
      return {
        ...baseRow,
        review_stage: entry.review_stage,
      };
    }

    return baseRow;
  });

  if (normalizedStage === 'guide') {
    const affectedStudents = [...new Set(rows.map((row) => row.student_id))];
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq('evaluator_id', evaluatorId)
      .in('student_id', affectedStudents);

    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase
      .from(table)
      .insert(rows);

    if (insertError) throw insertError;
  } else if (normalizedStage === 'ese') {
    const affectedStudents = [...new Set(rows.map((row) => row.student_id))];
    const rubricIds = [...new Set(rows.map((row) => row.rubric_id).filter(Boolean))];

    let deleteQuery = supabase
      .from(table)
      .delete()
      .eq('evaluator_id', evaluatorId)
      .in('student_id', affectedStudents);

    if (rubricIds.length > 0) {
      deleteQuery = deleteQuery.in('rubric_id', rubricIds);
    }

    const { error: deleteError } = await deleteQuery;
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase
      .from(table)
      .insert(rows);

    if (insertError) throw insertError;
  } else {
    const { error } = await supabase
      .from(table)
      .upsert(rows, {
        onConflict: normalizedStage === 'review'
          ? 'student_id,rubric_id,review_stage,evaluator_id'
          : 'student_id,rubric_id',
      });

    if (error) throw error;
  }

  const affectedStudents = [...new Set(rows.map((row) => row.student_id))];
  for (const studentId of affectedStudents) {
    await autoCalculateStudent(studentId);
  }

  if ((normalizedStage === 'guide' || normalizedStage === 'review') && Array.isArray(feedbackEntries) && feedbackEntries.length > 0) {
    await sendStageFeedbackNotifications({
      projectId,
      stage: normalizedStage,
      reviewStage: normalizedStage === 'review' ? normalizeReviewStage(reviewStage) : null,
      feedbackEntries,
      senderName,
    });
  }

  return {
    stage: normalizedStage,
    review_stage: normalizedStage === 'review' ? normalizeReviewStage(reviewStage) : null,
    updated_students: affectedStudents.length,
  };
};

export const getProjectStageBreakdown = async ({ projectId, stage, reviewStage = null, evaluatorId = null, coordinatorView = false }) => {
  const { stage: normalizedStage, table } = getStageConfig(stage);
  const rubrics = normalizedStage === 'guide'
    ? [GUIDE_TOTAL_RUBRIC]
    : await getActiveRubricsByStage(normalizedStage, reviewStage);
  const studentIds = await getProjectTeamMemberIds(projectId);
  const normalizedReviewStage = normalizedStage === 'review' ? normalizeReviewStage(reviewStage) : null;

  const { data: students, error: studentError } = await supabase
    .from('profiles')
    .select('id, full_name, roll_number')
    .in('id', studentIds);

  if (studentError) throw studentError;

  const marksSelect = normalizedStage === 'review'
    ? 'id, student_id, rubric_id, marks, evaluator_id, review_stage'
    : 'id, student_id, rubric_id, marks, evaluator_id';

  let marksQuery = supabase
    .from(table)
    .select(marksSelect)
    .in('student_id', studentIds);

  if (normalizedStage === 'review') {
    marksQuery = marksQuery.eq('review_stage', normalizedReviewStage);
  }
  if (!coordinatorView && evaluatorId) {
    marksQuery = marksQuery.eq('evaluator_id', evaluatorId);
  }

  const { data: marksRows, error: marksError } = await marksQuery;
  if (marksError) throw marksError;

  const marksByStudent = new Map();
  (marksRows || []).forEach((row) => {
    if (!marksByStudent.has(row.student_id)) {
      marksByStudent.set(row.student_id, []);
    }
    marksByStudent.get(row.student_id).push(row);
  });

  const entryLock = evaluatorId
    ? await getEvaluatorEntryLock({
        projectId,
        evaluatorId,
        stage: normalizedStage,
        reviewStage,
      })
    : { is_locked: false, locked_at: null };

  return {
    stage: normalizedStage,
    review_stage: normalizedReviewStage,
    entry_lock: entryLock,
    rubrics,
    students: (students || []).map((student) => {
      const studentMarks = marksByStudent.get(student.id) || [];
      const completedEseRows = normalizedStage === 'ese' && coordinatorView
        ? getCompletedEvaluatorRows(studentMarks, rubrics.length)
        : studentMarks;
      return {
        student_id: student.id,
        full_name: student.full_name,
        roll_number: student.roll_number,
        marks: rubrics.map((rubric) => {
          if (normalizedStage === 'guide') {
            const guideRows = studentMarks.filter((row) => row.student_id === student.id);
            const directMatch = guideRows[0] || null;
            const averageMarks = guideRows.length
              ? roundMarks(guideRows.reduce((sum, row) => sum + Number(row.marks || 0), 0) / guideRows.length)
              : null;

            return {
              rubric_id: rubric.id,
              rubric_title: rubric.title,
              max_marks: rubric.max_marks,
              marks: coordinatorView ? averageMarks : directMatch?.marks ?? null,
              evaluator_id: directMatch?.evaluator_id || null,
              review_stage: null,
            };
          }

          const rubricRowsSource = normalizedStage === 'ese' && coordinatorView ? completedEseRows : studentMarks;
          const rubricRows = rubricRowsSource.filter((row) => row.rubric_id === rubric.id);
          const directMatch = rubricRows[0] || null;
          const averageMarks = rubricRows.length
            ? roundMarks(rubricRows.reduce((sum, row) => sum + Number(row.marks || 0), 0) / rubricRows.length)
            : null;

          return {
            rubric_id: rubric.id,
            rubric_title: rubric.title,
            max_marks: rubric.max_marks,
            marks: coordinatorView ? averageMarks : directMatch?.marks ?? null,
            evaluator_id: directMatch?.evaluator_id || null,
            review_stage: normalizedReviewStage,
          };
        }),
      };
    }),
  };
};

export const getEvaluatorEntryLock = async ({ projectId, evaluatorId, stage, reviewStage = null }) => {
  const { stage: normalizedStage } = getStageConfig(stage);
  const normalizedReviewStage = normalizeLockReviewStage(normalizedStage, reviewStage);

  let lockQuery = supabase
    .from('rubric_entry_locks')
    .select('id, locked_at')
    .eq('project_id', projectId)
    .eq('evaluator_id', evaluatorId)
    .eq('stage', normalizedStage);
  lockQuery = applyOptionalReviewStageFilter(lockQuery, normalizedReviewStage);
  const { data, error } = await lockQuery.maybeSingle();

  if (error) {
    const missingTable =
      error.code === 'PGRST205' ||
      /rubric_entry_locks/i.test(error.message || '') ||
      /rubric_entry_locks/i.test(error.details || '');
    if (missingTable) {
      return { is_locked: false, locked_at: null };
    }
    throw error;
  }

  return {
    is_locked: Boolean(data?.locked_at),
    locked_at: data?.locked_at || null,
  };
};

export const setEvaluatorEntryLock = async ({ projectId, evaluatorId, stage, reviewStage = null, locked }) => {
  const { stage: normalizedStage } = getStageConfig(stage);
  const project = await getProjectRow(projectId);
  await assertStageWritable({ stage: normalizedStage, projectId });

  if (normalizedStage === 'review' || normalizedStage === 'ese') {
    const accessReviewStage = normalizedStage === 'ese'
      ? 'final_review'
      : normalizeReviewStage(reviewStage);
    const canWriteReview = await hasActiveReviewerStageAccess({
      project,
      evaluatorId,
      reviewStage: accessReviewStage,
    });

    if (!canWriteReview) {
      throw createHttpError('Review entry lock cannot be changed because coordinator access for this stage is closed.', 423);
    }
  }

  const normalizedReviewStage = normalizeLockReviewStage(normalizedStage, reviewStage);
  const now = new Date().toISOString();

  if (locked) {
    const { error } = await supabase
      .from('rubric_entry_locks')
      .upsert({
        project_id: projectId,
        evaluator_id: evaluatorId,
        stage: normalizedStage,
        review_stage: normalizedReviewStage,
        locked_at: now,
        updated_at: now,
      }, {
        onConflict: 'project_id,evaluator_id,stage,review_stage',
      });

    if (error) throw error;
    return { is_locked: true, locked_at: now };
  }

  let deleteQuery = supabase
    .from('rubric_entry_locks')
    .delete()
    .eq('project_id', projectId)
    .eq('evaluator_id', evaluatorId)
    .eq('stage', normalizedStage);
  deleteQuery = applyOptionalReviewStageFilter(deleteQuery, normalizedReviewStage);

  const { error } = await deleteQuery;
  if (error) throw error;

  return { is_locked: false, locked_at: null };
};

export const recalculateClassFinalResults = async (classId) => {
  const studentIds = await getClassStudentIds(classId);
  return Promise.all(studentIds.map((studentId) => autoCalculateStudent(studentId)));
};

export const getAdminFinalResults = async () => {
  const { data, error } = await supabase
    .from('final_results')
    .select('student_id, final_marks, status, is_published')
    .in('status', ['internal_published', 'sent_to_admin', 'internal_and_sent', 'published'])
    .order('updated_at', { ascending: false });

  if (error) throw error;

  const finalRows = data || [];
  if (finalRows.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, roll_number, class_id, class_section')
    .in('id', finalRows.map((row) => row.student_id).filter(Boolean));

  if (profileError) throw profileError;

  const profileRows = profiles || [];
  if (profileRows.length === 0) return [];

  const classIds = [...new Set(profileRows.map((row) => row.class_id).filter(Boolean))];
  let classMap = new Map();
  if (classIds.length > 0) {
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('id, class_section')
      .in('id', classIds);

    if (classError) throw classError;
    classMap = new Map((classes || []).map((row) => [row.id, row.class_section || row.id]));
  }

  const finalMap = new Map(finalRows.map((row) => [row.student_id, row]));
  return profileRows
    .map((profile) => {
      const row = finalMap.get(profile.id) || null;
      const classLabel = classMap.get(profile.class_id) || profile.class_section || null;

      return {
        student_id: profile.id,
        full_name: profile.full_name || null,
        roll_number: profile.roll_number || null,
        class_id: profile.class_id || null,
        class_name: classLabel,
        final_marks: row?.final_marks ?? 0,
        status: row?.status || 'pending',
        is_published: row?.is_published || false,
      };
    })
    .sort((left, right) => {
      const byClass = String(left.class_name || '').localeCompare(String(right.class_name || ''));
      if (byClass !== 0) return byClass;
      return String(left.roll_number || '').localeCompare(String(right.roll_number || ''), undefined, { numeric: true });
    });
};

export const getAdminClasses = async () => {
  const { data, error } = await supabase
    .from('classes')
    .select('id, class_section, department')
    .order('class_section', { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    class_name: row.class_section || row.id,
    department: row.department || '',
  }));
};

const getReviewRoundBreakdownForClassProjects = async ({ projectIds }) => {
  if (projectIds.length === 0) return {};

  const { data: teamMembers, error: teamError } = await supabase
    .from('team_members')
    .select('project_id, student_id')
    .in('project_id', projectIds);

  if (teamError) throw teamError;

  const studentIds = [...new Set((teamMembers || []).map((row) => row.student_id).filter(Boolean))];
  if (studentIds.length === 0) return {};

  const { data: reviewRows, error: reviewError } = await supabase
    .from('review_marks')
    .select('student_id, evaluator_id, review_stage, rubric_id, marks')
    .in('student_id', studentIds)
    .in('review_stage', REVIEW_ROUNDS);

  if (reviewError) throw reviewError;

  const map = {};
  for (const studentId of studentIds) {
    const studentRows = (reviewRows || []).filter((row) => row.student_id === studentId);
    const roundAverages = await buildReviewRoundAverages(studentRows);
    const roundItems = REVIEW_ROUNDS.map((reviewStage) => {
      return {
        review_stage: reviewStage,
        label: formatReviewStageLabel(reviewStage),
        marks: roundAverages[reviewStage] ?? null,
      };
    });
    map[studentId] = roundItems;
  }

  return map;
};

const getSimpleStageBreakdownForClassProjects = async ({ stage, projectIds }) => {
  const { stage: normalizedStage, table } = getStageConfig(stage);
  const rubrics = normalizedStage === 'guide'
    ? [GUIDE_TOTAL_RUBRIC]
    : await getActiveRubricsByStage(normalizedStage);

  if (projectIds.length === 0) {
    return {};
  }

  const { data: teamMembers, error: teamError } = await supabase
    .from('team_members')
    .select('project_id, student_id')
    .in('project_id', projectIds);

  if (teamError) throw teamError;

  const studentIds = [...new Set((teamMembers || []).map((row) => row.student_id).filter(Boolean))];
  if (studentIds.length === 0) {
    return {};
  }

  const { data: marksRows, error: marksError } = await supabase
    .from(table)
    .select('student_id, rubric_id, marks, evaluator_id')
    .in('student_id', studentIds);

  if (marksError) throw marksError;

  const map = {};
  studentIds.forEach((studentId) => {
    const studentMarks = (marksRows || []).filter((row) => row.student_id === studentId);
    const completedEseRows = normalizedStage === 'ese'
      ? getCompletedEvaluatorRows(studentMarks, rubrics.length)
      : studentMarks;
    map[studentId] = rubrics.map((rubric) => {
      if (normalizedStage === 'guide') {
        return {
          rubric_id: rubric.id,
          rubric_title: rubric.title,
          max_marks: rubric.max_marks,
          marks: studentMarks.length ? roundMarks(studentMarks.reduce((sum, row) => sum + Number(row.marks || 0), 0) / studentMarks.length) : null,
        };
      }

      const sourceRows = normalizedStage === 'ese' ? completedEseRows : studentMarks;
      const matches = sourceRows.filter((mark) => mark.rubric_id === rubric.id);
      return {
        rubric_id: rubric.id,
        rubric_title: rubric.title,
        max_marks: rubric.max_marks,
        marks: matches.length ? roundMarks(matches.reduce((sum, row) => sum + Number(row.marks || 0), 0) / matches.length) : null,
      };
    });
  });

  return map;
};

export const getCoordinatorFinalResults = async (classId) => {
  await recalculateClassFinalResults(classId);

  const [{ data: projects, error: projectError }, { data: classProfiles, error: classProfileError }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title')
      .eq('class_id', classId),
    supabase
      .from('profiles')
      .select('id, full_name, roll_number')
      .eq('role', 'student')
      .eq('class_id', classId),
  ]);

  if (projectError) throw projectError;
  if (classProfileError) throw classProfileError;

  const projectIds = (projects || []).map((row) => row.id);
  let teamMembers = [];
  if (projectIds.length > 0) {
    const { data, error: teamError } = await supabase
      .from('team_members')
      .select('project_id, student_id')
      .in('project_id', projectIds);

    if (teamError) throw teamError;
    teamMembers = data || [];
  }

  const projectTitleMap = new Map((projects || []).map((row) => [row.id, row.title]));
  const studentProjectMap = new Map();
  const studentIds = (classProfiles || []).map((row) => row.id).filter(Boolean);

  (teamMembers || []).forEach((row) => {
    if (!row.student_id) return;
    studentProjectMap.set(row.student_id, row.project_id);
    studentIds.push(row.student_id);
  });

  const uniqueStudentIds = [...new Set(studentIds)];
  if (uniqueStudentIds.length === 0) return [];

  const profiles = classProfiles && classProfiles.length === uniqueStudentIds.length
    ? classProfiles
    : (() => { return null; })();

  let resolvedProfiles = profiles;
  if (!resolvedProfiles) {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, roll_number')
      .in('id', uniqueStudentIds);

    if (profileError) throw profileError;
    resolvedProfiles = data || [];
  }

  const { data: finalRows, error: finalError } = await supabase
    .from('final_results')
    .select('student_id, attendance_marks, report_marks, review_total, guide_total, ese_total, cie_total, final_marks, status, is_published, locked_at, updated_at')
    .in('student_id', uniqueStudentIds);

  if (finalError) throw finalError;

  const profileMap = new Map((resolvedProfiles || []).map((row) => [row.id, row]));
  const finalMap = new Map((finalRows || []).map((row) => [row.student_id, row]));
  const [reviewRoundsMap, guideMap, eseMap] = await Promise.all([
    getReviewRoundBreakdownForClassProjects({ projectIds }),
    getSimpleStageBreakdownForClassProjects({ stage: 'guide', projectIds }),
    getSimpleStageBreakdownForClassProjects({ stage: 'ese', projectIds }),
  ]);

  return uniqueStudentIds.map((studentId) => {
    const profile = profileMap.get(studentId) || {};
    const finalResult = finalMap.get(studentId) || null;
    return {
      student_id: studentId,
      full_name: profile.full_name || null,
      roll_number: profile.roll_number || null,
      project_id: studentProjectMap.get(studentId) || null,
      project_title: projectTitleMap.get(studentProjectMap.get(studentId)) || null,
      attendance_marks: finalResult?.attendance_marks ?? 0,
      report_marks: finalResult?.report_marks ?? 0,
      review_total: finalResult?.review_total ?? 0,
      guide_total: finalResult?.guide_total ?? 0,
      ese_total: finalResult?.ese_total ?? 0,
      cie_total: finalResult?.cie_total ?? 0,
      final_marks: finalResult?.final_marks ?? 0,
      status: finalResult?.status || 'pending',
      is_published: Boolean(finalResult?.is_published),
      locked_at: finalResult?.locked_at || null,
      updated_at: finalResult?.updated_at || null,
      review_rounds: reviewRoundsMap[studentId] || [],
      breakdown: {
        guide: guideMap[studentId] || [],
        ese: eseMap[studentId] || [],
      },
    };
  });
};

export const getCoordinatorInternalComponents = async (classId) => {
  const studentIds = await getClassStudentIds(classId);
  if (studentIds.length === 0) return [];

  const [{ data: profiles, error: profileError }, { data: finalRows, error: finalError }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, roll_number').in('id', studentIds),
    supabase.from('final_results').select('student_id, attendance_marks, report_marks').in('student_id', studentIds),
  ]);

  if (profileError) throw profileError;
  if (finalError) throw finalError;

  const finalMap = new Map((finalRows || []).map((row) => [row.student_id, row]));
  return (profiles || []).map((profile) => ({
    student_id: profile.id,
    full_name: profile.full_name || null,
    roll_number: profile.roll_number || null,
    attendance_marks: finalMap.get(profile.id)?.attendance_marks ?? 0,
    report_marks: finalMap.get(profile.id)?.report_marks ?? 0,
  }));
};

export const saveCoordinatorInternalComponents = async ({ classId, entries }) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw createHttpError('At least one student entry is required.', 400);
  }

  const classStudentIds = new Set(await getClassStudentIds(classId));
  if (classStudentIds.size === 0) return [];

  const payload = entries.map((entry) => {
    if (!entry?.student_id || !classStudentIds.has(entry.student_id)) {
      throw createHttpError('Attendance/report marks can only be updated for students in your class.', 403);
    }

    const attendanceMarks = Number(entry.attendance_marks);
    const reportMarks = Number(entry.report_marks);

    if (!Number.isFinite(attendanceMarks) || attendanceMarks < 0 || attendanceMarks > INTERNAL_LIMITS.attendance) {
      throw createHttpError(`Attendance marks must be between 0 and ${INTERNAL_LIMITS.attendance}.`, 400);
    }
    if (!Number.isFinite(reportMarks) || reportMarks < 0 || reportMarks > INTERNAL_LIMITS.report) {
      throw createHttpError(`Report marks must be between 0 and ${INTERNAL_LIMITS.report}.`, 400);
    }

    return {
      student_id: entry.student_id,
      attendance_marks: attendanceMarks,
      report_marks: reportMarks,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from('final_results')
    .upsert(payload, { onConflict: 'student_id' });

  if (error) throw error;

  for (const row of payload) {
    await autoCalculateStudent(row.student_id);
  }

  return getCoordinatorInternalComponents(classId);
};

export const publishFinalResults = async ({ studentIds = null, adminId }) => {
  // Ensure studentIds is provided and not empty
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw createHttpError('No student IDs provided for publishing results.', 400);
  }

  // Fetch current status to preserve internal marks
  const { data: currentRows, error: fetchError } = await supabase
    .from('final_results')
    .select('student_id, status')
    .in('student_id', studentIds);

  if (fetchError) throw fetchError;

  for (const row of (currentRows || [])) {
    // Preserve internal marks status if already published by coordinator
    let newStatus = row.status;
    if (newStatus === 'internal_and_sent' || newStatus === 'internal_published') {
      // Already has internal marks published, keep it as internal_and_sent
      newStatus = 'internal_and_sent';
    } else {
      // No internal marks, mark as published by admin only
      newStatus = 'published';
    }

    const { error } = await supabase
      .from('final_results')
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
        published_by: adminId,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', row.student_id);

    if (error) throw error;
  }

  const { data, error } = await supabase
    .from('final_results')
    .select('student_id, final_marks, status')
    .in('student_id', studentIds);

  if (error) throw error;
  return data || [];
};

export const getStudentPublishedResult = async (studentId) => {
  const { data, error } = await supabase
    .from('final_results')
    .select('student_id, cie_total, ese_total, final_marks, status, is_published, published_at')
    .eq('student_id', studentId)
    .single();

  if (error || !data) {
    throw createHttpError('Final result is not published yet.', 404);
  }

  const isFinalPublished = data.is_published;
  const isInternalPublished = data.status === 'internal_published' || data.status === 'internal_and_sent' || isFinalPublished;

  if (!isInternalPublished && !isFinalPublished) {
    throw createHttpError('Final result is not published yet.', 404);
  }

  if (!isFinalPublished) {
    return {
      student_id: data.student_id,
      cie_total: data.cie_total,
      ese_total: null,
      final_marks: null,
      status: data.status,
      is_published: false,
      published_at: data.published_at,
      internal_only: true,
    };
  }

  return data;
};

export const revokePublishedResults = async ({ studentIds = null, adminId }) => {
  // Ensure studentIds is provided and not empty
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw createHttpError('No student IDs provided for revoking results.', 400);
  }

  // Fetch current status for all students to preserve internal marks
  const { data: currentRows, error: fetchError } = await supabase
    .from('final_results')
    .select('student_id, status')
    .in('student_id', studentIds);

  if (fetchError) throw fetchError;

  for (const row of (currentRows || [])) {
    let newStatus = row.status;
    
    // Preserve internal marks if they were published by coordinator
    if (newStatus === 'internal_and_sent') {
      // Keep internal marks published, just remove final marks
      newStatus = 'internal_published';
    } else if (newStatus === 'published') {
      // No internal marks, set to sent_to_admin
      newStatus = 'sent_to_admin';
    } else if (newStatus === 'internal_published') {
      // Already internal only, skip (should not be in published list)
      continue;
    }

    // Update only the final marks publication status
    const { error } = await supabase
      .from('final_results')
      .update({
        is_published: false,
        published_at: null,
        published_by: null,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', row.student_id);

    if (error) throw error;
  }

  const { data, error } = await supabase
    .from('final_results')
    .select('student_id, final_marks, status')
    .in('student_id', studentIds);

  if (error) throw error;
  return data || [];
};
