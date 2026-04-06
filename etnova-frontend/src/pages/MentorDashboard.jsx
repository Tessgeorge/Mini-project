import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabaseClient";
import ProfileMenu from "../components/ProfileMenu";
import NotificationPanel from "../components/NotificationPanel";
import Modal from "../components/Modal";
import { getStatusMeta } from "../constants/statusConfig";
import { EVALUATION_STAGE_OPTIONS, getWorkflowStageMeta } from "../constants/workflowConfig";
import { ADMIN_DATA_SYNC_KEY, emitAdminDataUpdated } from "../utils/adminLiveSync";
import { apiRequest } from "../config/apiClient";
import { REVIEW_ROUND_OPTIONS, fetchCoordinatorResultsBreakdown } from "../services/rubrics";

const TeamWorkspace = lazy(() => import("./Teamworkspace"));
const MyClass = lazy(() => import("./MyClass"));
const DynamicRubricEvaluation = lazy(() => import("../components/DynamicRubricEvaluation"));

function hasFinalMarkUpdated(row) {
  if (!row) return false;
  if (row.final_marks == null || Number.isNaN(Number(row.final_marks))) return false;
  return String(row.status || "").trim().toLowerCase() === "published";
}

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
  Search: () => (<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>),
  Lock: () => (<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>),
  Unlock: () => (<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>),
};

// ─── Helpers ────────────────────────────────────────────────────────────────
let mentorEvalFilterStrategy = null;
let mentorEvalInsertStrategy = null;
const mentorEvaluationInflight = new Map();
let systemSettingsInflight = null;
const coordinatorClassDataInflight = new Map();

function withInflight(mapOrKey, keyOrFactory, maybeFactory) {
  if (mapOrKey instanceof Map) {
    const map = mapOrKey;
    const key = keyOrFactory;
    const factory = maybeFactory;
    const existing = map.get(key);
    if (existing) return existing;
    const promise = Promise.resolve().then(factory).finally(() => {
      map.delete(key);
    });
    map.set(key, promise);
    return promise;
  }

  const factory = keyOrFactory;
  if (mapOrKey) return mapOrKey;
  const promise = Promise.resolve().then(factory).finally(() => {
    systemSettingsInflight = null;
  });
  systemSettingsInflight = promise;
  return promise;
}

function normalizeMentorEvaluationRow(row) {
  if (!row) return row;
  return {
    ...row,
    phase: getWorkflowStageMeta(row.phase || row.evaluation_type).label,
    score: row.score ?? row.obtained_marks ?? 0,
  };
}

function getProjectDisplayName(project) {
  return project?.team_name || project?.title || "Untitled Team";
}

function formatReviewStageLabel(stageKey) {
  return REVIEW_ROUND_OPTIONS.find((option) => option.value === stageKey)?.label
    || getWorkflowStageMeta(stageKey).label;
}

function formatActivityTime(ts) {
  if (!ts) return "Recently";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function buildRecentActivityItems({
  evaluations = [],
  guideProjects = [],
  reviewProjects = [],
  reviewerStageLabels = [],
}) {
  const items = [];

  (evaluations || []).slice(0, 3).forEach((ev) => {
    items.push({
      text: `Evaluation submitted for ${ev.project_name || ev.project_id || "team"} (${ev.phase || ev.evaluation_type || "Review"})`,
      time: formatActivityTime(ev.created_at),
    });
  });

  const recentGuideProjects = [...(guideProjects || [])]
    .map((project) => ({
      project,
      ts: new Date(project?.updated_at || project?.created_at || 0).getTime(),
    }))
    .sort((a, b) => b.ts - a.ts);

  for (const item of recentGuideProjects) {
    if (items.length >= 5) break;
    const project = item.project;
    const statusLabel = getStatusMeta(project?.status, { context: "project" }).label;
    items.push({
      text: `${getProjectDisplayName(project)} is currently ${String(statusLabel || "active").toLowerCase()} in your guide queue.`,
      time: item.ts > 0 ? formatActivityTime(item.ts) : "Current",
    });
  }

  if (items.length < 5 && reviewerStageLabels.length > 0) {
    items.push({
      text: `Reviewer access is open for ${reviewerStageLabels.join(", ")}.`,
      time: reviewProjects.length > 0
        ? `${reviewProjects.length} team${reviewProjects.length === 1 ? "" : "s"} available`
        : "Active now",
    });
  }

  return items.slice(0, 5);
}

async function fetchEvaluationsForMentor(mentorId) {
  return withInflight(mentorEvaluationInflight, mentorId, async () => {
    const preferredFilters = mentorEvalFilterStrategy
      ? [mentorEvalFilterStrategy, "guide_id", "evaluator_id"]
      : ["guide_id", "evaluator_id"];
    const filters = Array.from(new Set(preferredFilters));
    let fallbackRows = [];

    for (const filterColumn of filters) {
      const { data, error } = await supabase
        .from("evaluations")
        .select("*")
        .eq(filterColumn, mentorId)
        .order("created_at", { ascending: false });

      if (error) continue;
      const normalizedRows = (data || []).map(normalizeMentorEvaluationRow);
      if (normalizedRows.length > 0) {
        mentorEvalFilterStrategy = filterColumn;
        return normalizedRows;
      }
      if (fallbackRows.length === 0) {
        fallbackRows = normalizedRows;
      }
    }
    return fallbackRows;
  });
}

async function fetchSystemSettingsRows() {
  return withInflight(systemSettingsInflight, async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("*");

    return (data || []).sort((a, b) => {
      const aTs = new Date(a?.created_at || a?.updated_at || 0).getTime();
      const bTs = new Date(b?.created_at || b?.updated_at || 0).getTime();
      return aTs - bTs;
    });
  });
}

async function insertMentorEvaluation(mentorId, payload) {
  const candidates = mentorEvalInsertStrategy
    ? [mentorEvalInsertStrategy]
    : [
      {
        evaluatorKey: "guide_id",
        stageKey: "phase",
        scoreKeys: { obtained: "score", max: null },
      },
      {
        evaluatorKey: "evaluator_id",
        stageKey: "evaluation_type",
        scoreKeys: { obtained: "obtained_marks", max: "max_marks" },
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

function normalizeMilestoneDueDate(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  const maybeDate = new Date(value);
  if (!Number.isNaN(maybeDate.getTime())) {
    return maybeDate.toISOString();
  }
  return String(value);
}

function resolveCoordinatorClassId(profile, projects) {
  if (!profile?.is_coordinator) {
    return { classId: null, error: "" };
  }
  if (profile.class_id) {
    return { classId: profile.class_id, error: "" };
  }
  const normalizeSectionKey = (value) => String(value || "").trim().toLowerCase();
  const profileSection = normalizeSectionKey(profile?.class_section || profile?.batch);
  const projectClassIds = (projects || []).map((project) => project?.class_id).filter(Boolean);
  const projectSectionMatches = (projects || [])
    .filter((project) => normalizeSectionKey(project?.class_name) && normalizeSectionKey(project?.class_name) === profileSection)
    .map((project) => project?.class_id)
    .filter(Boolean);
  const classIds = Array.from(new Set([...projectClassIds, ...projectSectionMatches]));
  if (classIds.length === 1) {
    return { classId: classIds[0], error: "" };
  }
  if (!classIds.length && profileSection) {
    return { classId: "__pending_section_resolution__", error: "" };
  }
  if (classIds.length > 1) {
    return { classId: null, error: "Coordinator is linked to multiple classes. Ask admin to assign a coordinator class." };
  }
  return { classId: null, error: "No coordinator class assigned." };
}

async function resolveCoordinatorClassIdStrict(profile, projects) {
  const quick = resolveCoordinatorClassId(profile, projects);
  if (quick.classId && quick.classId !== "__pending_section_resolution__") {
    return quick;
  }

  const normalizeSectionKey = (value) => String(value || "").trim().toLowerCase();
  const candidateSections = [
    profile?.class_section,
    profile?.batch,
    ...(projects || []).map((project) => project?.class_name),
  ]
    .map(normalizeSectionKey)
    .filter(Boolean);

  if (!candidateSections.length) return { classId: null, error: quick.error || "No coordinator class assigned." };

  const { data, error } = await supabase
    .from("classes")
    .select("id, class_section")
    .in("class_section", [...new Set(candidateSections)]);

  if (error) {
    console.error("Failed to resolve coordinator class:", error);
    return { classId: null, error: quick.error || "No coordinator class assigned." };
  }

  const match = (data || []).find((row) => candidateSections.includes(normalizeSectionKey(row.class_section)));
  return match?.id
    ? { classId: match.id, error: "" }
    : { classId: null, error: quick.error || "No coordinator class assigned." };
}

const STATUS_MAP = {
  draft: { pill: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400", label: "Draft" },
  submitted: { pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400", label: "Submitted" },
  revision_required: { pill: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-400", label: "Revision Required" },
  active: { pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", label: "Active" },
  pending: { pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400", label: "Pending" },
  approved: { pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", label: "Approved" },
  completed: { pill: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500", label: "Completed" },
  rejected: { pill: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-400", label: "Rejected" },
};

function StatusBadge({ status }) {
  const shared = getStatusMeta(status, { context: "project" });
  const s = STATUS_MAP[status?.toLowerCase()] || {
    pill: shared.pillClass,
    dot: shared.dotClass,
    label: shared.label,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${s.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
    </span>
  );
}

function Spinner() {
  return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" /></div>;
}

function TabPanelLoader({ label = "Loading section..." }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 shadow-sm">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-400 border-t-transparent" />
        <p className="text-sm font-semibold">{label}</p>
      </div>
    </div>
  );
}

const REVIEW_STAGE_ORDER = ["Idea", "Abstract", "Zeroth Review", "First Review", "Second Review", "Final Review"];
const REVIEW_STAGE_VALUE_ORDER = REVIEW_ROUND_OPTIONS.map((option) => option.value);
const MY_CLASS_TABS = ["my-class-overview", "my-class-teams", "my-class-submissions", "my-class-reviews", "my-class-marks"];
const MENTOR_TABS = new Set(["overview", "teams", "evaluation", ...MY_CLASS_TABS, "my-class-marks"]);
const MENTOR_ACTIVE_TAB_STORAGE_KEY = "etnova:mentorDashboard:activeTab";
const MENTOR_SELECTED_TEAM_STORAGE_KEY = "etnova:mentorDashboard:selectedTeamId";
const MENTOR_SELECTED_REVIEW_PROJECT_STORAGE_KEY = "etnova:mentorDashboard:selectedReviewProjectId";

function getStoredMentorTab() {
  if (typeof window === "undefined") return "overview";
  try {
    const stored = window.sessionStorage.getItem(MENTOR_ACTIVE_TAB_STORAGE_KEY);
    return MENTOR_TABS.has(stored || "") ? stored : "overview";
  } catch {
    return "overview";
  }
}

function getStoredMentorSelectedTeamId() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(MENTOR_SELECTED_TEAM_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function getStoredMentorSelectedReviewProjectId() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(MENTOR_SELECTED_REVIEW_PROJECT_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

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

function resolveReviewerStageVisibility(accessRows = []) {
  const assignedStages = [
    ...new Set(
      (accessRows || [])
        .map((row) => String(row?.stage || "").trim().toLowerCase())
        .filter((stage) => REVIEW_STAGE_VALUE_ORDER.includes(stage))
    ),
  ].sort(
    (a, b) => REVIEW_STAGE_VALUE_ORDER.indexOf(a) - REVIEW_STAGE_VALUE_ORDER.indexOf(b)
  );

  const openStages = assignedStages.filter((stage) =>
    (accessRows || []).some((row) => row?.is_open && String(row?.stage || "").trim().toLowerCase() === stage)
  );

  if (openStages.length > 0) {
    return {
      allowedStages: openStages,
      writableStages: openStages,
    };
  }
  return {
    allowedStages: [],
    writableStages: [],
  };
}

function normalizeReviewStageValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "0th review" || normalized === "zeroth review" || normalized === "zeroth_review") return "zeroth_review";
  if (normalized === "1st review" || normalized === "first review" || normalized === "first_review") return "first_review";
  if (normalized === "2nd review" || normalized === "second review" || normalized === "second_review") return "second_review";
  if (normalized === "final review" || normalized === "final_review") return "final_review";
  return normalized;
}

async function fetchReviewerAccessRowsForMentor(mentorId, { skipCache = false } = {}) {
  let hasBatchScope = true;

  try {
    const rows = await apiRequest("/reviewer-access/me", { skipCache });
    return {
      rows: Array.isArray(rows) ? rows : [],
      hasBatchScope,
    };
  } catch (reviewerAccessApiError) {
    const { data: batchAccessRows, error: batchAccessError } = await supabase
      .from("reviewer_access")
      .select("class_id, stage, batch, is_open")
      .eq("mentor_id", mentorId);

    if (batchAccessError) {
      const missingBatchColumn =
        batchAccessError.code === "PGRST204" ||
        /batch/i.test(batchAccessError.message || "") ||
        /batch/i.test(batchAccessError.details || "");

      if (!missingBatchColumn) {
        throw reviewerAccessApiError;
      }

      hasBatchScope = false;
      const { data: legacyAccessRows, error: legacyAccessError } = await supabase
        .from("reviewer_access")
        .select("class_id, stage, is_open")
        .eq("mentor_id", mentorId);
      if (legacyAccessError) throw legacyAccessError;
      return {
        rows: legacyAccessRows || [],
        hasBatchScope,
      };
    }

    return {
      rows: batchAccessRows || [],
      hasBatchScope,
    };
  }
}

function sortReviewStages(rows) {
  const grouped = new Map();
  for (const row of rows || []) {
    const normalizedName = normalizeReviewStageName(row?.stage_name);
    const current = grouped.get(normalizedName);
    if (!current) {
      grouped.set(normalizedName, { ...row, stage_name: normalizedName });
      continue;
    }
    grouped.set(normalizedName, {
      ...current, ...row, stage_name: normalizedName,
      coordinator_deadline: row?.coordinator_deadline || current.coordinator_deadline || null,
      deadline: row?.deadline || current.deadline || null,
      stage_order: Number.isFinite(Number(current?.stage_order)) ? current.stage_order : row?.stage_order,
      is_active: Boolean(current?.is_active || row?.is_active),
      student_deadline_set_by_coordinator: Boolean(current?.student_deadline_set_by_coordinator || row?.student_deadline_set_by_coordinator),
    });
  }

  const normalizedRows = Array.from(grouped.entries()).map(([stageName, matched]) => ({
    ...matched,
    stage_name: stageName,
    stage_order: Number.isFinite(Number(matched?.stage_order))
      ? Number(matched.stage_order)
      : reviewStageOrderIndex(stageName),
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
    const orderA = Number.isFinite(Number(a?.stage_order)) ? Number(a.stage_order) : reviewStageOrderIndex(a?.stage_name);
    const orderB = Number.isFinite(Number(b?.stage_order)) ? Number(b.stage_order) : reviewStageOrderIndex(b?.stage_name);
    if (orderA !== orderB) return orderA - orderB;
    return String(normalizeReviewStageName(a?.stage_name)).localeCompare(String(normalizeReviewStageName(b?.stage_name)));
  });
}

function WeeklyChart({ evaluations }) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-IN", { weekday: "short" });
    const count = evaluations.filter((e) => e.created_at?.startsWith(key)).length;
    days.push({ label, key, count });
  }
  const max = Math.max(...days.map((d) => d.count), 1);
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

function ReviewModal({ project, onClose, onSubmit }) {
  const [form, setForm] = useState({ phase: EVALUATION_STAGE_OPTIONS[0], score: "", feedback: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!form.score || !form.feedback) { setErr("Please fill in score and feedback."); return; }
    setSaving(true); setErr("");
    try {
      await onSubmit({ projectId: project.id, ...form });
    } catch (error) {
      setErr(error.message || "Failed to submit evaluation. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const cls = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-6 py-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-teal-100 mb-1">Start Review</p>
              <h3 className="font-extrabold text-white text-lg leading-tight">{getProjectDisplayName(project)}</h3>
            </div>
            <button onClick={onClose} className="text-teal-100 hover:text-white mt-0.5"><Icon.X /></button>
          </div>
          {project.abstract && <p className="text-teal-100 text-xs mt-2 line-clamp-2">{project.abstract}</p>}
        </div>
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
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Review Stage</label>
              <select className={cls} value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}>
                {EVALUATION_STAGE_OPTIONS.map((stage) => <option key={stage}>{stage}</option>)}
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
    domains_of_interest: Array.isArray(profile?.domains_of_interest) ? profile.domains_of_interest.join(", ") : "",
    max_team_capacity: profile?.max_team_capacity || 2,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  const initial = (form.full_name || "M")[0].toUpperCase();

  const handleSave = async () => {
    if (!form.full_name.trim()) { setErr("Full name is required."); return; }
    setSaving(true); setErr("");
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: form.full_name.trim(), department: form.department.trim(),
        phone: form.phone.trim(), bio: form.bio.trim(),
        specialization: form.specialization.trim(),
        employee_id: form.employee_id.trim(),
        domains_of_interest: String(form.domains_of_interest || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        max_team_capacity: Math.max(1, Number(form.max_team_capacity || 2)),
      }).eq("id", profile.id);
      if (error) throw error;
      onSave({ ...profile, ...form });
      setSaved(true); setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setErr(e.message || "Failed to update profile."); }
    finally { setSaving(false); }
  };

  const openSupport = () => { window.location.href = "mailto:support@etnova.ac.in?subject=Mentor%20Portal%20Support"; };

  if (editing) {
    return (
      <Modal isOpen onClose={onClose} title="Profile Settings" maxWidth="max-w-2xl">
        <div className="p-6 space-y-5">
          {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}
          {saved && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">Profile updated successfully!</div>}
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">Email Address</label>
            <input value={form.email} readOnly className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed" />
            <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">Full Name *</label>
            <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
              value={form.full_name} onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))} placeholder="Enter your full name" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Employee / Staff ID</label>
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
                value={form.employee_id || form.roll_number} onChange={(e) => setForm((prev) => ({ ...prev, employee_id: e.target.value }))} placeholder="e.g., EMP-2024-001" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Specialization</label>
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
                value={form.specialization} onChange={(e) => setForm((prev) => ({ ...prev, specialization: e.target.value }))} placeholder="e.g., Machine Learning" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Domains of Interest</label>
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
                value={form.domains_of_interest} onChange={(e) => setForm((prev) => ({ ...prev, domains_of_interest: e.target.value }))} placeholder="e.g., Healthcare AI, EdTech, Computer Vision" />
              <p className="mt-1 text-xs text-slate-500">Separate multiple interests with commas.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Team Capacity</label>
              <input type="number" min="1" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
                value={form.max_team_capacity} onChange={(e) => setForm((prev) => ({ ...prev, max_team_capacity: e.target.value }))} placeholder="2" />
              <p className="mt-1 text-xs text-slate-500">Used by admin suggestions to avoid overloading mentors.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Department</label>
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
                value={form.department} onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))} placeholder="e.g., Computer Science" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">Phone Number</label>
              <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900"
                value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="e.g., +91 9876543210" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-900 mb-2">Bio</label>
            <textarea rows={4} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-slate-900 resize-none"
              value={form.bio} onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))} placeholder="Short professional bio or research interests..." />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all" disabled={saving}>Cancel</button>
            <button type="button" onClick={handleSave} className="flex-1 px-4 py-3 rounded-xl text-black font-bold text-sm hover:opacity-90 transition-all shadow-md" style={{ backgroundColor: "#00D2C4" }} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#e8edf2]/92 backdrop-blur-sm p-4">
      <div className="w-full max-w-[380px] overflow-hidden rounded-[20px] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)]"
        style={{ fontFamily: '"Nunito", "Inter", "Segoe UI", sans-serif' }}>
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0a9688] via-[#13b5a4] to-[#2dcfc0] px-6 pb-7 pt-6">
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/14" />
          <div className="absolute right-16 top-9 h-16 w-16 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 left-8 h-20 w-20 rounded-full bg-white/12" />
          <button onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl bg-white/14 text-white/90 transition-all hover:bg-white/24"><Icon.X /></button>
          <div className="relative flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-white/18 text-2xl font-extrabold text-white shadow-[0_12px_24px_rgba(0,0,0,0.12)] ring-1 ring-white/20">{initial}</div>
            <div className="min-w-0 flex-1 pr-10">
              <p className="truncate text-xl font-extrabold leading-tight text-white">{form.full_name || "Mentor"}</p>
              <p className="mt-1 truncate text-sm font-semibold text-white/80">{form.email || "No email available"}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white ring-1 ring-white/18">
                <Icon.Shield />Mentor
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 pt-5">
          {saved && (
            <div className="mb-4 flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-semibold">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
              Profile updated successfully!
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Full Name", value: form.full_name || "Not set" },
              { label: "Email", value: form.email || "Not set" },
              { label: "Role", value: "Mentor" },
              { label: "Department", value: form.department || "-" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                <p className="mt-1 break-words text-sm font-extrabold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <button onClick={() => { setEditing(true); setErr(""); }}
              className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-teal-50 group-hover:text-teal-700"><Icon.Settings /></div>
              <span className="flex-1 text-sm font-bold text-slate-800">Account Settings</span>
              <span className="text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600"><Icon.ChevronRight /></span>
            </button>
            <button onClick={openSupport}
              className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-teal-50 group-hover:text-teal-700"><Icon.Help /></div>
              <span className="flex-1 text-sm font-bold text-slate-800">Help &amp; Support</span>
              <span className="text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600"><Icon.ChevronRight /></span>
            </button>
          </div>
          <button onClick={onSignOut}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0a9688] via-[#13b5a4] to-[#2dcfc0] px-4 py-3.5 text-sm font-extrabold text-white shadow-[0_18px_28px_rgba(19,181,164,0.28)] transition-all hover:-translate-y-0.5">
            <Icon.Logout />Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, onSignOut, showMyClass, showEvaluation, isOpen }) {
  const myClassSubs = ["my-class-overview", "my-class-teams", "my-class-submissions", "my-class-reviews", "my-class-marks"];
  const isMyClassActive = myClassSubs.includes(active);
  const [myClassManuallyOpen, setMyClassManuallyOpen] = useState(isMyClassActive);
  const myClassOpen = isMyClassActive || myClassManuallyOpen;

  const topItems = [
    { key: "overview", label: "Dashboard", icon: <Icon.Dashboard /> },
    { key: "teams", label: "My Teams", icon: <Icon.Teams /> },
    ...(showEvaluation ? [{ key: "evaluation", label: "Review Evaluation", icon: <Icon.Evaluation /> }] : []),
  ];

  const myClassSubItems = [
    { key: "my-class-overview", label: "Overview" },
    { key: "my-class-teams", label: "Team" },
    { key: "my-class-submissions", label: "Submissions" },
    { key: "my-class-reviews", label: "Reviews" },
    { key: "my-class-marks", label: "Marks" },
  ];

  return (
    <aside className={`w-72 h-[100dvh] fixed inset-y-0 left-0 bg-white border-r border-slate-100 flex flex-col shadow-none flex-shrink-0 overflow-hidden z-40 transform transition-transform duration-300 md:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#00D2C4] to-[#00a89d] flex items-center justify-center shadow-sm">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <p className="font-black text-slate-900 leading-tight tracking-wide">ETNOVA</p>
          <p className="text-xs text-slate-400 font-semibold">Mentor Portal</p>
        </div>
      </div>
      <nav className="flex-1 px-4 py-5 space-y-1.5">
        {topItems.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setActive(key)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all border ${active === key
                ? "bg-[rgba(0,210,196,0.08)] text-teal-700 border-[rgba(0,210,196,0.35)]"
                : "bg-transparent text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-800"
              }`}>
            <span className={active === key ? "text-teal-600" : "text-slate-400"}>{icon}</span>
            {label}
          </button>
        ))}

        {showMyClass && (
          <div>
            <button
              onClick={() => {
                setMyClassManuallyOpen((open) => !open);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all border ${isMyClassActive
                  ? "bg-[rgba(0,210,196,0.08)] text-teal-700 border-[rgba(0,210,196,0.35)]"
                  : "bg-transparent text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-800"
                }`}>
              <span className={isMyClassActive ? "text-teal-600" : "text-slate-400"}>
                <Icon.Building />
              </span>
              <span className="flex-1 text-left">My Class</span>
              <svg
                width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                className={`transition-transform duration-200 ${myClassOpen ? "rotate-180" : "rotate-0"}`}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {myClassOpen && (
              <div className="mt-1 space-y-1 pl-2">
                {myClassSubItems.map(({ key, label }) => (
                  <button key={key} onClick={() => setActive(key)}
                    className={`w-full flex items-center gap-2 pl-9 pr-3 py-2.5 rounded-2xl text-sm font-semibold transition-all border ${active === key
                        ? "text-teal-700 bg-[rgba(0,210,196,0.08)] border-[rgba(0,210,196,0.35)]"
                        : "text-slate-600 bg-transparent border-transparent hover:bg-slate-50 hover:text-slate-800"
                      }`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active === key ? "bg-teal-500" : "bg-slate-300"}`} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>
      <div className="px-6 pb-6 pt-3 mt-auto">
        <button onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0a9688] via-[#13b5a4] to-[#2dcfc0] px-4 py-3.5 text-sm font-extrabold text-white shadow-[0_18px_28px_rgba(19,181,164,0.22)] transition-all hover:-translate-y-0.5 active:translate-y-0">
          <Icon.Logout />Sign Out
        </button>
      </div>
    </aside>
  );
}

function Topbar({ active, mentorName, notificationCount = 0, onNotificationClick, onProfileClick, onToggleSidebar, onNavigateHome }) {
  const labels = {
    overview:                "Dashboard",
    teams:                   "My Teams",
    evaluation:              "Review Evaluation",
    "my-class-overview":     "My Class — Overview",
    "my-class-teams":        "My Class — Team",
    "my-class-submissions":  "My Class — Submissions",
    "my-class-reviews":      "My Class — Reviews",
    "my-class-marks":        "My Class — Marks",
  };
  return (
    <header className="bg-white border-b border-gray-100 px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2 md:gap-3 text-sm text-gray-400">
        <button onClick={onToggleSidebar} className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <button
          type="button"
          onClick={onNavigateHome}
          disabled={active === "overview"}
          className={`hidden sm:inline transition-colors ${
            active === "overview"
              ? "cursor-default text-gray-400"
              : "text-gray-400 hover:text-teal-600"
          }`}
        >
          Home
        </button>
        <Icon.ChevronRight className="hidden sm:inline" />
        <span className="text-gray-700 font-semibold">{labels[active]}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onNotificationClick}
          className="relative rounded-xl p-2 text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-700 active:bg-gray-100"
          title="Notifications"
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          {notificationCount > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>
        <button onClick={onProfileClick}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all group" title="View / Edit Profile">
          <div className="w-8 h-8 rounded-full bg-teal-400 text-white flex items-center justify-center text-sm font-bold group-hover:ring-2 group-hover:ring-teal-300 group-hover:ring-offset-1 transition-all">
            {mentorName?.[0] || "M"}
          </div>
          <div className="text-sm text-left">
            <p className="font-semibold text-gray-800 leading-tight group-hover:text-teal-700 transition-colors">{mentorName || "Mentor"}</p>
            <p className="text-xs text-gray-400">Mentor</p>
          </div>
          <div className="text-gray-300 group-hover:text-teal-400 transition-colors ml-1"><Icon.Edit /></div>
        </button>
      </div>
    </header>
  );
}

// ─── OVERVIEW TAB ───────────────────────────────────────────────────────────
function OverviewTab({
  projects,
  evaluations,
  milestones,
  recentActivity,
  loading,
  onNavigate,
  onSubmitReview,
  showEvaluationPanel,
  reviewProjects = [],
  allowedReviewStages = [],
  hasReviewAccess = false,
  isCoordinatorWithClass = false,
  myClassData = null,
}) {
  const [reviewProject, setReviewProject] = useState(null);
  if (loading) return <Spinner />;

  const pendingTeams = projects.filter((proj) => !evaluations.some((ev) => ev.project_id === proj.id));
  const handleSubmitReview = async (data) => { await onSubmitReview(data); setReviewProject(null); };
  const reviewerStageLabels = allowedReviewStages.map(formatReviewStageLabel);
  const reviewerSummary = showEvaluationPanel
    ? `${reviewProjects.length} team${reviewProjects.length !== 1 ? "s" : ""} available`
    : hasReviewAccess
      ? "Awaiting open review stage"
      : "Access controlled by coordinator";
  const coordinatorPendingCount = Number(myClassData?.pendingEvaluations || 0);
  const coordinatorTitle = myClassData?.classTitle || "No coordinator role";

  // ─── FIXED: Only include stages where coordinator explicitly saved a student deadline ───
  const _adminDeadlineItems = isCoordinatorWithClass
    ? (myClassData?.reviewStages || [])
        .filter((s) => Boolean(s?.coordinator_deadline))
        .map((s) => ({
          title: `${normalizeReviewStageName(s.stage_name)} — Evaluation Deadline`,
          due_date: s.coordinator_deadline,
          status: s.is_completed ? "completed" : "upcoming",
          source: "admin",
        }))
    : [];

  const studentDeadlineItems = isCoordinatorWithClass
    ? (myClassData?.reviewStages || [])
        .filter((s) => Boolean(s?.coordinator_deadline) && Boolean(s?.deadline) && s.student_deadline_set_by_coordinator === true)
        .map((s) => ({
          title: `${normalizeReviewStageName(s.stage_name)} — Student Deadline`,
          due_date: s.deadline,
          status: "upcoming",
          source: "student",
        }))
    : [];

  const allDeadlineItems = (isCoordinatorWithClass
    ? studentDeadlineItems
    : milestones.map((m) => ({ ...m, source: "admin" }))
  )
    .filter((item) => Boolean(item?.due_date))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Assigned Teams Summary</p>
          <p className="text-5xl font-extrabold text-gray-900 mt-2 mb-1">{projects.length}</p>
          <p className="text-sm text-gray-400 mb-5">Teams currently assigned under guide role.</p>
          <button onClick={() => onNavigate("teams")}
            className="w-full bg-teal-400 hover:bg-teal-500 active:scale-95 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
            View Teams <Icon.ArrowRight />
          </button>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Evaluation Panel</p>
          <p className="text-5xl font-extrabold text-gray-900 mt-2 mb-1">{showEvaluationPanel ? reviewProjects.length : 0}</p>
          <p className="text-sm text-gray-400 mb-5">
            {showEvaluationPanel
              ? `${reviewerStageLabels.join(", ")} open for ${reviewProjects.length} team${reviewProjects.length !== 1 ? "s" : ""}.`
              : hasReviewAccess
                ? "Reviewer access exists, but no open stage is available right now."
                : "Review Evaluation opens only when reviewer access is assigned."}
          </p>
          <button
            onClick={() => showEvaluationPanel && onNavigate("evaluation")}
            disabled={!showEvaluationPanel}
            className={`w-full font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
              showEvaluationPanel
                ? "bg-teal-400 hover:bg-teal-500 active:scale-95 text-white"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            <Icon.Evaluation /> {showEvaluationPanel ? "Open Review Evaluation" : "Access Locked"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-teal-50 rounded-2xl p-5 border border-white">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Guide Role</p>
            <span className="rounded-full border border-white/80 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
              {projects.length} assigned
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-teal-600">{pendingTeams.length}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">teams need follow-up</p>
          <p className="mt-3 text-xs text-gray-500">
            {pendingTeams.length > 0
              ? `${pendingTeams.length} team${pendingTeams.length !== 1 ? "s are" : " is"} waiting for your guide action.`
              : "No pending guide responsibilities right now."}
          </p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-5 border border-white">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Reviewer Access</p>
            <span className="rounded-full border border-white/80 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
              {showEvaluationPanel ? `${allowedReviewStages.length} stage${allowedReviewStages.length === 1 ? "" : "s"}` : "Locked"}
            </span>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-blue-600">{showEvaluationPanel ? reviewProjects.length : 0}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">{reviewerSummary}</p>
          <p className="mt-3 text-xs text-gray-500">
            {showEvaluationPanel
              ? reviewerStageLabels.join(", ")
              : "Status only here so the main review action is not duplicated."}
          </p>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-5 border border-white">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Coordinator Class</p>
            <span className="rounded-full border border-white/80 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
              {isCoordinatorWithClass ? "Available" : "Not assigned"}
            </span>
          </div>
          <p className="mt-3 text-base font-extrabold text-gray-900">{coordinatorTitle}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            {isCoordinatorWithClass
              ? `${myClassData?.totalProjects || 0} teams · ${coordinatorPendingCount} pending`
              : "No coordinator class linked"}
          </p>
          <button
            type="button"
            onClick={() => isCoordinatorWithClass && onNavigate("my-class-overview")}
            disabled={!isCoordinatorWithClass}
            className={`mt-4 inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              isCoordinatorWithClass
                ? "bg-white text-emerald-700 shadow-sm hover:-translate-y-0.5"
                : "bg-white/70 text-gray-400 cursor-not-allowed"
            }`}
          >
            Open My Class <Icon.ArrowRight />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2"><WeeklyChart projects={projects} evaluations={evaluations} /></div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Recent Activity</p>
          {recentActivity.length === 0 ? <p className="text-sm text-gray-400">No activity yet.</p> : (
            <div className="space-y-4">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0 mt-0.5"><Icon.Star /></div>
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-start justify-between mb-1">
            <p className="font-extrabold text-gray-800 text-base">Deadlines & Milestones</p>
          </div>
          <p className="text-xs text-gray-400 mb-5">
            {isCoordinatorWithClass
              ? "Student submission deadlines from My Class."
              : "Read-only timeline controlled by admin."}
          </p>

          {allDeadlineItems.length === 0 ? (
            <p className="text-sm text-gray-400">No milestones set.</p>
          ) : (
            <div className="space-y-3">
              {allDeadlineItems.map((m, i) => {
                const today = new Date();
                const due = new Date(m.due_date);
                const isPast = due < today;
                const isToday = due.toDateString() === today.toDateString();
                const tag =
                  m.status === "completed"
                    ? "Completed"
                    : isToday
                    ? "Today"
                    : isPast
                    ? "Overdue"
                    : "Upcoming";
                const tagStyle =
                  tag === "Completed"
                    ? "bg-blue-50 text-blue-600 border-blue-200"
                    : tag === "Overdue"
                    ? "bg-red-50 text-red-600 border-red-200"
                    : tag === "Today"
                    ? "bg-amber-50 text-amber-600 border-amber-200"
                    : "bg-teal-50 text-teal-600 border-teal-200";
                const dotColor =
                  tag === "Completed"
                    ? "bg-blue-500"
                    : tag === "Overdue"
                    ? "bg-red-500"
                    : tag === "Today"
                    ? "bg-amber-500"
                    : m.source === "student"
                    ? "bg-indigo-400"
                    : "bg-teal-400";

                const formattedDate = !Number.isNaN(due.getTime())
                  ? due.toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : m.due_date;

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800">{m.title}</p>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{formattedDate}</p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full border flex-shrink-0 ml-3 ${tagStyle}`}
                    >
                      {tag}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Team Status Overview</p>
          <div className="space-y-4">
            {projects.map((proj) => {
              return (
                <div key={proj.id} className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 font-bold text-sm flex-shrink-0">
                    {getProjectDisplayName(proj)?.[0] || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{getProjectDisplayName(proj)}</p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <StatusBadge status={proj.status} />
                      <span className="text-xs text-gray-400">{proj.team_members?.length || 0} members</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {projects.length === 0 && <p className="text-sm text-gray-400">No teams assigned.</p>}
          </div>
        </div>
      </div>
      {reviewProject && <ReviewModal project={reviewProject} onClose={() => setReviewProject(null)} onSubmit={handleSubmitReview} />}
    </div>
  );
}

// ─── TEAMS TAB ──────────────────────────────────────────────────────────────
function TeamsTab({ projects, evaluations, loading, mentorId, mentorName, onNavigateHome }) {
  const [sel, setSel] = useState(() => getStoredMentorSelectedTeamId());
  const selectedProject = projects.find((project) => project.id === sel) || null;

  useEffect(() => {
    if (!sel) {
      try {
        window.sessionStorage.removeItem(MENTOR_SELECTED_TEAM_STORAGE_KEY);
      } catch {
        // Ignore session storage access failures.
      }
      return;
    }

    try {
      window.sessionStorage.setItem(MENTOR_SELECTED_TEAM_STORAGE_KEY, sel);
    } catch {
      // Ignore session storage access failures.
    }
  }, [sel]);

  if (loading) return <Spinner />;

  if (selectedProject) {
    return (
      <Suspense fallback={<TabPanelLoader label="Loading team workspace..." />}>
        <TeamWorkspace
          key={selectedProject.id}
          proj={selectedProject}
          mentorId={mentorId}
          mentorName={mentorName}
          onNavigateHome={onNavigateHome}
          onBack={() => setSel(null)}
        />
      </Suspense>
    );
  }

  return projects.length === 0 ? (
    <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-sm text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-teal-50 flex items-center justify-center mb-3">
        <svg width="28" height="28" fill="none" stroke="#14b8a6" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
      </div>
      <p className="text-gray-700 font-semibold">No teams assigned</p>
      <p className="text-gray-400 text-sm mt-1">Contact admin to get assigned to a team.</p>
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
            <div className="h-1 w-full bg-gradient-to-r from-teal-400 to-emerald-400" />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" fill="none" stroke="#14b8a6" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-gray-900 leading-tight">{getProjectDisplayName(proj)}</h3>
                    {proj.team_name && proj.team_name !== proj.title && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{proj.title}</p>
                    )}
                  </div>
                </div>
              </div>
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
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-400 font-medium">Evaluation Score</span>
                  <span className="text-teal-600 font-bold">{avg ? `Score: ${avg}/100` : ""}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-700" style={{ width: avg ? `${avg}%` : "0%" }} />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                <div className="flex items-center gap-2">
                  {isPending ? (
                    <><StatusBadge status={proj.status} /><span className="flex items-center gap-1 text-amber-600 text-xs font-semibold"><Icon.Clock /> Not evaluated</span></>
                  ) : (
                    <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${avg >= 90 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : avg >= 70 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${avg >= 90 ? "bg-emerald-500" : avg >= 70 ? "bg-amber-400" : "bg-red-400"}`} />
                      Avg {avg}/100
                    </span>
                  )}
                </div>
                <span className="flex items-center gap-1.5 text-teal-600 font-semibold text-xs group-hover:gap-2.5 transition-all">View Details <Icon.ArrowRight /></span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── EVALUATION TAB (ENHANCED) ──────────────────────────────────────────────
function EvaluationTab({ projects, loading, allowedReviewStages = [], writableReviewStages = [], reviewerAccessByClass = {} }) {
  const [selectedProjectId, setSelectedProjectId] = useState(() => getStoredMentorSelectedReviewProjectId());
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  const persistedReviewProjectId = selectedProject ? selectedProjectId : null;

  useEffect(() => {
    if (!persistedReviewProjectId) {
      try {
        window.sessionStorage.removeItem(MENTOR_SELECTED_REVIEW_PROJECT_STORAGE_KEY);
      } catch {
        // Ignore session storage access failures.
      }
      return;
    }

    try {
      window.sessionStorage.setItem(MENTOR_SELECTED_REVIEW_PROJECT_STORAGE_KEY, persistedReviewProjectId);
    } catch {
      // Ignore session storage access failures.
    }
  }, [persistedReviewProjectId]);

  const getProjectClassName = (project) => project?.class_name || project?.classes?.class_section || "Assigned Class";
  const projectGroups = projects.reduce((acc, project) => {
    const classId = project?.class_id != null ? String(project.class_id) : getProjectClassName(project);
    if (!acc[classId]) {
      acc[classId] = {
        classId,
        className: getProjectClassName(project),
        projects: [],
      };
    }
    acc[classId].projects.push(project);
    return acc;
  }, {});
  const groupedClasses = Object.values(projectGroups);
  const groupedClassIds = Object.keys(projectGroups);

  useEffect(() => {
    if (groupedClassIds.length === 0) {
      setSelectedClassId(null);
      return;
    }
    if (!selectedClassId || !groupedClassIds.includes(selectedClassId)) {
      setSelectedClassId(groupedClassIds[0]);
    }
  }, [groupedClassIds.join(","), selectedClassId]);

  const selectedClassGroup = groupedClasses.find((group) => group.classId === selectedClassId) || groupedClasses[0] || null;
  const className = selectedClassGroup?.className || "Assigned Class";
  const classAllowedReviewStages = reviewerAccessByClass[selectedClassGroup?.classId]?.allowedStages || [];
  const classWritableReviewStages = reviewerAccessByClass[selectedClassGroup?.classId]?.writableStages || [];

  const batchOptions = ["all"];
  const batchNums = [...new Set((selectedClassGroup?.projects || []).map(p => p.batch).filter(b => b != null))].sort();
  batchNums.forEach(b => batchOptions.push(String(b)));
  if ((selectedClassGroup?.projects || []).some(p => p.batch == null)) batchOptions.push("unassigned");

  const filtered = (selectedClassGroup?.projects || []).filter(project => {
    const name = getProjectDisplayName(project).toLowerCase();
    const members = (project.team_members || []).map(m => m.profiles?.full_name || "").join(" ").toLowerCase();
    const matchSearch = !search.trim() || name.includes(search.toLowerCase()) || members.includes(search.toLowerCase());
    const matchBatch = batchFilter === "all"
      || (batchFilter === "unassigned" && project.batch == null)
      || String(project.batch) === batchFilter;
    return matchSearch && matchBatch;
  });

  const batchColors = {
    "Batch 1": { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700", dot: "bg-teal-500", header: "from-teal-500 to-emerald-500" },
    "Batch 2": { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", dot: "bg-indigo-500", header: "from-indigo-500 to-purple-500" },
    "Unassigned": { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600", dot: "bg-slate-400", header: "from-slate-400 to-slate-500" },
  };
  const getBatchColor = (key) => batchColors[key] || batchColors["Batch 2"];

  const openStageLabel = classWritableReviewStages.length > 0
    ? REVIEW_ROUND_OPTIONS.find(o => o.value === classWritableReviewStages[0])?.label || classWritableReviewStages[0]
    : null;

  if (loading) return <Spinner />;

  if (selectedProject) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm">
          <button type="button" onClick={() => setSelectedProjectId(null)}
            className="text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1.5">
            <span className="rotate-180 inline-flex"><Icon.ArrowRight /></span>
            Review Evaluation
          </button>
          <Icon.ChevronRight />
          <span className="text-gray-500">{className}</span>
          <Icon.ChevronRight />
          <span className="text-gray-800 font-semibold">{getProjectDisplayName(selectedProject)}</span>
        </div>
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
          <div className="bg-gradient-to-r from-[#00D2C4] to-[#00a89d] px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">
                  {selectedProject.batch != null ? `Batch ${selectedProject.batch}` : "Unassigned Batch"}
                </p>
                <h2 className="text-xl font-extrabold text-white">{getProjectDisplayName(selectedProject)}</h2>
              </div>
              <StatusBadge status={selectedProject.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white">{className}</span>
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white">
                {(selectedProject.team_members || []).length} {(selectedProject.team_members || []).length === 1 ? "Student" : "Students"}
              </span>
              {selectedProject.batch != null && (
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white">Batch {selectedProject.batch}</span>
              )}
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Review Stages</p>
              <div className="flex flex-wrap gap-2">
                {allowedReviewStages.length > 0 ? allowedReviewStages.map((stageKey) => {
                  const label = REVIEW_ROUND_OPTIONS.find((item) => item.value === stageKey)?.label || stageKey;
                  const isWritable = writableReviewStages.includes(stageKey);
                  return (
                    <span key={stageKey} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${isWritable ? "border-teal-200 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-500"}`}>
                      {isWritable ? <Icon.Unlock /> : <Icon.Lock />}{label}
                    </span>
                  );
                }) : <span className="text-sm font-semibold text-slate-500">No stage assigned yet.</span>}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">Team Members</p>
              <div className="flex flex-wrap gap-2">
                {(selectedProject.team_members || []).map((member, i) => {
                  const name = member.profiles?.full_name || member.profiles?.email || "Student";
                  const colors = ["bg-teal-400", "bg-indigo-400", "bg-purple-400", "bg-amber-400", "bg-rose-400"];
                  return (
                    <div key={member.id || i} className="flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200 pr-3 pl-1 py-1">
                      <div className={`w-6 h-6 rounded-full ${colors[i % 5]} text-white text-xs font-bold flex items-center justify-center`}>{name[0]}</div>
                      <span className="text-xs font-semibold text-slate-700">{name}</span>
                    </div>
                  );
                })}
                {(selectedProject.team_members || []).length === 0 && <span className="text-sm text-slate-400">No students linked</span>}
              </div>
            </div>
          </div>
        </div>
        <Suspense fallback={<TabPanelLoader label="Loading rubric evaluation..." />}>
          <DynamicRubricEvaluation
            projectId={selectedProject.id}
            members={selectedProject.team_members || []}
            mode="review"
            allowedReviewStages={allowedReviewStages}
            writableReviewStages={writableReviewStages}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Review Evaluation</p>
            <h2 className="text-2xl font-extrabold text-gray-900">Assigned Teams</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Teams for the selected class appear below, grouped by batch. Click a team to enter rubric-wise marks.
            </p>
          </div>
          {openStageLabel ? (
            <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              <span className="text-xs font-bold text-teal-700">{openStageLabel} — Open for entry</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <Icon.Lock />
              <span className="text-xs font-bold text-slate-500">No stage open yet</span>
            </div>
          )}
        </div>
        {groupedClasses.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {groupedClasses.map((group) => (
              <button
                key={group.classId}
                type="button"
                onClick={() => setSelectedClassId(group.classId)}
                className={`px-3 py-2 rounded-full text-xs font-bold border transition ${
                  selectedClassId === group.classId
                    ? "bg-teal-500 text-white border-teal-500"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {group.className}
                <span className="ml-2 text-[11px] text-slate-400">({group.projects.length})</span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icon.Search /></span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search team or student name…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><Icon.X /></button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {batchOptions.map(opt => {
              const label = opt === "all" ? "All Batches" : opt === "unassigned" ? "Unassigned" : `Batch ${opt}`;
              const isActive = batchFilter === opt;
              return (
                <button key={opt} onClick={() => setBatchFilter(opt)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    isActive
                      ? opt === "1" ? "bg-teal-500 text-white border-teal-500"
                        : opt === "2" ? "bg-indigo-500 text-white border-indigo-500"
                        : "bg-slate-700 text-white border-slate-700"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <span className="text-sm text-slate-500">
            <span className="font-bold text-slate-800">{filtered.length}</span> team{filtered.length !== 1 ? "s" : ""} shown
            {search && <span className="text-teal-600"> · matching "{search}"</span>}
          </span>
          {batchNums.map(b => (
            <span key={b} className="text-sm text-slate-400">
              Batch {b}: <span className="font-bold text-slate-700">{(selectedClassGroup?.projects || []).filter(p => p.batch === b).length}</span>
            </span>
          ))}
        </div>
      </div>

      {projects.length === 0 && (
        <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-sm text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-3"><Icon.Lock /></div>
          <p className="text-gray-700 font-semibold">No review access assigned</p>
          <p className="text-gray-400 text-sm mt-1">Once the coordinator grants reviewer access, teams will appear here.</p>
        </div>
      )}

      {projects.length > 0 && filtered.length === 0 && (
        <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-sm text-center">
          <p className="text-gray-600 font-semibold">No teams match your search</p>
          <button onClick={() => { setSearch(""); setBatchFilter("all"); }} className="mt-3 text-sm text-teal-600 font-semibold hover:underline">
            Clear filters
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {filtered.map((project) => {
          const batchKey = project.batch ? `Batch ${project.batch}` : "Unassigned";
          const colors = getBatchColor(batchKey);
          const memberNames = (project.team_members || []).map(m => m.profiles?.full_name || m.profiles?.email || "Student");
          const memberColors = ["#14b8a6", "#6366f1", "#8b5cf6", "#f59e0b", "#ef4444"];
          return (
            <div key={project.id} onClick={() => setSelectedProjectId(project.id)}
              className="group bg-white rounded-xl border border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-teal-300 transition-all duration-200 p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer relative overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${colors.header}`} />
              <div className="flex items-center gap-3.5 min-w-0 pl-1 flex-1">
                <div className={`w-10 h-10 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-sm font-extrabold ${colors.text}`}>{getProjectDisplayName(project)[0]?.toUpperCase() || "?"}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="font-extrabold text-gray-900 leading-tight truncate text-sm">{getProjectDisplayName(project)}</h4>
                    <span className={`rounded-full border ${colors.border} ${colors.bg} px-1.5 py-0.5 text-[10px] font-bold ${colors.text} hidden sm:inline-block`}>{batchKey}</span>
                  </div>
                  {memberNames.length > 0 ? (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex">
                        {(project.team_members || []).slice(0, 3).map((tm, i) => (
                          <div key={i} className="w-4 h-4 rounded-full border border-white text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0"
                            style={{ background: memberColors[i % 5], marginLeft: i > 0 ? "-2px" : "0" }}>
                            {(tm.profiles?.full_name || "?")[0]}
                          </div>
                        ))}
                      </div>
                      <span className="text-xs text-slate-500 font-medium truncate">
                        {memberNames.slice(0, 3).join(", ")}{memberNames.length > 3 ? ` +${memberNames.length - 3}` : ""}
                      </span>
                    </div>
                  ) : <span className="text-xs text-slate-400 font-medium mt-1">No students</span>}
                </div>
              </div>
              <div className="flex items-center gap-4 sm:gap-6 ml-11 sm:ml-0 flex-shrink-0">
                <div className="flex items-center gap-3">
                  {openStageLabel && (
                    <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 hidden md:flex items-center gap-1">
                      <Icon.Unlock />{openStageLabel}
                    </span>
                  )}
                  <StatusBadge status={project.status} />
                </div>
                <button type="button"
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    writableReviewStages.length > 0
                      ? "bg-teal-50 text-teal-700 border-teal-200 group-hover:bg-teal-400 group-hover:text-white group-hover:border-teal-400"
                      : "bg-white border-slate-200 text-slate-600 group-hover:border-teal-200 group-hover:bg-teal-50 group-hover:text-teal-700"
                  }`}>
                  Review <Icon.ArrowRight />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
export default function MentorDashboard() {
  const [active, setActive] = useState(() => getStoredMentorTab());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [guideProjects, setGuideProjects] = useState([]);
  const [reviewProjects, setReviewProjects] = useState([]);
  const [hasReviewAccess, setHasReviewAccess] = useState(false);
  const [allowedReviewStages, setAllowedReviewStages] = useState([]);
  const [writableReviewStages, setWritableReviewStages] = useState([]);
  const [reviewerAccessByClass, setReviewerAccessByClass] = useState({});
  const [reviewAccessVersion, setReviewAccessVersion] = useState(0);
  const [evaluations, setEvaluations] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [mentorProfile, setMentorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [myClassData, setMyClassData] = useState(null);
  const [myClassLoading, setMyClassLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (MENTOR_TABS.has(active || "")) {
        window.sessionStorage.setItem(MENTOR_ACTIVE_TAB_STORAGE_KEY, active);
      } else {
        window.sessionStorage.removeItem(MENTOR_ACTIVE_TAB_STORAGE_KEY);
      }
    } catch {
      // Ignore session storage access failures.
    }
  }, [active]);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiRequest("/notifications", { skipCache: true });
      setNotifications(data || []);
    } catch (error) {
      console.error("Failed to load mentor notifications:", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(MENTOR_SELECTED_TEAM_STORAGE_KEY);
    } catch {
      // Ignore session storage access failures.
    }
  }, [active]);

  const loadCoordinatorClassData = useCallback(async (classId) => {
    return withInflight(coordinatorClassDataInflight, classId, async () => {
      const [{ data: classRow }, { data: classProjects }, { data: reviewStageRows, error: reviewStageError }, { data: classStudentProfiles }] = await Promise.all([
        supabase.from("classes").select("id, class_section").eq("id", classId).single(),
        supabase.from("projects").select("id, title, guide_id, status, approved_idea_id").eq("class_id", classId),
        supabase.from("review_stages")
          .select("id, stage_name, deadline, coordinator_deadline, stage_order, is_active, is_completed, is_locked, student_deadline_set_by_coordinator")
          .eq("class_id", classId).order("stage_order", { ascending: true }),
        supabase.from("profiles").select("id").eq("role", "student").eq("class_id", classId),
      ]);

      const projectsInClass = classProjects || [];
      const projectIds = projectsInClass.map(p => p.id);
      const guideIds = Array.from(new Set(projectsInClass.map(p => p.guide_id).filter(Boolean)));

      const [membersRes, evalRes, guidesRes, docsRes] = await Promise.all([
        projectIds.length ? supabase.from("team_members").select("id, project_id, student_id").in("project_id", projectIds) : Promise.resolve({ data: [] }),
        projectIds.length ? supabase.from("evaluations").select("id, project_id, score, obtained_marks").in("project_id", projectIds) : Promise.resolve({ data: [] }),
        guideIds.length ? supabase.from("profiles").select("id, full_name").in("id", guideIds) : Promise.resolve({ data: [] }),
        projectIds.length
          ? supabase.from("documents").select("id, project_id, document_type, status, coordinator_verified, uploaded_at").in("project_id", projectIds).order("uploaded_at", { ascending: false })
          : Promise.resolve({ data: [] }),
      ]);

    const members = membersRes.data || [];
    const classEvals = evalRes.data || [];
    const guides = guidesRes.data || [];
    const documents = docsRes.data || [];
    const guideMap = new Map(guides.map(g => [g.id, g.full_name || "Unassigned"]));
    const memberCountByProject = members.reduce((acc, item) => { acc[item.project_id] = (acc[item.project_id] || 0) + 1; return acc; }, {});
    const classStudentIds = new Set((classStudentProfiles || []).map((item) => item.id).filter(Boolean));
    const teamStudentIds = new Set(members.map((item) => item.student_id).filter(Boolean));
    const totalStudents = classStudentIds.size;
    const studentsWithoutTeamCount = [...classStudentIds].filter((studentId) => !teamStudentIds.has(studentId)).length;
    const studentsByProject = members.reduce((acc, item) => {
      if (!item?.project_id || !item?.student_id) return acc;
      if (!acc[item.project_id]) acc[item.project_id] = new Set();
      acc[item.project_id].add(item.student_id);
      return acc;
    }, {});
    const evalByProject = classEvals.reduce((acc, item) => {
      if (!acc[item.project_id]) acc[item.project_id] = [];
      const normalizedScore = Number(item.score ?? item.obtained_marks);
      acc[item.project_id].push(Number.isNaN(normalizedScore) ? 0 : normalizedScore);
      return acc;
    }, {});
    const latestDocumentByProjectType = documents.reduce((acc, item) => {
      if (!item?.project_id || !item?.document_type) return acc;
      const key = `${item.project_id}:${String(item.document_type).trim().toLowerCase()}`;
      if (!acc[key]) acc[key] = item;
      return acc;
    }, {});

      let reviewMarks = [];
      if (projectIds.length) {
        const studentIds = [...new Set(members.map((item) => item.student_id).filter(Boolean))];
        if (studentIds.length) {
          const { data: reviewMarksRows } = await supabase
            .from("review_marks")
            .select("student_id, review_stage")
            .in("student_id", studentIds);
          reviewMarks = reviewMarksRows || [];
        }
      }
      const finalResultRows = projectIds.length ? await fetchCoordinatorResultsBreakdown() : [];

      const stageProgress = {
        idea: 0, abstract: 0, zeroth_review: 0,
        first_review: 0, second_review: 0, final_review: 0,
      };

      const finalResultByStudentId = (finalResultRows || []).reduce((acc, row) => {
        if (row?.student_id) acc[row.student_id] = row;
        return acc;
      }, {});

      const projectRows = projectsInClass.map(project => {
        const scores = evalByProject[project.id] || [];
        const avgScore = scores.length ? scores.reduce((sum, s) => sum + s, 0) / scores.length : null;

        if (project.approved_idea_id) stageProgress.idea += 1;

        const abstractDocument = latestDocumentByProjectType[`${project.id}:abstract`];
        if (Boolean(abstractDocument?.coordinator_verified) || String(abstractDocument?.status || "").toLowerCase() === "approved") {
          stageProgress.abstract += 1;
        }

        const studentIds = [...(studentsByProject[project.id] || new Set())];
        const studentSet = new Set(studentIds);
        const marksByStage = reviewMarks.reduce((acc, row) => {
          const reviewStage = normalizeReviewStageValue(row?.review_stage);
          if (!studentSet.has(row?.student_id) || !REVIEW_STAGE_VALUE_ORDER.includes(reviewStage)) return acc;
          if (!acc[reviewStage]) acc[reviewStage] = new Set();
          acc[reviewStage].add(row.student_id);
          return acc;
        }, {});

        REVIEW_STAGE_VALUE_ORDER.forEach((reviewStage) => {
          const markedStudents = marksByStage[reviewStage];
          if (studentIds.length > 0 && markedStudents && markedStudents.size === studentIds.length) {
            stageProgress[reviewStage] += 1;
          }
        });

        const isFullyEvaluated = studentIds.length > 0 && studentIds.every((studentId) => hasFinalMarkUpdated(finalResultByStudentId[studentId]));

        return {
          ...project,
          teamSize: memberCountByProject[project.id] || 0,
          evaluationCount: scores.length,
          avgScore,
          guideName: guideMap.get(project.guide_id) || "Unassigned",
          isFullyEvaluated,
        };
      });

      const evaluatedCount = projectRows.filter((item) => item.isFullyEvaluated).length;
      const teamsWithLessThanThreeMembers = projectRows.filter((item) => Number(item.teamSize || 0) < 3).length;

      return {
        classId, classTitle: classRow?.class_section || "Untitled Class",
        totalProjects: projectRows.length, evaluatedProjects: evaluatedCount,
        totalStudents,
        pendingEvaluations: projectRows.length - evaluatedCount,
        teamsWithLessThanThreeMembers,
        studentsWithoutTeamCount,
        stageProgress, projects: projectRows,
        reviewStages: sortReviewStages(reviewStageRows || []),
        deadlineLoadError: reviewStageError
          ? (/coordinator_deadline/i.test(String(reviewStageError.message || ""))
            ? 'The "coordinator_deadline" column is missing in "review_stages". Run the Supabase ALTER TABLE migration first.'
            : (reviewStageError.message || "Failed to load review deadlines."))
          : "",
      };
    });
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/"); return; }

        const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        setMentorProfile(profile);

        let projData = [];

        if (profile) {
          const normalizeSectionKey = (value) => String(value || "").trim().toLowerCase();
          const resolveProjectBatch = (project) => {
            if (project?.batch != null) return String(project.batch);
            const members = project?.team_members || [];
            const leader = members.find((member) => member.role === "leader");
            const anchor = leader?.profiles || members[0]?.profiles || null;
            if (anchor?.batch != null) return String(anchor.batch);
            if (anchor?.class_section != null) return String(anchor.class_section);
            return null;
          };

          const [
            reviewerAccessResult,
            backendProjects,
            evalData,
            msData,
            mentorNotifications,
          ] = await Promise.all([
            fetchReviewerAccessRowsForMentor(profile.id, { skipCache: reviewAccessVersion > 0 }),
            apiRequest("/projects", { skipCache: reviewAccessVersion > 0 }),
            fetchEvaluationsForMentor(profile.id),
            fetchSystemSettingsRows(),
            apiRequest("/notifications", { skipCache: reviewAccessVersion > 0 }),
          ]);

          const reviewerAccessRows = reviewerAccessResult.rows;
          const hasBatchScope = reviewerAccessResult.hasBatchScope;

          setHasReviewAccess((reviewerAccessRows || []).some((row) => Boolean(row?.is_open)));
          const reviewerClassIds = [...new Set((reviewerAccessRows || []).map((row) => row.class_id).filter(Boolean))];
          const reviewerBatchMap = (reviewerAccessRows || []).reduce((acc, row) => {
            if (!row?.class_id) return acc;
            if (!acc[row.class_id]) acc[row.class_id] = { batches: new Set(), hasSpecificBatch: false };
            if (!hasBatchScope || row.batch == null) {
              if (!acc[row.class_id].hasSpecificBatch) acc[row.class_id].batches.add("all");
            } else {
              if (!acc[row.class_id].hasSpecificBatch) { acc[row.class_id].batches.clear(); acc[row.class_id].hasSpecificBatch = true; }
              acc[row.class_id].batches.add(String(row.batch));
            }
            return acc;
          }, {});

          const reviewerAccessByClass = Object.entries(
            (reviewerAccessRows || []).reduce((acc, row) => {
              const classId = row?.class_id != null ? String(row.class_id) : "unknown";
              if (!acc[classId]) acc[classId] = [];
              acc[classId].push(row);
              return acc;
            }, {})
          ).reduce((acc, [classId, rows]) => {
            acc[classId] = resolveReviewerStageVisibility(rows);
            return acc;
          }, {});
          setReviewerAccessByClass(reviewerAccessByClass);

          let classIdBySection = new Map();
          let reviewerClasses = [];
          if (reviewerClassIds.length > 0) {
            const { data: fetchedReviewerClasses, error: reviewerClassesError } = await supabase
              .from("classes").select("id, class_section").in("id", reviewerClassIds);
            if (reviewerClassesError) throw reviewerClassesError;
            reviewerClasses = fetchedReviewerClasses || [];
            classIdBySection = new Map((reviewerClasses || []).map((row) => [normalizeSectionKey(row.class_section), row.id]));
          }

          const resolveProjectClassId = (project) => {
            if (project?.class_id && reviewerBatchMap[project.class_id]) return project.class_id;
            const members = project?.team_members || [];
            const leader = members.find((member) => member.role === "leader");
            const anchor = leader?.profiles || members[0]?.profiles || null;
            if (!anchor) return null;
            if (anchor?.class_id && reviewerBatchMap[anchor.class_id]) return anchor.class_id;
            const classSection = String(anchor?.class_section || anchor?.batch || "").trim();
            if (!classSection) return null;
            return classIdBySection.get(normalizeSectionKey(classSection)) || null;
          };

          const guideProjectRows = (backendProjects || []).filter(
            (project) => project.guide_id === profile.id || project.mentor_id === profile.id
          );

          let reviewerProjectRows = [];
          if (reviewerClassIds.length > 0) {
            reviewerProjectRows = (backendProjects || []).filter((project) => {
              const resolvedClassId = resolveProjectClassId(project);
              const batchScope = resolvedClassId ? reviewerBatchMap[resolvedClassId] : null;
              const allowedBatches = batchScope?.batches;
              if (!allowedBatches || allowedBatches.size === 0) return false;
              if (allowedBatches.has("all")) return true;
              const effectiveBatch = resolveProjectBatch(project);
              return effectiveBatch != null && allowedBatches.has(String(effectiveBatch));
            });
          }

          const classSectionById = new Map((reviewerClasses || []).map((row) => [String(row.id), row.class_section]));
          const resolveProjectClassName = (project) => {
            if (project?.class_name) return project.class_name;
            if (project?.classes?.class_section) return project.classes.class_section;
            const members = Array.isArray(project?.team_members) ? project.team_members : [];
            const leader = members.find((member) => member?.role === "leader");
            const anchor = leader?.profiles || members[0]?.profiles || null;
            if (anchor?.class_section) return anchor.class_section;
            if (project?.batch != null) return String(project.batch);
            if (anchor?.batch != null) return String(anchor.batch);
            if (project?.class_id != null) return classSectionById.get(String(project.class_id)) || `Class ${project.class_id}`;
            return "Assigned Class";
          };

          if (reviewerProjectRows.length === 0 && reviewerClassIds.length > 0) {
            const { data: fallbackProjects, error: fallbackProjectsError } = await supabase
              .from("projects")
              .select(`*, classes(class_section), team_members(id, student_id, role, profiles:student_id(full_name, email, roll_number, department, batch, class_section))`)
              .or(`class_id.in.(${reviewerClassIds.join(",")}),class_id.is.null`)
              .order("created_at", { ascending: false });
            if (fallbackProjectsError) throw fallbackProjectsError;

            reviewerProjectRows = (fallbackProjects || []).filter((project) => {
              const resolvedClassId = resolveProjectClassId(project);
              const batchScope = resolvedClassId ? reviewerBatchMap[resolvedClassId] : null;
              const allowedBatches = batchScope?.batches;
              if (!allowedBatches || allowedBatches.size === 0) return false;
              if (allowedBatches.has("all")) return true;
              const effectiveBatch = resolveProjectBatch(project);
              return effectiveBatch != null && allowedBatches.has(String(effectiveBatch));
            }).map((project) => ({
              ...project,
              class_name: resolveProjectClassName(project),
            }));
          }

          reviewerProjectRows = reviewerProjectRows.map((project) => ({
            ...project,
            class_name: resolveProjectClassName(project),
          }));

          const mergedProjects = [...(guideProjectRows || []), ...reviewerProjectRows].reduce((acc, project) => {
            if (!acc.some((item) => item.id === project.id)) acc.push(project);
            return acc;
          }, []);

          projData = mergedProjects;
          setGuideProjects(guideProjectRows || []);
          setReviewProjects(reviewerProjectRows || []);
          const { allowedStages, writableStages } = resolveReviewerStageVisibility(reviewerAccessRows || []);
          setAllowedReviewStages(allowedStages);
          setWritableReviewStages(writableStages);
          setProjects(projData || []);
          setEvaluations(evalData || []);
          setNotifications(mentorNotifications || []);

          setMilestones((msData || []).map(m => ({
            title: m.setting_key || m.key || m.title || m.name,
            due_date: normalizeMilestoneDueDate(m.setting_value || m.value || m.due_date),
            status: m.status || "upcoming",
          })).filter(m => Boolean(m.due_date) && String(m.due_date).includes("-")));

          const activity = buildRecentActivityItems({
            evaluations: (evalData || []).map((ev) => {
              const proj = (projData || []).find((p) => p.id === ev.project_id);
              return {
                ...ev,
                project_id: ev.project_id,
                phase: ev.phase,
                created_at: ev.created_at,
                project_name: getProjectDisplayName(proj),
              };
            }),
            guideProjects: guideProjectRows || [],
            reviewProjects: reviewerProjectRows || [],
            reviewerStageLabels: allowedStages.map(formatReviewStageLabel),
          }).map((item) => {
            if (item.project_name) {
              return {
                text: `Evaluation submitted for ${item.project_name} (${item.phase})`,
                time: item.time,
              };
            }
            return item;
          });
          setRecentActivity(activity);
        }

        const coordinatorResolution = await resolveCoordinatorClassIdStrict(profile, projData);
        if (coordinatorResolution.classId) {
          setMyClassLoading(true);
          const freshData = await loadCoordinatorClassData(coordinatorResolution.classId);
          setMyClassData(freshData);
          setMyClassLoading(false);
        } else {
          setMyClassData(null);
          setMyClassLoading(false);
        }
      } catch (e) { console.error(e); setMyClassLoading(false); }
      finally { setLoading(false); }
    };
    init();
  }, [loadCoordinatorClassData, navigate, reviewAccessVersion]);

  useEffect(() => {
    if (!mentorProfile?.id) return undefined;
    const channel = supabase.channel(`mentor-reviewer-access-${mentorProfile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviewer_access", filter: `mentor_id=eq.${mentorProfile.id}` },
        async () => { setReviewAccessVersion((value) => value + 1); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [mentorProfile?.id]);

  useEffect(() => {
    if (!mentorProfile?.id) return undefined;

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        loadNotifications();
      }
    };

    refreshIfVisible();
    const onVisibilityChange = () => {
      refreshIfVisible();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const timer = setInterval(() => {
      refreshIfVisible();
    }, 60000);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadNotifications, mentorProfile?.id]);

  useEffect(() => {
    if (!mentorProfile?.id) return undefined;
    const channel = supabase.channel(`mentor-notifications-${mentorProfile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${mentorProfile.id}` }, async () => {
        await loadNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadNotifications, mentorProfile?.id]);

  const coordinatorClassResolution = resolveCoordinatorClassId(mentorProfile, projects);
  const coordinatorClassId = coordinatorClassResolution.classId && coordinatorClassResolution.classId !== "__pending_section_resolution__"
    ? coordinatorClassResolution.classId
    : (myClassData?.classId || null);
  const isCoordinatorWithClass = Boolean(mentorProfile?.is_coordinator && coordinatorClassId);
  const canOpenEvaluationPanel = hasReviewAccess && allowedReviewStages.length > 0 && reviewProjects.length > 0;
  const isMyClassActive = MY_CLASS_TABS.includes(active);

  useEffect(() => {
    if (loading) return;
    if (!isCoordinatorWithClass && MY_CLASS_TABS.includes(active)) setActive("overview");
  }, [active, isCoordinatorWithClass, loading]);

  useEffect(() => {
    if (loading) return;
    if (!canOpenEvaluationPanel && active === "evaluation") setActive("overview");
  }, [active, canOpenEvaluationPanel, loading]);

  useEffect(() => {
    if (!mentorProfile?.is_coordinator || !coordinatorClassId || !isMyClassActive) return undefined;
    let refreshTimer = null;
    const refreshMyClassData = async () => {
      try { setMyClassData(await loadCoordinatorClassData(coordinatorClassId)); } catch (error) { console.error(error); }
    };
    const queueRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(async () => { await refreshMyClassData(); }, 700);
    };
    const channel = supabase.channel(`mentor-my-class-review-stages-${coordinatorClassId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "review_stages", filter: `class_id=eq.${coordinatorClassId}` }, async () => { queueRefresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: `class_id=eq.${coordinatorClassId}` }, async () => { queueRefresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, async () => { queueRefresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluations" }, async () => { queueRefresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "review_marks" }, async () => { queueRefresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, async () => { queueRefresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, async () => { queueRefresh(); })
      .subscribe();
    const onAdminDataUpdated = () => { queueRefresh(); };
    const onStorage = (event) => { if (event.key === ADMIN_DATA_SYNC_KEY) queueRefresh(); };
    window.addEventListener("admin-data-updated", onAdminDataUpdated);
    window.addEventListener("storage", onStorage);
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener("admin-data-updated", onAdminDataUpdated);
      window.removeEventListener("storage", onStorage);
      supabase.removeChannel(channel);
    };
  }, [coordinatorClassId, isMyClassActive, loadCoordinatorClassData, mentorProfile?.is_coordinator]);

  const handleMarkAllNotificationsRead = async () => {
    try {
      await apiRequest("/notifications/read-all", { method: "PUT" });
    } catch (error) {
      console.error("Failed to mark mentor notifications as read:", error);
    } finally {
      setNotifications((previous) => previous.map((notification) => ({ ...notification, read: true })));
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification?.id) return;
    let nextTab = "";
    try {
      if (!notification.read) {
        await apiRequest(`/notifications/${notification.id}/read`, { method: "PUT" });
      }
    } catch (error) {
      console.error("Failed to mark mentor notification as read:", error);
    } finally {
      setNotifications((previous) => previous.map((item) => (
        item.id === notification.id ? { ...item, read: true } : item
      )));
      setShowNotifications(false);
      setShowAllNotifications(false);

      if (["idea_submitted", "document_submitted", "document_resubmitted", "meeting_request", "guide_assignment", "guide_unassigned", "guide_role_assigned", "guide_role_removed"].includes(notification.type)) {
        nextTab = "teams";
      }
      if (!nextTab && ["reviewer_access_granted", "reviewer_access_updated", "reviewer_access_removed"].includes(notification.type)) {
        nextTab = canOpenEvaluationPanel ? "evaluation" : "overview";
      }
      if (!nextTab && ["coordinator_assignment", "coordinator_role_removed", "review_deadline_updated"].includes(notification.type)) {
        nextTab = isCoordinatorWithClass ? "my-class-overview" : "overview";
      }
    }

    if (nextTab) {
      setActive(nextTab);
    }
  };

  const handleSubmitReview = async ({ projectId, phase, score, feedback }) => {
    try {
      const data = await insertMentorEvaluation(mentorProfile?.id, {
        projectId, phase, score: Number(score), maxScore: 100, feedback,
      });
      setEvaluations(p => [data, ...p]);
      const proj = projects.find(p => p.id === projectId);
      setRecentActivity(prev => [
        { text: `Evaluation submitted for ${getProjectDisplayName(proj)} (${phase})`, time: "Just now" },
        ...prev.slice(0, 4),
      ]);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleSaveStudentDeadline = async (stageId, deadlineIso) => {
    if (!coordinatorClassId) throw new Error("No coordinator class assigned.");
    const targetStage = myClassData?.reviewStages?.find(s => s.id === stageId);
    if (!targetStage) throw new Error("Review stage not found.");
    if (deadlineIso !== null && targetStage.coordinator_deadline) {
      const studentDate = new Date(deadlineIso);
      const adminDate = new Date(targetStage.coordinator_deadline);
      if (!Number.isNaN(studentDate.getTime()) && !Number.isNaN(adminDate.getTime()) && studentDate >= adminDate)
        throw new Error("Student deadline must be earlier than admin evaluation deadline.");
    }
    const normalizedStageName = normalizeReviewStageName(targetStage.stage_name);
    const normalizedStageKey = String(normalizedStageName || "").trim().toLowerCase();
    const stageAliasMap = {
      idea: ["Idea", "idea", "Idea Approval", "idea approval"],
      abstract: ["Abstract", "abstract", "Abstract Submission", "abstract submission"],
      "zeroth review": ["Zeroth Review", "zeroth review", "0th Review", "0th review"],
      "first review": ["First Review", "first review", "1st Review", "1st review"],
      "second review": ["Second Review", "second review", "2nd Review", "2nd review"],
      "final review": ["Final Review", "final review"],
    };
    const candidateStageNames = Array.from(new Set([
      targetStage.stage_name,
      normalizedStageName,
      String(targetStage.stage_name || "").trim(),
      ...(stageAliasMap[normalizedStageKey] || []),
    ].filter(Boolean)));

    let updateError = null;
    for (const stageName of candidateStageNames) {
      const { error } = await supabase
        .from("review_stages")
        .update({ deadline: deadlineIso, student_deadline_set_by_coordinator: deadlineIso !== null })
        .eq("class_id", coordinatorClassId)
        .eq("stage_name", stageName);
      if (error) {
        updateError = error;
        break;
      }
    }

    if (!updateError) {
      const { error } = await supabase
        .from("review_stages")
        .update({ deadline: deadlineIso, student_deadline_set_by_coordinator: deadlineIso !== null })
        .eq("id", stageId)
        .eq("class_id", coordinatorClassId);
      updateError = error;
    }
    if (updateError) throw new Error(updateError.message || "Failed to update student deadline.");
    emitAdminDataUpdated();
    setMyClassData(await loadCoordinatorClassData(coordinatorClassId));
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/signin"); };

  return (
    <div className="flex h-[100dvh] bg-gray-50 overflow-hidden relative">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-gray-900/50 z-30 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)} />
      )}
      <Sidebar active={active} setActive={(k) => { setActive(k); setIsSidebarOpen(false); }} onSignOut={handleSignOut} showMyClass={isCoordinatorWithClass} showEvaluation={canOpenEvaluationPanel} isOpen={isSidebarOpen} />
      <div className="flex-1 min-w-0 md:ml-72 h-[100dvh] flex flex-col overflow-hidden">
        <div className="relative">
          <Topbar
            active={active}
            mentorName={mentorProfile?.full_name}
            notificationCount={notifications.filter((notification) => !notification.read).length}
            onNotificationClick={() => {
              setShowNotifications((value) => !value);
              setShowProfileMenu(false);
              setShowAllNotifications(false);
            }}
            showMyClass={isCoordinatorWithClass}
            onProfileClick={() => {
              setShowProfileMenu((value) => !value);
              setShowNotifications(false);
            }}
            onToggleSidebar={() => setIsSidebarOpen(true)}
            onNavigateHome={() => setActive("overview")}
          />
          {showNotifications && (
            <div className="fixed right-2 top-16 z-50 sm:right-6 md:right-8">
              <NotificationPanel
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
                notifications={notifications}
                onMarkAsRead={handleMarkAllNotificationsRead}
                onNotificationClick={handleNotificationClick}
                showAll={showAllNotifications}
                onToggleViewAll={() => setShowAllNotifications((value) => !value)}
              />
            </div>
          )}
          {showProfileMenu && (
            <div className="fixed top-14 right-2 sm:right-6 md:right-8 z-50">
              <ProfileMenu
                profile={mentorProfile}
                isOpen={showProfileMenu}
                onClose={() => setShowProfileMenu(false)}
                onLogout={handleSignOut}
                onEditProfile={() => { setShowProfileMenu(false); setShowProfileEditor(true); }}
                onHelpSupport={() => navigate("/mentor/help")}
                roleLabel="Mentor"
                roleIcon="school"
                infoItems={[
                  { label: "Full Name", value: mentorProfile?.full_name },
                  { label: "Email", value: mentorProfile?.email },
                  { label: "Role", value: "Mentor" },
                  { label: "Department", value: mentorProfile?.department || "-" },
                ]}
              />
            </div>
          )}
        </div>
        <main className="flex-1 overflow-y-auto p-8">
          {active === "overview" && (
            <OverviewTab projects={guideProjects} evaluations={evaluations} milestones={milestones}
              recentActivity={recentActivity} loading={loading} onNavigate={setActive}
              onSubmitReview={handleSubmitReview} showEvaluationPanel={canOpenEvaluationPanel}
              reviewProjects={reviewProjects} allowedReviewStages={allowedReviewStages}
              hasReviewAccess={hasReviewAccess} isCoordinatorWithClass={isCoordinatorWithClass}
              myClassData={myClassData} />
          )}
          {active === "teams" && (
            <TeamsTab projects={guideProjects} evaluations={evaluations} loading={loading}
              onStartReview={handleSubmitReview} mentorId={mentorProfile?.id} mentorName={mentorProfile?.full_name}
              onNavigateHome={() => setActive("overview")} />
          )}
          {active === "evaluation" && canOpenEvaluationPanel && (
            <EvaluationTab
              projects={reviewProjects}
              evaluations={evaluations}
              setEvaluations={setEvaluations}
              mentorId={mentorProfile?.id}
              loading={loading}
              allowedReviewStages={allowedReviewStages}
              writableReviewStages={writableReviewStages}
              reviewerAccessByClass={reviewerAccessByClass}
            />
          )}
          {["my-class-overview", "my-class-teams", "my-class-submissions", "my-class-reviews", "my-class-marks"].includes(active) && isCoordinatorWithClass && (
            <MyClass
              classData={myClassData}
              loading={myClassLoading}
              onSaveStudentDeadline={handleSaveStudentDeadline}
              onStudentImportComplete={async () => {
                if (!coordinatorClassId) return;
                setMyClassData(await loadCoordinatorClassData(coordinatorClassId));
              }}
              activeSubPage={active.replace("my-class-", "")}
              onNavigate={(sub) => setActive("my-class-" + sub)}
            />
          )}
        </main>
      </div>

      {showProfileEditor && mentorProfile && (
        <MentorProfileModal
          profile={mentorProfile}
          onClose={() => setShowProfileEditor(false)}
          onSave={(updated) => { setMentorProfile(updated); setShowProfileEditor(false); }}
          onSignOut={handleSignOut}
          startEditing
        />
      )}
    </div>
  );
}
