import { supabaseAdmin } from '../config/supabase.js';

const supabase = supabaseAdmin;

const safeProfileName = (profile, fallback = 'Student') => {
  return profile?.full_name || profile?.email || fallback;
};

const LOCKED_PROJECT_STATUSES = new Set(['approved', 'completed']);
const isProjectLocked = (status) => LOCKED_PROJECT_STATUSES.has((status || '').toLowerCase());
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === 'string' && UUID_REGEX.test(value);

const enrichProjectsWithAllocations = async (projects) => {
  if (!projects?.length) return projects || [];

  const projectIds = [...new Set(projects.map((project) => project?.id).filter(isUuid))];
  if (projectIds.length === 0) return projects;

  const { data: allocations, error: allocError } = await supabase
    .from('guide_allocations')
    .select(`
      id,
      project_id,
      guide_id,
      status,
      assigned_at,
      comment,
      guide:profiles!guide_allocations_guide_id_fkey(
        id,
        full_name,
        email,
        department
      )
    `)
    .eq('status', 'active')
    .in('project_id', projectIds)
    .order('assigned_at', { ascending: false });

  if (allocError) {
    throw allocError;
  }

  const allocationMap = new Map();
  (allocations || []).forEach((row) => {
    if (!row?.project_id) return;
    if (!allocationMap.has(row.project_id)) {
      allocationMap.set(row.project_id, row);
    }
  });

  return projects.map((project) => {
    const activeAllocation = allocationMap.get(project.id) || null;
    const allocatedGuide = activeAllocation?.guide || null;

    return {
      ...project,
      mentor: allocatedGuide || project.mentor || null,
      guide_allocation: activeAllocation
        ? {
          id: activeAllocation.id,
          guide_id: activeAllocation.guide_id,
          status: activeAllocation.status,
          assigned_at: activeAllocation.assigned_at,
          comment: activeAllocation.comment || null,
        }
        : null,
    };
  });
};
const STUDENT_PROJECT_SELECT = `
  *,
  mentor:profiles!projects_mentor_id_fkey(id, full_name, email, department),
  guide:profiles!projects_guide_id_fkey(id, full_name, email, department),
  team_members(
    id,
    student_id,
    role,
    joined_at,
    profiles!team_members_student_id_fkey(
      id,
      full_name,
      email,
      roll_number,
      department,
      batch,
      class_section
    )
  ),
  documents(id, document_type, status, uploaded_at, file_name, file_url, version, feedback),
  evaluations(id, evaluation_type, obtained_marks, max_marks, feedback, created_at)
`;
const createNotifications = async (rows) => {
  if (!rows?.length) return;
  const validRows = rows.filter((r) => r?.user_id && r?.title && r?.message && r?.type);
  if (!validRows.length) return;
  const { error } = await supabase.from('notifications').insert(validRows);
  if (error) {
    console.error('Notification insert skipped:', error.message);
  }
};

const normalizeTextField = (value, { required = false, maxLength = 5000 } = {}) => {
  if (value === undefined) return undefined;
  if (value === null) {
    if (required) return null;
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    if (required) return null;
    return null;
  }

  return normalized.slice(0, maxLength);
};

const normalizeTechnologyStacks = (value) => {
  if (value === undefined) return undefined;

  const raw = Array.isArray(value)
    ? value
    : String(value || '')
      .split(',')
      .map((item) => item.trim());

  const unique = [...new Set(
    raw
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .map((item) => item.slice(0, 40))
  )];

  return unique.slice(0, 20);
};

// ====== USER PROFILE FUNCTIONS ======

export const getUserProfile = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ message: 'Profile not found', error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(req.body)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ message: 'Update failed', error: error.message });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;

    const [profileResult, notificationsResult, membershipsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single(),
      supabase
        .from('notifications')
        .select('id, user_id, type, title, message, read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('team_members')
        .select('project_id')
        .eq('student_id', userId),
    ]);

    if (profileResult.error) {
      return res.status(404).json({ message: 'Profile not found', error: profileResult.error.message });
    }
    if (notificationsResult.error) throw notificationsResult.error;
    if (membershipsResult.error) throw membershipsResult.error;

    const projectIds = [...new Set((membershipsResult.data || []).map((m) => m.project_id).filter(Boolean))];
    let projects = [];
    if (projectIds.length > 0) {
      const { data: projectRows, error: projectsError } = await supabase
        .from('projects')
        .select(STUDENT_PROJECT_SELECT)
        .in('id', projectIds)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;
      projects = await enrichProjectsWithAllocations(projectRows || []);
    }

    const notifications = notificationsResult.data || [];
    res.json({
      profile: profileResult.data,
      projects,
      notifications,
      meta: {
        unreadNotifications: notifications.filter((n) => !n.read).length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ====== PROJECT MANAGEMENT FUNCTIONS ======

export const createProject = async (req, res) => {
  try {
    const title = normalizeTextField(req.body?.title, { required: true, maxLength: 200 });
    const domain = normalizeTextField(req.body?.domain, { required: true, maxLength: 120 });
    const description = normalizeTextField(req.body?.description, { maxLength: 3000 });
    const abstract = normalizeTextField(req.body?.abstract, { maxLength: 3000 });
    const technologyStacks = normalizeTechnologyStacks(req.body?.technology_stacks);

    if (!title) {
      return res.status(400).json({ message: 'Project title is required' });
    }
    if (!domain) {
      return res.status(400).json({ message: 'Project domain is required' });
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        title,
        domain,
        description,
        abstract,
        technology_stacks: technologyStacks ?? [],
        created_by: req.user.id,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Ensure creator exists as team leader (safe even if DB trigger already inserted row).
    const { error: teamError } = await supabase
      .from('team_members')
      .insert({
        project_id: data.id,
        student_id: req.user.id,
        role: 'leader'
      });
    if (teamError && teamError.code !== '23505') throw teamError;

    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjects = async (req, res) => {
  try {
    let query = supabase.from('projects');

    // Filter based on user role
    if (req.userRole === 'student') {
      // Students see projects where they are a member.
      // Fetch ids first so nested team_members can include the entire team (not only self row).
      const { data: memberships, error: membershipError } = await supabase
        .from('team_members')
        .select('project_id')
        .eq('student_id', req.user.id);

      if (membershipError) throw membershipError;

      const projectIds = [...new Set((memberships || []).map((m) => m.project_id).filter(Boolean))];
      if (projectIds.length === 0) {
        return res.json([]);
      }

      const { data, error } = await supabase
        .from('projects')
        .select(STUDENT_PROJECT_SELECT)
        .in('id', projectIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json(await enrichProjectsWithAllocations(data || []));
    } else if (req.userRole === 'mentor') {
      const mentorProjectsSelect = `
        *,
        mentor:profiles!projects_mentor_id_fkey(id, full_name, email, department),
        guide:profiles!projects_guide_id_fkey(id, full_name, email, department),
        team_members(
          id, student_id, role,
          profiles!team_members_student_id_fkey(full_name, email, roll_number)
        ),
        documents(id, document_type, status, uploaded_at, file_name),
        evaluations(evaluation_type, obtained_marks, max_marks, feedback)
      `;

      const { data: assignedProjects, error: assignedError } = await supabase
        .from('projects')
        .select(mentorProjectsSelect)
        .or(`mentor_id.eq.${req.user.id},coordinator_id.eq.${req.user.id}`);

      if (assignedError) throw assignedError;

      // Coordinators additionally get projects from their batch scope.
      if (!req.isCoordinator || !req.userBatch) {
        return res.json(assignedProjects || []);
      }

      const { data: teamRows, error: teamRowsError } = await supabase
        .from('team_members')
        .select(`
          project_id,
          role,
          profiles!team_members_student_id_fkey(batch, class_section, department)
        `);

      if (teamRowsError) throw teamRowsError;

      const batchProjectIds = new Set();
      const grouped = {};
      (teamRows || []).forEach((row) => {
        if (!grouped[row.project_id]) grouped[row.project_id] = [];
        grouped[row.project_id].push(row);
      });

      Object.entries(grouped).forEach(([projectId, rows]) => {
        const leader = rows.find((r) => r.role === 'leader');
        const anchor = leader?.profiles || rows[0]?.profiles;
        if (!anchor) return;
        const projectBatch = anchor.batch || anchor.class_section || null;
        if (!projectBatch || projectBatch !== req.userBatch) return;
        if (req.userDepartment && anchor.department && anchor.department !== req.userDepartment) return;
        batchProjectIds.add(projectId);
      });

      const assignedIds = new Set((assignedProjects || []).map((p) => p.id));
      const extraIds = [...batchProjectIds].filter((id) => !assignedIds.has(id));
      if (extraIds.length === 0) {
        return res.json(assignedProjects || []);
      }

      const { data: extraProjects, error: extraError } = await supabase
        .from('projects')
        .select(mentorProjectsSelect)
        .in('id', extraIds);

      if (extraError) throw extraError;

      const combined = [...(assignedProjects || []), ...(extraProjects || [])];
      return res.json(await enrichProjectsWithAllocations(combined));
    } else if (req.userRole === 'admin') {
      // Admins see all projects
      query = query
        .select(`
          *,
          team_members(count),
          evaluations(count),
          mentor:profiles!projects_mentor_id_fkey(full_name, email),
          guide:profiles!projects_guide_id_fkey(full_name, email)
        `);
    }

    if (error) throw error;
    res.json(await enrichProjectsWithAllocations(data || []));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        mentor:profiles!projects_mentor_id_fkey(id, full_name, email, department),
        guide:profiles!projects_guide_id_fkey(id, full_name, email, department),
        team_members(
          id, student_id, role, joined_at,
          profiles!team_members_student_id_fkey(id, full_name, email, roll_number, department)
        ),
        documents(id, document_type, status, uploaded_at, file_name, file_url, version, feedback),
        evaluations(id, evaluation_type, obtained_marks, max_marks, feedback, created_at),
        individual_marks(
          id, student_id, category, obtained_marks, max_marks, feedback,
          profiles!individual_marks_student_id_fkey(full_name, email)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    const [enriched] = await enrichProjectsWithAllocations([data]);
    res.json(enriched || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, 'title')) {
      const title = normalizeTextField(req.body.title, { required: true, maxLength: 200 });
      if (!title) return res.status(400).json({ message: 'Project title cannot be empty' });
      updates.title = title;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'domain')) {
      const domain = normalizeTextField(req.body.domain, { required: true, maxLength: 120 });
      if (!domain) return res.status(400).json({ message: 'Project domain cannot be empty' });
      updates.domain = domain;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
      updates.description = normalizeTextField(req.body.description, { maxLength: 3000 });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'abstract')) {
      updates.abstract = normalizeTextField(req.body.abstract, { maxLength: 3000 });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'technology_stacks')) {
      updates.technology_stacks = normalizeTechnologyStacks(req.body.technology_stacks) ?? [];
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No valid project fields provided for update' });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const approveProject = async (req, res) => {
  try {
    const { status, feedback } = req.body; // status: 'approved' or 'rejected'

    const { data, error } = await supabase
      .from('projects')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Optionally create a feedback record
    if (feedback) {
      await supabase
        .from('evaluations')
        .insert({
          project_id: req.params.id,
          evaluator_id: req.user.id,
          evaluation_type: 'approval_feedback',
          max_marks: 0,
          obtained_marks: 0,
          feedback
        });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ====== TEAM MANAGEMENT FUNCTIONS ======

export const joinProject = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        project_id: req.params.id,
        student_id: req.user.id,
        role: 'member'
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ message: 'You are already a member of this project' });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
};

export const leaveProject = async (req, res) => {
  try {
    const projectId = req.params.id;

    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('id, role')
      .eq('project_id', projectId)
      .eq('student_id', req.user.id)
      .single();

    if (membershipError || !membership) {
      return res.status(404).json({ message: 'You are not a member of this project' });
    }

    if (membership.role === 'leader') {
      return res.status(400).json({ message: 'Leader cannot leave team. Transfer leadership or delete project.' });
    }

    const { data: projectRow, error: projectError } = await supabase
      .from('projects')
      .select('id, status')
      .eq('id', projectId)
      .single();

    if (projectError || !projectRow) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (isProjectLocked(projectRow.status)) {
      return res.status(400).json({ message: `Team is locked because project is ${projectRow.status}` });
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('project_id', projectId)
      .eq('student_id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Left project successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTeamMembers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        *,
        profiles!team_members_student_id_fkey(
          id, full_name, email, roll_number, phone
        )
      `)
      .eq('project_id', req.params.id);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ====== DOCUMENT MANAGEMENT FUNCTIONS ======

export const uploadDocument = async (req, res) => {
  try {
    const { document_type, file_name, file_url, file_size } = req.body;

    const { data, error } = await supabase
      .from('documents')
      .insert({
        project_id: req.params.id,
        uploaded_by: req.user.id,
        document_type,
        file_name,
        file_url,
        file_size,
        status: 'submitted'
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const removeTeamMember = async (req, res) => {
  try {
    const projectId = req.params.id;
    const targetStudentId = req.params.studentId;

    const { data: projectRow, error: projectError } = await supabase
      .from('projects')
      .select('id, title, status')
      .eq('id', projectId)
      .single();

    if (projectError || !projectRow) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (isProjectLocked(projectRow.status)) {
      return res.status(400).json({ message: `Team is locked because project is ${projectRow.status}` });
    }

    const { data: target, error: targetError } = await supabase
      .from('team_members')
      .select('id, role')
      .eq('project_id', projectId)
      .eq('student_id', targetStudentId)
      .single();

    if (targetError || !target) {
      return res.status(404).json({ message: 'Team member not found' });
    }

    if (req.userRole !== 'admin') {
      const { data: requester } = await supabase
        .from('team_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('student_id', req.user.id)
        .single();

      if (!requester || requester.role !== 'leader') {
        return res.status(403).json({ message: 'Only leader can remove team members' });
      }

      if (target.role === 'leader') {
        return res.status(400).json({ message: 'Leader cannot remove themselves from this action' });
      }
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('project_id', projectId)
      .eq('student_id', targetStudentId);

    if (error) throw error;

    const actorName = req.userRole === 'admin'
      ? 'Administrator'
      : safeProfileName(req.userProfile, 'Team Leader');
    const projectTitle = projectRow.title || 'your team';
    await createNotifications([
      {
        user_id: targetStudentId,
        type: 'team_member_removed',
        title: 'Removed from Team',
        message: `${actorName} removed you from ${projectTitle}.`,
      },
    ]);

    res.json({ message: 'Team member removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateDocument = async (req, res) => {
  try {
    const updates = {};
    const allowedFields = ['document_type', 'file_name', 'file_url', 'file_size', 'version', 'status', 'feedback'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    updates.uploaded_by = req.user.id;
    updates.uploaded_at = new Date().toISOString();

    const { data: current, error: currentError } = await supabase
      .from('documents')
      .select('id, project_id')
      .eq('id', req.params.id)
      .single();

    if (currentError || !current) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('project_id', current.project_id)
      .eq('student_id', req.user.id)
      .single();

    if (!membership) {
      return res.status(403).json({ message: 'You do not have access to this document' });
    }

    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    const { data: current, error: currentError } = await supabase
      .from('documents')
      .select('id, project_id')
      .eq('id', req.params.id)
      .single();

    if (currentError || !current) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('project_id', current.project_id)
      .eq('student_id', req.user.id)
      .single();

    if (!membership) {
      return res.status(403).json({ message: 'You do not have access to this document' });
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        profiles!documents_uploaded_by_fkey(full_name, email)
      `)
      .eq('project_id', req.params.id)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const approveDocument = async (req, res) => {
  try {
    const { status, feedback } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (feedback !== undefined) updates.feedback = feedback;

    const { data: doc, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', req.params.id)
      .select('*, projects(id, title)')
      .single();

    if (error) throw error;

    // Notify team members
    const { data: members } = await supabase
      .from('team_members')
      .select('student_id')
      .eq('project_id', doc.project_id);

    if (members?.length) {
      const actorName = safeProfileName(req.userProfile, 'Mentor');
      const projectTitle = doc.projects?.title || 'your project';

      const getNotifType = (s) => {
        if (s === 'approved') return 'document_approved';
        if (s === 'rejected') return 'document_rejected';
        return 'document_comment';
      };

      const getNotifTitle = (s) => {
        if (s === 'approved') return 'Document Approved';
        if (s === 'rejected') return 'Submission Rejected';
        return 'Feedback Received';
      };

      const rows = members.map(m => ({
        user_id: m.student_id,
        type: getNotifType(status),
        title: getNotifTitle(status),
        message: status
          ? `Submission "${doc.file_name}" in ${projectTitle} has been ${status} by ${actorName}.`
          : `New feedback received for "${doc.file_name}" in ${projectTitle}.`,
      }));
      await createNotifications(rows);
    }

    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ====== EVALUATION FUNCTIONS ======

export const createEvaluation = async (req, res) => {
  try {
    const { evaluation_type, max_marks, obtained_marks, feedback } = req.body;

    const { data, error } = await supabase
      .from('evaluations')
      .insert({
        project_id: req.params.id,
        evaluator_id: req.user.id,
        evaluation_type,
        max_marks,
        obtained_marks,
        feedback
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getEvaluations = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('evaluations')
      .select(`
        *,
        profiles!evaluations_evaluator_id_fkey(full_name, email)
      `)
      .eq('project_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateEvaluation = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('evaluations')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getIndividualMarks = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('individual_marks')
      .select(`
        *,
        profiles!individual_marks_student_id_fkey(full_name, email, roll_number),
        evaluator:profiles!individual_marks_evaluator_id_fkey(full_name, email)
      `)
      .eq('project_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateIndividualMarks = async (req, res) => {
  try {
    const { marks } = req.body; // Array of individual mark objects

    const results = [];
    for (const mark of marks) {
      const { data, error } = await supabase
        .from('individual_marks')
        .upsert({
          project_id: req.params.id,
          student_id: mark.student_id,
          evaluator_id: req.user.id,
          category: mark.category,
          max_marks: mark.max_marks,
          obtained_marks: mark.obtained_marks,
          feedback: mark.feedback
        })
        .select()
        .single();

      if (error) throw error;
      results.push(data);
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ====== ADMIN FUNCTIONS ======

export const getAllUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getSystemSettings = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*');

    if (error) throw error;

    // Convert to key-value object
    const settings = {};
    data?.forEach(setting => {
      settings[setting.setting_key] = setting.setting_value;
    });

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSystemSettings = async (req, res) => {
  try {
    const settings = req.body;
    const results = [];

    for (const [key, value] of Object.entries(settings)) {
      const { data, error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: key,
          setting_value: value,
          updated_by: req.user.id,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      results.push(data);
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const assignMentor = async (req, res) => {
  try {
    const { project_id, mentor_id, coordinator_id } = req.body;

    const { data, error } = await supabase
      .from('projects')
      .update({
        mentor_id,
        coordinator_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', project_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPendingProjects = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id,
        title,
        domain,
        description,
        status,
        created_at,
        created_by,
        team_members(student_id),
        creator:profiles!projects_created_by_fkey(id, full_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createJoinRequest = async (req, res) => {
  try {
    const { message } = req.body || {};
    const projectId = req.params.id;

    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('student_id', req.user.id)
      .single();

    if (membership) {
      return res.status(400).json({ message: 'You are already in this project' });
    }

    const { data: existingRequest, error: existingRequestError } = await supabase
      .from('join_requests')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('student_id', req.user.id)
      .single();

    if (existingRequestError && existingRequestError.code !== 'PGRST116') {
      throw existingRequestError;
    }

    if (existingRequest?.status === 'pending') {
      return res.status(400).json({ message: 'Join request already exists' });
    }

    let data;
    let reused = false;
    if (existingRequest?.id) {
      reused = true;
      const { data: updated, error: updateError } = await supabase
        .from('join_requests')
        .update({
          status: 'pending',
          message: message || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRequest.id)
        .select()
        .single();

      if (updateError) throw updateError;
      data = updated;
    } else {
      const { data: inserted, error } = await supabase
        .from('join_requests')
        .insert({
          project_id: projectId,
          student_id: req.user.id,
          status: 'pending',
          message: message || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ message: 'Join request already exists' });
        }
        throw error;
      }
      data = inserted;
    }

    const { data: projectRow } = await supabase
      .from('projects')
      .select('id, title')
      .eq('id', projectId)
      .single();

    const { data: leaders } = await supabase
      .from('team_members')
      .select('student_id')
      .eq('project_id', projectId)
      .eq('role', 'leader');

    const requesterName = safeProfileName(req.userProfile, 'Student');
    const projectTitle = projectRow?.title || 'your project';
    const leaderNotifications = (leaders || []).map((leader) => ({
      user_id: leader.student_id,
      type: 'join_request',
      title: 'New Join Request',
      message: `${requesterName} requested to join ${projectTitle}.`,
    }));
    await createNotifications(leaderNotifications);

    res.status(reused ? 200 : 201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getLeaderJoinRequests = async (req, res) => {
  try {
    const { data: leaderProjects, error: projectsError } = await supabase
      .from('team_members')
      .select('project_id')
      .eq('student_id', req.user.id)
      .eq('role', 'leader');

    if (projectsError) throw projectsError;

    const projectIds = (leaderProjects || []).map((row) => row.project_id);
    if (projectIds.length === 0) return res.json([]);

    const { data, error } = await supabase
      .from('join_requests')
      .select(`
        *,
        project:projects(id, title),
        student:profiles!join_requests_student_id_fkey(id, full_name, email, roll_number, department, semester)
      `)
      .in('project_id', projectIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getMyJoinRequests = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('join_requests')
      .select('*')
      .eq('student_id', req.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const respondToJoinRequest = async (req, res) => {
  try {
    const { action } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be approve or reject' });
    }

    const { data: requestRow, error: requestError } = await supabase
      .from('join_requests')
      .select('id, project_id, student_id, status')
      .eq('id', req.params.id)
      .single();

    if (requestError || !requestRow) {
      return res.status(404).json({ message: 'Join request not found' });
    }

    const { data: leaderMembership } = await supabase
      .from('team_members')
      .select('id')
      .eq('project_id', requestRow.project_id)
      .eq('student_id', req.user.id)
      .eq('role', 'leader')
      .single();

    if (!leaderMembership) {
      return res.status(403).json({ message: 'Only team leaders can manage this request' });
    }

    if (action === 'approve') {
      const { error: addError } = await supabase
        .from('team_members')
        .insert({
          project_id: requestRow.project_id,
          student_id: requestRow.student_id,
          role: 'member',
        });

      if (addError && addError.code !== '23505') throw addError;
    }

    const finalStatus = action === 'approve' ? 'approved' : 'rejected';
    const { data, error } = await supabase
      .from('join_requests')
      .update({
        status: finalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestRow.id)
      .select()
      .single();

    if (error) throw error;

    const { data: projectRow } = await supabase
      .from('projects')
      .select('id, title')
      .eq('id', requestRow.project_id)
      .single();

    const { data: leaderProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', req.user.id)
      .single();

    const leaderName = safeProfileName(leaderProfile, 'Team Leader');
    const projectTitle = projectRow?.title || 'your requested project';
    const decisionText = finalStatus === 'approved' ? 'approved' : 'rejected';

    await createNotifications([
      {
        user_id: requestRow.student_id,
        type: finalStatus === 'approved' ? 'join_request_approved' : 'join_request_rejected',
        title: `Join Request ${finalStatus === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `${leaderName} ${decisionText} your join request for ${projectTitle}.`,
      },
    ]);

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ====== NOTIFICATION FUNCTIONS ======

export const getNotifications = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, user_id, type, title, message, read, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id, user_id, type, title, message, read, created_at')
      .single();

    if (error) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user.id)
      .eq('read', false);

    if (error) throw error;
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ====== LEGACY FUNCTIONS (for backwards compatibility) ======

export const getAllItems = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const from = (page - 1) * limit;
    const to = from + parseInt(limit) - 1;

    const { data, error, count } = await supabase
      .from('projects') // Changed from 'items' to 'projects'
      .select('*', { count: 'exact' })
      .range(from, to);

    if (error) throw error;

    res.json({
      data: data || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createItem = async (req, res) => {
  // Redirect to createProject for backwards compatibility
  return createProject(req, res);
};
