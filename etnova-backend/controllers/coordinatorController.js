import { supabaseAdmin } from '../config/supabase.js';

const supabase = supabaseAdmin;

// ─── Helper: get coordinator's class_id from their profile ──────────────────
async function getCoordinatorClassId(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('class_id, department, full_name')
    .eq('id', userId)
    .eq('is_coordinator', true)
    .single();
  if (error || !data) return null;
  return data;
}

async function getScopedDocument(documentId, classId) {
  const { data, error } = await supabase
    .from('documents')
    .select('id, project_id, projects!inner(class_id)')
    .eq('id', documentId)
    .single();

  if (error || !data) return null;

  const documentClassId = data.projects?.class_id;
  if (!documentClassId || documentClassId !== classId) {
    return null;
  }

  return data;
}

// ─── 1. GET /coordinator/class ───────────────────────────────────────────────
// Overview page KPIs: class info + team count + eval counts + avg score
export const getClassOverview = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord?.class_id) {
      return res.status(403).json({ message: 'You are not assigned as a coordinator.' });
    }
    const { class_id, department } = coord;

    // Get class name
    const { data: classRow } = await supabase
      .from('classes')
      .select('id, class_name, department')
      .eq('id', class_id)
      .single();

    // Get all projects in this class
    const { data: projects } = await supabase
      .from('projects')
      .select('id, title, status, guide_id')
      .eq('class_id', class_id);

    const projectIds = (projects || []).map(p => p.id);

    // Pending verification count
    let pendingVerify = 0;
    if (projectIds.length > 0) {
      const { count } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .eq('status', 'approved')
        .eq('coordinator_verified', false);
      pendingVerify = count || 0;
    }

    // Evaluations
    let evalDone = 0;
    let avgScore = null;
    if (projectIds.length > 0) {
      const { data: evals } = await supabase
        .from('evaluations')
        .select('project_id, obtained_marks, max_marks')
        .in('project_id', projectIds);

      const evalledProjects = new Set((evals || []).map(e => e.project_id));
      evalDone = evalledProjects.size;

      const withMarks = (evals || []).filter(e => e.max_marks > 0);
      if (withMarks.length > 0) {
        const totalPct = withMarks.reduce((s, e) => s + (e.obtained_marks / e.max_marks) * 100, 0);
        avgScore = Math.round(totalPct / withMarks.length);
      }
    }

    // Stage progress — count projects at each stage using documents
    const stages = ['abstract', 'zeroth_review', 'first_review', 'second_review', 'final_review'];
    const stageProgress = {};
    for (const stage of stages) {
      if (projectIds.length > 0) {
        const { count } = await supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .in('project_id', projectIds)
          .eq('document_type', stage)
          .eq('coordinator_verified', true);
        stageProgress[stage] = count || 0;
      } else {
        stageProgress[stage] = 0;
      }
    }

    res.json({
      class: classRow,
      kpis: {
        totalTeams: (projects || []).length,
        pendingVerify,
        evalDone,
        pendingEval: Math.max(0, (projects || []).length - evalDone),
        avgScore,
      },
      stageProgress,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── 2. GET /coordinator/submissions ────────────────────────────────────────
// Submission queue: guide-approved, not yet coordinator-verified
export const getSubmissionQueue = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord?.class_id) return res.status(403).json({ message: 'Not a coordinator.' });

    const { data: projects } = await supabase
      .from('projects')
      .select('id, title, guide_id')
      .eq('class_id', coord.class_id);

    const projectIds = (projects || []).map(p => p.id);
    if (projectIds.length === 0) return res.json({ pending: [], verified: [] });

    // Pending queue
    const { data: pending } = await supabase
      .from('documents')
      .select(`
        id, project_id, document_type, file_name, file_url,
        file_size, status, uploaded_at, feedback,
        uploaded_by_profile:profiles!documents_uploaded_by_fkey(full_name, roll_number)
      `)
      .in('project_id', projectIds)
      .eq('status', 'approved')
      .eq('coordinator_verified', false)
      .order('uploaded_at', { ascending: false });

    // Recently verified (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: verified } = await supabase
      .from('documents')
      .select('id, project_id, document_type, file_name, coordinator_verified_at')
      .in('project_id', projectIds)
      .eq('coordinator_verified', true)
      .gte('coordinator_verified_at', sevenDaysAgo)
      .order('coordinator_verified_at', { ascending: false });

    // Enrich with project title and guide name
    const projectMap = {};
    const guideIds = [...new Set((projects || []).map(p => p.guide_id).filter(Boolean))];
    let guideMap = {};

    if (guideIds.length > 0) {
      const { data: guides } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', guideIds);
      (guides || []).forEach(g => { guideMap[g.id] = g.full_name; });
    }
    (projects || []).forEach(p => { projectMap[p.id] = p; });

    const enriched = (pending || []).map(doc => ({
      ...doc,
      project_title: projectMap[doc.project_id]?.title || '—',
      guide_name: guideMap[projectMap[doc.project_id]?.guide_id] || '—',
    }));

    const enrichedVerified = (verified || []).map(doc => ({
      ...doc,
      project_title: projectMap[doc.project_id]?.title || '—',
    }));

    res.json({ pending: enriched, verified: enrichedVerified });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── 3. PATCH /coordinator/submissions/:id/verify ───────────────────────────
export const verifySubmission = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord?.class_id) return res.status(403).json({ message: 'Not a coordinator.' });

    const scopedDocument = await getScopedDocument(req.params.id, coord.class_id);
    if (!scopedDocument) {
      return res.status(404).json({ message: 'Submission not found for your class.' });
    }

    const { data, error } = await supabase
      .from('documents')
      .update({
        coordinator_verified: true,
        coordinator_verified_at: new Date().toISOString(),
        coordinator_verified_by: req.user.id,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── 4. PATCH /coordinator/submissions/:id/return ───────────────────────────
// Returns document back to guide (resets to submitted)
export const returnSubmission = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord?.class_id) return res.status(403).json({ message: 'Not a coordinator.' });

    const { reason } = req.body || {};

    const scopedDocument = await getScopedDocument(req.params.id, coord.class_id);
    if (!scopedDocument) {
      return res.status(404).json({ message: 'Submission not found for your class.' });
    }

    const { data, error } = await supabase
      .from('documents')
      .update({
        status: 'submitted',
        coordinator_verified: false,
        feedback: reason ? `[Returned by coordinator]: ${reason}` : undefined,
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── 5. GET /coordinator/teams ───────────────────────────────────────────────
// All teams in class with guide, size, stage, score
export const getClassTeams = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord?.class_id) return res.status(403).json({ message: 'Not a coordinator.' });

    const { data: projects } = await supabase
      .from('projects')
      .select(`
        id, title, status, guide_id, created_at,
        team_members(id)
      `)
      .eq('class_id', coord.class_id)
      .order('created_at', { ascending: false });

    if (!projects?.length) return res.json([]);

    // Guide names
    const guideIds = [...new Set(projects.map(p => p.guide_id).filter(Boolean))];
    let guideMap = {};
    if (guideIds.length > 0) {
      const { data: guides } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', guideIds);
      (guides || []).forEach(g => { guideMap[g.id] = g.full_name; });
    }

    // Latest document per project (for stage)
    const projectIds = projects.map(p => p.id);
    const { data: docs } = await supabase
      .from('documents')
      .select('project_id, document_type, coordinator_verified, status')
      .in('project_id', projectIds)
      .order('uploaded_at', { ascending: false });

    // Evaluations avg per project
    const { data: evals } = await supabase
      .from('evaluations')
      .select('project_id, obtained_marks, max_marks')
      .in('project_id', projectIds);

    const evalMap = {};
    (evals || []).forEach(e => {
      if (!evalMap[e.project_id]) evalMap[e.project_id] = [];
      evalMap[e.project_id].push(e);
    });

    const docMap = {};
    (docs || []).forEach(d => {
      if (!docMap[d.project_id]) docMap[d.project_id] = d;
    });

    const result = projects.map(p => {
      const latestDoc = docMap[p.id];
      const projEvals = evalMap[p.id] || [];
      const withMarks = projEvals.filter(e => e.max_marks > 0);
      const avgScore = withMarks.length > 0
        ? Math.round(withMarks.reduce((s, e) => s + (e.obtained_marks / e.max_marks) * 100, 0) / withMarks.length)
        : null;

      return {
        id: p.id,
        title: p.title,
        status: p.status,
        guide_name: guideMap[p.guide_id] || '—',
        team_size: (p.team_members || []).length,
        latest_stage: latestDoc?.document_type || '—',
        submission_status: latestDoc?.status || '—',
        coordinator_verified: latestDoc?.coordinator_verified || false,
        avg_score: avgScore,
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── 6. GET /coordinator/deadlines ──────────────────────────────────────────
export const getDeadlines = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord?.class_id) return res.status(403).json({ message: 'Not a coordinator.' });

    const { data, error } = await supabase
      .from('class_submission_deadlines')
      .select('id, stage, deadline, updated_at')
      .eq('class_id', coord.class_id)
      .order('stage');

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── 7. PUT /coordinator/deadlines ──────────────────────────────────────────
// Body: [{ stage: 'abstract', deadline: '2026-03-14T00:00:00Z' }, ...]
export const saveDeadlines = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord?.class_id) return res.status(403).json({ message: 'Not a coordinator.' });

    const deadlines = req.body;
    if (!Array.isArray(deadlines)) {
      return res.status(400).json({ message: 'Body must be an array of { stage, deadline }' });
    }

    const rows = deadlines.map(d => ({
      class_id: coord.class_id,
      stage: d.stage,
      deadline: d.deadline || null,
      created_by: req.user.id,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('class_submission_deadlines')
      .upsert(rows, { onConflict: 'class_id,stage' })
      .select();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── 8. GET /coordinator/reviewer-access ────────────────────────────────────
// Stage toggles + which mentors are assigned
export const getReviewerAccess = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord?.class_id) return res.status(403).json({ message: 'Not a coordinator.' });

    const { data: accessRows } = await supabase
      .from('reviewer_access')
      .select(`
        id, mentor_id, stage, is_open, updated_at,
        mentor:profiles!reviewer_access_mentor_id_fkey(id, full_name, department)
      `)
      .eq('class_id', coord.class_id)
      .order('stage');

    // Stage open status (true if any row for that stage has is_open=true)
    const stages = ['zeroth_review', 'first_review', 'second_review', 'final_review'];
    const stageStatus = {};
    stages.forEach(s => {
      const rows = (accessRows || []).filter(r => r.stage === s);
      stageStatus[s] = rows.some(r => r.is_open);
    });

    res.json({
      stageStatus,
      assignments: accessRows || [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── 9. PUT /coordinator/reviewer-access ────────────────────────────────────
// Body: { stageToggles: { zeroth_review: true, ... }, mentorIds: ['uuid1','uuid2'] }
export const saveReviewerAccess = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord?.class_id) return res.status(403).json({ message: 'Not a coordinator.' });

    const { stageToggles = {}, mentorIds = [] } = req.body;
    const stages = Object.keys(stageToggles);

    if (stages.length === 0 && mentorIds.length === 0) {
      return res.status(400).json({ message: 'Provide stageToggles or mentorIds.' });
    }

    // Build upsert rows: one row per mentor per stage
    const rows = [];
    const allStages = ['zeroth_review', 'first_review', 'second_review', 'final_review'];

    for (const mentorId of mentorIds) {
      for (const stage of allStages) {
        rows.push({
          class_id: coord.class_id,
          mentor_id: mentorId,
          stage,
          is_open: stageToggles[stage] ?? false,
          granted_by: req.user.id,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // If only toggling stages (no mentor change), update existing rows
    if (mentorIds.length === 0 && stages.length > 0) {
      for (const stage of stages) {
        await supabase
          .from('reviewer_access')
          .update({ is_open: stageToggles[stage], updated_at: new Date().toISOString() })
          .eq('class_id', coord.class_id)
          .eq('stage', stage);
      }
      return res.json({ message: 'Stage access updated.' });
    }

    const { data, error } = await supabase
      .from('reviewer_access')
      .upsert(rows, { onConflict: 'class_id,mentor_id,stage' })
      .select();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── 10. GET /coordinator/department-mentors ─────────────────────────────────
// All mentors in coordinator's department (for reviewer selection checkboxes)
export const getDepartmentMentors = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord) return res.status(403).json({ message: 'Not a coordinator.' });

    // Get coordinator's own department
    const { data: coordProfile } = await supabase
      .from('profiles')
      .select('department')
      .eq('id', req.user.id)
      .single();

    if (!coordProfile?.department) {
      return res.status(400).json({ message: 'Coordinator department not set.' });
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, department, designation')
      .eq('role', 'mentor')
      .ilike('department', `%${coordProfile.department}%`)
      .order('full_name');

    if (error) throw error;

    // Also check which ones are already assigned as reviewers
    const { data: existing } = await supabase
      .from('reviewer_access')
      .select('mentor_id, stage, is_open')
      .eq('class_id', coord.class_id);

    const assignedIds = new Set((existing || []).map(r => r.mentor_id));

    const result = (data || []).map(m => ({
      ...m,
      is_assigned: assignedIds.has(m.id),
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
