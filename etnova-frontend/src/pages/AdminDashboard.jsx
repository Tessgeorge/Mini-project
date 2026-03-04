import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../config/supabaseClient";
import Sidebar from "../components/admin/Sidebar";
import TopNavbar from "../components/admin/TopNavbar";
import StatCard from "../components/admin/StatCard";
import SectionCard from "../components/admin/SectionCard";
import ReviewTimeline from "../components/admin/ReviewTimeline";
import PublishPanel from "../components/admin/PublishPanel";
import AcademicActivityPanel from "../components/admin/AcademicActivityPanel";
import ClassProgressAnalyzer from "../components/admin/ClassProgressAnalyzer";
import { adminRepository } from "../data/adminRepository";

const ADMIN_NAME = "Meenakshi";
const KPI_DATA = [
  { title: "Total Projects", value: "0", hint: "CSE S6 Mini Project", borderClass: "border-t-teal-500", icon: "teams" },
  { title: "Total Guides", value: "41", hint: "Department mentors active", borderClass: "border-t-sky-500", icon: "guides" },
  { title: "Active Review Stage", value: "-", hint: "Current academic checkpoint", borderClass: "border-t-teal-600", icon: "stage" },
  { title: "Results Published", value: "Not Yet", hint: "Awaiting final approval", borderClass: "border-t-rose-500", icon: "published" },
];

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
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchDashboardData();

    const channel = supabase
      .channel("dashboard-projects-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, fetchDashboardData)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchDashboardData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData]);

  useEffect(() => {
    const refreshStages = () => {
      adminRepository.getSnapshot().then((snapshot) => {
        setReviewStages((snapshot.reviewStages || []).sort((a, b) => a.id - b.id));
      });
    };

    refreshStages();
    const onStorage = (event) => {
      if (event.key === "etnova_admin_review_stages") {
        refreshStages();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

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

  const classOptions = useMemo(
    () => Array.from(new Set(teams.map((team) => team.class))).map((id) => ({ id, name: id })),
    [teams]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar activeItem="dashboard" onSignOut={handleSignOut} onNavigate={handleNavigate} />

      <main className="lg:ml-72 min-h-screen">
        <TopNavbar adminName={ADMIN_NAME} academicYearLabel="2026 - S6 Mini Project" pageTitle="Admin Dashboard" />

        <div className="p-4 md:p-6 lg:p-8 space-y-6">
          <section className="rounded-xl shadow-md bg-gradient-to-r from-teal-600 to-teal-500 text-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Good Evening, Dr. {ADMIN_NAME}</h1>
              <p className="text-teal-50 mt-1 text-sm">CSE Department - Project Evaluation Control Panel</p>
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
            <ReviewTimeline
              stages={reviewStages}
              deadlineView="class"
              selectedClass="S6 CSE A"
            />
          </SectionCard>

          <PublishPanel verificationStatus="All review sheets verified by HOD panel" />

          <ClassProgressAnalyzer
            classes={classOptions}
            teams={teams}
            activeStage={activeReviewStage}
          />
        </div>
      </main>

      <AcademicActivityPanel reviewStages={reviewStages} teams={teams} />
    </div>
  );
}
