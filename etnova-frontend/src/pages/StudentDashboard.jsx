import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import ProfileMenu from "../components/ProfileMenu";
import NotificationPanel from "../components/NotificationPanel";
import CreateProjectModal from "../components/CreateProjectModal";
import JoinProjectModal from "../components/JoinProjectModal";
import ProfileSettingsModal from "../components/ProfileSettingsModal";
import ProjectTracker from "../components/ProjectTracker";
import supabase from "../config/supabaseClient";
import { apiRequest } from "../config/apiClient";
import { fetchStudentBootstrapData, invalidateStudentBootstrapCache } from "../services/studentData";
import { STUDENT_PAGE_ROUTE_BY_ID, STUDENT_QUICK_NAV_ITEMS } from "../constants/studentNavigation";
import { ADMIN_DATA_SYNC_KEY } from "../utils/adminLiveSync";
import {
  getWorkflowActionLabel,
  getWorkflowDestination,
  getWorkflowSnapshot,
  getWorkflowStageMeta,
  normalizeWorkflowStage,
} from "../constants/workflowConfig";

// Pure Helpers
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function fmtShort(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtRelative(d) {
  if (!d) return "-";
  const diff = Math.round((new Date() - new Date(d)) / 60000);
  if (diff < 2) return "just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`;
  if (diff < 10080) return `${Math.round(diff / 1440)}d ago`;
  return fmtShort(d);
}

function toDateKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isRejectedStatus(status) {
  return ["rejected", "needs_revision"].includes(String(status || "").toLowerCase());
}

function isProfileComplete(profile) {
  if (!profile) return false;
  return Boolean(
    profile.full_name &&
    profile.roll_number &&
    profile.semester &&
    profile.department &&
    profile.class_section
  );
}

function normalizeClassDeadlineRows(reviewStageRows = []) {
  const latestByStage = new Map();

  const pickPreferredDeadlineRow = (current, incoming) => {
    if (!current) return incoming;
    const currentUpdatedAt = new Date(current?.updated_at || current?.deadline || 0).getTime();
    const incomingUpdatedAt = new Date(incoming?.updated_at || incoming?.deadline || 0).getTime();
    if (incomingUpdatedAt !== currentUpdatedAt) {
      return incomingUpdatedAt > currentUpdatedAt ? incoming : current;
    }
    return String(incoming?.id || "") > String(current?.id || "") ? incoming : current;
  };

  (reviewStageRows || []).forEach((row) => {
    const stageKey = normalizeWorkflowStage(row.stage_name);
    latestByStage.set(stageKey, pickPreferredDeadlineRow(latestByStage.get(stageKey), row));
  });

  const reviewItems = Array.from(latestByStage.values()).map((row) => ({
    stageKey: normalizeWorkflowStage(row.stage_name),
    stage: getWorkflowStageMeta(row.stage_name).label,
    active: Boolean(row.student_deadline_set_by_coordinator) && !row.is_locked,
    deadline: row.deadline,
    date: toDateKey(row.deadline),
  }));
  return reviewItems
    .filter((row) => row.active && row.date && row.deadline)
    .sort((a, b) => new Date(a.deadline || a.date) - new Date(b.deadline || b.date));
}

async function resolveClassIdFromContext({ profile, project }) {
  const directClassId = profile?.class_id || project?.class_id || "";
  if (directClassId) return directClassId;

  const candidateSections = [
    profile?.class_section,
    profile?.batch,
    ...(Array.isArray(project?.team_members)
      ? project.team_members.flatMap((member) => [
        member?.profiles?.class_section,
        member?.profiles?.batch,
      ])
      : []),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (candidateSections.length === 0) return "";

  const { data, error } = await supabase
    .from("classes")
    .select("id, class_section")
    .in("class_section", [...new Set(candidateSections)]);

  if (error) {
    console.error("Failed to resolve class from section:", error);
    return "";
  }

  const bySection = new Map((data || []).map((row) => [String(row.class_section || "").trim().toLowerCase(), row.id]));
  return candidateSections
    .map((section) => bySection.get(section.toLowerCase()))
    .find(Boolean) || "";
}

// KPI Glass Card
function KPICard({ label, value, sub, icon, color }) {
  return (
    <div className="glass-card relative overflow-hidden p-5 flex flex-col gap-3">
      {/* gradient accent strip */}
      <div className="absolute top-0 left-0 right-0 h-[3px] glass-accent-bar rounded-t-2xl" />
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
        <div className="size-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <span className="material-symbols-outlined text-base" style={{ color }}>{icon}</span>
        </div>
      </div>
      <div>
        <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 font-medium mt-1.5 leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

// Activity Feed Item
function ActivityRow({ icon, text, time, color = "#00D2C4" }) {
  return (
    <div className="flex items-start gap-3.5 py-3 border-b border-slate-50 last:border-0">
      <div className="size-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: `${color}14` }}>
        <span className="material-symbols-outlined text-sm" style={{ color }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 leading-snug">{text}</p>
        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{time}</p>
      </div>
    </div>
  );
}

// Deadline Calendar
function DeadlineCalendar({ deadlines, onNavigateTab }) {
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [active, setActive] = useState(null); // date string key

  const firstDOW = new Date(view.y, view.m, 1).getDay();
  const totalDays = new Date(view.y, view.m + 1, 0).getDate();
  const monthLabel = new Date(view.y, view.m, 1)
    .toLocaleString("en-IN", { month: "long", year: "numeric" });

  const dlMap = useMemo(() => {
    const map = {};
    deadlines.forEach((dl) => {
      if (!map[dl.date]) map[dl.date] = [];
      map[dl.date].push(dl);
    });
    return map;
  }, [deadlines]);

  const legendDeadlines = useMemo(() => {
    const seen = new Set();
    return deadlines.filter((deadline) => {
      const key = `${deadline.stage}-${deadline.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [deadlines]);

  function key(day) {
    return `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const todayKey = today.toISOString().slice(0, 10);

  function prev() {
    setView(v => { const d = new Date(v.y, v.m - 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
    setActive(null);
  }
  function next() {
    setView(v => { const d = new Date(v.y, v.m + 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
    setActive(null);
  }

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prev} className="size-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-all">
          <span className="material-symbols-outlined text-sm">chevron_left</span>
        </button>
        <p className="text-xs font-black text-slate-800">{monthLabel}</p>
        <button onClick={next} className="size-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-all">
          <span className="material-symbols-outlined text-sm">chevron_right</span>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <p key={i} className="text-center text-[10px] font-bold text-slate-400">{d}</p>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: firstDOW }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: totalDays }).map((_, i) => {
          const day = i + 1;
          const k = key(day);
          const dayDeadlines = dlMap[k] || [];
          const primaryDeadline = dayDeadlines[0];
          const isToday = k === todayKey;
          const isPast = k < todayKey;
          const isActive = active === k;
          const hasDeadline = dayDeadlines.length > 0;

          return (
            <div key={day} className="relative flex flex-col items-center">
              <button
                type="button"
                onClick={() => hasDeadline && setActive(isActive ? null : k)}
                className={`size-7 rounded-lg text-[11px] font-bold flex items-center justify-center transition-all
                  ${isToday ? "bg-slate-900 text-white" :
                    hasDeadline ? "cursor-pointer hover:scale-105 font-black" :
                      "text-slate-500 hover:bg-slate-50"}`}
                style={hasDeadline ? {
                  backgroundColor: "rgba(0,210,196,0.15)",
                  color: isPast ? "#94a3b8" : "#00897B",
                  outline: isActive ? "2px solid #00D2C4" : "1.5px solid rgba(0,210,196,0.3)"
                } : {}}
              >
                {day}
              </button>
              {hasDeadline && <div className="mt-0.5 size-1 rounded-full" style={{ backgroundColor: isPast ? "#cbd5e1" : "#00D2C4" }} />}

              {/* Popover */}
              {isActive && hasDeadline && (
                <div className="absolute top-9 left-1/2 -translate-x-1/2 z-30 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-left space-y-2">
                  <div className="text-[10px] text-slate-500 font-semibold">Due {fmtShort(primaryDeadline?.deadline || primaryDeadline?.date)}</div>
                  {dayDeadlines.map((dl) => {
                    const stageKey = normalizeWorkflowStage(dl?.stageKey || dl?.stage);
                    const canNavigate = stageKey !== "team_formation";
                    const actionTab = canNavigate ? getWorkflowDestination(stageKey, "student") : null;
                    const actionLabel = canNavigate ? getWorkflowActionLabel(stageKey, "student") : "";
                    return (
                      <div key={`${dl.stage}-${dl.deadline || dl.date}`} className="rounded-lg border border-slate-100 p-2">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm" style={{ color: "#00D2C4" }}>event</span>
                          <p className="text-[11px] font-black text-slate-900">{dl.stage}</p>
                        </div>
                        {!isPast && (
                          <p className="text-[10px] font-bold mt-1" style={{ color: "#00897B" }}>
                            {daysUntil(dl.deadline || dl.date)} day{daysUntil(dl.deadline || dl.date) !== 1 ? "s" : ""} left
                          </p>
                        )}
                        {isPast && <p className="text-[10px] text-slate-400 mt-1">Deadline passed</p>}
                        {canNavigate ? (
                          <button
                            type="button"
                            onClick={() => {
                              onNavigateTab?.(actionTab);
                              setActive(null);
                            }}
                            className="mt-2 w-full py-1.5 rounded-lg text-[10px] font-black text-black transition-all hover:opacity-90"
                            style={{ backgroundColor: "#00D2C4" }}
                          >
                            {actionLabel}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-1">
        {legendDeadlines.map(dl => (
          <div key={`${dl.stage}-${dl.date}`} className="flex items-center gap-1">
            <div className="size-1.5 rounded-full" style={{ backgroundColor: "#00D2C4" }} />
            <span className="text-[10px] text-slate-400">{dl.stage}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// No-Project Onboarding
function Onboarding({ profile, onCreate, onJoin }) {
  return (
    <div className="px-4 sm:px-6 md:px-8 py-8 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-900">
          {getGreeting()}{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}👋!
        </h1>
        <p className="text-sm text-slate-500 mt-1">Get started by creating or joining a project team.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
        {[
          { icon: "add_circle", title: "Create a Project Team", sub: "Start your team now and refine the project idea later.", label: "Create Team", dark: false, action: onCreate },
          { icon: "group_add", title: "Join an Existing Team", sub: "Send a join request to a team that matches your interest.", label: "Browse Teams", dark: true, action: onJoin },
        ].map(c => (
          <div key={c.title} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="size-12 rounded-2xl flex items-center justify-center mb-5"
              style={{ backgroundColor: c.dark ? "#f1f5f9" : "rgba(0,210,196,0.12)" }}>
              <span className="material-symbols-outlined text-2xl"
                style={{ color: c.dark ? "#64748b" : "#00D2C4" }}>{c.icon}</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 mb-2">{c.title}</h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{c.sub}</p>
            <button onClick={c.action}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
              style={c.dark ? { backgroundColor: "#0f172a", color: "#fff" } : { backgroundColor: "#00D2C4", color: "#000" }}>
              {c.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Component
export default function StudentDashboard() {
  const navigate = useNavigate();
  const hasInitializedRef = useRef(false);
  const goToStudentTab = useCallback(
    (tab) => {
      navigate(STUDENT_PAGE_ROUTE_BY_ID[tab] || "/student/dashboard");
    },
    [navigate]
  );

  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [studentClassId, setStudentClassId] = useState("");

  // UI state
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiRequest("/notifications", { skipCache: true });
      setNotifications(data || []);
    } catch (e) {
      console.error("Failed to load notifications:", e);
    }
  }, []);

  const loadClassDeadlines = useCallback(async (classId) => {
    if (!classId) {
      setDeadlines([]);
      return;
    }

    const { data: reviewRows, error: deadlineError } = await supabase
      .from("review_stages")
      .select("id, class_id, stage_name, deadline, coordinator_deadline, is_locked, student_deadline_set_by_coordinator, stage_order, updated_at")
      .eq("class_id", classId)
      .order("stage_order", { ascending: true });

    if (deadlineError) throw new Error(deadlineError.message || "Failed to load review deadlines.");
    setDeadlines(normalizeClassDeadlineRows(reviewRows || []));
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { profile: p, projects: list, notifications: initialNotifications } =
        await fetchStudentBootstrapData({ includeNotifications: true });

      setProfile(p);
      setNotifications(initialNotifications);

      const proj = list?.[0] || null;
      let resolvedClassId = p?.class_id || "";
      if (!resolvedClassId && p?.id) {
        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("class_id, class_section, batch")
          .eq("id", p.id)
          .single();
        if (!profileError) {
          resolvedClassId = profileRow?.class_id || "";
          if (!resolvedClassId) {
            resolvedClassId = await resolveClassIdFromContext({
              profile: profileRow || p,
              project: proj,
            });
          }
        }
      }
      if (!resolvedClassId) {
        resolvedClassId = await resolveClassIdFromContext({ profile: p, project: proj });
      }
      setStudentClassId(resolvedClassId);
      await loadClassDeadlines(resolvedClassId);
      if (!proj?.id) {
        setProject(null);
        setDocuments([]);
        setEvaluations([]);
        return;
      }

      // /dashboard-data already returns projects with documents and evaluations.
      setProject(proj);
      setDocuments((proj.documents || []).sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at)));
      setEvaluations((proj.evaluations || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (e) {
      setError(e.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [loadClassDeadlines]);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!studentClassId) return undefined;

    const channel = supabase
      .channel(`student-deadlines-${studentClassId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "review_stages",
          filter: `class_id=eq.${studentClassId}`,
        },
        async () => {
          try {
            await loadClassDeadlines(studentClassId);
          } catch (refreshError) {
            console.error("Failed to refresh review deadlines:", refreshError);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadClassDeadlines, studentClassId]);

  useEffect(() => {
    if (!studentClassId) return undefined;

    const refreshDeadlines = async () => {
      try {
        await loadClassDeadlines(studentClassId);
      } catch (error) {
        console.error("Failed to sync deadlines from admin update:", error);
      }
    };

    const onAdminDataUpdated = () => {
      refreshDeadlines();
    };
    const onStorage = (event) => {
      if (event.key === ADMIN_DATA_SYNC_KEY) refreshDeadlines();
    };

    window.addEventListener("admin-data-updated", onAdminDataUpdated);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("admin-data-updated", onAdminDataUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, [loadClassDeadlines, studentClassId]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/signin"); };

  // Derived values
  const workflowSnapshot = useMemo(
    () => getWorkflowSnapshot({ project, documents, deadlines }),
    [deadlines, documents, project]
  );
  const currentStage = workflowSnapshot.label;
  const workflowStatusValue = workflowSnapshot.isCompleted
    ? "Completed"
    : currentStage === "Idea Approval"
      ? "Before Idea Approval"
      : "In Progress";
  const workflowStatusIcon = workflowSnapshot.isCompleted
    ? "task_alt"
    : currentStage === "Idea Approval"
      ? "pending"
      : "alt_route";
  const workflowStatusColor = workflowSnapshot.isCompleted
    ? "#10b981"
    : currentStage === "Idea Approval"
      ? "#f59e0b"
      : "#00D2C4";

  const nextDeadline = useMemo(() => {
    const now = new Date();
    return deadlines.find(d => new Date(d.deadline || d.date) >= now) || null;
  }, [deadlines]);

  const currentStageDeadline = useMemo(() => {
    if (workflowSnapshot.isCompleted) return null;
    const now = new Date();
    const currentStageKey = normalizeWorkflowStage(workflowSnapshot.key);
    return (
      deadlines.find((deadline) => (
        normalizeWorkflowStage(deadline.stageKey || deadline.stage) === currentStageKey
        && new Date(deadline.deadline || deadline.date) >= now
      )) || null
    );
  }, [deadlines, workflowSnapshot]);

  const daysLeft = nextDeadline ? daysUntil(nextDeadline.deadline || nextDeadline.date) : null;
  const currentStageActionTab = currentStageDeadline
    ? getWorkflowDestination(currentStageDeadline.stageKey, "student")
    : getWorkflowDestination(workflowSnapshot.key, "student");
  const currentStageActionLabel = currentStageDeadline
    ? getWorkflowActionLabel(currentStageDeadline.stageKey, "student")
    : getWorkflowActionLabel(workflowSnapshot.key, "student");
  const priorityDeadline = nextDeadline || currentStageDeadline;
  const priorityDeadlineDaysLeft = priorityDeadline
    ? daysUntil(priorityDeadline.deadline || priorityDeadline.date)
    : null;
  const priorityActionTab = priorityDeadline
    ? getWorkflowDestination(priorityDeadline.stageKey, "student")
    : currentStageActionTab;
  const priorityActionLabel = priorityDeadline
    ? getWorkflowActionLabel(priorityDeadline.stageKey, "student")
    : currentStageActionLabel;

  const activeMembers = project?.team_members?.length ?? 0;
  const profileComplete = useMemo(() => isProfileComplete(profile), [profile]);
  const normalizedSearch = searchTerm.trim().toLowerCase();

  useEffect(() => {
    if (!profile) return;
    if (!profileComplete) {
      setShowSettingsModal(true);
      setShowProfileMenu(false);
    }
  }, [profile, profileComplete]);

  useEffect(() => {
    if (!profile?.id) return undefined;

    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") return;
      loadNotifications();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadNotifications();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    const timer = setInterval(() => {
      refreshIfVisible();
    }, 60000);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [profile?.id, loadNotifications]);

  useEffect(() => {
    if (!project?.id) return undefined;

    const refreshDocuments = async () => {
      const { data, error: docsError } = await supabase
        .from("documents")
        .select("*")
        .eq("project_id", project.id)
        .order("uploaded_at", { ascending: false });

      if (docsError) {
        console.error("Failed to refresh project documents:", docsError);
        return;
      }

      setDocuments(data || []);
    };

    const channel = supabase
      .channel(`student-project-documents-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `project_id=eq.${project.id}`,
        },
        async () => {
          await refreshDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [project?.id]);

  const handleMarkAllNotificationsRead = async () => {
    try {
      await apiRequest("/notifications/read-all", { method: "PUT" });
    } catch (e) {
      console.error("Failed to mark all notifications as read:", e);
    } finally {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification?.id) return;
    try {
      if (!notification.read) {
        await apiRequest(`/notifications/${notification.id}/read`, { method: "PUT" });
      }
    } catch (e) {
      console.error("Failed to mark notification as read:", e);
    } finally {
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
      if (notification.type === "join_request") {
        localStorage.setItem("studentOpenJoinRequests", "1");
        setShowNotifications(false);
        setShowAllNotifications(false);
        goToStudentTab("team");
      }
    }
  };

  // Alert priority logic
  const alert = useMemo(() => {
    if (!project) return null;
    const revision = documents.find(d => isRejectedStatus(d.status));
    if (revision) return {
      icon: "warning", bg: "bg-amber-50", border: "border-amber-200",
      text: "text-amber-900", color: "#f59e0b",
      msg: `Revision required on "${revision.document_type?.replace(/_/g, " ")}" - mentor has requested changes.`,
    };
    if (!priorityDeadline) return null;
    if (priorityDeadlineDaysLeft !== null && priorityDeadlineDaysLeft === 0) return {
      icon: "alarm", bg: "bg-rose-50", border: "border-rose-200",
      text: "text-rose-800", color: "#f43f5e",
      msg: `${priorityDeadline.stage} is due TODAY for your class. Submit immediately.`,
    };
    if (priorityDeadlineDaysLeft !== null && priorityDeadlineDaysLeft <= 5) return {
      icon: "schedule", bg: "bg-orange-50", border: "border-orange-200",
      text: "text-orange-800", color: "#f97316",
      msg: `${priorityDeadline.stage} submission is due in ${priorityDeadlineDaysLeft} day${priorityDeadlineDaysLeft !== 1 ? "s" : ""} for your class.`,
    };
    return null;
  }, [documents, priorityDeadline, priorityDeadlineDaysLeft, project]);

  // Activity feed
  const activityFeed = useMemo(() => {
    const items = [];
    documents.slice(0, 4).forEach(doc => {
      const label = doc.document_type?.replace(/_/g, " ") ?? "document";
      items.push({ id: `d${doc.id}`, icon: "upload_file", text: `${label} submitted`, time: fmtRelative(doc.uploaded_at), color: "#00D2C4" });
      if (doc.status === "approved") items.push({ id: `da${doc.id}`, icon: "verified", text: `${label} approved by mentor`, time: fmtRelative(doc.uploaded_at), color: "#10b981" });
      if (isRejectedStatus(doc.status)) items.push({ id: `dr${doc.id}`, icon: "edit_note", text: `Revision requested for ${label}`, time: fmtRelative(doc.uploaded_at), color: "#f59e0b" });
    });
    if (activeMembers > 1)
      items.push({ id: "team", icon: "group", text: `Team formed (${activeMembers} members)`, time: fmtRelative(project?.created_at), color: "#8b5cf6" });
    return items.slice(0, 7);
  }, [documents, activeMembers, project]);

  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [];

    const pageResults = STUDENT_QUICK_NAV_ITEMS
      .filter((item) => `${item.label} ${item.id}`.toLowerCase().includes(normalizedSearch))
      .map((item) => ({
        id: `page-${item.id}`,
        icon: item.icon,
        label: item.label,
        meta: "Open page",
        action: () => goToStudentTab(item.id),
      }));

    const deadlineResults = deadlines
      .filter((deadline) => `${deadline.stage} ${deadline.date}`.toLowerCase().includes(normalizedSearch))
      .map((deadline) => ({
        id: `deadline-${deadline.stage}`,
        icon: "event",
        label: `${deadline.stage} deadline`,
        meta: `Due ${fmtShort(deadline.date)} - ${getWorkflowActionLabel(deadline.stageKey, "student")}`,
        action: () => goToStudentTab(getWorkflowDestination(deadline.stageKey, "student")),
      }));

    const activityResults = activityFeed
      .filter((item) => `${item.text} ${item.time}`.toLowerCase().includes(normalizedSearch))
      .map((item) => ({
        id: `activity-${item.id}`,
        icon: item.icon,
        label: item.text,
        meta: `Recent activity - ${item.time}`,
        action: () => {
          if (item.text.toLowerCase().includes("marks")) return goToStudentTab("marks");
          if (item.text.toLowerCase().includes("team")) return goToStudentTab("team");
          return goToStudentTab("submissions");
        },
      }));

    return [...pageResults, ...deadlineResults, ...activityResults].slice(0, 8);
  }, [normalizedSearch, activityFeed, deadlines, goToStudentTab]);

  const handleSearchSubmit = useCallback((rawQuery) => {
    const query = (rawQuery || "").trim().toLowerCase();
    if (!query) return;
    if (searchResults.length > 0) {
      searchResults[0].action?.();
      setSearchTerm("");
    }
  }, [searchResults]);

  const handleSearchResultSelect = useCallback((result) => {
    result?.action?.();
    setSearchTerm("");
  }, []);

  // Loading screen
  if (loading) return (
    <div className="min-h-full etnova-bg flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block size-10 border-4 border-slate-200 border-t-[#00D2C4] rounded-full animate-spin" />
        <p className="mt-4 text-sm text-slate-500 font-medium">Loading your dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-full etnova-bg">

      {/* TopBar */}
      <div className="relative">
        <TopBar
          title="Dashboard"
          subtitle="Home"
          onSubtitleClick={() => navigate("/student/dashboard")}
          profile={profile}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          onSearchSubmit={handleSearchSubmit}
          searchResults={searchResults}
          onSearchResultSelect={handleSearchResultSelect}
          searchPlaceholder="Search pages, updates, deadlines..."
          onProfileClick={() => {
            if (!profileComplete) {
              setShowSettingsModal(true);
              setShowProfileMenu(false);
              return;
            }
            setShowProfileMenu(v => !v);
            setShowNotifications(false);
          }}
          notificationCount={notifications.filter(n => !n.read).length}
          onNotificationClick={() => {
            setShowNotifications(v => !v);
            setShowProfileMenu(false);
            setShowAllNotifications(false);
          }}
        />
        {showNotifications && (
          <div className="absolute right-2 sm:right-6 md:right-24 top-full z-50">
            <NotificationPanel
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
              notifications={notifications}
              onMarkAsRead={handleMarkAllNotificationsRead}
              onNotificationClick={handleNotificationClick}
              showAll={showAllNotifications}
              onToggleViewAll={() => setShowAllNotifications((v) => !v)}
            />
          </div>
        )}
      </div>

      {showProfileMenu && (
        <div className="fixed top-14 right-2 sm:right-6 md:right-8 z-50">
          <ProfileMenu profile={profile} isOpen={showProfileMenu}
            onClose={() => setShowProfileMenu(false)} onLogout={handleLogout}
            onEditProfile={() => { setShowProfileMenu(false); setShowSettingsModal(true); }}
            onHelpSupport={() => navigate("/student/help")} />
        </div>
      )}

      <ProfileSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        profile={profile}
        onSuccess={async () => {
          invalidateStudentBootstrapCache();
          await loadData();
        }}
        requireCompletion={!profileComplete}
      />
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        leaderName={profile?.full_name}
        onSuccess={async () => {
          invalidateStudentBootstrapCache();
          await loadData();
        }}
      />
      <JoinProjectModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSuccess={async () => {
          invalidateStudentBootstrapCache();
          await loadData();
        }}
      />

      {error && (
        <div className="mx-6 md:mx-8 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>{error}
        </div>
      )}

      {/* No Project - Onboarding */}
      {!loading && profile && !profileComplete && (
        <div className="px-4 sm:px-6 md:px-8 py-8 sm:py-10">
          <div className="max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-sm p-7">
            <h2 className="text-2xl font-black text-slate-900">Complete Your Profile</h2>
            <p className="text-sm text-slate-500 mt-2">
              Please complete your academic profile first. After that, you can create or join a team.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5 text-sm">
              <p className="text-slate-700">- Full Name</p>
              <p className="text-slate-700">- Roll Number</p>
              <p className="text-slate-700">- Semester</p>
              <p className="text-slate-700">- Department</p>
              <p className="text-slate-700">- Section</p>
            </div>
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="mt-6 px-5 py-3 rounded-xl text-black font-bold text-sm hover:opacity-90 transition-all"
              style={{ backgroundColor: "#00D2C4" }}
            >
              Complete Profile
            </button>
          </div>
        </div>
      )}

      {profileComplete && !project && !loading && (
        <Onboarding
          profile={profile}
          onCreate={() => setShowCreateModal(true)}
          onJoin={() => setShowJoinModal(true)}
        />
      )}

      {/* Main Dashboard */}
      {profileComplete && project && (
        <div className="px-4 sm:px-6 md:px-8 py-6 space-y-5 max-w-[1400px] mx-auto">

          {/* Section 1: Smart Context Header */}
          <div className="px-2 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

            {/* Left */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-black text-slate-900 leading-tight">
                {getGreeting()},&nbsp;
                <span style={{ color: "#00897B" }}>
                  {profile?.full_name?.split(" ")[0] || "Student"}
                </span>
                &nbsp;👋!
              </h1>

              <p className="text-base text-slate-500 mt-2 leading-relaxed max-w-xl">
                Your team is currently in the{" "}
                <span className="font-black text-slate-800">{currentStage}</span> step.
              </p>

              {/* Project title pill */}
              <div className="mt-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 text-slate-600 bg-slate-50">
                  <span className="material-symbols-outlined text-xs">folder_open</span>
                  {project?.team_name || project?.title || "Untitled Team"}
                </span>
              </div>
            </div>

            {/* Right: Date block */}
            <div className="flex-shrink-0 hidden sm:flex flex-col items-end gap-1 text-right">
              <div className="size-12 rounded-2xl flex items-center justify-center mb-1"
                style={{ backgroundColor: "rgba(0,210,196,0.1)" }}>
                <span className="material-symbols-outlined text-2xl" style={{ color: "#00D2C4" }}>today</span>
              </div>
              <p className="text-lg font-black text-slate-900">
                {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
              <p className="text-xs text-slate-400 font-medium">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric" })}
              </p>
            </div>

          </div>

          {/* Section 2: KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard label="Current Step" value={currentStage} sub="Shared workflow stage" icon="layers" color="#00D2C4" />
            <KPICard label="Next Deadline" value={daysLeft !== null ? `${daysLeft}d` : "-"} sub={nextDeadline ? `Until ${nextDeadline.stage}` : "No active deadline"} icon="schedule" color="#6366f1" />
            <KPICard label="Team Capacity" value={`${activeMembers}/4`} sub={activeMembers >= 4 ? "Full team" : `${4 - activeMembers} slot${4 - activeMembers !== 1 ? "s" : ""} remaining`} icon="group" color="#10b981" />
            <KPICard label="Workflow Status" value={workflowStatusValue} sub={workflowSnapshot.isCompleted ? "All review stages completed" : workflowSnapshot.description} icon={workflowStatusIcon} color={workflowStatusColor} />
          </div>

          {/* Section 3: Priority Alert Banner */}
          {alert && (
            <div className="relative overflow-hidden rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4"
              style={{
                background: `linear-gradient(135deg, ${alert.color}12 0%, ${alert.color}06 100%)`,
                border: `1px solid ${alert.color}30`,
                boxShadow: `0 2px 16px ${alert.color}14`,
              }}>
              {/* Left accent stripe */}
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: alert.color }} />

              {/* Icon with pulse ring */}
              <div className="relative flex-shrink-0 ml-2">
                <div className="size-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${alert.color}18`, border: `1px solid ${alert.color}25` }}>
                  <span className="material-symbols-outlined" style={{ color: alert.color }}>{alert.icon}</span>
                </div>
                <span className="absolute inset-0 rounded-xl animate-ping opacity-20"
                  style={{ backgroundColor: alert.color }} />
              </div>

              {/* Message */}
              <p className={`flex-1 text-sm font-semibold ${alert.text}`}>{alert.msg}</p>

              {/* CTA button */}
              <button type="button" onClick={() => goToStudentTab(priorityActionTab)}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-black transition-all hover:opacity-90 hover:scale-[1.03] active:scale-95 whitespace-nowrap"
                style={{ backgroundColor: alert.color, boxShadow: `0 3px 10px ${alert.color}40` }}>
                {priorityActionLabel}
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          )}


          {/* Section 4: Project Tracker */}
          <ProjectTracker
            project={project}
            documents={documents}
            deadlines={deadlines}
            evaluations={evaluations}
            currentStageKey={workflowSnapshot.key}
          />

          {/* Section 5: Activity Feed + Workflow Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Left: Recent Activity */}
            <div className="glass-card-strong lg:col-span-3 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-white/70 flex items-center gap-2.5">
                <div className="size-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(0,210,196,0.12)" }}>
                  <span className="material-symbols-outlined text-sm" style={{ color: "#00D2C4" }}>history</span>
                </div>
                <h2 className="text-sm font-black text-slate-900">Recent Activity</h2>
                <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-100/70 px-2 py-0.5 rounded-full">
                  {activityFeed.length} events
                </span>
              </div>
              <div className="px-5 pb-2">
                {activityFeed.length === 0 ? (
                  <div className="text-center py-10">
                    <span className="material-symbols-outlined text-3xl text-slate-200 block mb-2">timeline</span>
                    <p className="text-sm text-slate-400">No activity yet. Submit a document to get started.</p>
                  </div>
                ) : activityFeed.map(item => (
                  <ActivityRow key={item.id} {...item} />
                ))}
              </div>
            </div>

            {/* Right: Workflow Calendar */}
            <div className="glass-card-strong lg:col-span-2 overflow-visible">
              <div className="px-4 sm:px-6 py-4 border-b border-white/70 flex items-center gap-2.5">
                <div className="size-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(0,210,196,0.12)" }}>
                  <span className="material-symbols-outlined text-sm" style={{ color: "#00D2C4" }}>calendar_month</span>
                </div>
                <h2 className="text-sm font-black text-slate-900">Workflow Calendar</h2>
                <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Read-only</span>
              </div>
              <div className="p-5">
                <DeadlineCalendar deadlines={deadlines} onNavigateTab={goToStudentTab} />
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

