import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../config/supabaseClient";
import Sidebar from "../components/admin/Sidebar";
import TopNavbar from "../components/admin/TopNavbar";
import StatCard from "../components/admin/StatCard";
import SectionCard from "../components/admin/SectionCard";
import PublishPanel from "../components/admin/PublishPanel";
import AcademicActivityPanel from "../components/admin/AcademicActivityPanel";
import AdminProfileSettingsModal from "../components/admin/AdminProfileSettingsModal";

const ADMIN_NAME = "Meenakshi";
const KPI_DATA = [
  { title: "Total Projects", value: "0", hint: "CSE S6 Mini Project", borderClass: "border-t-teal-500", icon: "teams" },
  { title: "Total Guides", value: "41", hint: "Department mentors active", borderClass: "border-t-sky-500", icon: "guides" },
  { title: "Results Published", value: "Not Yet", hint: "Awaiting final approval", borderClass: "border-t-rose-500", icon: "published" },
];
const STAGE_ORDER = ["Idea", "Abstract", "Zeroth Review", "First Review", "Second Review", "Final Review"];

function normalizeStageName(stageName) {
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

function stageOrderIndex(stageName) {
  const normalized = normalizeStageName(stageName).toLowerCase();
  const idx = STAGE_ORDER.findIndex((name) => name.toLowerCase() === normalized);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function normalizeStageStatus(row) {
  if (row?.is_locked) return "Locked";
  if (row?.is_completed) return "Completed";
  if (row?.is_active) return "Active";
  return "Inactive";
}

function formatStageLabel(stageName) {
  if (stageName === "Zeroth Review") return "0th Review";
  if (stageName === "First Review") return "1st Review";
  if (stageName === "Second Review") return "2nd Review";
  if (stageName === "Final Review") return "Final";
  return stageName;
}

function formatStageSubline(stage) {
  if (!stage?.deadline) return "Pending";
  const date = new Date(stage.deadline);
  if (Number.isNaN(date.getTime())) return "Pending";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate("/signin");
    }
  };

  const handleNavigate = (itemId) => {
    if (itemId === "dashboard") {
      navigate("/admin");
      return;
    }
    if (itemId === "guide-allocation") {
      navigate("/admin/guide-allocation");
      return;
    }
    if (itemId === "mentor-management") {
      navigate("/admin/mentor-management");
      return;
    }
    if (itemId === "review-management") {
      navigate("/admin/review-management");
    }
  };

  const [projects, setProjects] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [reviewStages, setReviewStages] = useState([]);
  const [reviewClasses, setReviewClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [selectedClassName, setSelectedClassName] = useState("S6 CSE A");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [adminProfile, setAdminProfile] = useState({
    full_name: "",
    department: "",
  });

  const fetchAdminProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setAdminProfile({ full_name: "", department: "" });
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, department")
      .eq("id", user.id)
      .eq("role", "admin")
      .single();

    if (error || !data) {
      setAdminProfile({ full_name: "", department: "" });
      return;
    }

    setAdminProfile({
      full_name: data.full_name || "",
      department: data.department || "",
    });
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsRes, mentorsRes] = await Promise.all([
        supabase.from("projects").select("id, title, guide_id, status"),
        supabase.from("profiles").select("id, full_name, role").eq("role", "mentor"),
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (mentorsRes.error) throw mentorsRes.error;

      setProjects(projectsRes.data || []);
      setMentors(mentorsRes.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReviewStages = useCallback(async (classNameOverride = "") => {
    const { data: classRows, error: classError } = await supabase
      .from("classes")
      .select("id, class_name")
      .order("class_name", { ascending: true });

    if (classError) throw classError;

    const classes = classRows || [];
    setReviewClasses(classes);

    const targetClassName = classNameOverride || selectedClassName;
    const currentClass = classes.find((item) => item.class_name === targetClassName) || classes[0] || null;
    if (!currentClass?.id) {
      setSelectedClassId("");
      setSelectedClassName("");
      setReviewStages([]);
      return;
    }

    setSelectedClassName(currentClass.class_name || "S6 CSE A");
    setSelectedClassId(currentClass.id);

    const { data: stageRows, error: stageError } = await supabase
      .from("review_stages")
      .select("id, stage_name, deadline, is_active, is_completed, is_locked")
      .eq("class_id", currentClass.id);

    if (stageError) throw stageError;

    const mapped = [...(stageRows || [])]
      .sort((a, b) => {
        const byOrder = stageOrderIndex(a.stage_name) - stageOrderIndex(b.stage_name);
        if (byOrder !== 0) return byOrder;
        return String(a.stage_name || "").localeCompare(String(b.stage_name || ""));
      })
      .map((row) => ({
        id: row.id,
        name: normalizeStageName(row.stage_name),
        deadline: row.deadline || null,
        status: normalizeStageStatus(row),
      }));

    setReviewStages(mapped);
  }, [selectedClassName]);

  useEffect(() => {
    const run = async () => {
      await fetchDashboardData();
      await fetchReviewStages();
    };

    run();
    fetchAdminProfile();

    const channel = supabase
      .channel("dashboard-projects-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, fetchDashboardData)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchDashboardData)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "review_stages" },
        async (payload) => {
          const changedClassId = payload.new?.class_id || payload.old?.class_id || "";
          if (!selectedClassId || !changedClassId || changedClassId === selectedClassId) {
            await fetchReviewStages();
          }
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "classes" }, fetchReviewStages)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAdminProfile, fetchDashboardData, fetchReviewStages, selectedClassId]);

  const teams = useMemo(() => {
    const activeReviewStage = reviewStages.find((stage) => stage.status === "Active")?.name || "-";
    return projects.map((project) => {
      const guide = mentors.find((mentor) => mentor.id === project.guide_id);
      const status = String(project.status || "").toLowerCase();
      const submissionStatus = status.includes("submit") || status.includes("approve")
        ? "Submitted"
        : status.includes("late")
          ? "Late"
          : "Pending";
      return {
        id: project.id,
        name: project.title || "Untitled Project",
        class: "All Projects",
        stage: activeReviewStage,
        submissionStatus,
        guide: guide?.full_name || null,
      };
    });
  }, [mentors, projects, reviewStages]);

  const activeReviewStage = useMemo(
    () => reviewStages.find((stage) => stage.status === "Active")?.name || "-",
    [reviewStages]
  );

  const assignedProjects = useMemo(
    () => projects.filter((project) => Boolean(project.guide_id)).length,
    [projects]
  );

  const unassignedProjects = useMemo(
    () => projects.filter((project) => !project.guide_id).length,
    [projects]
  );

  const unassignedProjectRows = useMemo(
    () => projects.filter((project) => !project.guide_id),
    [projects]
  );

  const fullyOccupiedMentors = useMemo(
    () =>
      mentors.filter(
        (mentor) => projects.filter((project) => project.guide_id === mentor.id).length >= 2
      ).length,
    [mentors, projects]
  );

  const dashboardKpis = useMemo(
    () =>
      KPI_DATA.map((item) =>
        item.title === "Active Review Stage"
          ? { ...item, value: activeReviewStage }
          : item.title === "Total Projects"
            ? { ...item, value: String(projects.length), hint: `${assignedProjects} assigned, ${unassignedProjects} unassigned` }
            : item.title === "Total Guides"
              ? {
                ...item,
                value: String(mentors.length),
                hint: `${fullyOccupiedMentors} fully occupied`,
              }
              : item
      ),
    [activeReviewStage, assignedProjects, fullyOccupiedMentors, mentors.length, projects.length, unassignedProjects]
  );

  const orderedReviewStages = useMemo(() => {
    const byName = new Map(reviewStages.map((stage) => [normalizeStageName(stage.name), stage]));
    return STAGE_ORDER.map((name, index) => {
      const liveStage = byName.get(name);
      return liveStage || {
        id: `dashboard-stage-${index}`,
        name,
        deadline: null,
        status: "Inactive",
      };
    });
  }, [reviewStages]);

  const completedCount = useMemo(
    () => orderedReviewStages.filter((stage) => stage.status === "Completed").length,
    [orderedReviewStages]
  );

  const progressPercent = useMemo(() => {
    if (!orderedReviewStages.length) return 0;
    return Math.round((completedCount / orderedReviewStages.length) * 100);
  }, [completedCount, orderedReviewStages.length]);

  const adminName = adminProfile.full_name || ADMIN_NAME;
  const adminDepartment = adminProfile.department || "CSE";

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar activeItem="dashboard" onSignOut={handleSignOut} onNavigate={handleNavigate} />

      <main className="lg:ml-72 min-h-screen">
        <TopNavbar
          adminName={adminName}
          academicYearLabel="2026 - S6 Mini Project"
          pageTitle="Admin Dashboard"
          onProfileClick={() => setShowProfileSettings(true)}
        />

        <div className="p-4 md:p-6 lg:p-8 space-y-6">
          <section className="rounded-xl shadow-md bg-gradient-to-r from-teal-600 to-teal-500 text-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Good Evening, Dr. {adminName}</h1>
              <p className="text-teal-50 mt-1 text-sm">{adminDepartment} Department - Project Evaluation Control Panel</p>
            </div>
            <div className="text-sm sm:text-right text-teal-50">
              <p className="font-semibold text-white">Today</p>
              <p>{today}</p>
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {dashboardKpis.map((item) => <StatCard key={item.title} {...item} />)}
          </section>

          {loading ? <p className="text-sm text-gray-500">Loading live dashboard data...</p> : null}

          <SectionCard
            title="Unassigned Projects"
            action={(
              <button
                type="button"
                onClick={() => navigate("/admin/guide-allocation")}
                className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal-700 transition-colors"
              >
                Allocate Guide
              </button>
            )}
          >
            {unassignedProjectRows.length > 0 ? (
              <div className="space-y-3">
                {unassignedProjectRows.slice(0, 5).map((project) => (
                  <div key={project.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                    <p className="text-sm font-medium text-gray-800 truncate pr-3">{project.title || "Untitled Project"}</p>
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                      Unassigned
                    </span>
                  </div>
                ))}
                {unassignedProjectRows.length > 5 ? (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => navigate("/admin/guide-allocation")}
                      className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                    >
                      View More
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-gray-600">All projects have been allocated a guide.</p>
            )}
          </SectionCard>

          <SectionCard title="Review Stage Progress">
            <div className="space-y-6">
              <div className="flex items-center justify-end gap-3">
                <select
                  value={selectedClassName}
                  onChange={async (event) => {
                    const nextClass = event.target.value;
                    setSelectedClassName(nextClass);
                    await fetchReviewStages(nextClass);
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40 min-w-[170px]"
                >
                  {reviewClasses.map((classItem) => (
                    <option key={classItem.id} value={classItem.class_name}>
                      {classItem.class_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/review-management?class=${encodeURIComponent(selectedClassName || "")}`)}
                  className="px-4 py-1.5 rounded-lg bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors"
                >
                  {activeReviewStage === "-" ? "Open Review" : formatStageLabel(activeReviewStage)}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {orderedReviewStages.map((stage, index) => {
                  const isCompleted = stage.status === "Completed";
                  const isActive = stage.status === "Active";
                  const isLocked = stage.status === "Locked";
                  const dotClass = isCompleted || isActive
                    ? "bg-teal-500 border-teal-500 text-white"
                    : isLocked
                      ? "bg-rose-50 border-rose-200 text-rose-600"
                      : "bg-gray-50 border-gray-200 text-gray-500";
                  return (
                    <button
                      key={stage.id || `${stage.name}-${index}`}
                      type="button"
                      onClick={() => navigate(`/admin/review-management?class=${encodeURIComponent(selectedClassName || "")}`)}
                      className="text-left rounded-xl border border-gray-200 p-3 hover:border-teal-300 hover:bg-teal-50/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex w-8 h-8 items-center justify-center rounded-full border text-sm font-semibold ${dotClass}`}>
                          {isCompleted ? "✓" : index + 1}
                        </span>
                        <span className="text-sm font-semibold text-gray-800">{formatStageLabel(stage.name)}</span>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">{formatStageSubline(stage)}</p>
                      <p className="text-xs mt-1 text-gray-600">{stage.status === "Inactive" ? "Pending" : stage.status}</p>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <p className="font-semibold text-gray-700">Overall Progress</p>
                  <p>{progressPercent}%</p>
                </div>
                <p className="text-sm text-gray-500 mt-1">{`${completedCount} of ${orderedReviewStages.length} completed`}</p>
                <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>
          </SectionCard>

          <PublishPanel verificationStatus="All review sheets verified by HOD panel" />

        </div>
      </main>

      <AcademicActivityPanel reviewStages={reviewStages} teams={teams} />
      <AdminProfileSettingsModal
        isOpen={showProfileSettings}
        onClose={() => setShowProfileSettings(false)}
        onSuccess={fetchAdminProfile}
      />
    </div>
  );
}

