import { supabase } from '../config/supabase.js';

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

    // Get user profile with role information
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      // Continue with basic user info if profile fetch fails
      req.user = user;
      req.userRole = user.user_metadata?.role || 'student';
    } else {
      req.user = user;
      req.userProfile = profile;
      req.userRole = profile.role;
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

// Check if user can access specific project (student must be team member, mentor must be assigned)
export const canAccessProject = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;
    const userRole = req.userRole;

    if (userRole === 'admin') {
      // Admins can access all projects
      return next();
    }

    const { data: project, error } = await supabase
      .from('projects')
      .select(`
        *,
        team_members(student_id)
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
      hasAccess = project.team_members?.some(member => member.student_id === userId);
    } else if (userRole === 'mentor') {
      // Mentors can access if they are assigned as mentor or coordinator
      hasAccess = project.mentor_id === userId || project.coordinator_id === userId;
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
