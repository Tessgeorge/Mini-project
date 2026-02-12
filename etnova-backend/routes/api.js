import express from 'express';
import { 
  getUserProfile, 
  updateUserProfile,

  // Project management
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  approveProject,

  // Team management  
  joinProject,
  leaveProject,
  getTeamMembers,

  // Document management
  uploadDocument,
  getDocuments,
  approveDocument,

  // Evaluation management
  createEvaluation,
  getEvaluations,
  updateEvaluation,
  getIndividualMarks,
  updateIndividualMarks,

  // Admin functions
  getAllUsers,
  getSystemSettings,
  updateSystemSettings,
  assignMentor
} from '../controllers/apiController.js';
import { authenticateUser, requireRole } from '../middleware/supabaseAuth.js';

const router = express.Router();

// ====== USER PROFILE ROUTES ======
router.get('/profile', authenticateUser, getUserProfile);
router.put('/profile', authenticateUser, updateUserProfile);

// ====== PROJECT ROUTES ======
// Student routes
router.post('/projects', authenticateUser, requireRole(['student']), createProject);
router.get('/projects', authenticateUser, getProjects); // Get projects based on user role
router.get('/projects/:id', authenticateUser, getProjectById);
router.put('/projects/:id', authenticateUser, updateProject);
router.delete('/projects/:id', authenticateUser, requireRole(['student', 'admin']), deleteProject);

// Mentor routes
router.put('/projects/:id/approve', authenticateUser, requireRole(['mentor', 'admin']), approveProject);

// ====== TEAM MANAGEMENT ROUTES ======
router.post('/projects/:id/join', authenticateUser, requireRole(['student']), joinProject);
router.delete('/projects/:id/leave', authenticateUser, requireRole(['student']), leaveProject);
router.get('/projects/:id/team', authenticateUser, getTeamMembers);

// ====== DOCUMENT ROUTES ======
router.post('/projects/:id/documents', authenticateUser, requireRole(['student']), uploadDocument);
router.get('/projects/:id/documents', authenticateUser, getDocuments);
router.put('/documents/:id/approve', authenticateUser, requireRole(['mentor', 'admin']), approveDocument);

// ====== EVALUATION ROUTES ======
// Mentor/Coordinator routes for evaluations
router.post('/projects/:id/evaluations', authenticateUser, requireRole(['mentor']), createEvaluation);
router.get('/projects/:id/evaluations', authenticateUser, getEvaluations);
router.put('/evaluations/:id', authenticateUser, requireRole(['mentor']), updateEvaluation);

// Individual student marks (Coordinator only)
router.get('/projects/:id/individual-marks', authenticateUser, requireRole(['mentor']), getIndividualMarks);
router.put('/projects/:id/individual-marks', authenticateUser, requireRole(['mentor']), updateIndividualMarks);

// ====== ADMIN ROUTES ======
router.get('/admin/users', authenticateUser, requireRole(['admin']), getAllUsers);
router.get('/admin/settings', authenticateUser, requireRole(['admin']), getSystemSettings);
router.put('/admin/settings', authenticateUser, requireRole(['admin']), updateSystemSettings);
router.post('/admin/assign-mentor', authenticateUser, requireRole(['admin']), assignMentor);

// ====== PUBLIC ROUTES ======
router.get('/public/info', (req, res) => {
  res.json({ 
    message: 'Etnova API - Academic Project Management System',
    version: '1.0.0',
    features: [
      'Role-based project management',
      'Document submission and review',
      'Evaluation and marking system',
      'Team collaboration'
    ]
  });
});

export default router;
