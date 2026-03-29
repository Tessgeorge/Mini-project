import { useState, useEffect, useCallback, Component } from "react";
import { supabase } from "../config/supabaseClient";
import { apiRequest } from "../config/apiClient";
import CoordinatorResultsPanel from "../components/CoordinatorResultsPanel";

// ─── Helpers (preserved from original) ───────────────────────────────────────
function formatClassScore(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(1);
}

const REVIEW_STAGE_ORDER = ["Idea", "Abstract", "Zeroth Review", "First Review", "Second Review", "Final Review"];

function normalizeReviewStageName(stageName) {
  const v = String(stageName || "").trim().toLowerCase();
  if (v === "0th review") return "Zeroth Review";
  if (v === "1st review") return "First Review";
  if (v === "2nd review") return "Second Review";
  if (v === "zeroth review") return "Zeroth Review";
  if (v === "first review") return "First Review";
  if (v === "second review") return "Second Review";
  if (v === "idea") return "Idea";
  if (v === "abstract") return "Abstract";
  if (v === "final review") return "Final Review";
  return String(stageName || "").trim();
}

function reviewStageOrderIndex(stageName) {
  const normalized = normalizeReviewStageName(stageName).toLowerCase();
  const idx = REVIEW_STAGE_ORDER.findIndex(n => n.toLowerCase() === normalized);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function stageNameToProgressKey(stageName) {
  const normalized = normalizeReviewStageName(stageName).toLowerCase();
  if (normalized === "idea") return "idea";
  if (normalized === "abstract") return "abstract";
  if (normalized === "zeroth review") return "zeroth_review";
  if (normalized === "first review") return "first_review";
  if (normalized === "second review") return "second_review";
  if (normalized === "final review") return "final_review";
  return normalized.replace(/\s+/g, "_");
}

function formatDeadlineDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toDateInputValue(v) { return v ? v.slice(0, 10) : ""; }
function toTimeInputValue(v) { return v ? (v.slice(11, 16) || "") : ""; }
function buildDeadlineIso(d, t) { return d && t ? `${d}T${t}:00` : ""; }

function sortReviewStages(rows) {
  const grouped = new Map();
  for (const row of rows || []) {
    const name = normalizeReviewStageName(row?.stage_name);
    const cur = grouped.get(name);
    if (!cur) { grouped.set(name, { ...row, stage_name: name }); continue; }
    grouped.set(name, {
      ...cur, ...row, stage_name: name,
      coordinator_deadline: row?.coordinator_deadline || cur.coordinator_deadline || null,
      deadline: row?.deadline || cur.deadline || null,
      stage_order: Number.isFinite(Number(cur?.stage_order)) ? cur.stage_order : row?.stage_order,
      is_active: Boolean(cur?.is_active || row?.is_active),
      student_deadline_set_by_coordinator: Boolean(cur?.student_deadline_set_by_coordinator || row?.student_deadline_set_by_coordinator),
    });
  }

  const normalizedRows = Array.from(grouped.entries()).map(([stageName, matched]) => ({
    ...matched,
    stage_name: stageName,
    stage_order: Number.isFinite(Number(matched?.stage_order)) ? Number(matched.stage_order) : reviewStageOrderIndex(stageName),
    is_active: Boolean(matched?.is_active),
    student_deadline_set_by_coordinator: Boolean(matched?.student_deadline_set_by_coordinator),
  }));

  const missingCanonical = REVIEW_STAGE_ORDER
    .filter((stageName) => !grouped.has(stageName))
    .map((stageName, index) => ({
      id: `canonical-${index}`,
      stage_name: stageName,
      stage_order: reviewStageOrderIndex(stageName),
      deadline: null,
      coordinator_deadline: null,
      is_active: false,
      is_completed: false,
      is_locked: false,
      student_deadline_set_by_coordinator: false,
    }));

  return [...normalizedRows, ...missingCanonical].sort((a, b) => {
    const oa = Number.isFinite(Number(a?.stage_order)) ? Number(a.stage_order) : reviewStageOrderIndex(a?.stage_name);
    const ob = Number.isFinite(Number(b?.stage_order)) ? Number(b.stage_order) : reviewStageOrderIndex(b?.stage_name);
    return oa !== ob ? oa - ob : String(normalizeReviewStageName(a?.stage_name)).localeCompare(String(normalizeReviewStageName(b?.stage_name)));
  });
}

// ─── Design System Components ─────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: "#e2e8f0", borderTopColor: "#00D2C4" }} />
      <p className="text-sm text-slate-400 font-medium">Loading...</p>
    </div>
  );
}

// Card wrapper matching the screenshot style
function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

// Section header matching "Project Overview" / "Team Summary" style
function SectionHeader({ icon, title, action }) {
  return (
    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
      <div className="flex items-center gap-2.5">
        <span className="material-symbols-outlined text-xl" style={{ color: "#00D2C4" }}>{icon}</span>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// Label + value pair matching the screenshot
function InfoField({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-900">{value || "-"}</p>
    </div>
  );
}

// Teal filled button
function TealButton({ children, onClick, disabled, icon, small = false }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-2 font-bold rounded-xl transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"}`}
      style={{ backgroundColor: "#00D2C4", color: "#0f172a" }}>
      {icon && <span className="material-symbols-outlined" style={{ fontSize: small ? "14px" : "16px" }}>{icon}</span>}
      {children}
    </button>
  );
}

// Outline button
function OutlineButton({ children, onClick, disabled, icon, small = false, danger = false }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-2 font-bold rounded-xl border transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"} ${danger ? "border-red-200 text-red-500 hover:bg-red-50" : "border-slate-200 text-slate-700"}`}>
      {icon && <span className="material-symbols-outlined" style={{ fontSize: small ? "14px" : "16px" }}>{icon}</span>}
      {children}
    </button>
  );
}

// Status pill matching "In Progress" / "Pending" / "Assigned"
function StatusPill({ label, type = "gray" }) {
  const styles = {
    teal: { bg: "rgba(0,210,196,0.12)", color: "#00897B", border: "1px solid rgba(0,210,196,0.3)" },
    amber: { bg: "rgba(245,158,11,0.1)", color: "#d97706", border: "1px solid rgba(245,158,11,0.3)" },
    green: { bg: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)" },
    red: { bg: "rgba(239,68,68,0.1)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.3)" },
    blue: { bg: "rgba(59,130,246,0.1)", color: "#2563eb", border: "1px solid rgba(59,130,246,0.3)" },
    gray: { bg: "rgba(100,116,139,0.1)", color: "#475569", border: "1px solid rgba(100,116,139,0.2)" },
  };
  const s = styles[type] || styles.gray;
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold" style={s}>
      {label}
    </span>
  );
}

// ─── INNER TABS ───────────────────────────────────────────────────────────────
const INNER_TABS = [
  { key: "overview", label: "Overview", icon: "dashboard" },
  { key: "submissions", label: "Submissions", icon: "upload_file" },
  { key: "teams", label: "Teams", icon: "groups" },
  { key: "reviews", label: "Reviews", icon: "verified" },
  { key: "marks", label: "Marks", icon: "military_tech" },
];

// ─── TAB 1: Overview ─────────────────────────────────────────────────────────
function TabOverview({ classData, coordinators = [], loading, onSaveStudentDeadline, onNavigate }) {
  const [deadlineDrafts, setDeadlineDrafts] = useState({});
  const [editingIds, setEditingIds] = useState({});
  const [savingId, setSavingId] = useState("");
  const [dlError, setDlError] = useState("");
  const [dlNotice, setDlNotice] = useState("");
  // Local overrides so saved deadline shows instantly without waiting for classData refresh
  const [savedDeadlines, setSavedDeadlines] = useState({});

  useEffect(() => {
    const drafts = (classData?.reviewStages || []).reduce((acc, s) => {
      acc[s.id] = { date: toDateInputValue(s.deadline), time: toTimeInputValue(s.deadline) };
      return acc;
    }, {});
    // Seed savedDeadlines from DB values so they survive Cancel without a classData refresh
    const existing = (classData?.reviewStages || []).reduce((acc, s) => {
      if (s.deadline) acc[s.id] = s.deadline;
      return acc;
    }, {});
    setDeadlineDrafts(drafts);
    // Never reset editingIds here — it would override Cancel/Save actions
    // editingIds is only changed by handleEdit, handleSave, and Cancel clicks
    setSavedDeadlines(p => ({ ...existing, ...p })); // merge: keep any this-session saves
    setSavingId(""); setDlError(""); setDlNotice("");
  }, [classData]);

  if (loading) return <Spinner />;
  if (!classData) return (
    <Card>
      <div className="px-6 py-16 text-center">
        <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">school</span>
        <p className="text-slate-500 font-semibold">No coordinator class assigned.</p>
      </div>
    </Card>
  );

  const {
    classTitle,
    totalProjects,
    totalStudents = Array.isArray(classData?.projects)
      ? classData.projects.reduce((sum, project) => sum + Number(project?.teamSize || 0), 0)
      : 0,
    evaluatedProjects,
    pendingEvaluations,
    classAverageScore,
    projects = [],
    reviewStages = [],
    deadlineLoadError = "",
    stageProgress = {}
  } = classData;

  const handleDraftChange = (id, key, val) => {
    setDeadlineDrafts(p => ({ ...p, [id]: { date: p[id]?.date || "", time: p[id]?.time || "", [key]: val } }));
    setDlError(""); setDlNotice("");
  };

  const handleEdit = (stage) => {
    // Use locally saved value if available, else fall back to classData
    const existingIso = savedDeadlines[stage.id] || stage.deadline || "";
    setDeadlineDrafts(p => ({
      ...p,
      [stage.id]: {
        date: toDateInputValue(existingIso),
        time: toTimeInputValue(existingIso),
      }
    }));
    setEditingIds(p => ({ ...p, [stage.id]: true }));
    setDlError(""); setDlNotice("");
  };

  const handleSave = async (stage) => {
    const draft = deadlineDrafts[stage.id] || {};
    const iso = buildDeadlineIso(draft.date, draft.time);
    if (!iso) { setDlError("Both date and time are required."); return; }
    // Only validate against admin deadline if admin has set one
    if (stage.coordinator_deadline) {
      const sd = new Date(iso), ad = new Date(stage.coordinator_deadline);
      if (!Number.isNaN(sd.getTime()) && !Number.isNaN(ad.getTime()) && sd >= ad) {
        setDlError("Student deadline must be before the admin evaluation deadline."); return;
      }
    }
    setSavingId(stage.id); setDlError(""); setDlNotice("");
    try {
      await onSaveStudentDeadline(stage.id, iso);
      setSavedDeadlines(p => ({ ...p, [stage.id]: iso }));
      setDlNotice(`Deadline saved for ${normalizeReviewStageName(stage.stage_name)}.`);
      setEditingIds(p => ({ ...p, [stage.id]: false }));
    } catch (e) { setDlError(e.message || "Failed to save."); }
    finally { setSavingId(""); }
  };

  const handleRemove = async (stage) => {
    if (!window.confirm(`Remove student deadline for ${normalizeReviewStageName(stage.stage_name)}?`)) return;
    setSavingId(stage.id); setDlError(""); setDlNotice("");
    try {
      await onSaveStudentDeadline(stage.id, null);
      setSavedDeadlines(p => { const n = { ...p }; delete n[stage.id]; return n; });
      setDeadlineDrafts(p => ({ ...p, [stage.id]: { date: "", time: "" } }));
      setDlNotice(`Deadline removed for ${normalizeReviewStageName(stage.stage_name)}.`);
    } catch (e) { setDlError(e.message || "Failed to remove deadline."); }
    finally { setSavingId(""); }
  };

  const statusType = (s) => {
    const k = (s || "").toLowerCase();
    if (k === "approved" || k === "completed") return "green";
    if (k === "pending") return "amber";
    if (k === "rejected") return "red";
    return "gray";
  };

  return (
    <div className="space-y-5">

      {/* Class identity header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
        <h2 className="text-xl font-extrabold text-slate-900 leading-tight">
          My Class — {classTitle}
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
          <span className="text-sm text-slate-500 flex items-center gap-1.5">
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            {totalProjects} teams
          </span>
          <span className="text-slate-300 text-sm">·</span>
          <span className="text-sm text-slate-500">
            {totalStudents} students
          </span>
          {coordinators.length > 0 && (
            <>
              <span className="text-slate-300 text-sm">·</span>
              <span className="text-sm text-slate-500 flex items-center gap-1.5">
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                {coordinators.map(c => c.full_name).join(" · ")}
              </span>
            </>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Total Teams", value: totalProjects, icon: "groups", color: "#00D2C4" },
          { label: "Evaluated", value: evaluatedProjects, icon: "verified", color: "#10b981" },
          { label: "Pending", value: pendingEvaluations, icon: "pending", color: "#f59e0b" },
          { label: "Class Avg Score", value: classAverageScore != null ? `${formatClassScore(classAverageScore)}/100` : "—", icon: "grade", color: "#6366f1" },
        ].map(k => (
          <Card key={k.label}>
            <div className="px-5 py-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${k.color}18` }}>
                <span className="material-symbols-outlined" style={{ color: k.color, fontSize: "20px" }}>{k.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 leading-none">{k.value ?? "—"}</p>
                <p className="text-xs text-slate-400 font-medium mt-1">{k.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Review Deadlines */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">Review deadlines</p>
            <p className="text-xs text-slate-400 mt-0.5">Admin sets evaluation deadlines · you set student submission deadlines</p>
          </div>
        </div>
        <div className="px-5 py-4">
          {(deadlineLoadError || dlError) && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
              <span className="material-symbols-outlined text-base mt-0.5">error</span>
              {deadlineLoadError || dlError}
            </div>
          )}
          {dlNotice && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-sm text-emerald-700">
              <span className="material-symbols-outlined text-base">check_circle</span>
              {dlNotice}
            </div>
          )}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Admin Evaluation Schedule */}
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-sm font-bold text-slate-700">Admin Evaluation Schedule</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Stage</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Evaluation Deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {reviewStages.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-slate-400 text-sm">No stages configured yet.</td></tr>
                  ) : reviewStages.map(s => (
                    <tr key={`admin-${s.id}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">{normalizeReviewStageName(s.stage_name)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDeadlineDateTime(s.coordinator_deadline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Student Submission Deadlines */}
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-sm font-bold text-slate-700">Student Submission Deadlines</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Stage</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Student Deadline</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {reviewStages.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400 text-sm">No stages configured yet.</td></tr>
                  ) : reviewStages.map(s => {
                    const draft = deadlineDrafts[s.id] || { date: "", time: "" };
                    const adminEnabled = Boolean(s.coordinator_deadline);
                    const savedIso = savedDeadlines[s.id] || s.deadline;
                    // Only show saved deadline if admin has enabled this stage
                    const hasSaved = adminEnabled && Boolean(savedIso);
                    // Coordinator can only set/edit if admin has enabled this stage first
                    const canEdit = adminEnabled;
                    // Only enter edit mode when explicitly triggered — never auto-open
                    const isEditing = editingIds[s.id] === true;
                    const isSaving = savingId === s.id;
                    return (
                      <tr key={`student-${s.id}`} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-800">{normalizeReviewStageName(s.stage_name)}</td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex flex-col gap-1.5">
                              <input type="date" value={draft.date}
                                onChange={e => handleDraftChange(s.id, "date", e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:border-[#00D2C4]" />
                              <input
                                type="text"
                                value={draft.time}
                                placeholder="HH:MM  e.g. 14:30"
                                maxLength={5}
                                onChange={e => {
                                  let v = e.target.value.replace(/[^0-9]/g, "");
                                  if (v.length >= 3) v = v.slice(0, 2) + ":" + v.slice(2, 4);
                                  handleDraftChange(s.id, "time", v);
                                }}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:border-[#00D2C4]"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {hasSaved ? (
                                <>
                                  <span className="text-sm text-slate-700">{formatDeadlineDateTime(savedIso)}</span>
                                  <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Saved</span>
                                </>
                              ) : (
                                <span className="text-slate-300 text-sm">—</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <button onClick={() => handleSave(s)} disabled={isSaving}
                                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-teal-500 text-white hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                <span className="material-symbols-outlined text-sm">save</span>
                                {isSaving ? "Saving..." : "Save"}
                              </button>
                              <button onClick={() => {
                                const existingIso = savedDeadlines[s.id] || s.deadline || "";
                                setDeadlineDrafts(p => ({
                                  ...p,
                                  [s.id]: {
                                    date: toDateInputValue(existingIso),
                                    time: toTimeInputValue(existingIso),
                                  }
                                }));
                                setEditingIds(p => ({ ...p, [s.id]: false }));
                                setDlError(""); setDlNotice("");
                              }}
                                className="inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all">
                                Cancel
                              </button>
                              {(savedDeadlines[s.id] || s.deadline) && (
                                <button onClick={() => handleRemove(s)} disabled={isSaving}
                                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                  Remove
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleEdit(s)}
                                disabled={!canEdit}
                                title={!canEdit ? "Admin must set the evaluation deadline for this stage first" : "Edit student deadline"}
                                className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>edit</span>
                                Edit
                              </button>
                              {hasSaved && (
                                <button
                                  onClick={() => handleRemove(s)}
                                  disabled={savingId === s.id}
                                  title="Remove deadline"
                                  className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                  <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>delete</span>
                                  Remove
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>

      {/* Stage Progress */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-bold text-slate-800">Stage progress</p>
          <p className="text-xs text-slate-400 mt-0.5">Teams completed per stage · {totalProjects} total teams</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          {reviewStages.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No stages configured.</p>
          ) : reviewStages.map(s => {
            const progressKey = stageNameToProgressKey(s.stage_name);
            const done = Number(stageProgress?.[progressKey] || 0);
            const total = totalProjects || 1;
            const pct = Math.round((done / total) * 100);
            const barColor = pct === 100 ? "#14b8a6" : pct >= 40 ? "#f59e0b" : "#e2e8f0";
            return (
              <div key={s.id}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm text-slate-600 font-medium">{normalizeReviewStageName(s.stage_name)}</span>
                  <span className="text-sm font-semibold text-slate-800">{done} / {total}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: pct + "%", backgroundColor: barColor }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Today's action list */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-bold text-slate-800">Today's action list</p>
        </div>
        <div className="px-5 py-2">
          {[
            {
              num: 1,
              urgent: pendingEvaluations > 0,
              title: pendingEvaluations > 0
                ? `${pendingEvaluations} submission${pendingEvaluations !== 1 ? "s" : ""} awaiting your verification`
                : "No pending submissions",
              sub: pendingEvaluations > 0
                ? "Guide-approved documents waiting for your sign-off"
                : "All submissions are verified",
              btn: "Go to Submissions",
              nav: "submissions",
            },
            {
              num: 2,
              urgent: false,
              title: "Manage reviewer access for evaluation stages",
              sub: "Open or close mark entry per stage for reviewers",
              btn: "Go to Reviews",
              nav: "reviews",
            },
            {
              num: 3,
              urgent: reviewStages.some(s => s.coordinator_deadline && !s.deadline),
              title: reviewStages.some(s => s.coordinator_deadline && !s.deadline)
                ? "Set missing student submission deadlines"
                : "All student deadlines are set",
              sub: reviewStages.some(s => s.coordinator_deadline && !s.deadline)
                ? "Some admin-enabled stages have no student deadline yet"
                : "Review the deadlines table above if needed",
              btn: null,
              nav: null,
            },
          ].map(item => (
            <div key={item.num} className="flex items-start gap-3 py-3.5 border-b border-slate-50 last:border-b-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${item.urgent ? "bg-teal-400 text-white" : "bg-slate-100 text-slate-400"}`}>
                {item.num}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${item.urgent ? "text-slate-900" : "text-slate-500"}`}>{item.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
              </div>
              {item.btn && (
                <button
                  type="button"
                  onClick={() => { if (item.nav) onNavigate?.(item.nav); }}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl flex-shrink-0 transition-all ${item.urgent ? "bg-teal-400 hover:bg-teal-500 text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  {item.btn}
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── TAB 2: Submissions Queue ─────────────────────────────────────────────────
function TabSubmissions({ classId }) {
  const [pending, setPending] = useState([]);
  const [verified, setVerified] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: projects } = await supabase.from("projects").select("id,title,guide_id").eq("class_id", classId);
      const ids = (projects || []).map(p => p.id);
      if (!ids.length) { setLoading(false); return; }

      const guideIds = [...new Set(projects.map(p => p.guide_id).filter(Boolean))];
      let guideMap = {};
      if (guideIds.length) {
        const { data: g } = await supabase.from("profiles").select("id,full_name").in("id", guideIds);
        (g || []).forEach(x => { guideMap[x.id] = x.full_name; });
      }
      const projMap = {};
      (projects || []).forEach(p => { projMap[p.id] = p; });

      const { data: pDocs } = await supabase.from("documents")
        .select("id,project_id,document_type,file_name,file_url,status,uploaded_at")
        .in("project_id", ids).eq("status", "approved").eq("coordinator_verified", false)
        .order("uploaded_at", { ascending: false });

      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      const { data: vDocs } = await supabase.from("documents")
        .select("id,project_id,document_type,file_name,file_url,coordinator_verified_at")
        .in("project_id", ids).eq("coordinator_verified", true).gte("coordinator_verified_at", weekAgo)
        .order("coordinator_verified_at", { ascending: false });

      const enrich = docs => (docs || []).map(d => ({
        ...d, project_title: projMap[d.project_id]?.title || "—",
        guide_name: guideMap[projMap[d.project_id]?.guide_id] || "—",
      }));
      setPending(enrich(pDocs));
      setVerified(enrich(vDocs));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  const getUser = async () => { const { data: { user } } = await supabase.auth.getUser(); return user; };

  const verify = async (docId) => {
    setActing(docId);
    const u = await getUser();
    await supabase.from("documents").update({ coordinator_verified: true, coordinator_verified_at: new Date().toISOString(), coordinator_verified_by: u?.id }).eq("id", docId);
    await load(); setActing(null);
  };

  const returnDoc = async (docId) => {
    setActing(docId);
    await supabase.from("documents").update({ status: "submitted", coordinator_verified: false }).eq("id", docId);
    await load(); setActing(null);
  };

  const approveAll = async () => {
    const u = await getUser();
    for (const doc of pending) {
      await supabase.from("documents").update({ coordinator_verified: true, coordinator_verified_at: new Date().toISOString(), coordinator_verified_by: u?.id }).eq("id", doc.id);
    }
    await load();
  };

  const ago = ts => {
    if (!ts) return "—";
    const d = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (d < 3600) return `${Math.floor(d / 60)}m ago`;
    if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
    return `${Math.floor(d / 86400)}d ago`;
  };

  const extColor = name => {
    const e = name?.split(".").pop()?.toLowerCase();
    return e === "pdf" ? "#ef4444" : ["docx", "doc"].includes(e) ? "#3b82f6" : e === "pptx" ? "#f97316" : "#6b7280";
  };
  const extLabel = name => (name?.split(".").pop() || "FILE").toUpperCase().slice(0, 3);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      {/* Pending queue */}
      <Card>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-xl" style={{ color: "#00D2C4" }}>pending_actions</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Pending Verification</h2>
              <p className="text-xs text-slate-400 mt-0.5">Guide-approved documents waiting for your sign-off</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill label={`${pending.length} pending`} type={pending.length > 0 ? "amber" : "gray"} />
            {pending.length > 1 && <TealButton onClick={approveAll} icon="done_all" small>Approve all {pending.length}</TealButton>}
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,210,196,0.1)" }}>
              <span className="material-symbols-outlined text-2xl" style={{ color: "#00D2C4" }}>check_circle</span>
            </div>
            <p className="text-slate-600 font-semibold">All clear — no pending submissions</p>
            <p className="text-sm text-slate-400">Guide-approved documents will appear here automatically</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {pending.map(doc => (
              <div key={doc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                  style={{ backgroundColor: extColor(doc.file_name) }}>
                  {extLabel(doc.file_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {doc.project_title}
                    <span className="ml-2 text-slate-400 font-normal text-sm">· {(doc.document_type || "document").replace(/_/g, " ")}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Guide: <span className="font-medium text-slate-600">{doc.guide_name}</span>
                    <span className="mx-1.5 text-slate-200">·</span>
                    {ago(doc.uploaded_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" title="View file"
                      className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-teal-600 hover:border-teal-200 transition-all">
                      <span className="material-symbols-outlined text-base">visibility</span>
                    </a>
                  )}
                  {doc.file_url && (
                    <a href={doc.file_url} download title="Download file"
                      className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-teal-600 hover:border-teal-200 transition-all">
                      <span className="material-symbols-outlined text-base">download</span>
                    </a>
                  )}
                  <TealButton small onClick={() => verify(doc.id)} disabled={acting === doc.id} icon="verified">
                    Verify
                  </TealButton>
                  <OutlineButton small danger onClick={() => returnDoc(doc.id)} disabled={acting === doc.id} icon="undo">
                    Return
                  </OutlineButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Verified this week */}
      <Card>
        <SectionHeader icon="task_alt" title="Verified This Week" />
        {verified.length === 0 ? (
          <div className="px-6 py-10 text-center text-slate-400 text-sm">No verifications this week yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Team", "Document", "Verified On", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {verified.map(doc => (
                <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3 font-semibold text-slate-900">{doc.project_title}</td>
                  <td className="px-6 py-3 text-slate-600 capitalize">{(doc.document_type || "").replace(/_/g, " ")}</td>
                  <td className="px-6 py-3 text-slate-500">
                    {doc.coordinator_verified_at ? new Date(doc.coordinator_verified_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td className="px-6 py-3"><StatusPill label="Verified" type="green" /></td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      {doc.file_url ? (
                        <>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" title="View file"
                            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-teal-600 hover:border-teal-200 transition-all">
                            <span className="material-symbols-outlined text-[18px] leading-none">visibility</span>
                          </a>
                          <a href={doc.file_url} download title="Download file"
                            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-teal-600 hover:border-teal-200 transition-all">
                            <span className="material-symbols-outlined text-[18px] leading-none">download</span>
                          </a>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">No file</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ─── TAB 3: Teams ─────────────────────────────────────────────────────────────
// ─── Team Detail View ─────────────────────────────────────────────────────────
// ─── Error boundary for TeamDetail ───────────────────────────────────────────
class TeamDetailBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div className="bg-white rounded-2xl border border-red-100 px-6 py-10 text-center space-y-3">
        <span className="material-symbols-outlined text-3xl text-red-300 block">error</span>
        <p className="text-sm font-semibold text-slate-700">Something went wrong loading this team.</p>
        <p className="text-xs text-slate-400">{this.state.error?.message || "Unknown error"}</p>
        <button onClick={this.props.onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700 mt-2">
          ← Back to Teams
        </button>
      </div>
    );
    return this.props.children;
  }
}

function TeamDetail({ projectId, onBack }) {
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [docs, setDocs] = useState([]);
  const [evals, setEvals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [projRes, memRes, docRes, evalRes] = await Promise.all([
          supabase.from("projects").select("id,title,description,status,guide_id,domain,technology_stacks,created_at").eq("id", projectId).single(),
          supabase.from("team_members").select("id,role,profiles:student_id(id,full_name,roll_number,email)").eq("project_id", projectId),
          supabase.from("documents").select("id,document_type,file_name,file_url,file_size,status,coordinator_verified,uploaded_at,feedback").eq("project_id", projectId).order("uploaded_at", { ascending: false }),
          supabase.from("evaluations").select("id,evaluation_type,obtained_marks,max_marks,feedback,created_at,profiles:evaluator_id(full_name)").eq("project_id", projectId).order("created_at", { ascending: false }),
        ]);
        let proj = projRes.data;
        if (proj?.guide_id) {
          const { data: guide } = await supabase.from("profiles").select("full_name").eq("id", proj.guide_id).single();
          proj = { ...proj, guide_name: guide?.full_name || "—" };
        }
        setProject(proj);
        setMembers(memRes.data || []);
        setDocs(docRes.data || []);
        setEvals(evalRes.data || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [projectId]);

  if (loading) return <Spinner />;
  if (!project) return <div className="text-center py-16 text-slate-400">Project not found.</div>;

  const statusColor = s => { const k = (s || "").toLowerCase(); return k === "approved" ? "#10b981" : k === "pending" ? "#f59e0b" : k === "rejected" ? "#ef4444" : "#94a3b8"; };
  const statusBg = s => { const k = (s || "").toLowerCase(); return k === "approved" ? "#f0fdf4" : k === "pending" ? "#fffbeb" : k === "rejected" ? "#fef2f2" : "#f8fafc"; };
  const stageLabel = s => (s || "—").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const fmtDate = ts => ts ? new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const fmtSize = b => !b ? "" : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;
  const completedStages = [...new Set(docs.filter(d => d.status === "approved").map(d => d.document_type))];
  const pct = Math.round((completedStages.length / 6) * 100);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        Back to Teams
      </button>

      <div className="bg-white rounded-2xl border border-slate-100 px-6 py-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">My Class › Teams › Project</p>
        <h1 className="text-xl font-extrabold text-slate-900 leading-tight">{project.title}</h1>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: statusBg(project.status), color: statusColor(project.status) }}>
            {(project.status || "active").toUpperCase()}
          </span>
          {project.domain && <span className="text-xs text-slate-500">{project.domain}</span>}
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Overall progression</span>
            <span className="font-semibold text-slate-700">{pct}% complete</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: pct + "%", backgroundColor: "#14b8a6" }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50"><p className="text-sm font-bold text-slate-700">Project information</p></div>
            <div className="px-6 py-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned guide</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{project.guide_name?.[0] || "G"}</div>
                  <span className="text-sm font-semibold text-slate-800">{project.guide_name || "—"}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Created</p>
                <p className="text-sm text-slate-700">{fmtDate(project.created_at)}</p>
              </div>
              {project.technology_stacks && (
                <div className="col-span-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Technologies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(project.technology_stacks) ? project.technology_stacks : [project.technology_stacks]).map((t, i) => (
                      <span key={i} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {project.description && (
                <div className="col-span-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{project.description}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">Submission history</p>
              <span className="text-xs text-slate-400">{docs.length} file{docs.length !== 1 ? "s" : ""}</span>
            </div>
            {docs.length === 0 ? (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">No submissions yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Stage", "File", "Guide", "Coord", "Date"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {docs.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 font-semibold text-slate-800">{stageLabel(d.document_type)}</td>
                      <td className="px-5 py-3">
                        {d.file_url ? (
                          <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-teal-600 hover:text-teal-700 font-medium">
                            <span className="material-symbols-outlined text-sm">description</span>
                            <span className="truncate max-w-[120px]">{d.file_name || "file"}</span>
                            {d.file_size && <span className="text-slate-300 text-xs">{fmtSize(d.file_size)}</span>}
                          </a>
                        ) : <span className="text-slate-400 text-xs">{d.file_name || "—"}</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: statusBg(d.status), color: statusColor(d.status) }}>
                          {(d.status || "—").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: d.coordinator_verified ? "#f0fdf4" : "#f8fafc", color: d.coordinator_verified ? "#10b981" : "#94a3b8" }}>
                          {d.coordinator_verified ? "VERIFIED" : "PENDING"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(d.uploaded_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <CoordinatorResultsPanel
            projectId={projectId}
            students={members.map((member) => ({
              student_id: member.profiles?.id,
              full_name: member.profiles?.full_name,
              roll_number: member.profiles?.roll_number || member.profiles?.email,
            })).filter((student) => student.student_id)}
          />
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">Team members</p>
              <span className="text-xs text-slate-400">{members.length} members</span>
            </div>
            <div className="divide-y divide-slate-50">
              {members.length === 0 ? (
                <p className="px-5 py-8 text-center text-slate-400 text-sm">No members found.</p>
              ) : members.map((m, i) => {
                const colors = ["#14b8a6", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6"];
                return (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }}>
                      {m.profiles?.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{m.profiles?.full_name || "—"}</p>
                      <p className="text-xs text-slate-400">{m.profiles?.roll_number || m.profiles?.email || "—"}</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">{m.role || "member"}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <p className="text-sm font-bold text-slate-700">Evaluation history</p>
            </div>
            <div className="divide-y divide-slate-50">
              {evals.length === 0 ? (
                <p className="px-5 py-8 text-center text-slate-400 text-sm">No evaluations yet.</p>
              ) : evals.map(ev => {
                const sc = ev.max_marks > 0 ? Math.round((ev.obtained_marks / ev.max_marks) * 100) : null;
                const scColor = sc >= 75 ? "#10b981" : sc >= 50 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={ev.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stageLabel(ev.evaluation_type)}</p>
                      {sc !== null && <span className="text-lg font-extrabold" style={{ color: scColor }}>{ev.obtained_marks}<span className="text-xs text-slate-400 font-medium">/{ev.max_marks}</span></span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400">{ev.profiles?.full_name || "—"}</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: sc !== null ? "#f0fdf4" : "#f8fafc", color: sc !== null ? "#10b981" : "#94a3b8" }}>
                        {sc !== null ? "COMPLETED" : "NOT STARTED"}
                      </span>
                    </div>
                    {ev.feedback && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">{ev.feedback}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabTeams({ classId }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBatchId, setSavingBatchId] = useState("");
  const [batchSaveError, setBatchSaveError] = useState("");
  const [locked, setLocked] = useState(false);
  const [filterBatch, setFilterBatch] = useState("all");
  const [filterGuide, setFilterGuide] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("ok");

  const showNotice = (msg, type = "ok") => {
    setNotice(msg); setNoticeType(type);
    setTimeout(() => setNotice(""), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const apiTeams = await apiRequest("/coordinator/teams", { skipCache: true });
        const normalized = (apiTeams || []).map((team) => ({
          id: team.id,
          title: team.title,
          status: team.status,
          batch: team.batch == null ? null : Number(team.batch),
          guide_name: team.guide_name || "—",
          members: [],
          team_size: Number(team.team_size || 0),
          current_stage: String(team.latest_stage || "—").replace(/_/g, " "),
          sub_status: team.submission_status || "—",
          coord_verified: Boolean(team.coordinator_verified),
        }));
        normalized.sort((a, b) => {
          const ba = a.batch ?? 99, bb = b.batch ?? 99;
          return ba - bb || a.title.localeCompare(b.title);
        });
        setTeams(normalized);
        setLoading(false);
        return;
      } catch (apiError) {
        console.warn("Falling back to direct teams query:", apiError?.message || apiError);
      }

      const { data: projects, error: projErr } = await supabase
        .from("projects")
        .select("id,title,status,guide_id,batch,created_at,team_members(id)")
        .eq("class_id", classId)
        .order("created_at", { ascending: true });

      const rawProjects = projErr
        ? await supabase.from("projects")
          .select("id,title,status,guide_id,created_at,team_members(id)")
          .eq("class_id", classId).order("created_at", { ascending: true })
          .then(r => (r.data || []).map(p => ({ ...p, batch: null })))
        : (projects || []);

      if (!rawProjects.length) { setTeams([]); setLoading(false); return; }

      const guideIds = [...new Set(rawProjects.map(p => p.guide_id).filter(Boolean))];
      let guideMap = {};
      if (guideIds.length) {
        const { data: g } = await supabase.from("profiles").select("id,full_name").in("id", guideIds);
        (g || []).forEach(x => { guideMap[x.id] = x.full_name; });
      }
      const ids = rawProjects.map(p => p.id);
      const { data: docs } = await supabase.from("documents")
        .select("project_id,document_type,status,coordinator_verified")
        .in("project_id", ids).order("uploaded_at", { ascending: false });
      const { data: stages } = await supabase.from("review_stages")
        .select("stage_name,is_active,stage_order")
        .eq("class_id", classId).eq("is_active", true)
        .order("stage_order", { ascending: false }).limit(1);
      const currentStage = stages?.[0]?.stage_name || null;

      const docMap = {};
      (docs || []).forEach(d => { if (!docMap[d.project_id]) docMap[d.project_id] = d; });

      const built = rawProjects.map(p => {
        const ld = docMap[p.id];
        return {
          id: p.id, title: p.title, status: p.status, batch: p.batch ?? null,
          guide_name: guideMap[p.guide_id] || "—",
          members: [],
          team_size: (p.team_members || []).length,
          current_stage: currentStage || (ld?.document_type?.replace(/_/g, " ") || "—"),
          sub_status: ld?.status || "—",
          coord_verified: ld?.coordinator_verified || false,
        };
      });
      // Sort: batch 1 first, then batch 2, then unassigned
      built.sort((a, b) => {
        const ba = a.batch ?? 99, bb = b.batch ?? 99;
        return ba - bb || a.title.localeCompare(b.title);
      });
      setTeams(built);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  const exportRef = { current: null };

  useEffect(() => {
    if (!exportOpen) return;
    const close = (e) => {
      // Only close if click is outside the dropdown wrapper
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [exportOpen]);

  const handleAutoDivide = async () => {
    if (locked) return showNotice("Unlock team formation first.", "err");
    if (!window.confirm("Auto-divide all teams equally into Batch 1 and Batch 2?")) return;
    setSaving(true);
    try {
      const sorted = [...teams].sort((a, b) => a.title.localeCompare(b.title));
      const half = Math.ceil(sorted.length / 2);
      const assignments = sorted.map((team, index) => ({
        project_id: team.id,
        batch: index < half ? 1 : 2,
      }));
      await apiRequest("/coordinator/teams/batches", {
        method: "PUT",
        body: { assignments },
      });
      await load();
      showNotice(`${sorted.length} teams divided — Batch 1: ${half}, Batch 2: ${sorted.length - half}`);
    } catch (e) { showNotice("Failed: " + e.message, "err"); }
    setSaving(false);
  };

  const handleBatchChange = async (teamId, newBatch) => {
    if (locked) return showNotice("Unlock team formation to make changes.", "err");
    setBatchSaveError("");
    const previousTeams = teams;
    // newBatch is a string from select ("", "1", "2") — convert correctly
    const val = newBatch === "" || newBatch === null ? null : Number(newBatch);
    // Update UI immediately
    setTeams(prev => {
      const updated = prev.map(t => t.id === teamId ? { ...t, batch: val } : t);
      updated.sort((a, b) => { const ba = a.batch ?? 99, bb = b.batch ?? 99; return ba - bb || a.title.localeCompare(b.title); });
      return updated;
    });
    setSavingBatchId(teamId);
    try {
      await apiRequest("/coordinator/teams/batches", {
        method: "PUT",
        body: {
          assignments: [{ project_id: teamId, batch: val }],
        },
      });

      await load();
      showNotice(`Batch saved as ${val ? `Batch ${val}` : "Unassigned"}.`);
    } catch (error) {
      setTeams(previousTeams);
      setBatchSaveError(error.message || "Batch save failed.");
      showNotice("Failed to save batch: " + error.message, "err");
    } finally {
      setSavingBatchId("");
    }
  };

  const buildPdf = (arr, label) => {
    const rows = arr.map((t, i) =>
      `<tr>
        <td>${i + 1}</td>
        <td><strong>${t.title}</strong></td>
        <td>${t.team_size}</td>
        <td>${t.guide_name}</td>
        <td>${t.batch ? "Batch " + t.batch : "Unassigned"}</td>
      </tr>`
    ).join("");
    return `<!DOCTYPE html><html><head><title>${label}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;padding:24px}
      h1{font-size:16px;margin-bottom:2px}
      p.sub{color:#666;font-size:11px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse}
      th{background:#f1f5f9;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0}
      td{padding:7px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top;font-size:12px}
    </style>
    </head><body>
    <h1>${label}</h1>
    <p class="sub">${arr.length} teams &nbsp;·&nbsp; Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
    <table>
      <thead><tr><th>Sl. No.</th><th>Project name</th><th>Members</th><th>Guide</th><th>Batch</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </body></html>`;
  };

  const handleExport = (which) => {
    const map = {
      batch1: { arr: teams.filter(t => t.batch === 1), label: "Batch 1" },
      batch2: { arr: teams.filter(t => t.batch === 2), label: "Batch 2" },
      all: { arr: teams, label: "All Teams" },
    };
    const { arr, label } = map[which];
    if (!arr.length) { alert(`No teams in ${label} to export.`); return; }
    const html = buildPdf(arr, label).replace(
      "</style>",
      `.dl-btn{display:inline-flex;align-items:center;gap:6px;background:#14b8a6;color:#fff;font-weight:700;font-size:13px;padding:8px 18px;border-radius:8px;border:none;cursor:pointer;margin-bottom:20px;text-decoration:none}
      .dl-btn:hover{background:#0f9d8a}
      @media print{.dl-btn{display:none}}</style>`
    ).replace(
      "<h1>",
      `<a class="dl-btn" id="dlbtn">⬇ Download</a><h1>`
    ).replace(
      "</body>",
      `<script>
        document.getElementById("dlbtn").onclick=function(){
          var a=document.createElement("a");
          a.href="data:text/html;charset=utf-8,"+encodeURIComponent(document.documentElement.outerHTML);
          a.download="${label.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.html";
          a.click();
        };
      </script></body>`
    );
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  };

  if (selectedId) return (
    <TeamDetailBoundary onBack={() => setSelectedId(null)}>
      <TeamDetail projectId={selectedId} onBack={() => setSelectedId(null)} />
    </TeamDetailBoundary>
  );
  if (loading) return <Spinner />;

  const b1 = teams.filter(t => t.batch === 1);
  const b2 = teams.filter(t => t.batch === 2);
  const un = teams.filter(t => !t.batch);
  const guides = ["all", ...new Set(teams.map(t => t.guide_name).filter(g => g !== "—"))];
  const filtered = teams.filter(t =>
    (filterBatch === "all" || (filterBatch === "1" && t.batch === 1) || (filterBatch === "2" && t.batch === 2) || (filterBatch === "none" && !t.batch)) &&
    (filterGuide === "all" || t.guide_name === filterGuide)
  );
  const statusType = s => { const k = (s || "").toLowerCase(); return k === "active" ? "green" : k === "pending" ? "amber" : k === "completed" ? "blue" : "gray"; };

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-500">Total Teams: <strong className="text-slate-800">{teams.length}</strong></span>
              <span className="text-xs text-slate-500">Total Students: <strong className="text-slate-800">{teams.reduce((s, t) => s + t.team_size, 0)}</strong></span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setLocked(l => !l)}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border transition-all ${locked ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-[#00D2C4] text-[#00D2C4] hover:bg-teal-50"}`}>
              <span className="material-symbols-outlined text-base">{locked ? "lock" : "lock_open"}</span>
              {locked ? "Unlock Formation" : "Lock Formation"}
            </button>
            <button onClick={handleAutoDivide} disabled={saving || locked}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ backgroundColor: "#00D2C4", color: "#0f172a" }}>
              <span className="material-symbols-outlined text-base">call_split</span>
              {saving ? "Dividing..." : "Auto-divide into batches"}
            </button>
            <div className="relative" ref={el => { exportRef.current = el; }}>
              <button onClick={() => setExportOpen(o => !o)}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-white border border-[#00D2C4] text-[#00D2C4] hover:bg-teal-50 transition-all">
                <span className="material-symbols-outlined text-base">download</span>
                Export
                <span className="material-symbols-outlined text-sm">{exportOpen ? "expand_less" : "expand_more"}</span>
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-40 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-20">
                  {[
                    { key: "batch1", label: "Batch 1", color: "text-teal-700 hover:bg-teal-50" },
                    { key: "batch2", label: "Batch 2", color: "text-indigo-700 hover:bg-indigo-50" },
                    { key: "all", label: "All teams", color: "text-slate-700 hover:bg-slate-50" },
                  ].map(({ key, label, color }) => (
                    <button key={key} onClick={() => { handleExport(key); setExportOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b border-slate-50 last:border-0 ${color}`}>
                      <span className="material-symbols-outlined text-sm">download</span>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-5 mt-3 pt-3 border-t border-slate-50">
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-400" /><span className="text-xs text-slate-500">Batch 1</span><span className="text-sm font-bold text-teal-600">{b1.length}</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400" /><span className="text-xs text-slate-500">Batch 2</span><span className="text-sm font-bold text-indigo-600">{b2.length}</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300" /><span className="text-xs text-slate-500">Unassigned</span><span className="text-sm font-bold text-slate-400">{un.length}</span></div>
          {locked && <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full"><span className="material-symbols-outlined text-sm">lock</span>Formation locked</span>}
        </div>
        <div className="mt-5">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Batches assigned</span>
            <span className="text-xs font-bold text-slate-700">{Math.round((teams.filter(t => t.batch).length / (teams.length || 1)) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round((teams.filter(t => t.batch).length / (teams.length || 1)) * 100)}%`, backgroundColor: "#00D2C4" }} />
          </div>
        </div>
      </div>

      {notice && (
        <div className={`rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 border ${noticeType === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
          <span className="material-symbols-outlined text-base">{noticeType === "ok" ? "check_circle" : "error"}</span>{notice}
        </div>
      )}
      {batchSaveError && (
        <div className="rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 border bg-red-50 border-red-200 text-red-700">
          <span className="material-symbols-outlined text-base">error</span>Batch save failed: {batchSaveError}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{filtered.length} of {teams.length} teams</p>
          <div className="flex gap-2">
            <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl bg-white focus:outline-none">
              <option value="all">All batches</option>
              <option value="1">Batch 1</option>
              <option value="2">Batch 2</option>
              <option value="none">Unassigned</option>
            </select>
            <select value={filterGuide} onChange={e => setFilterGuide(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl bg-white focus:outline-none">
              {guides.map(g => <option key={g} value={g}>{g === "all" ? "All guides" : g}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["SI.NO", "Project Title", "Members", "Guide", "Batch", "Current Stage", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 text-sm">No teams found.</td></tr>
              ) : filtered.map((t, idx) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3.5 text-xs text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                        style={{ backgroundColor: t.batch === 1 ? "#14b8a6" : t.batch === 2 ? "#6366f1" : "#94a3b8" }}>
                        {t.title?.[0]?.toUpperCase() || "T"}
                      </div>
                      <span className="font-semibold text-slate-900 text-sm">{t.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-slate-700">{t.team_size}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-600">{t.guide_name}</td>
                  <td className="px-4 py-3.5">
                    <select value={t.batch || ""} disabled={locked || savingBatchId === t.id}
                      onChange={e => handleBatchChange(t.id, e.target.value)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-none transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${t.batch === 1 ? "bg-teal-50 border-teal-200 text-teal-700" : t.batch === 2 ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                      <option value="">Unassigned</option>
                      <option value="1">Batch 1</option>
                      <option value="2">Batch 2</option>
                    </select>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-600 capitalize">{t.current_stage}</td>
                  <td className="px-4 py-3.5"><StatusPill label={t.status || "Pending"} type={statusType(t.status)} /></td>
                  <td className="px-4 py-3.5">
                    <button onClick={() => setSelectedId(t.id)}
                      className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 transition-all">
                      <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>open_in_new</span>
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TAB 4: Reviews & Access ──────────────────────────────────────────────────
function TabReviews({ classId }) {
  const [toggles, setToggles] = useState({ zeroth_review: false, first_review: false, second_review: false, final_review: false });
  const [mentors, setMentors] = useState([]);
  const [selected, setSelected] = useState([]);
  const [mentorBatches, setMentorBatches] = useState({});
  const [mentorSearch, setMentorSearch] = useState("");
  const [reviewerView, setReviewerView] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let rows = [];
      let hasBatchScope = true;

      const { data: accessRows, error: accessError } = await supabase
        .from("reviewer_access")
        .select("mentor_id,stage,is_open,batch")
        .eq("class_id", classId);

      if (accessError) {
        const missingBatchColumn =
          accessError.code === "PGRST204" ||
          /batch/i.test(accessError.message || "") ||
          /batch/i.test(accessError.details || "");

        if (missingBatchColumn) {
          hasBatchScope = false;
          const { data: legacyRows, error: legacyError } = await supabase
            .from("reviewer_access")
            .select("mentor_id,stage,is_open")
            .eq("class_id", classId);

          if (legacyError) throw legacyError;
          rows = legacyRows || [];
        } else {
          throw accessError;
        }
      } else {
        rows = accessRows || [];
      }
      const t = { zeroth_review: false, first_review: false, second_review: false, final_review: false };
      const assigned = new Set();
      const batchMap = {};
      (rows || []).forEach((row) => {
        if (row?.mentor_id) assigned.add(row.mentor_id);
        if (row?.is_open) t[row.stage] = true;
        if (hasBatchScope && row?.mentor_id) {
          const nextBatch = row.batch ?? "all";
          const currentBatch = batchMap[row.mentor_id];
          if (currentBatch == null || (currentBatch === "all" && nextBatch !== "all")) {
            batchMap[row.mentor_id] = nextBatch;
          }
        }
      });
      setToggles(t);
      setSelected([...assigned]);
      setMentorBatches(batchMap);

      const { data: mentorRows, error: mentorError } = await supabase
        .from("profiles")
        .select("id,full_name,email,department,designation")
        .eq("role", "mentor")
        .order("full_name");

      if (mentorError) throw mentorError;
      setMentors(mentorRows || []);
    } catch (e) {
      console.error(e);
    }
    if (!silent) setLoading(false);
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  const persistAccess = useCallback(async (
    nextSelected = selected,
    nextToggles = toggles,
    nextMentorBatches = mentorBatches
  ) => {
    setSaving(true);
    setSaveError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const allStages = ["zeroth_review", "first_review", "second_review", "final_review"];
      const rows = [];
      for (const mentorId of nextSelected) {
        for (const stage of allStages) {
          rows.push({
            class_id: classId,
            mentor_id: mentorId,
            stage,
            batch: nextMentorBatches[mentorId] === "all" || nextMentorBatches[mentorId] == null ? null : Number(nextMentorBatches[mentorId]),
            is_open: nextToggles[stage] || false,
            granted_by: user.id,
            updated_at: new Date().toISOString(),
          });
        }
      }

      if (rows.length > 0) {
        let writeError = null;
        const upsertResult = await supabase
          .from("reviewer_access")
          .upsert(rows, { onConflict: "class_id,mentor_id,stage" });

        writeError = upsertResult.error;

        const missingBatchColumn =
          writeError &&
          (writeError.code === "PGRST204" ||
            /batch/i.test(writeError.message || "") ||
            /batch/i.test(writeError.details || ""));

        if (missingBatchColumn) {
          throw new Error('Batch scope cannot be saved because the "reviewer_access.batch" column is missing in Supabase.');
        }

        if (writeError) throw writeError;
      }

      const deselected = mentors.filter(m => !nextSelected.includes(m.id)).map(m => m.id);
      if (deselected.length > 0) {
        const { error: deleteError } = await supabase
          .from("reviewer_access")
          .delete()
          .eq("class_id", classId)
          .in("mentor_id", deselected);
        if (deleteError) throw deleteError;
      }

      if (nextSelected.length === 0) {
        const { error: clearError } = await supabase
          .from("reviewer_access")
          .delete()
          .eq("class_id", classId);
        if (clearError) throw clearError;
      }

      await load(true);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
      setSaveError(e.message || "Failed to save reviewer access.");
    }
    setSaving(false);
  }, [classId, load, mentorBatches, mentors, selected, toggles]);

  const saveAccess = async () => {
    await persistAccess();
  };

  const handleToggleChange = async (stageKey) => {
    if (selected.length === 0) {
      alert("Please assign at least one reviewer from the list below before opening a stage.");
      return;
    }
    const nextToggles = { ...toggles, [stageKey]: !toggles[stageKey] };
    setToggles(nextToggles);
    await persistAccess(selected, nextToggles, mentorBatches);
  };

  const handleReviewerSelectionChange = async (mentorId) => {
    const nextSelected = selected.includes(mentorId)
      ? selected.filter((id) => id !== mentorId)
      : [...selected, mentorId];
    setSelected(nextSelected);
    await persistAccess(nextSelected, toggles, mentorBatches);
  };

  const normalizedSearch = mentorSearch.trim().toLowerCase();
  const visibleMentors = [...mentors]
    .filter((mentor) => {
      if (reviewerView === "assigned" && !selected.includes(mentor.id)) return false;
      if (reviewerView === "unassigned" && selected.includes(mentor.id)) return false;
      if (!normalizedSearch) return true;
      return [
        mentor.full_name,
        mentor.email,
        mentor.department,
        mentor.designation,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
    })
    .sort((a, b) => {
      const aSelected = selected.includes(a.id);
      const bSelected = selected.includes(b.id);
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      return String(a.full_name || a.email || "").localeCompare(String(b.full_name || b.email || ""));
    });

  const handleReviewerBatchChange = async (mentorId, batchValue) => {
    const nextMentorBatches = { ...mentorBatches, [mentorId]: batchValue };
    setMentorBatches(nextMentorBatches);
    if (!selected.includes(mentorId)) return;
    await persistAccess(selected, toggles, nextMentorBatches);
  };

  if (loading) return <Spinner />;

  const stageList = [
    { key: "zeroth_review", label: "Zeroth Review" },
    { key: "first_review", label: "First Review" },
    { key: "second_review", label: "Second Review" },
    { key: "final_review", label: "Final Review" },
  ];

  return (
    <div className="space-y-5">
      {/* Stage toggles */}
      <Card>
        <SectionHeader icon="lock_open" title="Stage Access Control" />
        <div className="px-6 py-4">
          <p className="text-sm text-slate-500 mb-5">Open a stage to allow assigned reviewers to enter marks. Close it to lock marks entry.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stageList.map(({ key, label }) => {
              const isOn = toggles[key];
              return (
                <div key={key} className={`flex items-center justify-between px-4 py-4 rounded-xl border-2 transition-all ${isOn ? "border-[#00D2C4] bg-[rgba(0,210,196,0.05)]" : "border-slate-100 bg-slate-50/50"}`}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-xl" style={{ color: isOn ? "#00D2C4" : "#94a3b8" }}>
                      {isOn ? "lock_open" : "lock"}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{isOn ? "Reviewers can enter marks" : "Marks entry locked"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill label={isOn ? "Open" : "Closed"} type={isOn ? "teal" : "gray"} />
                    <button onClick={() => handleToggleChange(key)}
                      disabled={saving}
                      className="w-11 h-6 rounded-full relative transition-all duration-200 focus:outline-none"
                      style={{ backgroundColor: isOn ? "#00D2C4" : "#e2e8f0" }}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-200 ${isOn ? "left-5" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Reviewer assignment */}
      <Card>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-xl" style={{ color: "#00D2C4" }}>manage_accounts</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Assign Reviewers</h2>
              <p className="text-xs text-slate-400 mt-0.5">Select mentors and choose which batch they can review</p>
            </div>
          </div>
          <TealButton onClick={saveAccess} disabled={saving} icon="save">
            {saving ? "Saving..." : "Save Access"}
          </TealButton>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
              <input
                type="text"
                value={mentorSearch}
                onChange={(e) => setMentorSearch(e.target.value)}
                placeholder="Search mentors by name, email, department..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#00D2C4] focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: "all", label: `All (${mentors.length})` },
                { key: "assigned", label: `Assigned (${selected.length})` },
                { key: "unassigned", label: `Unassigned (${Math.max(mentors.length - selected.length, 0)})` },
              ].map((option) => {
                const active = reviewerView === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setReviewerView(option.key)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      active
                        ? "border-[#00D2C4] bg-[rgba(0,210,196,0.08)] text-[#009e93]"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
            <p>{visibleMentors.length} mentor{visibleMentors.length === 1 ? "" : "s"} shown</p>
            {mentorSearch && (
              <button
                type="button"
                onClick={() => setMentorSearch("")}
                className="font-semibold text-[#009e93] hover:text-[#007f76]"
              >
                Clear search
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
          {mentors.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-400 text-sm">No mentors found.</div>
          ) : visibleMentors.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-400 text-sm">No mentors match the current search or filter.</div>
          ) : visibleMentors.map(m => {
            const checked = selected.includes(m.id);
            return (
              <div key={m.id} className={`flex items-center gap-4 px-6 py-4 transition-colors ${checked ? "bg-[rgba(0,210,196,0.04)]" : "hover:bg-slate-50/50"}`}>
                <input type="checkbox" id={`mentor-${m.id}`} checked={checked}
                  onChange={() => handleReviewerSelectionChange(m.id)}
                  disabled={saving}
                  className="w-4 h-4 cursor-pointer flex-shrink-0" style={{ accentColor: "#00D2C4" }} />
                
                <label htmlFor={`mentor-${m.id}`} className="flex flex-1 items-center gap-4 min-w-0 cursor-pointer">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                    style={{ backgroundColor: "#00D2C4" }}>
                    {(m.full_name || m.email || "Mentor")?.[0]?.toUpperCase() || "M"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{m.full_name || m.email || "Unnamed Mentor"}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{m.department}{m.designation ? ` · ${m.designation}` : ""}</p>
                  </div>
                </label>

                <select
                  value={mentorBatches[m.id] ?? "all"}
                  onChange={(e) => handleReviewerBatchChange(m.id, e.target.value)}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">All Batches</option>
                  <option value="1">Batch 1</option>
                  <option value="2">Batch 2</option>
                </select>
                {checked && <StatusPill label="Assigned" type="teal" />}
              </div>
            );
          })}
        </div>

        {saved && (
          <div className="flex items-center gap-2 px-6 py-4 bg-emerald-50 border-t border-emerald-100 text-sm font-semibold text-emerald-700">
            <span className="material-symbols-outlined text-base">check_circle</span>
            Reviewer access saved successfully
          </div>
        )}
        {saveError && (
          <div className="flex items-center gap-2 px-6 py-4 bg-red-50 border-t border-red-100 text-sm font-semibold text-red-700">
            <span className="material-symbols-outlined text-base">error</span>
            {saveError}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
// activeSubPage is driven by the sidebar — values: "overview" | "teams" | "submissions" | "reviews"
export default function MyClass({ classData, loading, onSaveStudentDeadline, activeSubPage = "overview", onNavigate }) {
  const [coordinators, setCoordinators] = useState([]);

  useEffect(() => {
    if (!classData?.classId) return;
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_coordinator", true)
      .eq("class_id", classData.classId)
      .then(({ data }) => setCoordinators(data || []));
  }, [classData?.classId]);

  const classId = classData?.classId || null;
  const classTitle = classData?.classTitle || "My Class";
  const totalTeams = Number(classData?.totalProjects || 0);
  const totalStudents = Number(
    classData?.totalStudents ??
    (Array.isArray(classData?.projects)
      ? classData.projects.reduce((sum, project) => sum + Number(project?.teamSize || 0), 0)
      : 0)
  );
  const evaluatedTeams = Number(classData?.evaluatedProjects || 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {classId && (
        <div className="flex flex-col gap-6">
          {/* Page Identity Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#00D2C4" }}>
              <span className="material-symbols-outlined text-white text-[20px]">school</span>
            </div>
            <div>
              <h2 className="text-[17px] font-black text-slate-900 leading-tight">My Class</h2>
              <p className="text-xs font-semibold text-slate-500">{classTitle}</p>
            </div>
          </div>

          {/* Class detail card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white"
                style={{ backgroundColor: "#00D2C4" }}>
                <span className="material-symbols-outlined text-2xl">groups</span>
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">{classTitle}</h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs font-bold text-slate-400 font-mono tracking-wider">{`CL-${String(classId).slice(0, 8).toUpperCase()}`}</span>
                  {coordinators.length > 0 && <span className="text-xs text-slate-500 ml-1">Coordinator: {coordinators.map(c => c.full_name).join(" - ")}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">

              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                {evaluatedTeams} / {totalTeams} Evaluated
              </span>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                {totalStudents} Students
              </span>
            </div>
          </div>

        </div>
      )}
      {/* Content — sub-page is controlled by sidebar */}
      {activeSubPage === "overview" && <TabOverview classData={classData} coordinators={coordinators} loading={loading} onSaveStudentDeadline={onSaveStudentDeadline} onNavigate={onNavigate} />}
      {activeSubPage === "teams" && classId && <TabTeams classId={classId} />}
      {activeSubPage === "submissions" && classId && <TabSubmissions classId={classId} />}
      {activeSubPage === "reviews" && classId && <TabReviews classId={classId} />}
      {activeSubPage === "marks" && classId && <CoordinatorResultsPanel classId={classId} />}

      {!classId && activeSubPage !== "overview" && (
        <Card>
          <div className="px-6 py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">info</span>
            <p className="text-slate-500">Class data not available yet.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
