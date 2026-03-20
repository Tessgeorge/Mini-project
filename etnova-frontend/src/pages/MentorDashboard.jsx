import { useState, useEffect, useRef, useCallback } from "react";
import TeamWorkspace from "./Teamworkspace";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabaseClient";
import ProfileMenu from "../components/ProfileMenu";
import Modal from "../components/Modal";
import AppSidebar from "../components/Sidebar";
import AppTopBar from "../components/TopBar";

// ─── Icons ─────────────────────────────────────────────────────────────────
const Icon = {
  Dashboard: () => (<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>),
  Teams: () => (<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
  Evaluation: () => (<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>),
  Logout: () => (<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>),
  ChevronRight: () => (<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>),
  ArrowRight: () => (<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>),
  Clock: () => (<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>),
  Check: () => (<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>),
  Alert: () => (<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>),
  Star: () => (<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>),
  X: () => (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>),
  User: () => (<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>),
  Edit: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>),
  Save: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>),
  Mail: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>),
  Building: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>),
  Hash: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>),
  Shield: () => (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>),
  Settings: () => (<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 .99-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 .99 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51.99H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51.99z" /></svg>),
  Help: () => (<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>),
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const scoreClr = s => s >= 90 ? "text-emerald-600" : s >= 70 ? "text-amber-500" : "text-red-500";
const scoreBg = s => s >= 90 ? "bg-emerald-500" : s >= 70 ? "bg-amber-400" : "bg-red-400";

let mentorEvalFilterStrategy = null;
let mentorEvalInsertStrategy = null;

function normalizeMentorEvaluationRow(row) {
  if (!row) return row;
  return {
    ...row,
    phase: row.phase || row.evaluation_type || "Phase 1",
    score: row.score ?? row.obtained_marks ?? 0,
  };
}

async function fetchEvaluationsForMentor(mentorId) {
  const filters = mentorEvalFilterStrategy ? [mentorEvalFilterStrategy] : ["evaluator_id", "guide_id"];
  for (const filterColumn of filters) {
    const { data, error } = await supabase
      .from("evaluations")
      .select("*")
      .eq(filterColumn, mentorId);

    if (error) continue;
    mentorEvalFilterStrategy = filterColumn;
    return (data || [])
      .map(normalizeMentorEvaluationRow)
      .sort((a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0));
  }
  return [];
}

async function fetchSystemSettingsRows() {
  const { data } = await supabase
    .from("system_settings")
    .select("*");

  return (data || []).sort((a, b) => {
    const aTs = new Date(a?.created_at || a?.updated_at || 0).getTime();
    const bTs = new Date(b?.created_at || b?.updated_at || 0).getTime();
    return aTs - bTs;
  });
}

async function insertMentorEvaluation(mentorId, payload) {
  const candidates = mentorEvalInsertStrategy
    ? [mentorEvalInsertStrategy]
    : [
      {
        evaluatorKey: "evaluator_id",
        stageKey: "evaluation_type",
        scoreKeys: { obtained: "obtained_marks", max: "max_marks" },
      },
      {
        evaluatorKey: "guide_id",
        stageKey: "phase",
        scoreKeys: { obtained: "score", max: null },
      },
    ];

  for (const candidate of candidates) {
    const insertRow = {
      project_id: payload.projectId,
      feedback: payload.feedback,
      [candidate.evaluatorKey]: mentorId,
      [candidate.stageKey]: payload.phase,
    };
    if (candidate.scoreKeys.obtained) insertRow[candidate.scoreKeys.obtained] = payload.score;
    if (candidate.scoreKeys.max) insertRow[candidate.scoreKeys.max] = payload.maxScore;

    const { data, error } = await supabase
      .from("evaluations")
      .insert([insertRow])
      .select()
      .single();

    if (error) continue;
    mentorEvalInsertStrategy = candidate;
    return normalizeMentorEvaluationRow(data);
  }

  throw new Error("Failed to submit evaluation.");
}

const STATUS_MAP = {
  active: { pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", label: "Active" },
  pending: { pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400", label: "Pending" },
  completed: { pill: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500", label: "Completed" },
  rejected: { pill: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-400", label: "Rejected" },
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status?.toLowerCase()] || STATUS_MAP.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${s.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
    </span>
  );
}

function Spinner() {
  return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" /></div>;
}

function formatClassScore(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(1);
}

const REVIEW_STAGE_ORDER = ["Idea", "Abstract", "Zeroth Review", "First Review", "Second Review", "Final Review"];
const MENTOR_NAV_ITEMS = [
  { id: "overview", label: "Dashboard", icon: "dashboard" },
  { id: "teams", label: "My Teams", icon: "group" },
  { id: "evaluation", label: "Evaluation", icon: "grading" },
  { id: "my-class", label: "My Class", icon: "apartment" },
];

function normalizeReviewStageName(stageName) {
  const value = String(stageName || "").trim().toLowerCase();
  if (value === "0th review") return "Zeroth Review";
  if (value === "1st review") return "First Review";
  if (value === "2nd review") return "Second Review";
  if (value === "zeroth review") return "Zeroth Review";
  if (value === "first review") return "First Review";
  if (value === "second review") return "Second Review";
  if (value === "idea") return "Idea";
  if (value === "abstract") return "Abstract";
  if (value === "final review") return "Final Review";
  return String(stageName || "").trim();
}

function reviewStageOrderIndex(stageName) {
  const normalized = normalizeReviewStageName(stageName).toLowerCase();
  const idx = REVIEW_STAGE_ORDER.findIndex((name) => name.toLowerCase() === normalized);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function formatDeadlineDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInputValue(value) {
  if (!value) return "";
  return value.slice(0, 10);
}

function toTimeInputValue(value) {
  if (!value) return "";
  return value.slice(11, 16) || "";
}

function buildDeadlineIso(datePart, timePart) {
  if (!datePart || !timePart) return "";
  return datePart + "T" + timePart + ":00";
}

function normalizeMilestoneDueDate(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString();
  }

  if (typeof value === "number") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
  }

  const maybeDate = new Date(value);
  if (!Number.isNaN(maybeDate.getTime())) {
    return maybeDate.toISOString();
  }

  return String(value);
}

function formatMyClassError(prefix, error) {
  const message = String(error?.message || error?.details || "").trim();
  if (!message) return prefix;
  return `${prefix}: ${message}`;
}

function sortReviewStages(rows) {
  const grouped = new Map();

  for (const row of rows || []) {
    const normalizedName = normalizeReviewStageName(row?.stage_name);
    const current = grouped.get(normalizedName);

    if (!current) {
      grouped.set(normalizedName, {
        ...row,
        stage_name: normalizedName,
      });
      continue;
    }

    grouped.set(normalizedName, {
      ...current,
      ...row,
      stage_name: normalizedName,
      coordinator_deadline: row?.coordinator_deadline || current.coordinator_deadline || null,
      deadline: row?.deadline || current.deadline || null,
      stage_order: Number.isFinite(Number(current?.stage_order)) ? current.stage_order : row?.stage_order,
      is_active: Boolean(current?.is_active || row?.is_active),
      student_deadline_set_by_coordinator: Boolean(current?.student_deadline_set_by_coordinator || row?.student_deadline_set_by_coordinator),
    });
  }

  return REVIEW_STAGE_ORDER.map((stageName, index) => {
    const matched = grouped.get(stageName);
    if (matched) {
      return {
        ...matched,
        stage_name: stageName,
        stage_order: Number.isFinite(Number(matched?.stage_order)) ? Number(matched.stage_order) : index,
        is_active: Boolean(matched?.is_active),
        student_deadline_set_by_coordinator: Boolean(matched?.student_deadline_set_by_coordinator),
      };
    }

    return {
      id: `canonical-${index}` ,
      stage_name: stageName,
      stage_order: index,
      deadline: null,
      coordinator_deadline: null,
      is_active: false,
      student_deadline_set_by_coordinator: false,
    };
  }).sort((a, b) => {
    const orderA = Number.isFinite(Number(a?.stage_order)) ? Number(a.stage_order) : reviewStageOrderIndex(a?.stage_name);
    const orderB = Number.isFinite(Number(b?.stage_order)) ? Number(b.stage_order) : reviewStageOrderIndex(b?.stage_name);
    if (orderA !== orderB) return orderA - orderB;
    return String(normalizeReviewStageName(a?.stage_name)).localeCompare(String(normalizeReviewStageName(b?.stage_name)));
  });
}

function resolveCoordinatorClassId(profile, projects) {
  if (!profile?.is_coordinator) {
    return { classId: null, error: "" };
  }

  if (profile.class_id) {
    return { classId: profile.class_id, error: "" };
  }

  const classIds = Array.from(new Set((projects || []).map((project) => project?.class_id).filter(Boolean)));
  if (classIds.length === 1) {
    return { classId: classIds[0], error: "" };
  }

  if (classIds.length > 1) {
    return {
      classId: null,
      error: "Coordinator is linked to multiple classes. Ask admin to assign a coordinator class.",
    };
  }

  return { classId: null, error: "No coordinator class assigned." };
}

function WeeklyChart({ projects, evaluations }) {
  // Build last-7-days evaluation count per day
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-IN", { weekday: "short" });
    const count = evaluations.filter(e => e.created_at?.startsWith(key)).length;
    days.push({ label, key, count });
  }
  const max = Math.max(...days.map(d => d.count), 1);

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Weekly Evaluation Activity</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{evaluations.length} <span className="text-sm font-medium text-gray-400">total evaluations</span></p>
        </div>
        <span className="text-xs bg-teal-50 text-teal-600 font-semibold px-3 py-1.5 rounded-full border border-teal-200">Last 7 days</span>
      </div>
      <div className="flex items-end justify-between gap-2 h-28">
        {days.map((d) => {
          const pct = max === 0 ? 0 : (d.count / max) * 100;
          return (
            <div key={d.key} className="flex flex-col items-center gap-1.5 flex-1">
              <span className="text-xs font-bold text-gray-600">{d.count > 0 ? d.count : ""}</span>
              <div className="w-full rounded-t-lg bg-gray-100 relative overflow-hidden" style={{ height: "80px" }}>
                <div
                  className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-teal-500 to-teal-300 transition-all duration-700"
                  style={{ height: `${Math.max(pct, d.count > 0 ? 10 : 0)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 font-medium">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Project Progress Ring ──────────────────────────────────────────────────
function ProgressRing({ pct, size = 56, stroke = 5 }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#14b8a6" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
    </svg>
  );
}

// ─── Review Modal ───────────────────────────────────────────────────────────
function ReviewModal({ project, onClose, onSubmit }) {
  const [form, setForm] = useState({ phase: "Phase 1", score: "", feedback: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!form.score || !form.feedback) { setErr("Please fill in score and feedback."); return; }
    setSaving(true); setErr("");
    await onSubmit({ projectId: project.id, ...form });
    setSaving(false);
  };

  const cls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-teal-100 mb-1">Start Review</p>
              <h3 className="font-extrabold text-white text-lg leading-tight">{project.title}</h3>
            </div>
            <button onClick={onClose} className="text-teal-100 hover:text-white mt-0.5"><Icon.X /></button>
          </div>
          {project.abstract && (
            <p className="text-teal-100 text-xs mt-2 line-clamp-2">{project.abstract}</p>
          )}
        </div>

        {/* Members */}
        {project.team_members?.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Team Members</p>
            <div className="flex flex-wrap gap-2">
              {project.team_members.map((tm, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1">
                  <div className="w-5 h-5 rounded-full bg-teal-400 text-white flex items-center justify-center text-xs font-bold">
                    {tm.profiles?.full_name?.[0] || "?"}
                  </div>
                  <span className="text-xs font-medium text-gray-700">{tm.profiles?.full_name || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Phase</label>
              <select className={cls} value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}>
                {["Phase 1", "Phase 2", "Phase 3", "Final Review"].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Score (0–100)</label>
              <input type="number" min="0" max="100" placeholder="e.g. 85" className={cls}
                value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} />
            </div>
          </div>
          {form.score && (
            <div className={`text-center py-2 rounded-xl font-bold text-sm ${Number(form.score) >= 90 ? "bg-emerald-50 text-emerald-700" : Number(form.score) >= 70 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
              {Number(form.score) >= 90 ? "🌟 Excellent" : Number(form.score) >= 70 ? "✓ Good" : "⚠ Needs Improvement"}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Feedback</label>
            <textarea rows={4} placeholder="Provide detailed feedback for the team..." className={`${cls} resize-none`}
              value={form.feedback} onChange={e => setForm({ ...form, feedback: e.target.value })} />
          </div>
          {err && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all text-sm">Cancel</button>
            <button onClick={submit} disabled={saving}
              className="flex-2 flex-1 bg-teal-400 hover:bg-teal-500 text-white font-bold py-3 rounded-xl transition-all text-sm disabled:opacity-50">
              {saving ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mentor Profile Modal ────────────────────────────────────────────────────
function MentorProfileModal({ profile, onClose, onSave, onSignOut, startEditing = false }) {
  const [editing, setEditing] = useState(startEditing);
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    email: profile?.email || "",
    department: profile?.department || "",
    roll_number: profile?.roll_number || "",
    phone: profile?.phone || "",
    bio: profile?.bio || "",
    specialization: profile?.specialization || "",
    employee_id: profile?.employee_id || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const initial = (form.full_name || "M")[0].toUpperCase();

  const field = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all";
  const fieldRO = "w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-slate-100 text-gray-500 cursor-not-allowed";

  const handleSave = async () => {
    if (!form.full_name.trim()) { setErr("Full name is required."); return; }
    setSaving(true); setErr("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          department: form.department.trim(),
          phone: form.phone.trim(),
          bio: form.bio.trim(),
          specialization: form.specialization.trim(),
          employee_id: form.employee_id.trim(),
        })
        .eq("id", profile.id);
      if (error) throw error;
      onSave({ ...profile, ...form });
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setErr(e.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const Label = ({ text, required }) => (
    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
      {text}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );

  const infoItems = [
    { label: "Full Name", value: form.full_name || "Not set" },
    { label: "Email", value: form.email || "Not set" },
    { label: "Role", value: "Project Guide" },
    { label: "Department", value: form.department || "-" },
  ];

  const openSupport = () => {
    window.location.href = "mailto:support@etnova.ac.in?subject=Mentor%20Portal%20Support";
  };

  if (editing) {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title="Profile Settings"
        maxWidth="max-w-2xl"
      >
        <div className="p-6 space-y-5">
          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          {saved && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Profile updated successfully!
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">Email Address</label>
            <input
              value={form.email}
              readOnly
              className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">Full Name *</label>
            <input
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
              value={form.full_name}
              onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
              placeholder="Enter your full name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Employee / Staff ID</label>
              <input
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
                value={form.employee_id || form.roll_number}
                onChange={(e) => setForm((prev) => ({ ...prev, employee_id: e.target.value }))}
                placeholder="e.g., EMP-2024-001"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Specialization</label>
              <input
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
                value={form.specialization}
                onChange={(e) => setForm((prev) => ({ ...prev, specialization: e.target.value }))}
                placeholder="e.g., Machine Learning"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Department</label>
              <input
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
                value={form.department}
                onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                placeholder="e.g., Computer Science"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Phone Number</label>
              <input
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="e.g., +91 9876543210"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">Bio</label>
            <textarea
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 resize-none"
              value={form.bio}
              onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
              placeholder="Short professional bio or research interests..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 px-4 py-3 rounded-xl text-black font-bold text-sm hover:opacity-90 transition-all shadow-md"
              style={{ backgroundColor: "#00D2C4" }}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-200/92 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-[380px] overflow-hidden rounded-[20px] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)]"
        style={{ fontFamily: '"Nunito", "Inter", "Segoe UI", sans-serif' }}
      >

        {/* ── Header gradient banner ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0a9688] via-[#13b5a4] to-[#2dcfc0] px-6 pb-7 pt-6">
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/14" />
          <div className="absolute right-16 top-9 h-16 w-16 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 left-8 h-20 w-20 rounded-full bg-white/12" />

          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl bg-white/14 text-white/90 transition-all hover:bg-white/24"
          >
            <Icon.X />
          </button>

          <div className="relative flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-white/18 text-2xl font-extrabold text-white shadow-[0_12px_24px_rgba(0,0,0,0.12)] ring-1 ring-white/20">
              {initial}
            </div>
            <div className="min-w-0 flex-1 pr-10">
              <p className="truncate text-xl font-extrabold leading-tight text-white">{form.full_name || "Mentor"}</p>
              <p className="mt-1 truncate text-sm font-semibold text-white/80">{form.email || "No email available"}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white ring-1 ring-white/18">
                <Icon.Shield />
                Mentor
              </div>
            </div>
          </div>
        </div>

        {/* ── Floating role badge ── */}
        <div className="hidden">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 bg-white border border-gray-200 shadow-lg text-gray-700 text-xs font-bold px-4 py-1.5 rounded-full">
              <Icon.Shield />
              {profile?.role
                ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
                : "Mentor"}
            </span>
            {!editing && (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 bg-teal-400 hover:bg-teal-500 text-white shadow-lg text-xs font-bold px-4 py-1.5 rounded-full transition-all active:scale-95">
                <Icon.Edit /> Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="px-5 pb-5 pt-5">

          {/* Success toast */}
          {saved && (
            <div className="mb-4 flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-semibold">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
              Profile updated successfully!
            </div>
          )}

          {!editing ? (
            /* ── View mode ── */
            <div>
              <div className="grid grid-cols-2 gap-3">
                {infoItems.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                    <p className="mt-1 break-words text-sm font-extrabold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2">
                <button
                  onClick={() => {
                    setEditing(true);
                    setErr("");
                  }}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-teal-50 group-hover:text-teal-700">
                    <Icon.Settings />
                  </div>
                  <span className="flex-1 text-sm font-bold text-slate-800">Account Settings</span>
                  <span className="text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600">
                    <Icon.ChevronRight />
                  </span>
                </button>

                <button
                  onClick={openSupport}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-teal-50 group-hover:text-teal-700">
                    <Icon.Help />
                  </div>
                  <span className="flex-1 text-sm font-bold text-slate-800">Help &amp; Support</span>
                  <span className="text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600">
                    <Icon.ChevronRight />
                  </span>
                </button>
              </div>

              <button
                onClick={onSignOut}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0a9688] via-[#13b5a4] to-[#2dcfc0] px-4 py-3.5 text-sm font-extrabold text-white shadow-[0_18px_28px_rgba(19,181,164,0.28)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_34px_rgba(19,181,164,0.34)]"
              >
                <Icon.Logout />
                Sign Out
              </button>
            </div>
          ) : (
            /* ── Edit mode ── */
            <div className="mt-2 space-y-4">
              <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-2.5 text-xs text-teal-700 font-semibold flex items-center gap-2">
                <Icon.Edit /> Editing your profile — changes save to your account
              </div>

              <div>
                <Label text="Full Name" required />
                <input className={field} value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. Dr. Mohan S" />
              </div>

              <div>
                <Label text="Email" />
                <input className={fieldRO} value={form.email} readOnly
                  title="Email cannot be changed here" />
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  Managed through authentication settings
                </p>
              </div>

              <div>
                <Label text="Phone" />
                <input className={field} value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="e.g. +91 98765 43210" />
              </div>

              <div>
                <Label text="Department" />
                <input className={field} value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  placeholder="e.g. Computer Science" />
              </div>

              <div>
                <Label text="Specialization" />
                <input className={field} value={form.specialization}
                  onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))}
                  placeholder="e.g. Machine Learning, IoT" />
              </div>

              <div>
                <Label text="Employee / Staff ID" />
                <input className={field} value={form.employee_id || form.roll_number}
                  onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                  placeholder="e.g. EMP-2024-001" />
              </div>

              <div>
                <Label text="Bio" />
                <textarea className={field + " resize-none"} rows={3} value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="Short professional bio or research interests..." />
              </div>

              {err && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  {err}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => { setEditing(false); setErr(""); }}
                  className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 text-sm transition-all">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-teal-400 hover:bg-teal-500 active:scale-95 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition-all">
                  <Icon.Save />{saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MentorProfileMenu({ profile, isOpen, onClose, onLogout, onEditProfile }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) onClose();
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || !profile) return null;

  const initial = profile.full_name?.charAt(0).toUpperCase() || "M";
  const infoItems = [
    { label: "Full Name", value: profile.full_name },
    { label: "Email", value: profile.email },
    { label: "Role", value: "Project Guide" },
    { label: "Department", value: profile.department },
  ].filter((item) => item.value);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-3 w-[calc(100vw-1rem)] max-w-sm sm:w-80 rounded-2xl border border-slate-100 overflow-hidden z-50"
      style={{
        background: "white",
        boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.07)",
        animation: "menuFadeIn 0.18s ease",
      }}
    >
      <style>{`
        @keyframes menuFadeIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #00D2C4 0%, #00897B 100%)" }}
        />
        <div className="absolute -top-6 -right-6 size-28 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-4 -left-4 size-20 rounded-full opacity-10 bg-white" />

        <div className="relative z-10 px-5 pt-5 pb-4 flex items-center gap-4">
          <div
            className="size-14 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0 shadow-md"
            style={{ backgroundColor: "rgba(255,255,255,0.25)", color: "white", backdropFilter: "blur(8px)" }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-white text-base leading-tight truncate">
              {profile.full_name || "Mentor"}
            </p>
            <p className="text-white/70 text-xs mt-0.5 truncate">{profile.email}</p>
            <span
              className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}
            >
              <span className="material-symbols-outlined text-xs">school</span>
              Mentor
            </span>
          </div>
        </div>
      </div>

      {infoItems.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4">
          {infoItems.map((item) => (
            <div key={item.label}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className="text-sm font-black text-slate-900 mt-0.5 break-words">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="py-1.5">
        <button
          onClick={() => {
            onEditProfile?.();
            onClose();
          }}
          className="w-full px-5 py-3 text-left flex items-center gap-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors group"
        >
          <span
            className="size-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-teal-50"
            style={{ backgroundColor: "rgba(0,210,196,0.08)" }}
          >
            <span className="material-symbols-outlined text-base" style={{ color: "#00897B" }}>
              manage_accounts
            </span>
          </span>
          <span className="flex-1">Account Settings</span>
          <span className="material-symbols-outlined text-sm text-slate-300">chevron_right</span>
        </button>

        <button
          onClick={openSupport}
          className="w-full px-5 py-3 text-left flex items-center gap-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors group"
        >
          <span
            className="size-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-indigo-50"
            style={{ backgroundColor: "rgba(99,102,241,0.08)" }}
          >
            <span className="material-symbols-outlined text-base" style={{ color: "#6366f1" }}>
              help
            </span>
          </span>
          <span className="flex-1">Help &amp; Support</span>
          <span className="material-symbols-outlined text-sm text-slate-300">chevron_right</span>
        </button>
      </div>

      <div className="px-4 pb-4 pt-1 border-t border-slate-100">
        <button
          onClick={onLogout}
          className="w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 hover:opacity-90 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #00D2C4 0%, #00897B 100%)",
            color: "white",
            boxShadow: "0 4px 14px rgba(0,210,196,0.35)",
          }}
        >
          <span className="material-symbols-outlined text-base">logout</span>
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, onSignOut, showMyClass }) {
  const items = [
    { key: "overview", label: "Dashboard", I: Icon.Dashboard },
    { key: "teams", label: "My Teams", I: Icon.Teams },
    { key: "evaluation", label: "Evaluation", I: Icon.Evaluation },
    ...(showMyClass ? [{ key: "my-class", label: "My Class", I: Icon.Building }] : []),
  ];
  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col shadow-sm flex-shrink-0">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl bg-teal-400 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <p className="font-extrabold text-gray-800 leading-tight">ETNOVA</p>
          <p className="text-xs text-gray-400">Mentor Portal</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(({ key, label, I }) => (
          <button key={key} onClick={() => setActive(key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active === key ? "bg-teal-50 text-teal-700 font-semibold" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}>
            <span className={active === key ? "text-teal-500" : "text-gray-400"}><I /></span>
            {label}
          </button>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-gray-100">
        <button onClick={onSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-teal-600 hover:bg-teal-50 transition-all">
          <Icon.Logout /> Sign out
        </button>
      </div>
    </aside>
  );
}

function Topbar({ active, mentorName, onProfileClick, showMyClass }) {
  const labels = {
    overview: "Dashboard",
    teams: "My Teams",
    evaluation: "Evaluation",
    ...(showMyClass ? { "my-class": "My Class" } : {}),
  };
  return (
    <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span>Home</span><Icon.ChevronRight />
        <span className="text-gray-700 font-semibold">{labels[active]}</span>
      </div>
      <button
        onClick={onProfileClick}
        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all group"
        title="View / Edit Profile"
      >
        <div className="w-8 h-8 rounded-full bg-teal-400 text-white flex items-center justify-center text-sm font-bold group-hover:ring-2 group-hover:ring-teal-300 group-hover:ring-offset-1 transition-all">
          {mentorName?.[0] || "M"}
        </div>
        <div className="text-sm text-left">
          <p className="font-semibold text-gray-800 leading-tight group-hover:text-teal-700 transition-colors">{mentorName || "Mentor"}</p>
          <p className="text-xs text-gray-400">Project Guide</p>
        </div>
        <div className="text-gray-300 group-hover:text-teal-400 transition-colors ml-1">
          <Icon.Edit />
        </div>
      </button>
    </header>
  );
}

function MyClassTab({ classData, loading, onSaveStudentDeadline, emptyMessage = "No coordinator class assigned." }) {
  const [deadlineDrafts, setDeadlineDrafts] = useState({});
  const [editingDeadlineIds, setEditingDeadlineIds] = useState({});
  const [savingDeadlineId, setSavingDeadlineId] = useState("");
  const [deadlineError, setDeadlineError] = useState("");
  const [deadlineNotice, setDeadlineNotice] = useState("");

  useEffect(() => {
    const nextDrafts = (classData?.reviewStages || []).reduce((acc, stage) => {
      acc[stage.id] = {
        date: toDateInputValue(stage.deadline),
        time: toTimeInputValue(stage.deadline),
      };
      return acc;
    }, {});
    const nextEditing = (classData?.reviewStages || []).reduce((acc, stage) => {
      acc[stage.id] = Boolean(stage.coordinator_deadline && !stage.deadline);
      return acc;
    }, {});
    setDeadlineDrafts(nextDrafts);
    setEditingDeadlineIds(nextEditing);
    setSavingDeadlineId("");
    setDeadlineError("");
    setDeadlineNotice("");
  }, [classData]);

  if (loading) return <Spinner />;
  if (!classData) {
    return (
      <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-sm text-center">
        <p className="text-gray-700 font-semibold">{emptyMessage}</p>
      </div>
    );
  }

  const {
    classTitle,
    totalProjects,
    evaluatedProjects,
    pendingEvaluations,
    classAverageScore,
    projects,
    reviewStages = [],
    deadlineLoadError = "",
  } = classData;

  const handleDraftChange = (stageId, key, value) => {
    setDeadlineDrafts((prev) => ({
      ...prev,
      [stageId]: {
        date: prev[stageId]?.date || "",
        time: prev[stageId]?.time || "",
        [key]: value,
      },
    }));
    setDeadlineError("");
    setDeadlineNotice("");
  };

  const handleEditDeadline = (stage) => {
    if (!stage?.coordinator_deadline) return;
    setDeadlineDrafts((prev) => ({
      ...prev,
      [stage.id]: {
        date: toDateInputValue(stage.deadline),
        time: toTimeInputValue(stage.deadline),
      },
    }));
    setEditingDeadlineIds((prev) => ({
      ...prev,
      [stage.id]: true,
    }));
    setDeadlineError("");
    setDeadlineNotice("");
  };

  const handleSaveDeadline = async (stage) => {
    const draft = deadlineDrafts[stage.id] || { date: "", time: "" };
    const nextDeadline = buildDeadlineIso(draft.date, draft.time);
    if (!nextDeadline) {
      setDeadlineError("Student deadline date and time are required.");
      return;
    }

    if (!stage?.coordinator_deadline) {
      setDeadlineError("Student deadline can be edited only after the admin enables this stage.");
      return;
    }

    if (stage.coordinator_deadline) {
      const studentDate = new Date(nextDeadline);
      const adminDate = new Date(stage.coordinator_deadline);
      if (!Number.isNaN(studentDate.getTime()) && !Number.isNaN(adminDate.getTime()) && studentDate >= adminDate) {
        setDeadlineError("Student deadline must be earlier than admin evaluation deadline.");
        return;
      }
    }

    setSavingDeadlineId(stage.id);
    setDeadlineError("");
    setDeadlineNotice("");
    try {
      await onSaveStudentDeadline(stage.id, nextDeadline);
      setDeadlineNotice(`Student deadline updated for ${normalizeReviewStageName(stage.stage_name)}.`);
      setEditingDeadlineIds((prev) => ({
        ...prev,
        [stage.id]: !stage.deadline && false,
      }));
    } catch (error) {
      setDeadlineError(error.message || "Failed to update student deadline.");
    } finally {
      setSavingDeadlineId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          { label: "Class Title", value: classTitle || "—" },
          { label: "Total Projects", value: totalProjects },
          { label: "Evaluated Projects", value: evaluatedProjects },
          { label: "Pending Evaluations", value: pendingEvaluations },
          { label: "Class Average Score", value: classAverageScore != null ? `${formatClassScore(classAverageScore)}/100` : "—" },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{item.label}</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-2 break-words">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Review Deadlines</p>
          <p className="text-sm text-gray-500 mt-1">Admin sets evaluation deadlines. Coordinators set student submission deadlines for this class.</p>
        </div>

        {deadlineLoadError ? (
          <div className="mx-5 mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {deadlineLoadError}
          </div>
        ) : null}
        {deadlineError ? (
          <div className="mx-5 mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {deadlineError}
          </div>
        ) : null}
        {deadlineNotice ? (
          <div className="mx-5 mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {deadlineNotice}
          </div>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 p-5">
          <section className="rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-sm font-bold text-gray-800">Admin Evaluation Schedule</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Stage</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Evaluation Deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reviewStages.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-gray-400">No review stages found for this class.</td>
                    </tr>
                  ) : reviewStages.map((stage) => (
                    <tr key={`admin-${stage.id}`}>
                      <td className="px-4 py-3 font-semibold text-gray-800">{normalizeReviewStageName(stage.stage_name)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDeadlineDateTime(stage.coordinator_deadline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-sm font-bold text-gray-800">Student Submission Deadlines</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Stage</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Student Deadline</th>
                    <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reviewStages.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-400">No review stages found for this class.</td>
                    </tr>
                  ) : reviewStages.map((stage) => {
                    const draft = deadlineDrafts[stage.id] || { date: "", time: "" };
                    const isStageEnabled = Boolean(stage.coordinator_deadline);
                    const isEditing = editingDeadlineIds[stage.id] ?? Boolean(isStageEnabled && !stage.deadline);
                    const isSaving = savingDeadlineId === stage.id;
                    const hasAdminDeadline = Boolean(stage.coordinator_deadline);
                    const showSavedStudentDeadline = Boolean(isStageEnabled && stage.deadline && stage.student_deadline_set_by_coordinator);

                    return (
                      <tr key={`student-${stage.id}`}>
                        <td className="px-4 py-3 font-semibold text-gray-800">{normalizeReviewStageName(stage.stage_name)}</td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="date"
                                value={draft.date}
                                onChange={(event) => handleDraftChange(stage.id, "date", event.target.value)}
                                disabled={!isStageEnabled}
                                className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                              />
                              <input
                                type="time"
                                value={draft.time}
                                onChange={(event) => handleDraftChange(stage.id, "time", event.target.value)}
                                disabled={!isStageEnabled}
                                className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-700">
                                {showSavedStudentDeadline ? formatDeadlineDateTime(stage.deadline) : "-"}
                              </span>
                              {showSavedStudentDeadline ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                  Saved
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <button
                              type="button"
                              onClick={() => handleSaveDeadline(stage)}
                              disabled={isSaving || !hasAdminDeadline || !isStageEnabled}
                              className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                              <Icon.Save />
                              {isSaving ? "Saving..." : "Save"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEditDeadline(stage)}
                              disabled={isSaving || !hasAdminDeadline || !isStageEnabled}
                              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                            >
                              <Icon.Edit />
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Class Projects</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Title</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Guide</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Team Size</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Evaluations</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Avg Score</th>
                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">No projects in this class.</td>
                </tr>
              ) : projects.map((project) => (
                <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-semibold text-gray-800">{project.title || "Untitled Project"}</td>
                  <td className="px-5 py-3 text-gray-600">{project.guideName || "Unassigned"}</td>
                  <td className="px-5 py-3 text-gray-600">{project.teamSize}</td>
                  <td className="px-5 py-3 text-gray-600">{project.evaluationCount}</td>
                  <td className="px-5 py-3 text-gray-600">{project.avgScore != null ? `${formatClassScore(project.avgScore)}/100` : "—"}</td>
                  <td className="px-5 py-3"><StatusBadge status={project.status || "pending"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── OVERVIEW TAB ───────────────────────────────────────────────────────────
function OverviewTab({ projects, evaluations, milestones, recentActivity, loading, onNavigate, onSubmitReview }) {
  const [reviewProject, setReviewProject] = useState(null);

  if (loading) return <Spinner />;

  // Pending = projects that have NO evaluation yet
  const pendingProjects = projects.filter(proj =>
    !evaluations.some(ev => ev.project_id === proj.id)
  );

  const handleSubmitReview = async (data) => {
    await onSubmitReview(data);
    setReviewProject(null);
  };

  const avgScore = evaluations.length
    ? Math.round(evaluations.reduce((s, e) => s + Number(e.score), 0) / evaluations.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* ── Top summary cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Assigned Teams Summary */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Assigned Teams Summary</p>
          <p className="text-5xl font-extrabold text-gray-900 mt-2 mb-1">{projects.length}</p>
          <p className="text-sm text-gray-400 mb-5">Teams currently assigned under guide role.</p>
          <button
            onClick={() => onNavigate("teams")}
            className="w-full bg-teal-400 hover:bg-teal-500 active:scale-95 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
            View Teams <Icon.ArrowRight />
          </button>
        </div>

        {/* Evaluation Panel */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Evaluation Panel</p>
          <p className="text-5xl font-extrabold text-gray-900 mt-2 mb-1">{evaluations.length}</p>
          <p className="text-sm text-gray-400 mb-5">
            {pendingProjects.length > 0
              ? `${pendingProjects.length} project${pendingProjects.length !== 1 ? "s" : ""} pending evaluation.`
              : "All projects evaluated! 🎉"}
          </p>
          <button
            onClick={() => onNavigate("evaluation")}
            className="w-full bg-teal-400 hover:bg-teal-500 active:scale-95 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
            <Icon.Evaluation /> Go to Evaluation
          </button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Evaluations Done", value: evaluations.length, color: "text-teal-500", bg: "bg-teal-50" },
          { label: "Average Score", value: avgScore ? `${avgScore}%` : "—", color: "text-blue-500", bg: "bg-blue-50" },
          { label: "Completed", value: projects.filter(p => p.status?.toLowerCase() === "completed").length, color: "text-emerald-500", bg: "bg-emerald-50" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-white`}>
            <p className={`text-3xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Weekly chart + Recent Activity ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <WeeklyChart projects={projects} evaluations={evaluations} />
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Recent Activity</p>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400">No activity yet.</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon.Star />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 leading-snug">{item.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Deadlines & Milestones + Pending Reviews ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Milestones */}
        <div className="xl:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <p className="font-extrabold text-gray-800 text-base mb-1">Deadlines & Milestones</p>
          <p className="text-xs text-gray-400 mb-5">Read-only timeline controlled by admin.</p>
          {milestones.length === 0 ? (
            <p className="text-sm text-gray-400">No milestones set.</p>
          ) : (
            <div className="space-y-3">
              {milestones.map((m, i) => {
                const today = new Date();
                const due = new Date(m.due_date);
                const isPast = due < today;
                const isToday = due.toDateString() === today.toDateString();
                const tag = m.status === "completed" ? "Completed"
                  : isToday ? "Today"
                    : isPast ? "Overdue"
                      : "Upcoming";
                const tagStyle = tag === "Completed" ? "bg-blue-50 text-blue-600 border-blue-200"
                  : tag === "Overdue" ? "bg-red-50 text-red-600 border-red-200"
                    : tag === "Today" ? "bg-amber-50 text-amber-600 border-amber-200"
                      : "bg-teal-50 text-teal-600 border-teal-200";
                return (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tag === "Completed" ? "bg-blue-500" : tag === "Overdue" ? "bg-red-500" : tag === "Today" ? "bg-amber-500" : "bg-teal-400"}`} />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{m.title}</p>
                        <p className="text-xs text-gray-400">{m.due_date}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${tagStyle}`}>{tag}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Team Score Overview */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Team Score Overview</p>
          <div className="space-y-4">
            {projects.map(proj => {
              const ev = evaluations.filter(e => e.project_id === proj.id);
              const avg = ev.length ? Math.round(ev.reduce((s, e) => s + Number(e.score), 0) / ev.length) : null;
              return (
                <div key={proj.id} className="flex items-center gap-3">
                  <ProgressRing pct={avg || 0} size={44} stroke={4} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{proj.title}</p>
                    <p className={`text-xs font-bold ${avg ? scoreClr(avg) : "text-gray-400"}`}>
                      {avg ? `${avg}/100` : "Not evaluated"}
                    </p>
                  </div>
                </div>
              );
            })}
            {projects.length === 0 && <p className="text-sm text-gray-400">No projects assigned.</p>}
          </div>
        </div>
      </div>

      {/* ── Pending Reviews Section ── */}
      {pendingProjects.length > 0 && (
        <div id="pending-section" className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 bg-amber-50 border-b border-amber-100">
            <span className="text-amber-500"><Icon.Alert /></span>
            <div>
              <p className="font-extrabold text-gray-800">Pending Reviews</p>
              <p className="text-xs text-gray-500">{pendingProjects.length} project{pendingProjects.length !== 1 ? "s" : ""} waiting for your evaluation</p>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingProjects.map(proj => (
              <div key={proj.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 font-extrabold text-sm flex-shrink-0">
                    {proj.title?.[0] || "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{proj.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Icon.Clock />{proj.team_members?.length || 0} members
                      </span>
                      <StatusBadge status={proj.status} />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setReviewProject(proj)}
                  className="flex items-center gap-2 bg-teal-400 hover:bg-teal-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all active:scale-95">
                  Start Review <Icon.ArrowRight />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewProject && (
        <ReviewModal
          project={reviewProject}
          onClose={() => setReviewProject(null)}
          onSubmit={handleSubmitReview}
        />
      )}
    </div>
  );
}

// ─── TEAMS TAB ──────────────────────────────────────────────────────────────
const PHASES = ["Research", "Proposal", "Development", "Testing", "Final Pitch"];

function FileIcon({ name }) {
  const ext = name?.split(".").pop()?.toLowerCase();
  const map = {
    pdf: ["#ef4444", "PDF"], pptx: ["#f97316", "PPT"], ppt: ["#f97316", "PPT"],
    xlsx: ["#22c55e", "XLS"], xls: ["#22c55e", "XLS"], docx: ["#3b82f6", "DOC"],
    doc: ["#3b82f6", "DOC"], zip: ["#8b5cf6", "ZIP"]
  };
  const [color, label] = map[ext] || ["#6b7280", "FILE"];
  return (
    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0" style={{ background: color }}>
      {label}
    </div>
  );
}

function TeamDetailView({ proj, evaluations, onBack, onStartReview, documents, docsLoading }) {
  const [reviewProject, setReviewProject] = useState(null);
  const evs = evaluations.filter(e => e.project_id === proj.id);
  const avg = evs.length ? Math.round(evs.reduce((s, e) => s + Number(e.score), 0) / evs.length) : null;

  // Determine current phase index from evaluations
  const phasesDone = [...new Set(evs.map(e => e.phase))];
  const currentPhaseIdx = Math.min(phasesDone.length, PHASES.length - 1);

  // Score history for mini sparkline
  const scoreHistory = [...evs].reverse();

  const handleDownload = (doc) => {
    if (!doc.file_url) return;
    // file_url is a direct URL (Supabase Storage public URL or external)
    // Create a hidden anchor and trigger download
    const a = document.createElement("a");
    a.href = doc.file_url;
    a.download = doc.file_name || "download";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-5">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        Back to Projects
      </button>

      {/* ── Hero Banner ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #134e4a 100%)" }}>
        <div className="px-7 pt-7 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-400/20 border border-teal-400/30 flex items-center justify-center flex-shrink-0">
                <svg width="24" height="24" fill="none" stroke="#2dd4bf" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-white leading-tight">{proj.title}</h2>
                {proj.abstract && <p className="text-slate-400 text-sm mt-1 max-w-lg leading-relaxed">{proj.abstract}</p>}
                <div className="flex items-center gap-3 mt-3">
                  <StatusBadge status={proj.status} />
                  <span className="text-xs text-slate-500">
                    Current Phase: <span className="text-teal-400 font-semibold">{PHASES[currentPhaseIdx]}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => setReviewProject(proj)}
                className="flex items-center gap-2 bg-teal-400 hover:bg-teal-300 text-slate-900 text-sm font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95">
                <Icon.Star /> Add Review
              </button>
            </div>
          </div>

          {/* Members + progress */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-5 pt-5 border-t border-white/10">
            <div className="flex items-center gap-2">
              {proj.team_members?.slice(0, 4).map((tm, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: ["#14b8a6", "#3b82f6", "#8b5cf6", "#f59e0b"][i % 4], marginLeft: i > 0 ? "-8px" : "0" }}>
                  {tm.profiles?.full_name?.[0] || "?"}
                </div>
              ))}
              {proj.team_members?.length > 4 && (
                <span className="text-xs text-slate-400 ml-1">+{proj.team_members.length - 4} more</span>
              )}
              <span className="text-slate-400 text-xs ml-2">| {proj.team_members?.length || 0} members</span>
            </div>
            <div className="flex items-center gap-3 min-w-[180px]">
              <span className="text-xs text-slate-400 whitespace-nowrap">Project Progress</span>
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-700"
                  style={{ width: `${Math.round((currentPhaseIdx / (PHASES.length - 1)) * 100)}%` }} />
              </div>
              <span className="text-teal-400 font-bold text-xs whitespace-nowrap">
                {Math.round((currentPhaseIdx / (PHASES.length - 1)) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Milestone Timeline + Submissions ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Left: Milestone + Submissions */}
        <div className="xl:col-span-2 space-y-5">

          {/* Milestone Timeline */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <svg width="18" height="18" fill="none" stroke="#14b8a6" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              <p className="font-bold text-gray-800">Milestone Timeline</p>
            </div>
            <div className="flex items-center justify-between relative">
              {/* connecting line */}
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 z-0" />
              {PHASES.map((phase, i) => {
                const done = i < currentPhaseIdx;
                const current = i === currentPhaseIdx;
                const pending = i > currentPhaseIdx;
                return (
                  <div key={phase} className="flex flex-col items-center gap-2 z-10 flex-1">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${done ? "bg-teal-400 border-teal-400" :
                        current ? "bg-white border-teal-400 shadow-lg shadow-teal-100" :
                          "bg-white border-gray-200"
                      }`}>
                      {done
                        ? <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                        : <div className={`w-2.5 h-2.5 rounded-full ${current ? "bg-teal-400" : "bg-gray-300"}`} />
                      }
                    </div>
                    <span className={`text-xs font-semibold text-center leading-tight ${current ? "text-teal-600" : done ? "text-gray-500" : "text-gray-300"}`}>
                      {phase}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Submissions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="#14b8a6" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                <p className="font-bold text-gray-800">Recent Submissions</p>
              </div>
              <span className="text-xs text-gray-400">{documents.length} file{documents.length !== 1 ? "s" : ""}</span>
            </div>
            {docsLoading ? (
              <div className="px-6 py-8 flex justify-center">
                <div className="w-6 h-6 border-3 border-teal-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-gray-50 flex items-center justify-center mb-3">
                  <svg width="22" height="22" fill="none" stroke="#9ca3af" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                </div>
                <p className="text-sm font-semibold text-gray-500">No submissions yet</p>
                <p className="text-xs text-gray-400 mt-1">Team hasn't uploaded any documents.</p>
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Document</th>
                      <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Uploaded By</th>
                      <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Date</th>
                      <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Feedback</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {documents.map((doc, i) => {
                      // Exact column names from your documents table
                      const stMap = {
                        "approved": "bg-emerald-50 text-emerald-700 border-emerald-200",
                        "pending": "bg-amber-50 text-amber-700 border-amber-200",
                        "pending_review": "bg-amber-50 text-amber-700 border-amber-200",
                        "under_review": "bg-blue-50 text-blue-700 border-blue-200",
                        "rejected": "bg-red-50 text-red-600 border-red-200",
                        "submitted": "bg-teal-50 text-teal-700 border-teal-200",
                      };
                      const statusKey = doc.status?.toLowerCase().replace(/\s+/g, "_") || "pending";
                      return (
                        <tr key={doc.id || i} className="hover:bg-gray-50 transition-colors">
                          {/* Document name + type */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <FileIcon name={doc.file_name} />
                              <div>
                                <p className="font-semibold text-gray-800 text-sm truncate max-w-[150px]">{doc.file_name || "—"}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {doc.document_type || "Document"} · {formatFileSize(doc.file_size)}
                                  {doc.version ? ` · v${doc.version}` : ""}
                                </p>
                              </div>
                            </div>
                          </td>
                          {/* Uploaded by — profiles joined */}
                          <td className="px-6 py-4 text-gray-600 text-sm">
                            {doc.profiles?.full_name || "—"}
                          </td>
                          {/* Date — use uploaded_at */}
                          <td className="px-6 py-4 text-gray-400 text-xs whitespace-nowrap">
                            {doc.uploaded_at
                              ? new Date(doc.uploaded_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                              : "—"}
                          </td>
                          {/* Status */}
                          <td className="px-6 py-4">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${stMap[statusKey] || stMap.pending}`}>
                              {doc.status || "Pending"}
                            </span>
                          </td>
                          {/* Feedback */}
                          <td className="px-6 py-4 max-w-[140px]">
                            {doc.feedback
                              ? <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{doc.feedback}</p>
                              : <span className="text-xs text-gray-300">—</span>
                            }
                          </td>
                          {/* Download */}
                          <td className="px-6 py-4">
                            {doc.file_url ? (
                              <button
                                onClick={() => handleDownload(doc)}
                                className="flex items-center gap-1.5 text-teal-600 hover:text-teal-700 text-xs font-semibold hover:bg-teal-50 px-2.5 py-1.5 rounded-lg transition-all">
                                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="7 10 12 15 17 10" />
                                  <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Download
                              </button>
                            ) : (
                              <span className="text-xs text-gray-300 px-2.5 py-1.5">No file</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {/* Right: Members + Score Analytics */}
        <div className="space-y-5">

          {/* Team Members */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Team Members</p>
            <div className="space-y-3">
              {proj.team_members?.length === 0 && <p className="text-sm text-gray-400">No members found.</p>}
              {proj.team_members?.map((tm, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: ["#14b8a6", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"][i % 5] }}>
                    {tm.profiles?.full_name?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{tm.profiles?.full_name || "—"}</p>
                    <p className="text-xs text-gray-400">{tm.profiles?.roll_number || tm.profiles?.department || "—"}</p>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                    {tm.role || "member"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Score Analytics */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Score Analytics</p>
            {evs.length === 0 ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 border-4 border-amber-100 flex items-center justify-center mb-3">
                  <span className="text-2xl">📋</span>
                </div>
                <p className="text-sm font-semibold text-gray-700">No evaluations yet</p>
                <p className="text-xs text-gray-400 mt-1">Submit the first review</p>
                <button onClick={() => setReviewProject(proj)}
                  className="mt-3 w-full bg-teal-400 hover:bg-teal-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all">
                  Add Review
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Avg score ring */}
                <div className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <ProgressRing pct={avg || 0} size={72} stroke={6} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-sm font-extrabold ${scoreClr(avg || 0)}`}>{avg}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Average Score</p>
                    <p className={`text-lg font-extrabold ${scoreClr(avg || 0)}`}>{avg}/100</p>
                    <p className="text-xs text-gray-400">{evs.length} evaluation{evs.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                {/* Score per phase */}
                <div className="space-y-2.5">
                  {scoreHistory.map((ev, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500 font-medium">{ev.phase}</span>
                        <span className={`font-bold ${scoreClr(ev.score)}`}>{ev.score}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${ev.score}%`, background: ev.score >= 90 ? "#10b981" : ev.score >= 70 ? "#f59e0b" : "#ef4444" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {reviewProject && (
        <ReviewModal project={reviewProject} onClose={() => setReviewProject(null)}
          onSubmit={async (d) => { await onStartReview(d); setReviewProject(null); }} />
      )}
    </div>
  );
}

function TeamsTab({ projects, evaluations, loading, onStartReview, mentorId, mentorName }) {
  const [sel, setSel] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);

  useEffect(() => {
    if (!sel) return;
    setDocsLoading(true);
    supabase
      .from("documents")
      .select(`
        id, project_id, uploaded_by, document_type,
        file_name, file_url, file_size, version,
        status, uploaded_at, feedback,
        profiles:uploaded_by ( full_name, email, roll_number )
      `)
      .eq("project_id", sel)
      .order("uploaded_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Documents fetch error:", error);
        setDocuments(data || []);
        setDocsLoading(false);
      });
  }, [sel]);

  if (loading) return <Spinner />;

  if (sel) {
    const proj = projects.find(p => p.id === sel);
    return (
      <TeamWorkspace
        proj={proj}
        mentorId={mentorId}
        mentorName={mentorName}
        onBack={() => { setSel(null); setDocuments([]); }}
      />
    );
  }

  // ── Project Cards Grid ──
  return projects.length === 0 ? (
    <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-sm text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-teal-50 flex items-center justify-center mb-3">
        <svg width="28" height="28" fill="none" stroke="#14b8a6" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
      </div>
      <p className="text-gray-700 font-semibold">No projects assigned</p>
      <p className="text-gray-400 text-sm mt-1">Contact admin to get assigned to a project.</p>
    </div>
  ) : (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {projects.map(proj => {
        const evs = evaluations.filter(e => e.project_id === proj.id);
        const avg = evs.length ? Math.round(evs.reduce((s, e) => s + Number(e.score), 0) / evs.length) : null;
        const isPending = evs.length === 0;
        const memberColors = ["#14b8a6", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];

        return (
          <div key={proj.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group cursor-pointer"
            onClick={() => setSel(proj.id)}>

            {/* Card top accent */}
            <div className="h-1 w-full bg-gradient-to-r from-teal-400 to-emerald-400" />

            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" fill="none" stroke="#14b8a6" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-gray-900 leading-tight">{proj.title}</h3>
                    {proj.abstract && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{proj.abstract}</p>}
                  </div>
                </div>

              </div>

              {/* Members */}
              {proj.team_members?.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex">
                    {proj.team_members.slice(0, 4).map((tm, i) => (
                      <div key={i} className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: memberColors[i % 5], marginLeft: i > 0 ? "-6px" : "0" }}>
                        {tm.profiles?.full_name?.[0] || "?"}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">
                    {proj.team_members.map(m => m.profiles?.full_name?.split(" ")[0]).filter(Boolean).join(", ")}
                    {proj.team_members.length > 3 ? ` +${proj.team_members.length - 3}` : ""}
                  </span>
                </div>
              )}

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-400 font-medium">Project Progress</span>
                  <span className="text-teal-600 font-bold">{avg ? `Score: ${avg}/100` : ""}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-700"
                    style={{ width: avg ? `${avg}%` : "0%" }} />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div className="flex items-center gap-2">
                  {isPending ? (
                    <>
                      <StatusBadge status={proj.status} />
                      <span className="flex items-center gap-1 text-amber-600 text-xs font-semibold">
                        <Icon.Clock /> Not evaluated
                      </span>
                    </>
                  ) : (
                    <span className={"flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border " + (
                      avg >= 90 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : avg >= 70 ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-red-50 text-red-600 border-red-200"
                    )}>
                      <span className={"w-1.5 h-1.5 rounded-full " + (avg >= 90 ? "bg-emerald-500" : avg >= 70 ? "bg-amber-400" : "bg-red-400")} />
                      Avg {avg}/100
                    </span>
                  )}
                </div>
                <span className="flex items-center gap-1.5 text-teal-600 font-semibold text-xs group-hover:gap-2.5 transition-all">
                  View Details <Icon.ArrowRight />
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── EVALUATION TAB ─────────────────────────────────────────────────────────
function EvaluationTab({ projects, evaluations, setEvaluations, mentorId, loading }) {
  const [form, setForm] = useState({ projectId: "", phase: "Phase 1", score: "", feedback: "" });
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterProj, setFilterProj] = useState("all");

  if (loading) return <Spinner />;

  const submit = async () => {
    if (!form.projectId || !form.score || !form.feedback) { setErr("Please fill all fields."); return; }
    setSaving(true); setErr("");
    try {
      const data = await insertMentorEvaluation(mentorId, {
        projectId: form.projectId,
        phase: form.phase,
        score: Number(form.score),
        maxScore: 100,
        feedback: form.feedback,
      });
      setEvaluations(p => [data, ...p]);
      setForm({ projectId: "", phase: "Phase 1", score: "", feedback: "" });
      setOk(true); setTimeout(() => setOk(false), 2500);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const filtered = filterProj === "all" ? evaluations : evaluations.filter(e => e.project_id === filterProj);
  const cls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Form */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Submit Evaluation</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Project</label>
            <select className={cls} value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}>
              <option value="">— Choose a project —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Phase</label>
            <select className={cls} value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}>
              {["Phase 1", "Phase 2", "Phase 3", "Final Review"].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Score (0–100)</label>
            <input type="number" min="0" max="100" placeholder="e.g. 85" className={cls}
              value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} />
          </div>
          {form.score && (
            <div className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold ${Number(form.score) >= 90 ? "bg-emerald-50 text-emerald-700" : Number(form.score) >= 70 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
              <div className={`w-2 h-2 rounded-full ${scoreBg(Number(form.score))}`} />
              {Number(form.score) >= 90 ? "Excellent performance" : Number(form.score) >= 70 ? "Good performance" : "Needs improvement"}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Feedback</label>
            <textarea rows={4} placeholder="Detailed feedback for the team..." className={`${cls} resize-none`}
              value={form.feedback} onChange={e => setForm({ ...form, feedback: e.target.value })} />
          </div>
          {err && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
          <button onClick={submit} disabled={saving}
            className="w-full bg-teal-400 hover:bg-teal-500 active:scale-95 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50">
            {saving ? "Submitting..." : "Submit Evaluation"}
          </button>
          {ok && <p className="text-center text-sm font-semibold text-teal-600 flex items-center justify-center gap-1.5"><Icon.Check /> Evaluation submitted!</p>}
        </div>
      </div>

      {/* Records */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Evaluation Records</p>
          <select className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-gray-50 focus:outline-none" value={filterProj} onChange={e => setFilterProj(e.target.value)}>
            <option value="all">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div className="space-y-3 overflow-y-auto max-h-[540px] pr-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400">No evaluations submitted yet.</p>
          ) : filtered.map((ev, index) => (
            <div key={ev.id || `${ev.project_id || "project"}-${ev.created_at || "time"}-${index}`} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-bold text-gray-800 text-sm">{projects.find(p => p.id === ev.project_id)?.title || "—"}</span>
                  <span className="ml-2 text-xs bg-teal-50 text-teal-700 font-semibold px-2 py-0.5 rounded-full">{ev.phase}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${scoreBg(ev.score)}`} />
                  <span className={`font-extrabold text-xl ${scoreClr(ev.score)}`}>{ev.score}</span>
                </div>
              </div>
              {ev.feedback && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{ev.feedback}</p>}
              <p className="text-xs text-gray-400 mt-1.5">{ev.created_at?.split("T")[0]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
export default function MentorDashboard() {
  const [active, setActive] = useState("overview");
  const [projects, setProjects] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [mentorProfile, setMentorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [myClassData, setMyClassData] = useState(null);
  const [myClassLoading, setMyClassLoading] = useState(false);
  const [myClassError, setMyClassError] = useState("");
  const navigate = useNavigate();

  const loadCoordinatorClassData = useCallback(async (classId) => {
    const [{ data: classRow }, { data: classProjects }, { data: reviewStageRows, error: reviewStageError }] = await Promise.all([
      supabase.from("classes").select("id, class_name").eq("id", classId).single(),
      supabase.from("projects").select("id, title, guide_id, status").eq("class_id", classId),
      supabase
        .from("review_stages")
        .select("id, stage_name, deadline, coordinator_deadline, stage_order, is_active, student_deadline_set_by_coordinator")
        .eq("class_id", classId)
        .order("stage_order", { ascending: true }),
    ]);

    const projectsInClass = classProjects || [];
    const projectIds = projectsInClass.map((project) => project.id);
    const guideIds = Array.from(new Set(projectsInClass.map((project) => project.guide_id).filter(Boolean)));

    const [membersRes, evalRes, guidesRes] = await Promise.all([
      projectIds.length
        ? supabase.from("team_members").select("id, project_id").in("project_id", projectIds)
        : Promise.resolve({ data: [] }),
      projectIds.length
        ? supabase.from("evaluations").select("id, project_id, obtained_marks").in("project_id", projectIds)
        : Promise.resolve({ data: [] }),
      guideIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", guideIds)
        : Promise.resolve({ data: [] }),
    ]);

    const members = membersRes.data || [];
    const classEvals = evalRes.data || [];
    const guides = guidesRes.data || [];
    const guideMap = new Map(guides.map((guide) => [guide.id, guide.full_name || "Unassigned"]));
    const memberCountByProject = members.reduce((acc, item) => {
      acc[item.project_id] = (acc[item.project_id] || 0) + 1;
      return acc;
    }, {});
    const evalByProject = classEvals.reduce((acc, item) => {
      if (!acc[item.project_id]) acc[item.project_id] = [];
      const normalizedScore = Number(item.score ?? item.obtained_marks) || 0;
      acc[item.project_id].push(normalizedScore);
      return acc;
    }, {});

    const projectRows = projectsInClass.map((project) => {
      const scores = evalByProject[project.id] || [];
      const avgScore = scores.length
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : null;
      return {
        ...project,
        teamSize: memberCountByProject[project.id] || 0,
        evaluationCount: scores.length,
        avgScore,
        guideName: guideMap.get(project.guide_id) || "Unassigned",
      };
    });

    const evaluatedCount = projectRows.filter((item) => item.evaluationCount > 0).length;
    const allScores = classEvals.map((item) => Number(item.score)).filter((score) => !Number.isNaN(score));
    const classAverageScore = allScores.length
      ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length
      : null;

    return {
      classId,
      classTitle: classRow?.class_name || "Untitled Class",
      totalProjects: projectRows.length,
      evaluatedProjects: evaluatedCount,
      pendingEvaluations: projectRows.length - evaluatedCount,
      classAverageScore,
      projects: projectRows,
      reviewStages: sortReviewStages(reviewStageRows || []),
      deadlineLoadError: reviewStageError
        ? (/coordinator_deadline/i.test(String(reviewStageError.message || ""))
          ? 'The "coordinator_deadline" column is missing in "review_stages". Run the Supabase ALTER TABLE migration first.'
          : (reviewStageError.message || "Failed to load review deadlines."))
        : "",
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/"); return; }

        const { data: profile } = await supabase
          .from("profiles").select("*").eq("id", user.id).single();
        setMentorProfile(profile);

        let projData = [];

        if (profile) {
          // Projects assigned to this mentor + team members joined with profiles
          const { data: projectRows, error: projectError } = await supabase
            .from("projects")
            .select(`*, team_members(id, student_id, role, profiles:student_id(full_name, email, roll_number, department))`)
            .or(`guide_id.eq.${profile.id},mentor_id.eq.${profile.id}`)
            .order("created_at", { ascending: false });
          if (projectError) {
            console.error(projectError);
          }
          projData = projectRows || [];
          setProjects(projData || []);

          // Evaluations by this mentor
          let evalData = [];
          try {
            evalData = await fetchEvaluationsForMentor(profile.id);
          } catch (evaluationError) {
            console.error(evaluationError);
          }
          setEvaluations(evalData || []);

          // Milestones (system_settings table) — read admin-controlled deadlines
          let msData = [];
          try {
            msData = await fetchSystemSettingsRows();
          } catch (settingsError) {
            console.error(settingsError);
          }
          // Map to milestone shape — adjust column names if needed
          setMilestones((msData || []).map(m => ({
            title: m.setting_key || m.key || m.title || m.name,
            due_date: normalizeMilestoneDueDate(m.setting_value || m.value || m.due_date),
            status: m.status || "upcoming",
          })).filter(m => Boolean(m.due_date) && String(m.due_date).includes("-")));

          // Build recent activity from evaluations
          const activity = (evalData || []).slice(0, 5).map(ev => {
            const proj = (projData || []).find(p => p.id === ev.project_id);
            const ago = getTimeAgo(ev.created_at);
            return { text: `Evaluation submitted for ${proj?.title || "a project"} (${ev.phase})`, time: ago };
          });
          setRecentActivity(activity);
        }

        const coordinatorResolution = resolveCoordinatorClassId(profile, projData);
        if (coordinatorResolution.classId) {
          setMyClassLoading(true);
          try {
            setMyClassError("");
            setMyClassData(await loadCoordinatorClassData(coordinatorResolution.classId));
          } catch (error) {
            console.error(error);
            setMyClassData(null);
            setMyClassError(formatMyClassError("Failed to load coordinator class details", error));
          }
          setMyClassLoading(false);
        } else {
          setMyClassData(null);
          setMyClassError(profile?.is_coordinator ? coordinatorResolution.error : "");
          setMyClassLoading(false);
        }
      } catch (e) {
        console.error(e);
        setMyClassError(formatMyClassError("Failed to load coordinator class details", e));
        setMyClassLoading(false);
      }
      finally { setLoading(false); }
    };
    init();
  }, [loadCoordinatorClassData, navigate]);

  const coordinatorClassId = resolveCoordinatorClassId(mentorProfile, projects).classId;
  const isCoordinatorWithClass = Boolean(mentorProfile?.is_coordinator && coordinatorClassId);

  useEffect(() => {
    if (!isCoordinatorWithClass && active === "my-class") {
      setActive("overview");
    }
  }, [active, isCoordinatorWithClass]);

  useEffect(() => {
    if (!mentorProfile?.is_coordinator || !coordinatorClassId) return undefined;

    const refreshMyClassData = async () => {
      try {
        setMyClassData(await loadCoordinatorClassData(coordinatorClassId));
        setMyClassError("");
      } catch (error) {
        console.error(error);
        setMyClassError(formatMyClassError("Failed to refresh coordinator class details", error));
      }
    };

    const channel = supabase
      .channel(`mentor-my-class-review-stages-${coordinatorClassId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "review_stages",
          filter: `class_id=eq.${coordinatorClassId}`,
        },
        async () => {
          await refreshMyClassData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [coordinatorClassId, loadCoordinatorClassData, mentorProfile?.is_coordinator]);

  // Time ago helper
  function getTimeAgo(ts) {
    if (!ts) return "—";
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  // Submit review from any tab
  const handleSubmitReview = async ({ projectId, phase, score, feedback }) => {
    try {
      const data = await insertMentorEvaluation(mentorProfile?.id, {
        projectId,
        phase,
        score: Number(score),
        maxScore: 100,
        feedback,
      });
      setEvaluations(p => [data, ...p]);
      // Update recent activity
      const proj = projects.find(p => p.id === projectId);
      setRecentActivity(prev => [
        { text: `Evaluation submitted for ${proj?.title || "a project"} (${phase})`, time: "Just now" },
        ...prev.slice(0, 4),
      ]);
    } catch (e) { console.error(e); }
  };

  const handleSaveStudentDeadline = async (stageId, deadlineIso) => {
    if (!coordinatorClassId) {
      throw new Error("No coordinator class assigned.");
    }

    const targetStage = myClassData?.reviewStages?.find((stage) => stage.id === stageId);
    if (!targetStage) {
      throw new Error("Review stage not found.");
    }

    if (targetStage.coordinator_deadline) {
      const studentDate = new Date(deadlineIso);
      const adminDate = new Date(targetStage.coordinator_deadline);
      if (!Number.isNaN(studentDate.getTime()) && !Number.isNaN(adminDate.getTime()) && studentDate >= adminDate) {
        throw new Error("Student deadline must be earlier than admin evaluation deadline.");
      }
    }

    const { error } = await supabase
      .from("review_stages")
      .update({ deadline: deadlineIso, student_deadline_set_by_coordinator: true })
      .eq("id", stageId)
      .eq("class_id", coordinatorClassId);

    if (error) {
      throw new Error(error.message || "Failed to update student deadline.");
    }

    setMyClassData(await loadCoordinatorClassData(coordinatorClassId));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const activeTitle = active === "teams"
    ? "My Teams"
    : active === "evaluation"
      ? "Evaluation"
      : active === "my-class"
        ? "My Class"
        : "Dashboard";

  const mentorNavItems = isCoordinatorWithClass
    ? MENTOR_NAV_ITEMS
    : MENTOR_NAV_ITEMS.filter((item) => item.id !== "my-class");

  return (
    <div className="flex min-h-[100dvh] w-full etnova-bg overflow-hidden">
      <AppSidebar
        navItems={mentorNavItems}
        activeItem={active}
        onNavigate={setActive}
        onLogout={handleSignOut}
        portalSubtitle="Mentor Portal"
        showMobileNav={false}
      />
      <div className="flex-1 min-h-0 md:ml-64 flex flex-col overflow-hidden">
        <div className="relative">
          <AppTopBar
            title={activeTitle}
            subtitle="Home"
            profile={{ full_name: mentorProfile?.full_name || "Mentor" }}
            onProfileClick={() => {
              setShowProfileMenu((value) => !value);
            }}
            showSearch={false}
            notificationCount={0}
          />
          {showProfileMenu && (
            <div className="fixed top-14 right-2 sm:right-6 md:right-8 z-50">
              <ProfileMenu
                profile={mentorProfile}
                isOpen={showProfileMenu}
                onClose={() => setShowProfileMenu(false)}
                onLogout={handleSignOut}
                onEditProfile={() => {
                  setShowProfileMenu(false);
                  setShowProfileEditor(true);
                }}
                roleLabel="Mentor"
                roleIcon="school"
                infoItems={[
                  { label: "Full Name", value: mentorProfile?.full_name },
                  { label: "Email", value: mentorProfile?.email },
                  { label: "Role", value: "Project Guide" },
                  { label: "Department", value: mentorProfile?.department || "-" },
                ]}
              />
            </div>
          )}
        </div>
        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 lg:p-8">
          {active === "overview" && (
            <OverviewTab
              projects={projects}
              evaluations={evaluations}
              milestones={milestones}
              recentActivity={recentActivity}
              loading={loading}
              onNavigate={setActive}
              onSubmitReview={handleSubmitReview}
            />
          )}
          {active === "teams" && (
            <TeamsTab
              projects={projects}
              evaluations={evaluations}
              loading={loading}
              onStartReview={handleSubmitReview}
              mentorId={mentorProfile?.id}
              mentorName={mentorProfile?.full_name}
            />
          )}
          {active === "evaluation" && (
            <EvaluationTab
              projects={projects}
              evaluations={evaluations}
              setEvaluations={setEvaluations}
              mentorId={mentorProfile?.id}
              loading={loading}
            />
          )}
          {active === "my-class" && isCoordinatorWithClass && (
            <MyClassTab
              classData={myClassData}
              loading={myClassLoading}
              onSaveStudentDeadline={handleSaveStudentDeadline}
              emptyMessage={myClassError || "No coordinator class assigned."}
            />
          )}
        </main>
      </div>

      {/* ── Mentor Profile Modal ── */}
      {showProfileEditor && mentorProfile && (
        <MentorProfileModal
          profile={mentorProfile}
          onClose={() => setShowProfileEditor(false)}
          onSave={(updated) => {
            setMentorProfile(updated);
            setShowProfileEditor(false);
          }}
          onSignOut={handleSignOut}
          startEditing
        />
      )}
    </div>
  );
}
