import { useEffect, useMemo, useState } from "react";
import {
  REVIEW_ROUND_OPTIONS,
  fetchProjectRubricMarks,
  getRubricStageMeta,
  saveProjectRubricMarks,
  updateProjectRubricEntryLock,
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

function LockIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}

function formatInitial(name = "") {
  return String(name).trim().charAt(0).toUpperCase() || "S";
}

function getStudentChipColor(index) {
  const colors = [
    "bg-teal-100 text-teal-700 border-teal-200",
    "bg-indigo-100 text-indigo-700 border-indigo-200",
    "bg-amber-100 text-amber-700 border-amber-200",
    "bg-rose-100 text-rose-700 border-rose-200",
  ];
  return colors[index % colors.length];
}

function getHeaderTitle(mode, activeReviewLabel, meta) {
  if (mode === "review") return `${activeReviewLabel} Marks`;
  return `${meta.label} Marks`;
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
  const [isEntryLocked, setIsEntryLocked] = useState(false);
  const [lockedAt, setLockedAt] = useState(null);

  const students = useMemo(
    () =>
      (members || []).map((member) => ({
        student_id: member.student_id,
        full_name: member.profiles?.full_name || member.full_name || "Unnamed Student",
        roll_number: member.profiles?.roll_number || member.roll_number || "-",
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
  const title = getHeaderTitle(mode, activeReviewLabel, meta);

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

        setIsEntryLocked(Boolean(data?.entry_lock?.is_locked));
        setLockedAt(data?.entry_lock?.locked_at || null);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Failed to load rubric marks.");
        setStageData({ stage: activeStage, rubrics: [], students });
        setDraft(buildEmptyDraft(students, [], []));
        setFeedbackDraft(buildFeedbackDraft(students, []));
        setIsEntryLocked(false);
        setLockedAt(null);
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
      setNotice(`${mode === "review" ? activeReviewLabel : meta.label} marks saved successfully.`);
    } catch (err) {
      setError(err.message || "Failed to save rubric marks.");
    } finally {
      setSaving(false);
    }
  };

  const handleLockToggle = async (locked) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await updateProjectRubricEntryLock(
        projectId,
        activeStage,
        locked,
        reviewContextStage
      );
      setIsEntryLocked(Boolean(result?.is_locked));
      setLockedAt(result?.locked_at || null);
      setNotice(locked ? "Marks locked successfully." : "Marks unlocked successfully.");
    } catch (err) {
      setError(err.message || `Failed to ${locked ? "lock" : "unlock"} marks.`);
    } finally {
      setSaving(false);
    }
  };

  const rubricTotal = useMemo(
    () => (stageData.rubrics || []).reduce((sum, rubric) => sum + Number(rubric.max_marks || 0), 0),
    [stageData.rubrics]
  );

  const resolvedStudents = stageData.students || [];
  const resolvedRubrics = stageData.rubrics || [];
  const saveDisabled =
    loading ||
    saving ||
    isReadOnly ||
    isEntryLocked ||
    !resolvedStudents.length ||
    !resolvedRubrics.length;
  const canToggleLock = !loading && !saving && !isReadOnly && resolvedStudents.length > 0 && resolvedRubrics.length > 0;

  return (
    <div className="space-y-5">
      {mode === "review" && allowedReviewStages.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {allowedReviewStages.map((stage) => {
            const option = REVIEW_ROUND_OPTIONS.find((item) => item.value === stage);
            const selected = stage === reviewStage;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => setReviewStage(stage)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  selected
                    ? "border-teal-500 bg-teal-500 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700"
                }`}
              >
                {option?.label || stage}
              </button>
            );
          })}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Review Evaluation</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Rubrics are loaded automatically from the admin configuration for the selected review round.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700">
              {mode === "review" ? activeReviewLabel : meta.label}
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold ${
                isReadOnly || isEntryLocked
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              <LockIcon />
              {isReadOnly ? "Coordinator Closed" : isEntryLocked ? "Locked" : "Open"}
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveDisabled}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white transition ${
                saveDisabled
                  ? "cursor-not-allowed bg-slate-300"
                  : "bg-teal-500 hover:bg-teal-600"
              }`}
            >
              <SaveIcon />
              {saving ? "Saving..." : "Save Marks"}
            </button>
            <button
              type="button"
              onClick={() => handleLockToggle(!isEntryLocked)}
              disabled={!canToggleLock}
              className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                !canToggleLock
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                  : isEntryLocked
                    ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-700"
              }`}
            >
              {isEntryLocked ? "Unlock Marks" : "Lock Marks"}
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          {notice ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}

          {lockedAt ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Marks locked at {new Date(lockedAt).toLocaleString("en-IN")}.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Rubrics</p>
              <p className="mt-2 text-4xl font-black text-slate-900">{resolvedRubrics.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Students</p>
              <p className="mt-2 text-4xl font-black text-slate-900">{resolvedStudents.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Stage Limit</p>
              <p className="mt-2 text-4xl font-black text-slate-900">{rubricTotal}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-4">
              <h3 className="text-lg font-bold text-slate-900">Entry Grid</h3>
              <p className="mt-1 text-sm text-slate-500">
                All students in the selected project appear here with the active review rubrics. Saved feedback reaches only the corresponding student.
              </p>
            </div>

            {loading ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">Loading rubric marks...</div>
            ) : !resolvedRubrics.length ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                No active rubrics found for this stage yet.
              </div>
            ) : !resolvedStudents.length ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                No students are linked to this project.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                        Student
                      </th>
                      {resolvedRubrics.map((rubric) => (
                        <th
                          key={rubric.id}
                          className="border-b border-slate-200 px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500"
                        >
                          <div className="min-w-[130px]">
                            <p className="text-slate-600">{rubric.title}</p>
                            <p className="mt-1 text-[11px] font-semibold normal-case tracking-normal text-slate-400">
                              / {rubric.max_marks}
                            </p>
                          </div>
                        </th>
                      ))}
                      {allowFeedback ? (
                        <th className="border-b border-slate-200 px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                          Individual Feedback
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {resolvedStudents.map((student, index) => (
                      <tr key={student.student_id} className="align-top">
                        <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-4 py-4">
                          <div className="flex min-w-[220px] items-start gap-3">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold ${getStudentChipColor(index)}`}
                            >
                              {formatInitial(student.full_name)}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{student.full_name}</p>
                              <p className="mt-1 text-xs text-slate-400">{student.roll_number || "-"}</p>
                            </div>
                          </div>
                        </td>

                        {resolvedRubrics.map((rubric) => {
                          const value = draft?.[student.student_id]?.[rubric.id] ?? "";
                          const existingMarks =
                            student.marks?.find((entry) => entry.rubric_id === rubric.id)?.marks ?? value;

                          return (
                            <td key={rubric.id} className="border-b border-slate-100 px-4 py-4">
                              {isReadOnly || isEntryLocked ? (
                                <div className="flex min-h-[44px] min-w-[90px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-base font-bold text-slate-700">
                                  {existingMarks === "" || existingMarks == null ? "-" : existingMarks}
                                </div>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  max={rubric.max_marks}
                                  value={value}
                                  onChange={(event) => handleCellChange(student.student_id, rubric.id, event.target.value)}
                                  className="w-24 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                                />
                              )}
                            </td>
                          );
                        })}

                        {allowFeedback ? (
                          <td className="border-b border-slate-100 px-4 py-4">
                            {isReadOnly || isEntryLocked ? (
                              <div className="min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                {String(feedbackDraft?.[student.student_id] || "").trim() || "No feedback added."}
                              </div>
                            ) : (
                              <textarea
                                rows={3}
                                value={feedbackDraft?.[student.student_id] || ""}
                                onChange={(event) => handleFeedbackChange(student.student_id, event.target.value)}
                                placeholder="Add individual feedback"
                                className="min-w-[220px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                              />
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
