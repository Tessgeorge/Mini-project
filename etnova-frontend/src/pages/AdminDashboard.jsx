import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../config/supabaseClient";
import AppFrame from "../components/AppFrame";
import Sidebar from "../components/admin/Sidebar";
import TopNavbar from "../components/admin/TopNavbar";
import StatCard from "../components/admin/StatCard";
import SectionCard from "../components/admin/SectionCard";
import PublishPanel from "../components/admin/PublishPanel";
import AdminProfileSettingsModal from "../components/admin/AdminProfileSettingsModal";
import ProfileMenu from "../components/ProfileMenu";

const ADMIN_NAME = "Meenakshi";
const KPI_DATA = [
  { title: "Total Projects", value: "0", hint: "CSE S6 Mini Project", borderClass: "border-t-teal-500", icon: "teams" },
  { title: "Total Guides", value: "41", hint: "Department mentors active", borderClass: "border-t-sky-500", icon: "guides" },
  { title: "Results Published", value: "Not Yet", hint: "Awaiting final approval", borderClass: "border-t-rose-500", icon: "published" },
];
const STAGE_ORDER = ["Idea", "Abstract", "Zeroth Review", "First Review", "Second Review", "Final Review"];

function getClassLabel(classRow) {
  return String(classRow?.class_section || classRow?.class_name || classRow?.id || "").trim();
}

function normalizeClassRows(rows = []) {
  return rows.map((item) => ({
    ...item,
    label: getClassLabel(item),
  }));
}

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

function formatTimelineStageLabel(stageName) {
  if (stageName === "Idea") return "Idea Approval";
  if (stageName === "Abstract") return "Abstract Submission";
  if (stageName === "Zeroth Review") return "Zeroth Review";
  if (stageName === "First Review") return "First Review";
  if (stageName === "Second Review") return "Second Review";
  if (stageName === "Final Review") return "Final Review";
  return stageName;
}

function formatStageSubline(stage) {
  if (!stage?.deadline) return "Pending";
  const date = new Date(stage.deadline);
  if (Number.isNaN(date.getTime())) return "Pending";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function normalizeClassRef(value) {
  return String(value || "").trim().toLowerCase();
}

function hasDeadlinePassed(deadline) {
  if (!deadline) return false;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
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
      return;
    }
    if (itemId === "rubrics-management") {
      navigate("/admin/rubrics");
    }
  };

  const [projects, setProjects] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [reviewStages, setReviewStages] = useState([]);
  const [reviewClasses, setReviewClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [selectedClassName, setSelectedClassName] = useState("S6 CSE A");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [dashboardClasses, setDashboardClasses] = useState([]);
  const [classActiveStageMap, setClassActiveStageMap] = useState({});
  const [adminProfile, setAdminProfile] = useState({
    full_name: "",
    email: "",
    department: "",
  });

  const fetchAdminProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setAdminProfile({ full_name: "", email: "", department: "" });
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, email, department")
      .eq("id", user.id)
      .eq("role", "admin")
      .single();

    if (error || !data) {
      setAdminProfile({ full_name: "", email: "", department: "" });
      return;
    }

    setAdminProfile({
      full_name: data.full_name || "",
      email: data.email || "",
      department: data.department || "",
    });
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsRes, mentorsRes, classesRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, title, guide_id, status, class_id, team_members(id, student_id, profiles:student_id(class_section))"),
        supabase.from("profiles").select("id, full_name, role").eq("role", "mentor"),
        supabase.from("classes").select("id, class_section, department"),
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (mentorsRes.error) throw mentorsRes.error;
      if (classesRes.error) throw classesRes.error;

      setProjects(projectsRes.data || []);
      setMentors(mentorsRes.data || []);
      setDashboardClasses((classesRes.data || []).map((item) => ({
        ...item,
        label: getClassLabel(item),
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReviewStages = useCallback(async (classNameOverride = "", classIdOverride = "") => {
    const { data: classRows, error: classError } = await supabase
      .from("classes")
      .select("id, class_section, department")
      .order("class_section", { ascending: true, nullsFirst: false });

    if (classError) throw classError;

    const classes = classRows || [];

    const normalizedClasses = normalizeClassRows(classes);

    const normalizedTargetClass = normalizeClassRef(classNameOverride || selectedClassName);
    const normalizedTargetId = normalizeClassRef(classIdOverride || selectedClassId);
    const currentClass = normalizedClasses.find((item) => normalizeClassRef(item.id) === normalizedTargetId)
      || normalizedClasses.find((item) => normalizeClassRef(item.label) === normalizedTargetClass)
      || normalizedClasses[0]
      || null;
    if (!currentClass?.id) {
      setSelectedClassId("");
      setSelectedClassName("");
      setReviewStages([]);
      setClassActiveStageMap({});
      return;
    }

    setReviewClasses(normalizedClasses);
    setSelectedClassName(currentClass.label || "S6 CSE A");
    setSelectedClassId(currentClass.id);

    const { data: stageRows, error: stageError } = await supabase
      .from("review_stages")
      .select("id, stage_name, coordinator_deadline, is_active, is_completed, is_locked")
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
        deadline: row.coordinator_deadline || null,
        status: normalizeStageStatus(row),
        rawStatus: normalizeStageStatus(row),
      }));

    setReviewStages(mapped);

    const { data: allStageRows, error: allStageError } = await supabase
      .from("review_stages")
      .select("class_id, stage_name, is_active");

    if (allStageError) throw allStageError;

    const classNameById = new Map(normalizedClasses.map((item) => [item.id, item.label]));
    const activeMap = {};
    (allStageRows || []).forEach((row) => {
      if (!row?.is_active) return;
      const className = classNameById.get(row.class_id);
      if (!className) return;
      activeMap[className] = normalizeStageName(row.stage_name);
    });
    setClassActiveStageMap(activeMap);
  }, [selectedClassId, selectedClassName]);

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
        async () => {
          await Promise.all([fetchDashboardData(), fetchReviewStages()]);
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "classes" }, async () => {
        await Promise.all([fetchDashboardData(), fetchReviewStages()]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAdminProfile, fetchDashboardData, fetchReviewStages, selectedClassId]);

  const teams = useMemo(() => {
    const classNameById = new Map(dashboardClasses.map((item) => [item.id, item.label || getClassLabel(item)]));
    return projects.map((project) => {
      const guide = mentors.find((mentor) => mentor.id === project.guide_id);
      const status = String(project.status || "").toLowerCase();
      const submissionStatus = status.includes("submit") || status.includes("approve")
        ? "Submitted"
        : status.includes("late")
          ? "Late"
          : "Pending";
      const fallbackClass = project.team_members
        ?.map((member) => member?.profiles?.class_section)
        ?.find(Boolean);
      const resolvedClass = classNameById.get(project.class_id) || fallbackClass || "Unassigned Class";
      const activeReviewStage = classActiveStageMap[resolvedClass] || "-";
      return {
        id: project.id,
        name: project.title || "Untitled Project",
        class: resolvedClass,
        stage: activeReviewStage,
        submissionStatus,
        status: submissionStatus || "Pending",
        guide: guide?.full_name || null,
      };
    });
  }, [classActiveStageMap, dashboardClasses, mentors, projects]);

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

  const orderedReviewStages = useMemo(() => {
    const byName = new Map(reviewStages.map((stage) => [normalizeStageName(stage.name), stage]));
    let activeStageFound = false;
    let fallbackActiveAssigned = false;

    return STAGE_ORDER.map((name, index) => {
      const liveStage = byName.get(name);
      const baseStage = liveStage || {
        id: `dashboard-stage-${index}`,
        name,
        deadline: null,
        status: "Inactive",
        rawStatus: "Inactive",
      };

      const rawStatus = baseStage.rawStatus || baseStage.status || "Inactive";
      const deadlinePassed = hasDeadlinePassed(baseStage.deadline);
      const isOpened = rawStatus !== "Locked";
      let status = "Locked";

      if (rawStatus === "Completed" || deadlinePassed) {
        status = "Completed";
      } else if (rawStatus === "Active") {
        status = "Active";
        activeStageFound = true;
      } else if (isOpened && !activeStageFound && !fallbackActiveAssigned) {
        status = "Active";
        fallbackActiveAssigned = true;
      } else if (isOpened) {
        status = "Pending";
      }

      return {
        ...baseStage,
        status,
        rawStatus,
      };
    });
  }, [reviewStages]);

  const activeReviewStage = useMemo(
    () => orderedReviewStages.find((stage) => stage.status === "Active")?.name || "-",
    [orderedReviewStages]
  );

  const completedCount = useMemo(
    () => orderedReviewStages.filter((stage) => stage.status === "Completed").length,
    [orderedReviewStages]
  );

  const currentTimelineIndex = useMemo(() => {
    const activeIndex = orderedReviewStages.findIndex((stage) => stage.status === "Active");
    if (activeIndex !== -1) return activeIndex;
    const pendingIndex = orderedReviewStages.findIndex((stage) => stage.status === "Pending");
    if (pendingIndex !== -1) return Math.max(pendingIndex - 1, 0);
    return Math.max(completedCount - 1, 0);
  }, [completedCount, orderedReviewStages]);

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

  const adminName = adminProfile.full_name || ADMIN_NAME;
  const adminDepartment = adminProfile.department || "CSE";

  return (
    <AppFrame
      sidebar={<Sidebar activeItem="dashboard" onSignOut={handleSignOut} onNavigate={handleNavigate} />}
      header={(
        <TopNavbar
          adminName={adminName}
          academicYearLabel="2026 - S6 Mini Project"
          pageTitle="Admin Dashboard"
          onProfileClick={() => setShowProfileMenu((value) => !value)}
        />
      )}
      headerOverlay={showProfileMenu ? (
        <div className="fixed top-14 right-2 sm:right-6 md:right-8 z-50">
          <ProfileMenu
            profile={adminProfile}
            isOpen={showProfileMenu}
            onClose={() => setShowProfileMenu(false)}
            onLogout={handleSignOut}
            onEditProfile={() => {
              setShowProfileMenu(false);
              setShowProfileSettings(true);
            }}
            roleLabel="Administrator"
            roleIcon="admin_panel_settings"
            infoItems={[
              { label: "Full Name", value: adminProfile.full_name || "-" },
              { label: "Email", value: adminProfile.email || "-" },
              { label: "Role", value: "Administrator" },
              { label: "Department", value: adminDepartment || "-" },
            ]}
          />
        </div>
      ) : null}
    >
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
          <section className="glass-card p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">Good Evening, Dr. {adminName}</h1>
              <p className="text-slate-500 mt-1 text-sm">{adminDepartment} Department - Project Evaluation Control Panel</p>
            </div>
            <div className="text-sm sm:text-right text-slate-500">
              <p className="font-semibold text-slate-700">Today</p>
              <p>{today}</p>
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {dashboardKpis.map((item) => <StatCard key={item.title} {...item} />)}
          </section>

          {loading ? <p className="text-sm text-slate-500">Loading live dashboard data...</p> : null}

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
                  <div key={project.id} className="flex items-center justify-between rounded-lg border border-slate-200/70 bg-white/70 px-3 py-2">
                    <p className="text-sm font-medium text-slate-800 truncate pr-3">{project.title || "Untitled Project"}</p>
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
              <p className="text-sm text-slate-600">All projects have been allocated a guide.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Milestone Timeline"
            action={(
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  value={selectedClassId || reviewClasses[0]?.id || ""}
                  onChange={async (event) => {
                    const nextClassId = event.target.value;
                    const matchedClass = reviewClasses.find(
                      (classItem) => normalizeClassRef(classItem.id) === normalizeClassRef(nextClassId)
                    );
                    setSelectedClassId(nextClassId);
                    setSelectedClassName(matchedClass?.label || "");
                    await fetchReviewStages(matchedClass?.label || "", nextClassId);
                  }}
                  className="glass-input min-w-[220px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm"
                  disabled={reviewClasses.length === 0}
                >
                  {reviewClasses.length === 0 ? (
                    <option value="">No classes found</option>
                  ) : reviewClasses.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.label || getClassLabel(classItem)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/review-management?class=${encodeURIComponent(selectedClassName || "")}`)}
                  className="rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-teal-600 hover:shadow-md"
                >
                  {activeReviewStage === "-" ? "Open Review" : `Manage ${formatStageLabel(activeReviewStage)}`}
                </button>
              </div>
            )}
          >
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 font-semibold text-teal-700">
                  {selectedClassName || "Select class"}
                </span>
                <span>
                  {activeReviewStage === "-"
                    ? "No review stage is currently open."
                    : `${formatTimelineStageLabel(activeReviewStage)} is currently active.`}
                </span>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white px-4 py-8 shadow-sm sm:px-6 lg:px-8">
                <div className="relative">
                  <div className="absolute left-[34px] right-[34px] top-7 h-0.5 bg-slate-200 sm:left-[42px] sm:right-[42px]" />
                  <div
                    className="absolute left-[34px] top-7 h-0.5 bg-[#00D2C4] transition-all duration-500 sm:left-[42px]"
                    style={{
                      width: orderedReviewStages.length > 1
                        ? `${(currentTimelineIndex / (orderedReviewStages.length - 1)) * (100 - (84 / Math.max(orderedReviewStages.length, 1)))}%`
                        : "0%",
                    }}
                  />
                  <div className="relative grid grid-cols-3 gap-y-8 md:grid-cols-6">
                    {orderedReviewStages.map((stage, index) => {
                      const isCompleted = stage.status === "Completed";
                      const isActive = stage.status === "Active";
                      const isDimmed = !isCompleted && !isActive;
                      const nodeClass = isCompleted
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isActive
                          ? "border-[#00D2C4] bg-white text-[#00D2C4] shadow-[0_0_0_6px_rgba(0,210,196,0.12)]"
                          : "border-slate-200 bg-slate-50 text-slate-400";
                      const pillClass = isCompleted
                        ? "bg-emerald-50 text-emerald-700"
                        : isActive
                          ? "bg-[#E8FFFB] text-[#008E86]"
                          : "bg-slate-100 text-slate-500";
                      const pillLabel = isCompleted ? "Completed" : isActive ? "Active" : "Locked";

                      return (
                        <button
                          key={stage.id || `${stage.name}-${index}`}
                          type="button"
                          onClick={() => navigate(`/admin/review-management?class=${encodeURIComponent(selectedClassName || "")}`)}
                          className="flex flex-col items-center text-center"
                        >
                          <span className={`relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-bold transition-all ${nodeClass}`}>
                            {isCompleted ? "OK" : isActive ? <span className="h-4 w-4 rounded-full bg-[#00D2C4]" /> : (
                              <span className="material-symbols-outlined text-[20px]">lock</span>
                            )}
                          </span>
                          <p className={`mt-4 text-base font-semibold ${isDimmed ? "text-slate-300" : "text-slate-900"}`}>
                            {formatTimelineStageLabel(stage.name)}
                          </p>
                          <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${pillClass}`}>
                            {pillLabel}
                          </span>
                          <p className={`mt-2 text-xs ${isDimmed ? "text-slate-300" : "text-slate-400"}`}>
                            {formatStageSubline(stage)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <PublishPanel verificationStatus="All review sheets verified by HOD panel" />

      </div>
      <AdminProfileSettingsModal
        isOpen={showProfileSettings}
        onClose={() => setShowProfileSettings(false)}
        onSuccess={fetchAdminProfile}
      />
    </AppFrame>
  );
}

