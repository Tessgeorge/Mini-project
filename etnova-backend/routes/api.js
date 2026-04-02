import express from 'express';
import { 
  getDashboardData,
  getAdminDashboardData,
  getAdminGuideAllocationData,
  getAdminMentorManagementData,
  getAdminReviewManagementData,
  getUserProfile, 
  updateUserProfile,

  // Project management
  createProject,
  getProjects,
  getMyReviewerAccess,
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
import {
  getProjectIdeas,
  createProjectIdea,
  updateProjectIdea,
  submitProjectIdea,
  getProjectIdeaChats,
  createProjectIdeaChatSession,
  getProjectIdeaChatMessages,
  renameProjectIdeaChatSession,
  deleteProjectIdeaChatSession,
  sendProjectIdeaChatMessage,
  generateProjectIdeaDraft,
  generateProjectIdeaChat,
  getProjectIdeaChat,
  getMentorIdeas,
  reviewProjectIdea,
} from '../controllers/ideaController.js';
import {
  getAdminClassList,
  getAdminFinalMarks,
  getMyPublishedResult,
  getStageEntryLock,
  getStageMarksBreakdown,
  listRubrics,
  publishResults,
  revokeResults,
  removeRubric,
  saveStageRubrics,
  submitStageMarks,
  updateStageEntryLock,
} from '../controllers/rubricController.js';
import { authenticateUser, requireRole, requireCoordinator, canAccessProject } from '../middleware/supabaseAuth.js';

const router = express.Router();

// ====== USER PROFILE ROUTES ======
router.get('/dashboard-data', authenticateUser, getDashboardData);
router.get('/admin/dashboard-data', authenticateUser, requireRole(['admin']), getAdminDashboardData);
router.get('/admin/guide-allocation-data', authenticateUser, requireRole(['admin']), getAdminGuideAllocationData);
router.get('/admin/mentor-management-data', authenticateUser, requireRole(['admin']), getAdminMentorManagementData);
router.get('/admin/review-management-data', authenticateUser, requireRole(['admin']), getAdminReviewManagementData);
router.get('/profile', authenticateUser, getUserProfile);
router.put('/profile', authenticateUser, updateUserProfile);

// ====== PROJECT ROUTES ======
router.get('/projects/public/pending', authenticateUser, requireRole(['student']), getPendingProjects);

// Student routes
router.post('/projects', authenticateUser, requireRole(['student']), createProject);
router.get('/projects', authenticateUser, getProjects); // Get projects based on user role
router.get('/reviewer-access/me', authenticateUser, requireRole(['mentor']), getMyReviewerAccess);
router.get('/projects/:id', authenticateUser, canAccessProject(), getProjectById);
router.put('/projects/:id', authenticateUser, requireRole(['student']), canAccessProject(), updateProject);
router.delete('/projects/:id', authenticateUser, requireRole(['student', 'admin']), canAccessProject({ studentMustBeLeader: true }), deleteProject);
router.get('/projects/:id/ideas', authenticateUser, canAccessProject(), getProjectIdeas);
router.post('/projects/:id/ideas', authenticateUser, requireRole(['student']), canAccessProject(), createProjectIdea);
router.put('/projects/:id/ideas/:ideaId', authenticateUser, requireRole(['student']), canAccessProject(), updateProjectIdea);
router.post('/projects/:id/ideas/:ideaId/submit', authenticateUser, requireRole(['student']), canAccessProject(), submitProjectIdea);
router.get('/projects/:id/idea-chats', authenticateUser, requireRole(['student']), canAccessProject(), getProjectIdeaChats);
router.post('/projects/:id/idea-chats', authenticateUser, requireRole(['student']), canAccessProject(), createProjectIdeaChatSession);
router.post('/projects/:id/ideas/assistant-draft', authenticateUser, requireRole(['student']), canAccessProject(), generateProjectIdeaDraft);
router.get('/idea-chats/:chatId/messages', authenticateUser, requireRole(['student']), getProjectIdeaChatMessages);
router.put('/idea-chats/:chatId', authenticateUser, requireRole(['student']), renameProjectIdeaChatSession);
router.delete('/idea-chats/:chatId', authenticateUser, requireRole(['student']), deleteProjectIdeaChatSession);
router.post('/idea-chats/:chatId/messages', authenticateUser, requireRole(['student']), sendProjectIdeaChatMessage);
router.get('/ideas/:ideaId/chat', authenticateUser, requireRole(['student']), getProjectIdeaChat);
router.post('/ideas/:ideaId/chat', authenticateUser, requireRole(['student']), generateProjectIdeaChat);

// Mentor routes
router.put('/projects/:id/approve', authenticateUser, requireRole(['mentor', 'admin']), canAccessProject(), approveProject);
router.get('/mentor/ideas', authenticateUser, requireRole(['mentor', 'admin']), getMentorIdeas);
router.post('/mentor/ideas/:ideaId/review', authenticateUser, requireRole(['mentor', 'admin']), reviewProjectIdea);

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
router.get('/evaluation-rubrics', authenticateUser, requireRole(['admin', 'mentor']), listRubrics);
router.get('/projects/:id/rubric-marks/:stage', authenticateUser, requireRole(['mentor']), canAccessProject(), getStageMarksBreakdown);
router.put('/projects/:id/rubric-marks/:stage', authenticateUser, requireRole(['mentor']), canAccessProject(), submitStageMarks);
router.get('/projects/:id/rubric-marks/:stage/lock', authenticateUser, requireRole(['mentor']), canAccessProject(), getStageEntryLock);
router.put('/projects/:id/rubric-marks/:stage/lock', authenticateUser, requireRole(['mentor']), canAccessProject(), updateStageEntryLock);

// Individual student marks (Coordinator only)
router.get('/projects/:id/individual-marks', authenticateUser, requireRole(['mentor']), requireCoordinator, canAccessProject(), getIndividualMarks);
router.put('/projects/:id/individual-marks', authenticateUser, requireRole(['mentor']), requireCoordinator, canAccessProject(), updateIndividualMarks);

// ====== ADMIN ROUTES ======
router.get('/admin/users', authenticateUser, requireRole(['admin']), getAllUsers);
router.get('/admin/settings', authenticateUser, requireRole(['admin']), getSystemSettings);
router.put('/admin/settings', authenticateUser, requireRole(['admin']), updateSystemSettings);
router.post('/admin/assign-mentor', authenticateUser, requireRole(['admin']), assignMentor);
router.get('/admin/rubrics', authenticateUser, requireRole(['admin']), listRubrics);
router.put('/admin/rubrics/:stage', authenticateUser, requireRole(['admin']), saveStageRubrics);
router.delete('/admin/rubrics/:id', authenticateUser, requireRole(['admin']), removeRubric);
router.get('/admin/classes', authenticateUser, requireRole(['admin']), getAdminClassList);
router.get('/admin/final-results', authenticateUser, requireRole(['admin']), getAdminFinalMarks);
router.post('/admin/final-results/publish', authenticateUser, requireRole(['admin']), publishResults);
router.post('/admin/final-results/revoke', authenticateUser, requireRole(['admin']), revokeResults);

// Student published result route
router.get('/results/me', authenticateUser, requireRole(['student']), getMyPublishedResult);

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
