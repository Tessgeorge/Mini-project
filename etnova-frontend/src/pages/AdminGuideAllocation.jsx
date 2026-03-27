import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabase";
import AppFrame from "../components/AppFrame";
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
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [mentors, setMentors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedGuides, setSelectedGuides] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const mentorById = useMemo(() => new Map(mentors.map((mentor) => [mentor.id, mentor])), [mentors]);
  const classNameById = useMemo(() => new Map(classes.map((item) => [item.id, item.class_name])), [classes]);

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

  const fetchClasses = useCallback(async () => {
    const { data, error: classesError } = await supabase
      .from("profiles")
      .select("class_section")
      .eq("role", "student")
      .not("class_section", "is", null)
      .order("class_section", { ascending: true });

    if (classesError) throw classesError;
    const unique = [...new Set((data || []).map((row) => String(row.class_section || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ id: value, class_name: value }));
    setClasses(unique);
    return unique;
  }, []);

  const fetchProjects = useCallback(async () => {
    const { data: projectsData, error: projectsError } = await supabase
      .from("projects")
      .select(`
        id,
        title,
        guide_id,
        team_members (
          project_id,
          student_id,
          profiles:student_id (
            class_section
          )
        )
      `)
      .order("title", { ascending: true });

    if (projectsError) throw projectsError;

    const projectRows = projectsData || [];
    const projectIds = projectRows.map((row) => row.id).filter(Boolean);

    const { data: allocationRows, error: allocationsError } = projectIds.length > 0
      ? await supabase
        .from("guide_allocations")
        .select("project_id, guide_id")
        .in("project_id", projectIds)
      : { data: [], error: null };
    if (allocationsError) throw allocationsError;

    const guideIds = [...new Set((allocationRows || []).map((row) => row.guide_id).filter(Boolean))];
    const { data: guideRows, error: guidesError } = guideIds.length > 0
      ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", guideIds)
      : { data: [], error: null };
    if (guidesError) throw guidesError;

    const guideNameById = new Map((guideRows || []).map((row) => [row.id, row.full_name || ""]));
    const allocationByProject = new Map();
    (allocationRows || []).forEach((row) => {
      if (!row?.project_id || allocationByProject.has(row.project_id)) return;
      allocationByProject.set(row.project_id, row);
    });

    const normalized = projectRows.map((project) => {
      const allocation = allocationByProject.get(project.id) || null;
      const members = Array.isArray(project.team_members) ? project.team_members : [];
      const classSection = members
        .map((member) => {
          const profile = Array.isArray(member?.profiles) ? member.profiles[0] : member?.profiles;
          return String(profile?.class_section || "").trim();
        })
        .find(Boolean) || "";

      return {
        id: project.id,
        title: project.title || "Untitled Project",
        guide_id: project.guide_id || null,
        class_id: classSection || null,
        class_name: classSection,
        allocated_guide_id: allocation?.guide_id || null,
        allocated_guide_name: guideNameById.get(allocation?.guide_id) || "",
      };
    });

    setProjects(normalized);
    return normalized;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([fetchMentors(), fetchProjects(), fetchClasses()]);
    } catch (err) {
      setError(err.message || "Failed to load guide allocation data.");
    } finally {
      setLoading(false);
    }
  }, [fetchClasses, fetchMentors, fetchProjects]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "guide_allocations" }, fetchProjects)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, fetchProjects)
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
      return;
    }
    if (itemId === "rubrics-management") {
      navigate("/admin/rubrics");
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

  const filteredProjects = useMemo(() => {
    if (!selectedClassId) return projects;
    const selected = String(selectedClassId).trim().toLowerCase();
    return projects.filter((project) => String(project.class_name || "").trim().toLowerCase() === selected);
  }, [projects, selectedClassId]);

  return (
    <AppFrame
      sidebar={(
        <Sidebar
          activeItem="guide-allocation"
          onSignOut={handleSignOut}
          onNavigate={handleNavigate}
        />
      )}
      header={(
        <TopNavbar
          adminName={ADMIN_NAME}
          academicYearLabel="2026 - S6 Mini Project"
          pageTitle="Guide Allocation"
        />
      )}
    >
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
          <section className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">Guide Allocation</h1>
              <p className="text-slate-500 mt-1">Interactive guide assignment powered by Supabase</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={runRandomAllocation}
                disabled={loading || saving}
                className="px-4 py-2.5 rounded-xl btn-primary font-semibold disabled:opacity-60"
              >
                Run Random Allocation
              </button>
              <button
                type="button"
                onClick={resetAllocation}
                disabled={loading || saving}
                className="px-4 py-2.5 rounded-xl border border-teal-200 text-teal-700 font-semibold bg-white/90 hover:bg-teal-50 transition-colors disabled:opacity-60"
              >
                Reset Allocation
              </button>
            </div>
          </section>

          {loading ? (
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
              Loading guide allocation data...
            </div>
          ) : null}
          {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          {notice ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{notice}</div> : null}

          <section className="bg-white/90 rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/70">
              <h2 className="text-lg font-semibold text-slate-800">Project Allocation Table</h2>
              <div className="mt-3 flex items-center gap-3">
                <label className="text-sm text-slate-600 font-medium" htmlFor="class-filter">Class Filter</label>
                <select
                  id="class-filter"
                  value={selectedClassId}
                  onChange={(event) => setSelectedClassId(event.target.value)}
                  className="glass-input rounded-xl px-3 py-2.5 text-sm text-slate-700 min-w-[200px]"
                >
                  <option value="">All Classes</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>{item.class_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-slate-100/70 text-slate-600">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Project Name</th>
                    <th className="px-6 py-3 text-left font-semibold">Assigned Guide</th>
                    <th className="px-6 py-3 text-left font-semibold">Status</th>
                    <th className="px-6 py-3 text-left font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {filteredProjects.map((project) => {
                    const currentGuideId = project.allocated_guide_id || project.guide_id || "";
                    const fallbackGuide = mentorById.get(currentGuideId);
                    const assignedGuide = project.allocated_guide_name || fallbackGuide?.full_name || "Unassigned";
                    const selection = selectedGuides[project.id] ?? "";
                    const candidate = selection || currentGuideId || "";
                    const allowed = candidate ? canAssignMentor(project, candidate) : false;
                    const isAssigned = Boolean(currentGuideId);

                    return (
                      <tr key={project.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-800">{project.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{project.class_name || classNameById.get(project.class_id) || "-"}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{assignedGuide}</td>
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
                              className="glass-input rounded-lg px-3 py-2 text-sm text-slate-700"
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
                              className="px-3 py-2 rounded-lg btn-primary text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {selection === NONE_GUIDE_VALUE ? "Unassign" : isAssigned ? "Reassign" : "Assign"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProjects.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">No projects found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg bg-white/90 border border-slate-200/70 p-3">
              <p className="text-xs text-slate-500">Total Projects</p>
              <p className="text-xl font-semibold text-slate-800">{summary.totalProjects}</p>
            </div>
            <div className="rounded-lg bg-white/90 border border-slate-200/70 p-3">
              <p className="text-xs text-slate-500">Assigned Projects</p>
              <p className="text-xl font-semibold text-emerald-700">{summary.assignedProjects}</p>
            </div>
            <div className="rounded-lg bg-white/90 border border-slate-200/70 p-3">
              <p className="text-xs text-slate-500">Unassigned Projects</p>
              <p className="text-xl font-semibold text-rose-700">{summary.unassignedProjects}</p>
            </div>
            <div className="rounded-lg bg-white/90 border border-slate-200/70 p-3">
              <p className="text-xs text-slate-500">Total Guides</p>
              <p className="text-xl font-semibold text-slate-800">{summary.totalGuides}</p>
            </div>
            <div className="rounded-lg bg-white/90 border border-slate-200/70 p-3">
              <p className="text-xs text-slate-500">Fully Occupied</p>
              <p className="text-xl font-semibold text-amber-700">{summary.fullGuides}</p>
            </div>
          </section>
      </div>
    </AppFrame>
  );
}
