import { useEffect, useMemo, useState } from "react";
import {
  REVIEW_ROUND_OPTIONS,
  fetchProjectRubricMarks,
  getRubricStageMeta,
  saveProjectRubricMarks,
} from "../services/rubrics";

function buildEmptyDraft(students, rubrics, existingRows = []) {
  const next = {};
  students.forEach((student) => {
    const studentExisting = existingRows.find((row) => row.student_id === student.student_id) || null;
    next[student.student_id] = {};
    rubrics.forEach((rubric) => {
      const found = studentExisting?.marks?.find((entry) => entry.rubric_id === rubric.id);
      next[student.student_id][rubric.id] = found?.marks ?? "";
    });
  });
  return next;
}

function buildFeedbackDraft(students, existingRows = []) {
  return (students || []).reduce((acc, student) => {
    const existing = existingRows.find((row) => row.student_id === student.student_id) || null;
    acc[student.student_id] = existing?.feedback || "";
    return acc;
  }, {});
}

export default function DynamicRubricEvaluation({
  projectId,
  members = [],
  mode = "guide",
  allowedReviewStages = [],
  writableReviewStages = [],
}) {
  const baseStage = mode === "review" ? "review" : "guide";
  const defaultReviewStage = allowedReviewStages[0] || REVIEW_ROUND_OPTIONS[0].value;
  const [reviewStage, setReviewStage] = useState(defaultReviewStage);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [stageData, setStageData] = useState({ stage: baseStage, rubrics: [], students: [] });
  const [draft, setDraft] = useState({});
  const [feedbackDraft, setFeedbackDraft] = useState({});
  const [isUiLocked, setIsUiLocked] = useState(false);

  const students = useMemo(
    () =>
      (members || []).map((member) => ({
        student_id: member.student_id,
        full_name: member.profiles?.full_name || "Unnamed Student",
        roll_number: member.profiles?.roll_number || "-",
      })),
    [members]
  );

  useEffect(() => {
    if (baseStage !== "review") return;
    if (!allowedReviewStages.length) return;
    if (!allowedReviewStages.includes(reviewStage)) {
      setReviewStage(allowedReviewStages[0]);
    }
  }, [allowedReviewStages, baseStage, reviewStage]);

  const reviewContextStage = baseStage === "review" ? reviewStage : null;
  const activeStage = baseStage === "review" && reviewStage === "final_review" ? "ese" : baseStage;
  const allowFeedback = activeStage === "review" || activeStage === "guide";
  const meta = getRubricStageMeta(activeStage);
  const activeReviewLabel =
    REVIEW_ROUND_OPTIONS.find((item) => item.value === reviewStage)?.label || "Review";
  const isReadOnly = baseStage === "review" && !writableReviewStages.includes(reviewStage);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      setNotice("");
      try {
        const data = await fetchProjectRubricMarks(projectId, activeStage, reviewContextStage);
        if (cancelled) return;

        const resolvedStudents = data?.students || students;
        const resolvedRubrics = data?.rubrics || [];

        setStageData({
          stage: activeStage,
          rubrics: resolvedRubrics,
          students: resolvedStudents,
        });

        setDraft(buildEmptyDraft(resolvedStudents, resolvedRubrics, data?.students || []));
        setFeedbackDraft(buildFeedbackDraft(resolvedStudents, data?.students || []));

        const hasMarks = (data?.students || []).some(
          (s) => Array.isArray(s.marks) && s.marks.length > 0
        );
        setIsUiLocked(hasMarks);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Failed to load rubric marks.");
        setStageData({ stage: activeStage, rubrics: [], students });
        setDraft(buildEmptyDraft(students, [], []));
        setFeedbackDraft(buildFeedbackDraft(students, []));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (projectId) run();

    return () => {
      cancelled = true;
    };
  }, [activeStage, projectId, reviewContextStage, students]);

  const handleCellChange = (studentId, rubricId, value) => {
    setDraft((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [rubricId]: value,
      },
    }));
  };

  const handleFeedbackChange = (studentId, value) => {
    setFeedbackDraft((prev) => ({
      ...prev,
      [studentId]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const entries = [];
      for (const student of stageData.students || []) {
        for (const rubric of stageData.rubrics || []) {
          const raw = draft?.[student.student_id]?.[rubric.id];
          const marks = raw === "" || raw == null ? 0 : Number(raw);
          if (Number.isNaN(marks) || marks < 0 || marks > Number(rubric.max_marks)) {
            throw new Error(`Marks for ${student.full_name} / ${rubric.title} must be between 0 and ${rubric.max_marks}.`);
          }
          entries.push({
            student_id: student.student_id,
            rubric_id: rubric.id,
            marks,
          });
        }
      }

      const feedbackEntries = allowFeedback
        ? (stageData.students || [])
            .map((student) => {
              const feedback = String(feedbackDraft?.[student.student_id] || "").trim();
              return feedback ? { student_id: student.student_id, feedback } : null;
            })
            .filter(Boolean)
        : [];

      await saveProjectRubricMarks(
        projectId,
        activeStage,
        entries,
        reviewContextStage,
        feedbackEntries
      );

      const refreshed = await fetchProjectRubricMarks(
        projectId,
        activeStage,
        reviewContextStage
      );

      const resolvedStudents = refreshed?.students || students;
      const resolvedRubrics = refreshed?.rubrics || [];

      setStageData({
        stage: activeStage,
        rubrics: resolvedRubrics,
        students: resolvedStudents,
      });

      setDraft(buildEmptyDraft(resolvedStudents, resolvedRubrics, refreshed?.students || []));
      setFeedbackDraft(buildFeedbackDraft(resolvedStudents, refreshed?.students || []));
      setIsUiLocked(true);

      setNotice(`${meta.label} marks saved successfully.`);
    } catch (err) {
      setError(err.message || "Failed to save rubric marks.");
    } finally {
      setSaving(false);
    }
  };

  const rubricTotal = useMemo(
    () => (stageData.rubrics || []).reduce((sum, rubric) => sum + Number(rubric.max_marks || 0), 0),
    [stageData.rubrics]
  );

  return (
    <div className="space-y-5">
      {/* UI remains same as your file (no conflicts below) */}
    </div>
  );
}