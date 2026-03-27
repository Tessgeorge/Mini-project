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

function buildFeedbackDraft(students) {
  return (students || []).reduce((acc, student) => {
    acc[student.student_id] = "";
    return acc;
  }, {});
}

export default function DynamicRubricEvaluation({ projectId, members = [], mode = "guide", allowedReviewStages = [], writableReviewStages = [] }) {
  const stage = mode === "review" ? "review" : "guide";
  const initialReviewStage = allowedReviewStages[0] || REVIEW_ROUND_OPTIONS[0].value;
  const [reviewStage, setReviewStage] = useState(initialReviewStage);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [stageData, setStageData] = useState({ stage, rubrics: [], students: [] });
  const [draft, setDraft] = useState({});
  const [feedbackDraft, setFeedbackDraft] = useState({});

  const students = useMemo(
    () => (members || []).map((member) => ({
      student_id: member.student_id,
      full_name: member.profiles?.full_name || "Unnamed Student",
      roll_number: member.profiles?.roll_number || "-",
    })),
    [members]
  );

  useEffect(() => {
    if (stage !== "review") return;
    if (!allowedReviewStages.length) return;
    if (!allowedReviewStages.includes(reviewStage)) {
      setReviewStage(allowedReviewStages[0]);
    }
  }, [allowedReviewStages, reviewStage, stage]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      setNotice("");
      try {
        const activeReviewStage = stage === "review" ? reviewStage : null;
        const data = await fetchProjectRubricMarks(projectId, stage, activeReviewStage);
        if (cancelled) return;
        setStageData(data || { stage, rubrics: [], students: [] });
        setDraft(buildEmptyDraft(data?.students || students, data?.rubrics || [], data?.students || []));
        setFeedbackDraft(buildFeedbackDraft(data?.students || students));
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Failed to load rubric marks.");
        setStageData({ stage, rubrics: [], students });
        setDraft(buildEmptyDraft(students, [], []));
        setFeedbackDraft(buildFeedbackDraft(students));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (projectId) run();
    return () => {
      cancelled = true;
    };
  }, [projectId, reviewStage, stage, students]);

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

      const feedbackEntries = stage === "guide"
        ? (stageData.students || []).map((student) => {
          const feedback = String(feedbackDraft?.[student.student_id] || "").trim();
          return feedback ? { student_id: student.student_id, feedback } : null;
        }).filter(Boolean)
        : [];

      await saveProjectRubricMarks(projectId, stage, entries, stage === "review" ? reviewStage : null, feedbackEntries);
      const refreshed = await fetchProjectRubricMarks(projectId, stage, stage === "review" ? reviewStage : null);
      setStageData(refreshed || { stage, rubrics: [], students: [] });
      setDraft(buildEmptyDraft(refreshed?.students || students, refreshed?.rubrics || [], refreshed?.students || []));
      setFeedbackDraft(buildFeedbackDraft(refreshed?.students || students));
      setNotice(`${meta.label} marks saved successfully.`);
    } catch (err) {
      setError(err.message || "Failed to save rubric marks.");
    } finally {
      setSaving(false);
    }
  };

  const meta = getRubricStageMeta(stage);
  const isReadOnly = stage === "review" && !writableReviewStages.includes(reviewStage);
  const activeReviewLabel =
    REVIEW_ROUND_OPTIONS.find((item) => item.value === reviewStage)?.label || "Review";

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{stage === "review" ? "Review Evaluation" : "Guide Evaluation"}</p>
            <h3 className="text-xl font-extrabold text-gray-900 mt-1">
              {stage === "review" ? `${activeReviewLabel} Marks` : `${meta.label} Marks`}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {stage === "review"
                ? isReadOnly
                  ? "This review round is visible in read-only mode because coordinator access is currently closed."
                  : "Existing review rubrics are loaded automatically for the selected review round."
                : "Guide enters a direct total mark out of 15 for each student. Totals are calculated automatically in the backend."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {stage === "review" ? (
              allowedReviewStages.length > 1 ? (
                <select
                  value={reviewStage}
                  onChange={(event) => setReviewStage(event.target.value)}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  {allowedReviewStages.map((stageKey) => {
                    const option = REVIEW_ROUND_OPTIONS.find((item) => item.value === stageKey);
                    return (
                      <option key={stageKey} value={stageKey}>
                        {option?.label || stageKey}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-700">
                  {REVIEW_ROUND_OPTIONS.find((item) => item.value === reviewStage)?.label || "Review"}
                </div>
              )
            ) : null}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || !stageData.rubrics.length || !stageData.students.length || isReadOnly}
              className="rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : isReadOnly ? "Read Only" : "Save Marks"}
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Rubrics</p>
          <p className="mt-2 text-2xl font-extrabold text-gray-900">{stageData.rubrics.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Students</p>
          <p className="mt-2 text-2xl font-extrabold text-gray-900">{stageData.students.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Stage Limit</p>
          <p className="mt-2 text-2xl font-extrabold text-gray-900">{meta.total}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800">Entry Grid</p>
          <p className="text-xs text-gray-400 mt-1">
            {stage === "review"
              ? "All students in the selected project appear here with the active review rubrics. Individual feedback reaches only the corresponding student."
              : "Add individual feedback here to send it directly to each student with your name."}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${stage === "guide" ? "min-w-[1080px]" : "min-w-[1160px]"}`}>
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Student</th>
                {(stageData.rubrics || []).map((rubric) => (
                  <th key={rubric.id} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                    {rubric.title}
                    <span className="ml-1 text-[11px] normal-case text-gray-400">/ {rubric.max_marks}</span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Individual Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={Math.max(3, stageData.rubrics.length + 2)} className="px-4 py-8 text-center text-gray-500">Loading rubric fields...</td></tr>
              ) : !stageData.rubrics.length ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No active rubrics configured for this stage.</td></tr>
              ) : (
                (stageData.students || []).map((student) => (
                  <tr key={student.student_id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{student.full_name}</p>
                      <p className="text-xs text-gray-400">{student.roll_number}</p>
                    </td>
                    {stageData.rubrics.map((rubric) => (
                      <td key={`${student.student_id}-${rubric.id}`} className="px-4 py-3">
                        <input
                        type="number"
                        min="0"
                        max={rubric.max_marks}
                        value={draft?.[student.student_id]?.[rubric.id] ?? ""}
                        onChange={(event) => handleCellChange(student.student_id, rubric.id, event.target.value)}
                        readOnly={isReadOnly}
                        className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </td>
                  ))}
                    <td className="px-4 py-3">
                      <textarea
                        rows={3}
                        value={feedbackDraft?.[student.student_id] ?? ""}
                        onChange={(event) => handleFeedbackChange(student.student_id, event.target.value)}
                        placeholder="Write individual feedback for this student..."
                        readOnly={isReadOnly}
                        className="w-full min-w-[260px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
