import {
  getAdminClasses,
  deleteRubric,
  getActiveRubricsByStage,
  getAdminFinalResults,
  getCoordinatorFinalResults,
  getProjectStageBreakdown,
  getRubricsForAdmin,
  getStudentPublishedResult,
  publishFinalResults,
  saveRubricsForStage,
  upsertStageMarks,
} from '../services/rubricEvaluationService.js';

const translateSchemaError = (error) => {
  const rawMessage = String(error?.message || '');

  if (rawMessage.includes("Could not find the table 'public.final_results' in the schema cache")) {
    const translated = new Error('The "final_results" table is missing in Supabase. Run the SQL in etnova-backend/sql/rubrics_evaluation_schema.sql and refresh the schema cache.');
    translated.status = 500;
    return translated;
  }

  if (rawMessage.includes("Could not find the table 'public.rubrics' in the schema cache")) {
    const translated = new Error('The "rubrics" table is missing in Supabase. Run the SQL in etnova-backend/sql/rubrics_evaluation_schema.sql and refresh the schema cache.');
    translated.status = 500;
    return translated;
  }

  if (rawMessage.includes("column rubrics.review_round does not exist") || rawMessage.includes("Could not find the 'review_round' column of 'rubrics'")) {
    const translated = new Error('The "rubrics.review_round" column is missing in Supabase. Run the SQL in etnova-backend/sql/rubrics_evaluation_schema.sql and refresh the schema cache.');
    translated.status = 500;
    return translated;
  }

  return error;
};

const handleControllerError = (res, error) => {
  const resolvedError = translateSchemaError(error);
  const status = resolvedError?.status || 500;
  return res.status(status).json({ message: resolvedError.message || 'Unexpected server error.' });
};

export const listRubrics = async (req, res) => {
  try {
    const { stage, review_stage: reviewStage } = req.query;
    if (!stage) {
      return res.status(400).json({ message: 'stage query parameter is required.' });
    }

    const result = req.userRole === 'admin'
      ? await getRubricsForAdmin(stage, reviewStage || null)
      : await getActiveRubricsByStage(stage, reviewStage || null);

    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const saveStageRubrics = async (req, res) => {
  try {
    const { stage } = req.params;
    const { rubrics, review_stage: reviewStage } = req.body || {};
    const result = await saveRubricsForStage({
      stage,
      rubrics,
      adminId: req.user.id,
      reviewStage: reviewStage || null,
    });

    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const removeRubric = async (req, res) => {
  try {
    await deleteRubric(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const submitStageMarks = async (req, res) => {
  try {
    const { stage, id: projectId } = req.params;
    const { entries, review_stage: reviewStage, feedback_entries: feedbackEntries } = req.body || {};
    const result = await upsertStageMarks({
      stage,
      projectId,
      evaluatorId: req.user.id,
      entries,
      reviewStage,
      feedbackEntries,
      senderName: req.userProfile?.full_name || req.userProfile?.email || 'Guide',
    });

    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getStageMarksBreakdown = async (req, res) => {
  try {
    if (req.userRole === 'admin') {
      return res.status(403).json({ message: 'Admin users cannot access rubric-wise marks.' });
    }

    const { stage, id: projectId } = req.params;
    const result = await getProjectStageBreakdown({
      projectId,
      stage,
      reviewStage: req.query.review_stage || null,
      evaluatorId: req.user.id,
      coordinatorView: Boolean(req.isCoordinator),
    });
    if (req.isCoordinator) {
      return res.json(result);
    }

    return res.json({
      stage: result.stage,
      rubrics: result.rubrics,
      students: result.students.map((student) => ({
        student_id: student.student_id,
        full_name: student.full_name,
        roll_number: student.roll_number,
        marks: student.marks,
      })),
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getAdminFinalMarks = async (req, res) => {
  try {
    const result = await getAdminFinalResults();
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getAdminClassList = async (req, res) => {
  try {
    const result = await getAdminClasses();
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const publishResults = async (req, res) => {
  try {
    const { student_ids: studentIds } = req.body || {};
    const result = await publishFinalResults({
      studentIds,
      adminId: req.user.id,
    });
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getMyPublishedResult = async (req, res) => {
  try {
    const result = await getStudentPublishedResult(req.user.id);
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getCoordinatorResultsBreakdown = async (req, res) => {
  try {
    const classId = req.userProfile?.class_id;
    if (!classId) {
      return res.status(403).json({ message: 'Coordinator class scope not found.' });
    }

    const result = await getCoordinatorFinalResults(classId);
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error);
  }
};
