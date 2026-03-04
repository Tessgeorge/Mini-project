import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabase";
import Sidebar from "../components/admin/Sidebar";
import TopNavbar from "../components/admin/TopNavbar";

const ADMIN_NAME = "Meenakshi";
const MAX_PROJECTS_PER_GUIDE = 2;
const NONE_GUIDE_VALUE = "__none__";

function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function isMentorProfile(row) {
  return row && typeof row.id === "string";
}

export default function AdminGuideAllocation() {
  const navigate = useNavigate();
  const [mentors, setMentors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedGuides, setSelectedGuides] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const mentorById = useMemo(() => new Map(mentors.map((mentor) => [mentor.id, mentor])), [mentors]);

  const getGuideWorkload = useCallback((mentorId, sourceProjects = projects) => {
    return sourceProjects.filter((project) => project.guide_id === mentorId).length;
  }, [projects]);

  const fetchMentors = useCallback(async () => {
    const { data, error: mentorsError } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "mentor")
      .eq("designation", "guide")
      .order("full_name", { ascending: true });

    if (mentorsError) throw mentorsError;

    const normalized = (data || [])
      .filter(isMentorProfile)
      .map((mentor) => ({
        id: mentor.id,
        full_name: mentor.full_name || "Unnamed Mentor",
        email: mentor.email || "-",
      }));

    setMentors(normalized);
    return normalized;
  }, []);

  const fetchProjects = useCallback(async () => {
    const { data, error: projectsError } = await supabase
      .from("projects")
      .select(`
        id,
        title,
        guide_id,
        class_id,
        classes:class_id (
          class_name
        )
      `)
      .order("title", { ascending: true });

    if (projectsError) throw projectsError;

    const normalized = (data || []).map((project) => ({
      id: project.id,
      title: project.title || "Untitled Project",
      guide_id: project.guide_id || null,
      class_name: Array.isArray(project.classes)
        ? (project.classes[0]?.class_name || "Unknown Class")
        : (project.classes?.class_name || "Unknown Class"),
    }));

    setProjects(normalized);
    return normalized;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([fetchMentors(), fetchProjects()]);
    } catch (err) {
      setError(err.message || "Failed to load guide allocation data.");
    } finally {
      setLoading(false);
    }
  }, [fetchMentors, fetchProjects]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const onFocus = () => fetchData();
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchData();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    const channel = supabase
      .channel("guide-allocation-projects-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, fetchProjects)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchMentors)
      .subscribe();

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [fetchData, fetchMentors, fetchProjects]);

  const canAssignMentor = useCallback((project, mentorId) => {
    if (mentorId === NONE_GUIDE_VALUE) return true;
    if (project.guide_id === mentorId) return true;
    return getGuideWorkload(mentorId) < MAX_PROJECTS_PER_GUIDE;
  }, [getGuideWorkload]);

  const runRandomAllocation = async () => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const unassignedProjects = projects.filter((project) => !project.guide_id);
      if (unassignedProjects.length === 0) {
        setNotice("All projects already have guides.");
        return;
      }
      if (mentors.length === 0) {
        throw new Error("No mentors available for allocation.");
      }

      const shuffledMentors = shuffleArray(mentors);
      const workloadMap = new Map(shuffledMentors.map((mentor) => [mentor.id, getGuideWorkload(mentor.id)]));
      const assignments = [];

      for (const project of unassignedProjects) {
        const availableMentors = shuffledMentors.filter(
          (mentor) => (workloadMap.get(mentor.id) || 0) < MAX_PROJECTS_PER_GUIDE,
        );
        if (availableMentors.length === 0) break;
        const selected = availableMentors[Math.floor(Math.random() * availableMentors.length)];
        workloadMap.set(selected.id, (workloadMap.get(selected.id) || 0) + 1);
        assignments.push({ projectId: project.id, mentorId: selected.id });
      }

      if (assignments.length === 0) {
        throw new Error("No mentors have free capacity (max 2 projects each).");
      }

      setProjects((prev) => prev.map((project) => {
        const found = assignments.find((item) => item.projectId === project.id);
        return found ? { ...project, guide_id: found.mentorId } : project;
      }));

      const results = await Promise.all(
        assignments.map((item) => supabase.from("projects").update({ guide_id: item.mentorId }).eq("id", item.projectId)),
      );

      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      const skipped = unassignedProjects.length - assignments.length;
      setNotice(
        skipped > 0
          ? `Random allocation complete. ${skipped} project(s) left unassigned due to mentor capacity.`
          : "Random allocation complete.",
      );
      await fetchProjects();
    } catch (err) {
      setError(err.message || "Random allocation failed.");
      alert(err.message || "Random allocation failed.");
      await fetchProjects();
    } finally {
      setSaving(false);
    }
  };

  const resetAllocation = async () => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      setProjects((prev) => prev.map((project) => ({ ...project, guide_id: null })));

      const { error: updateError } = await supabase
        .from("projects")
        .update({ guide_id: null })
        .not("guide_id", "is", null);

      if (updateError) throw updateError;

      setNotice("Allocation reset completed.");
      await fetchProjects();
    } catch (err) {
      setError(err.message || "Failed to reset allocation.");
      alert(err.message || "Failed to reset allocation.");
      await fetchProjects();
    } finally {
      setSaving(false);
    }
  };

  const assignGuide = async (projectId, mentorId) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project || !mentorId) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const nextGuideId = mentorId === NONE_GUIDE_VALUE ? null : mentorId;
      if (nextGuideId && !canAssignMentor(project, nextGuideId)) {
        const message = "Selected mentor is already at maximum workload (2 projects).";
        setError(message);
        alert(message);
        return;
      }

      setProjects((prev) => prev.map((item) => (
        item.id === projectId
          ? { ...item, guide_id: nextGuideId }
          : item
      )));

      const { error: updateError } = await supabase
        .from("projects")
        .update({ guide_id: nextGuideId })
        .eq("id", projectId);

      if (updateError) throw updateError;

      setSelectedGuides((prev) => ({ ...prev, [projectId]: "" }));
      setNotice(nextGuideId ? "Guide assigned successfully." : "Guide unassigned successfully.");
      await fetchProjects();
    } catch (err) {
      setError(err.message || "Failed to assign guide.");
      alert(err.message || "Failed to assign guide.");
      await fetchProjects();
    } finally {
      setSaving(false);
    }
  };

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

  const summary = useMemo(() => {
    const assigned = projects.filter((project) => Boolean(project.guide_id)).length;
    const unassigned = projects.length - assigned;
    const fullMentors = mentors.filter((mentor) => getGuideWorkload(mentor.id) >= MAX_PROJECTS_PER_GUIDE).length;
    return {
      totalProjects: projects.length,
      assignedProjects: assigned,
      unassignedProjects: unassigned,
      totalGuides: mentors.length,
      fullGuides: fullMentors,
    };
  }, [mentors, projects, getGuideWorkload]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        activeItem="guide-allocation"
        onSignOut={handleSignOut}
        onNavigate={handleNavigate}
      />

      <main className="lg:ml-72 min-h-screen">
        <TopNavbar
          adminName={ADMIN_NAME}
          academicYearLabel="2026 - S6 Mini Project"
          pageTitle="Guide Allocation"
        />

        <div className="p-4 md:p-6 lg:p-8 space-y-6">
          <section className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">Guide Allocation</h1>
              <p className="text-gray-500 mt-1">Interactive guide assignment powered by Supabase</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={runRandomAllocation}
                disabled={loading || saving}
                className="px-4 py-2.5 rounded-xl bg-teal-600 text-white font-semibold shadow-md hover:bg-teal-700 transition-colors disabled:opacity-60"
              >
                Run Random Allocation
              </button>
              <button
                type="button"
                onClick={resetAllocation}
                disabled={loading || saving}
                className="px-4 py-2.5 rounded-xl border border-teal-200 text-teal-700 font-semibold bg-white hover:bg-teal-50 transition-colors disabled:opacity-60"
              >
                Reset Allocation
              </button>
            </div>
          </section>

          {loading ? (
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
              Loading guide allocation data...
            </div>
          ) : null}
          {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          {notice ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{notice}</div> : null}

          <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Project Allocation Table</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Project Name</th>
                    <th className="px-6 py-3 text-left font-semibold">Assigned Guide</th>
                    <th className="px-6 py-3 text-left font-semibold">Status</th>
                    <th className="px-6 py-3 text-left font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {projects.map((project) => {
                    const guide = mentors.find((mentor) => mentor.id === project.guide_id);
                    const assignedGuide = guide?.full_name || "-";
                    const selection = selectedGuides[project.id] ?? "";
                    const candidate = selection || project.guide_id || "";
                    const allowed = candidate ? canAssignMentor(project, candidate) : false;
                    const isAssigned = Boolean(project.guide_id);

                    return (
                      <tr key={project.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-800">{project.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{project.class_name}</p>
                        </td>
                        <td className="px-6 py-4 text-gray-700">{assignedGuide}</td>
                        <td className="px-6 py-4">
                          {isAssigned ? (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Assigned</span>
                          ) : (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <select
                              value={selection}
                              onChange={(event) => setSelectedGuides((prev) => ({ ...prev, [project.id]: event.target.value }))}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                            >
                              <option value="">Select guide</option>
                              <option value={NONE_GUIDE_VALUE}>None (Unassign)</option>
                              {mentors.map((mentor) => {
                                const optionAllowed = canAssignMentor(project, mentor.id);
                                return (
                                  <option key={mentor.id} value={mentor.id} disabled={!optionAllowed}>
                                    {mentor.full_name}
                                    {!optionAllowed ? " (Full)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                            <button
                              type="button"
                              onClick={() => assignGuide(project.id, selection)}
                              disabled={loading || saving || !selection || !allowed}
                              className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {selection === NONE_GUIDE_VALUE ? "Unassign" : isAssigned ? "Reassign" : "Assign"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {projects.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">No projects found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg bg-white border border-gray-100 p-3">
              <p className="text-xs text-gray-500">Total Projects</p>
              <p className="text-xl font-semibold text-gray-800">{summary.totalProjects}</p>
            </div>
            <div className="rounded-lg bg-white border border-gray-100 p-3">
              <p className="text-xs text-gray-500">Assigned Projects</p>
              <p className="text-xl font-semibold text-emerald-700">{summary.assignedProjects}</p>
            </div>
            <div className="rounded-lg bg-white border border-gray-100 p-3">
              <p className="text-xs text-gray-500">Unassigned Projects</p>
              <p className="text-xl font-semibold text-rose-700">{summary.unassignedProjects}</p>
            </div>
            <div className="rounded-lg bg-white border border-gray-100 p-3">
              <p className="text-xs text-gray-500">Total Guides</p>
              <p className="text-xl font-semibold text-gray-800">{summary.totalGuides}</p>
            </div>
            <div className="rounded-lg bg-white border border-gray-100 p-3">
              <p className="text-xs text-gray-500">Fully Occupied</p>
              <p className="text-xl font-semibold text-amber-700">{summary.fullGuides}</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
