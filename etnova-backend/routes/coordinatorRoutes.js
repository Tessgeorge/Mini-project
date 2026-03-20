import express from 'express';
import {
  getClassOverview,
  getSubmissionQueue,
  verifySubmission,
  returnSubmission,
  getClassTeams,
  getDeadlines,
  saveDeadlines,
  getReviewerAccess,
  saveReviewerAccess,
  getDepartmentMentors,
} from '../controllers/coordinatorController.js';

const router = express.Router();

// All routes here are already protected by authMiddleware applied in server.js
// before this router is mounted — same pattern as your existing api.js

router.get('/class',                     getClassOverview);
router.get('/submissions',               getSubmissionQueue);
router.patch('/submissions/:id/verify',  verifySubmission);
router.patch('/submissions/:id/return',  returnSubmission);
router.get('/teams',                     getClassTeams);
router.get('/deadlines',                 getDeadlines);
router.put('/deadlines',                 saveDeadlines);
router.get('/reviewer-access',           getReviewerAccess);
router.put('/reviewer-access',           saveReviewerAccess);
router.get('/department-mentors',        getDepartmentMentors);

export default router;