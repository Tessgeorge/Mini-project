import express from 'express';
import {
  getClassOverview,
  getSubmissionQueue,
  verifySubmission,
  returnSubmission,
  getClassTeams,
  saveTeamBatches,
  getDeadlines,
  saveDeadlines,
  getReviewerAccess,
  saveReviewerAccess,
  getDepartmentMentors,
  listInternalMarks,
  saveInternalMarks,
  publishCoordinatorResults,
} from '../controllers/coordinatorController.js';
import { getCoordinatorResultsBreakdown } from '../controllers/rubricController.js';

const router = express.Router();

router.get('/class', getClassOverview);
router.get('/submissions', getSubmissionQueue);
router.patch('/submissions/:id/verify', verifySubmission);
router.patch('/submissions/:id/return', returnSubmission);
router.get('/teams', getClassTeams);
router.put('/teams/batches', saveTeamBatches);
router.get('/deadlines', getDeadlines);
router.put('/deadlines', saveDeadlines);
router.get('/reviewer-access', getReviewerAccess);
router.put('/reviewer-access', saveReviewerAccess);
router.get('/department-mentors', getDepartmentMentors);
router.get('/internal-marks', listInternalMarks);
router.put('/internal-marks', saveInternalMarks);
router.get('/final-results/breakdown', getCoordinatorResultsBreakdown);
router.post('/results/publish', publishCoordinatorResults);

export default router;
