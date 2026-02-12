import { supabase, supabaseAdmin } from '../config/supabase.js';

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

// ====== PROJECT MANAGEMENT FUNCTIONS ======

export const createProject = async (req, res) => {
  try {
    const { title, description, abstract } = req.body;
    
    const { data, error } = await supabase
      .from('projects')
      .insert({
        title,
        description,
        abstract,
        created_by: req.user.id,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Automatically add creator as team leader
    await supabase
      .from('team_members')
      .insert({
        project_id: data.id,
        student_id: req.user.id,
        role: 'leader'
      });

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
      // Students see only their projects
      query = query
        .select(`
          *,
          team_members!inner(student_id, role),
          documents(id, document_type, status, uploaded_at),
          evaluations(evaluation_type, obtained_marks, max_marks, feedback)
        `)
        .eq('team_members.student_id', req.user.id);
    } else if (req.userRole === 'mentor') {
      // Mentors see assigned projects
      query = query
        .select(`
          *,
          team_members(
            id, student_id, role,
            profiles!team_members_student_id_fkey(full_name, email, roll_number)
          ),
          documents(id, document_type, status, uploaded_at, file_name),
          evaluations(evaluation_type, obtained_marks, max_marks, feedback)
        `)
        .or(`mentor_id.eq.${req.user.id},coordinator_id.eq.${req.user.id}`);
    } else if (req.userRole === 'admin') {
      // Admins see all projects
      query = query
        .select(`
          *,
          team_members(count),
          evaluations(count),
          profiles!projects_mentor_id_fkey(full_name, email)
        `);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    res.json(data || []);
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
        team_members(
          id, student_id, role, joined_at,
          profiles!team_members_student_id_fkey(id, full_name, email, roll_number)
        ),
        documents(id, document_type, status, uploaded_at, file_name, file_url),
        evaluations(id, evaluation_type, obtained_marks, max_marks, feedback, created_at),
        individual_marks(
          id, student_id, category, obtained_marks, max_marks, feedback,
          profiles!individual_marks_student_id_fkey(full_name, email)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
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
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('project_id', req.params.id)
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
    const { status, feedback } = req.body; // status: 'approved' or 'needs_revision'
    
    const { data, error } = await supabase
      .from('documents')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
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
