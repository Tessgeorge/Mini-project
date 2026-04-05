import { supabaseAdmin } from '../config/supabase.js';
import {
  recalculateClassFinalResults,
  getCoordinatorInternalComponents,
  saveCoordinatorInternalComponents,
  publishCoordinatorMarks,
} from '../services/rubricEvaluationService.js';

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

async function isTeamFormationLocked(classId) {
  if (!classId) return false;

  const { data, error } = await supabase
    .from('class_submission_deadlines')
    .select('deadline')
    .eq('class_id', classId)
    .eq('stage', 'team_formation')
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.deadline);
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
    await recalculateClassFinalResults(class_id);

    // Get class name
    const { data: classRow } = await supabase
      .from('classes')
      .select('id, class_section, department')
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
    await recalculateClassFinalResults(coord.class_id);
    const formationLocked = await isTeamFormationLocked(coord.class_id);
    const { data: coordinatorClass } = await supabase
      .from('classes')
      .select('id, class_section')
      .eq('id', coord.class_id)
      .maybeSingle();

    const { data: scopedProjects } = await supabase
      .from('projects')
      .select(`
        id, title, status, guide_id, batch, created_at,
        team_members(id)
      `)
      .eq('class_id', coord.class_id)
      .order('created_at', { ascending: false });

    const { data: nullClassProjects } = await supabase
      .from('projects')
      .select(`
        id, title, status, guide_id, batch, created_at,
        team_members(id, role, profiles!team_members_student_id_fkey(class_id, class_section))
      `)
      .is('class_id', null)
      .order('created_at', { ascending: false });

    const matchedLegacyProjects = (nullClassProjects || []).filter((project) => {
      const members = project?.team_members || [];
      const leader = members.find((member) => member.role === 'leader');
      const anchor = leader?.profiles || members[0]?.profiles || null;
      if (!anchor) return false;
      if (anchor.class_id && anchor.class_id === coord.class_id) return true;
      return Boolean(
        coordinatorClass?.class_section &&
        anchor.class_section &&
        String(anchor.class_section).trim() === String(coordinatorClass.class_section).trim()
      );
    });

    const projects = [...(scopedProjects || []), ...matchedLegacyProjects].reduce((acc, project) => {
      if (!acc.some((row) => row.id === project.id)) acc.push(project);
      return acc;
    }, []);

    if (!projects.length) return res.json({ formation_locked: formationLocked, teams: [] });

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
        batch: p.batch ?? null,
        guide_name: guideMap[p.guide_id] || '�',
        team_size: (p.team_members || []).length,
        latest_stage: latestDoc?.document_type || '—',
        submission_status: latestDoc?.status || '—',
        coordinator_verified: latestDoc?.coordinator_verified || false,
        avg_score: avgScore,
      };
    });

    res.json({
      formation_locked: formationLocked,
      teams: result,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── 5a. PUT /coordinator/teams/batches ─────────────────────────────────────
// Body: { assignments: [{ project_id: "uuid", batch: 1|2|null }, ...] }
export const saveTeamBatches = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord?.class_id) return res.status(403).json({ message: 'Not a coordinator.' });
    const formationLocked = await isTeamFormationLocked(coord.class_id);
    if (formationLocked) {
      return res.status(423).json({ message: 'Team formation is locked. Unlock it before changing batches.' });
    }
    const { data: coordinatorClass } = await supabase
      .from('classes')
      .select('id, class_section')
      .eq('id', coord.class_id)
      .maybeSingle();

    const assignments = Array.isArray(req.body?.assignments) ? req.body.assignments : [];
    if (!assignments.length) {
      return res.status(400).json({ message: 'Provide at least one batch assignment.' });
    }

    const normalized = assignments.map((entry) => {
      const projectId = String(entry?.project_id || '').trim();
      const rawBatch = entry?.batch;
      const batch = rawBatch == null || rawBatch === '' ? null : Number(rawBatch);
      return { project_id: projectId, batch };
    });

    const invalid = normalized.find(
      (entry) => !entry.project_id || (entry.batch != null && ![1, 2].includes(entry.batch))
    );
    if (invalid) {
      return res.status(400).json({ message: 'Each assignment must include project_id and batch as 1, 2, or null.' });
    }

    const projectIds = [...new Set(normalized.map((entry) => entry.project_id))];
    const { data: candidateProjects, error: candidateError } = await supabase
      .from('projects')
      .select(`
        id, class_id,
        team_members(role, profiles!team_members_student_id_fkey(class_id, class_section))
      `)
      .in('id', projectIds);
    if (candidateError) throw candidateError;

    const allowedIds = new Set(
      (candidateProjects || [])
        .filter((project) => {
          if (project.class_id && project.class_id === coord.class_id) return true;
          if (project.class_id) return false;
          const members = project?.team_members || [];
          const leader = members.find((member) => member.role === 'leader');
          const anchor = leader?.profiles || members[0]?.profiles || null;
          if (!anchor) return false;
          if (anchor.class_id && anchor.class_id === coord.class_id) return true;
          return Boolean(
            coordinatorClass?.class_section &&
            anchor.class_section &&
            String(anchor.class_section).trim() === String(coordinatorClass.class_section).trim()
          );
        })
        .map((row) => row.id)
    );
    const projectById = new Map((candidateProjects || []).map((row) => [row.id, row]));
    const outOfScope = projectIds.filter((id) => !allowedIds.has(id));
    if (outOfScope.length > 0) {
      return res.status(403).json({ message: 'One or more teams do not belong to your class.' });
    }

    for (const entry of normalized) {
      const currentProject = projectById.get(entry.project_id);
      const updatePayload = { batch: entry.batch };
      if (currentProject && !currentProject.class_id) {
        // Auto-heal legacy records so future coordinator queries are class_id-based.
        updatePayload.class_id = coord.class_id;
      }
      const { error: updateError } = await supabase
        .from('projects')
        .update(updatePayload)
        .eq('id', entry.project_id);
      if (updateError) throw updateError;
    }

    res.json({ updated: normalized.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const setTeamFormationLock = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord?.class_id) return res.status(403).json({ message: 'Not a coordinator.' });

    const locked = Boolean(req.body?.locked);

    if (locked) {
      const { data: classProjects, error: projectError } = await supabase
        .from('projects')
        .select('id, title, team_members(id)')
        .eq('class_id', coord.class_id);

      if (projectError) throw projectError;

      const invalidTeams = (classProjects || [])
        .map((project) => ({
          id: project.id,
          title: project.title || 'Untitled Team',
          size: Array.isArray(project.team_members) ? project.team_members.length : 0,
        }))
        .filter((team) => team.size < 3 || team.size > 4);

      if (invalidTeams.length > 0) {
        return res.status(400).json({
          message: 'Team formation can be locked only when every team has 3 to 4 students.',
          invalid_teams: invalidTeams,
        });
      }

      const { error } = await supabase
        .from('class_submission_deadlines')
        .upsert({
          class_id: coord.class_id,
          stage: 'team_formation',
          deadline: new Date().toISOString(),
          created_by: req.user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'class_id,stage' });

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('class_submission_deadlines')
        .delete()
        .eq('class_id', coord.class_id)
        .eq('stage', 'team_formation');

      if (error) throw error;
    }

    res.json({ formation_locked: locked });
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
      .neq('stage', 'team_formation')
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
    const hasClosedEvaluationStage = rows.some((row) =>
      ['review', 'guide', 'ese'].includes(row.stage) && row.deadline && new Date(row.deadline).getTime() <= Date.now()
    );
    if (hasClosedEvaluationStage) {
      await recalculateClassFinalResults(coord.class_id);
    }
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
      if (stages.some((stage) => stageToggles[stage] === false)) {
        await recalculateClassFinalResults(coord.class_id);
      }
      return res.json({ message: 'Stage access updated.' });
    }

    const { data, error } = await supabase
      .from('reviewer_access')
      .upsert(rows, { onConflict: 'class_id,mentor_id,stage' })
      .select();

    if (error) throw error;
    if (stages.some((stage) => stageToggles[stage] === false)) {
      await recalculateClassFinalResults(coord.class_id);
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── 10. GET /coordinator/department-mentors ─────────────────────────────────
// All users with mentor role (for reviewer selection checkboxes)
export const getDepartmentMentors = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord) return res.status(403).json({ message: 'Not a coordinator.' });

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, department, designation')
      .eq('role', 'mentor')
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

export const listInternalMarks = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord?.class_id) return res.status(403).json({ message: 'Not a coordinator.' });

    const rows = await getCoordinatorInternalComponents(coord.class_id);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const saveInternalMarks = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord?.class_id) return res.status(403).json({ message: 'Not a coordinator.' });

    const { entries = [] } = req.body || {};
    const rows = await saveCoordinatorInternalComponents({
      classId: coord.class_id,
      entries,
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const publishCoordinatorResults = async (req, res) => {
  try {
    const coord = await getCoordinatorClassId(req.user.id);
    if (!coord?.class_id) return res.status(403).json({ message: 'Not a coordinator.' });

    const { type } = req.body || {};
    const result = await publishCoordinatorMarks({
      classId: coord.class_id,
      publishType: type
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
