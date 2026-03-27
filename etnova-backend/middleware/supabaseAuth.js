import { supabase, supabaseAdmin } from '../config/supabase.js';

const isDev = process.env.NODE_ENV !== 'production';

// Middleware to verify Supabase JWT token
export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (isDev && user?.id) {
      console.log('DEBUG AUTH: User ID:', user.id);
    }

    // Get user profile with role information
    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (isDev && profileError) {
      console.log('DEBUG AUTH: Profile fetch failed for ID:', user.id, profileError);
    }
    if (profileError) {
      console.error('Profile fetch error:', profileError);
      // Continue with basic user info if profile fetch fails
      req.user = user;
      req.userRole = user.user_metadata?.role || 'student';
      req.userProfile = null;
      req.isCoordinator = false;
      req.userBatch = null;
      req.userDepartment = null;
    } else {
      req.user = user;
      req.userProfile = profile;
      req.userRole = profile.role;
      req.isCoordinator = Boolean(profile.is_coordinator);
      req.userBatch = profile.batch || profile.class_section || null;
      req.userDepartment = profile.department || null;
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
};

// Middleware to check specific roles
export const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const userRole = req.userRole;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          message: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${userRole}`
        });
      }

      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      res.status(500).json({ message: 'Authorization error' });
    }
  };
};

// Backwards compatibility
export const requireAdmin = requireRole(['admin']);

export const requireCoordinator = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  if (req.userRole !== 'mentor' || !req.isCoordinator) {
    return res.status(403).json({ message: 'Coordinator access required' });
  }
  next();
};

const isProjectInCoordinatorScope = async (projectId, req) => {
  if (!req.isCoordinator || !req.userBatch) return false;

  const { data: members, error } = await supabaseAdmin
    .from('team_members')
    .select(`
      role,
      profiles!team_members_student_id_fkey(batch, class_section, department)
    `)
    .eq('project_id', projectId);

  if (error || !members?.length) return false;

  const leader = members.find((m) => m.role === 'leader');
  const anchor = leader?.profiles || members[0]?.profiles;
  if (!anchor) return false;

  const projectBatch = anchor.batch || anchor.class_section || null;
  if (!projectBatch || projectBatch !== req.userBatch) return false;

  if (!req.userDepartment) return true;
  if (!anchor.department) return true;

  return anchor.department === req.userDepartment;
};

const resolveProjectReviewerScope = async (project) => {
  if (!project?.id) {
    return { class_id: project?.class_id || null, batch: project?.batch ?? null };
  }

  if (project?.class_id && project?.batch != null) {
    return { class_id: project.class_id, batch: project.batch };
  }

  const { data: members, error } = await supabaseAdmin
    .from('team_members')
    .select(`
      role,
      profiles!team_members_student_id_fkey(class_id, class_section, batch)
    `)
    .eq('project_id', project.id);

  if (error || !members?.length) {
    return { class_id: project?.class_id || null, batch: project?.batch ?? null };
  }

  const leader = members.find((member) => member.role === 'leader');
  const anchor = leader?.profiles || members[0]?.profiles || null;

  return {
    class_id: project?.class_id || anchor?.class_id || null,
    batch: project?.batch ?? anchor?.batch ?? null,
  };
};

const hasReviewerAccessForProject = async ({ project, userId }) => {
  if (!userId) return false;
  const projectScope = await resolveProjectReviewerScope(project);
  if (!projectScope?.class_id) return false;

  const { data, error } = await supabaseAdmin
    .from('reviewer_access')
    .select('id, batch')
    .eq('class_id', projectScope.class_id)
    .eq('mentor_id', userId)
    .limit(20);

  if (error) throw error;
  const accessRows = data || [];
  if (!accessRows.length) return false;

  const specificBatchRows = accessRows.filter((row) => row.batch != null);
  const effectiveRows = specificBatchRows.length > 0 ? specificBatchRows : accessRows;

  if (projectScope.batch == null) {
    return effectiveRows.some((row) => row.batch == null);
  }

  return effectiveRows.some((row) => row.batch == null || Number(row.batch) === Number(projectScope.batch));
};

// Check if user can access specific project (student must be team member, mentor must be assigned)
export const canAccessProject = (options = {}) => async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;
    const userRole = req.userRole;
    const {
      allowCoordinatorBatchScope = true,
      studentMustBeLeader = false,
    } = options;

    if (userRole === 'admin') {
      // Admins can access all projects
      return next();
    }

    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select(`
        *,
        team_members(student_id, role)
      `)
      .eq('id', projectId)
      .single();

    if (error || !project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check access based on role
    let hasAccess = false;

    if (userRole === 'student') {
      // Students can access if they are team members
      const myTeamRow = project.team_members?.find((member) => member.student_id === userId);
      hasAccess = Boolean(myTeamRow);
      if (hasAccess && studentMustBeLeader) {
        hasAccess = myTeamRow.role === 'leader' || project.created_by === userId;
      }
    } else if (userRole === 'mentor') {
      // Mentors can access if they are assigned as mentor or coordinator
      const assignedGuideId = project.guide_id ?? project.mentor_id;
      hasAccess = assignedGuideId === userId || project.coordinator_id === userId;
      if (!hasAccess) {
        hasAccess = await hasReviewerAccessForProject({ project, userId });
      }
      if (!hasAccess && allowCoordinatorBatchScope) {
        hasAccess = await isProjectInCoordinatorScope(projectId, req);
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have access to this project' });
    }

    req.project = project;
    next();
  } catch (error) {
    console.error('Project access middleware error:', error);
    res.status(500).json({ message: 'Project access check failed' });
  }
};
