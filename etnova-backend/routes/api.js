import express from 'express';
import { 
  getDashboardData,
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
  removeTeamMember,

  // Document management
  uploadDocument,
  updateDocument,
  deleteDocument,
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
  assignMentor,

  // Join request management
  getPendingProjects,
  createJoinRequest,
  getLeaderJoinRequests,
  getMyJoinRequests,
  respondToJoinRequest,

  // Notifications
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from '../controllers/apiController.js';
import { authenticateUser, requireRole, requireCoordinator, canAccessProject } from '../middleware/supabaseAuth.js';

const router = express.Router();

// ====== USER PROFILE ROUTES ======
router.get('/dashboard-data', authenticateUser, getDashboardData);
router.get('/profile', authenticateUser, getUserProfile);
router.put('/profile', authenticateUser, updateUserProfile);

// ====== PROJECT ROUTES ======
router.get('/projects/public/pending', authenticateUser, requireRole(['student']), getPendingProjects);

// Student routes
router.post('/projects', authenticateUser, requireRole(['student']), createProject);
router.get('/projects', authenticateUser, getProjects); // Get projects based on user role
router.get('/projects/:id', authenticateUser, canAccessProject(), getProjectById);
router.put('/projects/:id', authenticateUser, canAccessProject({ studentMustBeLeader: true }), updateProject);
router.delete('/projects/:id', authenticateUser, requireRole(['student', 'admin']), canAccessProject({ studentMustBeLeader: true }), deleteProject);

// Mentor routes
router.put('/projects/:id/approve', authenticateUser, requireRole(['mentor', 'admin']), canAccessProject(), approveProject);

// ====== TEAM MANAGEMENT ROUTES ======
router.post('/projects/:id/join', authenticateUser, requireRole(['student']), joinProject);
router.delete('/projects/:id/leave', authenticateUser, requireRole(['student']), leaveProject);
router.get('/projects/:id/team', authenticateUser, canAccessProject(), getTeamMembers);
router.delete('/projects/:id/team/:studentId', authenticateUser, requireRole(['student', 'admin']), canAccessProject({ studentMustBeLeader: true }), removeTeamMember);

// ====== DOCUMENT ROUTES ======
router.post('/projects/:id/documents', authenticateUser, requireRole(['student']), canAccessProject(), uploadDocument);
router.get('/projects/:id/documents', authenticateUser, canAccessProject(), getDocuments);
router.put('/documents/:id', authenticateUser, requireRole(['student']), updateDocument);
router.delete('/documents/:id', authenticateUser, requireRole(['student']), deleteDocument);
router.put('/documents/:id/approve', authenticateUser, requireRole(['mentor', 'admin']), approveDocument);

// ====== JOIN REQUEST ROUTES ======
router.post('/projects/:id/join-requests', authenticateUser, requireRole(['student']), createJoinRequest);
router.get('/join-requests/leader', authenticateUser, requireRole(['student']), getLeaderJoinRequests);
router.get('/join-requests/my', authenticateUser, requireRole(['student']), getMyJoinRequests);
router.put('/join-requests/:id', authenticateUser, requireRole(['student']), respondToJoinRequest);

// ====== NOTIFICATION ROUTES ======
router.get('/notifications', authenticateUser, getNotifications);
router.put('/notifications/read-all', authenticateUser, markAllNotificationsRead);
router.put('/notifications/:id/read', authenticateUser, markNotificationRead);

// ====== EVALUATION ROUTES ======
// Mentor/Coordinator routes for evaluations
router.post('/projects/:id/evaluations', authenticateUser, requireRole(['mentor']), canAccessProject(), createEvaluation);
router.get('/projects/:id/evaluations', authenticateUser, canAccessProject(), getEvaluations);
router.put('/evaluations/:id', authenticateUser, requireRole(['mentor']), updateEvaluation);

// Individual student marks (Coordinator only)
router.get('/projects/:id/individual-marks', authenticateUser, requireRole(['mentor']), requireCoordinator, canAccessProject(), getIndividualMarks);
router.put('/projects/:id/individual-marks', authenticateUser, requireRole(['mentor']), requireCoordinator, canAccessProject(), updateIndividualMarks);

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
