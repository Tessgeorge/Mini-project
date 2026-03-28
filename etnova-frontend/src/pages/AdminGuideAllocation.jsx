import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabase";
import AppFrame from "../components/AppFrame";
import Sidebar from "../components/admin/Sidebar";
import TopNavbar from "../components/admin/TopNavbar";
import SectionCard from "../components/admin/SectionCard";
import AllocationSummary from "../components/admin/AllocationSummary";

const ADMIN_NAME = "Meenakshi";
const MAX_PROJECTS_PER_GUIDE = 2;
const NONE_GUIDE_VALUE = "__none__";

function normalizeTagList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  return [...new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

function getMentorCapacity(mentor) {
  const value = Number(mentor?.max_team_capacity);
  return Number.isFinite(value) && value > 0 ? value : MAX_PROJECTS_PER_GUIDE;
}

function tokenizeForMatch(values) {
  return [...new Set(
    values
      .flatMap((value) => String(value || "").toLowerCase().split(/[^a-z0-9]+/))
      .map((item) => item.trim())
      .filter((item) => item.length >= 3)
  )];
}

function buildProjectSignals(project) {
  const domain = String(project?.detected_domain || project?.domain || "").trim();
  const subdomain = String(project?.detected_subdomain || "").trim();
  const keywords = normalizeTagList(project?.detected_keywords || []);
  const technologies = normalizeTagList(project?.technologies || []);
  const department = String(project?.team_department || "").trim();

  return {
    domain,
    subdomain,
    keywords,
    technologies,
    department,
    terms: tokenizeForMatch([domain, subdomain, ...keywords, ...technologies]),
  };
}

function scoreMentorRecommendation(project, mentor, workload) {
  const signals = buildProjectSignals(project);
  const interests = normalizeTagList(mentor?.domains_of_interest);
  const mentorTerms = tokenizeForMatch([mentor?.specialization || "", ...interests]);
  const mentorDepartment = String(mentor?.department || "").trim().toLowerCase();
  const projectDepartment = String(signals.department || "").trim().toLowerCase();
  const capacity = getMentorCapacity(mentor);
  const remainingCapacity = capacity - workload;

  let score = 20;
  const reasons = [];

  const hasDomainMatch = signals.domain && interests.some(
    (item) => item.toLowerCase().includes(signals.domain.toLowerCase())
      || signals.domain.toLowerCase().includes(item.toLowerCase()),
  );
  if (hasDomainMatch) {
    score += 32;
    reasons.push("domain interest aligned");
  }

  const hasSubdomainMatch = signals.subdomain && mentorTerms.some(
    (term) => signals.subdomain.toLowerCase().includes(term) || term.includes(signals.subdomain.toLowerCase()),
  );
  if (hasSubdomainMatch) {
    score += 18;
    reasons.push("subdomain aligned");
  }

  const keywordMatches = signals.terms.filter((term) => mentorTerms.includes(term));
  if (keywordMatches.length > 0) {
    score += Math.min(18, keywordMatches.length * 6);
    reasons.push(`matched ${keywordMatches.slice(0, 3).join(", ")}`);
  }

  if (
    mentor?.specialization
    && signals.terms.some((term) => String(mentor.specialization).toLowerCase().includes(term))
  ) {
    score += 12;
    reasons.push("specialization matched");
  }

  if (mentorDepartment && projectDepartment && mentorDepartment === projectDepartment) {
    score += 8;
    reasons.push("department aligned");
  }

  if (remainingCapacity > 0) {
    score += Math.min(10, remainingCapacity * 4);
    reasons.push(`${remainingCapacity}/${capacity} slots free`);
  } else {
    score -= 18;
    reasons.push("at capacity");
  }

  return {
    mentor_id: mentor.id,
    mentor_name: mentor.full_name,
    score: Math.max(0, Math.min(99, Math.round(score))),
    reasons: reasons.slice(0, 3),
    workload,
    capacity,
    remainingCapacity,
    eligible: remainingCapacity > 0,
  };
}

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

  const recommendationsByProject = useMemo(() => {
    const nextMap = new Map();
    projects.forEach((project) => {
      const suggestions = mentors
        .map((mentor) => scoreMentorRecommendation(project, mentor, getGuideWorkload(mentor.id)))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      nextMap.set(project.id, suggestions);
    });
    return nextMap;
  }, [getGuideWorkload, mentors, projects]);

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
        department: mentor.department || "",
        specialization: mentor.specialization || "",
        domains_of_interest: normalizeTagList(mentor.domains_of_interest),
        max_team_capacity: getMentorCapacity(mentor),
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
        domain,
        approved_idea_id,
        current_idea_id,
        team_members (
          project_id,
          student_id,
          profiles:student_id (
            class_section,
            department
          )
        )
      `)
      .order("title", { ascending: true });

    if (projectsError) throw projectsError;

    const projectRows = projectsData || [];
    const projectIds = projectRows.map((row) => row.id).filter(Boolean);
    const ideaIds = [...new Set(
      projectRows.flatMap((row) => [row.approved_idea_id, row.current_idea_id]).filter(Boolean),
    )];

    const { data: ideaRows, error: ideasError } = ideaIds.length > 0
      ? await supabase
        .from("project_ideas")
        .select("id, title, domain, subdomain, keywords, confidence_score, technologies, status")
        .in("id", ideaIds)
      : { data: [], error: null };
    if (ideasError) throw ideasError;

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
    const ideaById = new Map((ideaRows || []).map((row) => [row.id, row]));
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
      const teamDepartment = members
        .map((member) => {
          const profile = Array.isArray(member?.profiles) ? member.profiles[0] : member?.profiles;
          return String(profile?.department || "").trim();
        })
        .find(Boolean) || "";
      const detectedIdea = ideaById.get(project.approved_idea_id) || ideaById.get(project.current_idea_id) || null;

      return {
        id: project.id,
        title: project.title || "Untitled Project",
        guide_id: project.guide_id || null,
        domain: project.domain || "",
        detected_domain: detectedIdea?.domain || project.domain || "",
        detected_subdomain: detectedIdea?.subdomain || "",
        detected_keywords: Array.isArray(detectedIdea?.keywords) ? detectedIdea.keywords : [],
        confidence_score: typeof detectedIdea?.confidence_score === "number" ? detectedIdea.confidence_score : 0,
        technologies: Array.isArray(detectedIdea?.technologies) ? detectedIdea.technologies : [],
        idea_title: detectedIdea?.title || "",
        team_department: teamDepartment,
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
    const mentor = mentorById.get(mentorId);
    return getGuideWorkload(mentorId) < getMentorCapacity(mentor);
  }, [getGuideWorkload, mentorById]);

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
          (mentor) => (workloadMap.get(mentor.id) || 0) < getMentorCapacity(mentor),
        );
        if (availableMentors.length === 0) break;
        const selected = availableMentors[Math.floor(Math.random() * availableMentors.length)];
        workloadMap.set(selected.id, (workloadMap.get(selected.id) || 0) + 1);
        assignments.push({ projectId: project.id, mentorId: selected.id });
      }

      if (assignments.length === 0) {
        throw new Error("No mentors have free capacity.");
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
    const fullMentors = mentors.filter((mentor) => getGuideWorkload(mentor.id) >= getMentorCapacity(mentor)).length;
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

  const mentorLoadOverview = useMemo(() => {
    return mentors.map((mentor) => {
      const assigned = getGuideWorkload(mentor.id);
      const capacity = getMentorCapacity(mentor);
      return {
        id: mentor.id,
        name: mentor.full_name,
        specialization: mentor.specialization || "General mentoring",
        assigned,
        capacity,
        percent: capacity > 0 ? Math.min(100, Math.round((assigned / capacity) * 100)) : 0,
      };
    });
  }, [getGuideWorkload, mentors]);

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
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <section className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800">Guide Allocation</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Match teams to mentors using detected idea domains, project keywords, specialization, and live
              capacity signals. Suggestions stay advisory so admin keeps the final decision.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runRandomAllocation}
              disabled={loading || saving}
              className="rounded-xl px-4 py-2.5 font-semibold shadow-sm btn-primary disabled:opacity-60"
            >
              Run Random Allocation
            </button>
            <button
              type="button"
              onClick={resetAllocation}
              disabled={loading || saving}
              className="rounded-xl border border-teal-200 bg-white/90 px-4 py-2.5 font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-60"
            >
              Reset Allocation
            </button>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-sm">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
            Loading guide allocation data...
          </div>
        ) : null}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{notice}</div> : null}

        <AllocationSummary
          stats={{
            totalTeams: summary.totalProjects,
            assignedTeams: summary.assignedProjects,
            unassignedTeams: summary.unassignedProjects,
            totalGuides: summary.totalGuides,
            fullyOccupiedGuides: summary.fullGuides,
          }}
        />

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <SectionCard
            title="Allocation Controls"
            subtitle="Filter the team list, review suggestion readiness, and keep the allocation pass manageable."
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(220px,280px)_1fr]">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="class-filter">Class Filter</label>
                <select
                  id="class-filter"
                  value={selectedClassId}
                  onChange={(event) => setSelectedClassId(event.target.value)}
                  className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-slate-700"
                >
                  <option value="">All Classes</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>{item.class_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Visible Teams</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-800">{filteredProjects.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">AI Suggested</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-800">
                    {filteredProjects.filter((project) => (recommendationsByProject.get(project.id) || []).length > 0).length}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Needs Assignment</p>
                  <p className="mt-2 text-2xl font-semibold text-rose-700">
                    {filteredProjects.filter((project) => !(project.allocated_guide_id || project.guide_id)).length}
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Mentor Capacity Snapshot"
            subtitle="Check current availability before confirming allocations."
          >
            <div className="space-y-4">
              {mentorLoadOverview.map((mentor) => (
                <div key={mentor.id} className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{mentor.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{mentor.specialization}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {mentor.assigned}/{mentor.capacity} teams
                    </span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        mentor.percent >= 100 ? "bg-amber-500" : mentor.percent >= 75 ? "bg-teal-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${mentor.percent}%` }}
                    />
                  </div>
                </div>
              ))}
              {mentorLoadOverview.length === 0 ? (
                <p className="text-sm text-slate-500">No mentors available yet.</p>
              ) : null}
            </div>
          </SectionCard>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200/70 px-6 py-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Project Allocation Table</h2>
              <p className="mt-1 text-sm text-slate-500">
                Review AI match suggestions alongside detected idea signals, then confirm the final mentor manually.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50/80 px-3 py-1.5 text-xs font-medium text-teal-700">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              AI suggestions are advisory only
            </div>
          </div>

          <div className="grid gap-4 p-4 xl:hidden">
            {filteredProjects.map((project) => {
              const currentGuideId = project.allocated_guide_id || project.guide_id || "";
              const fallbackGuide = mentorById.get(currentGuideId);
              const assignedGuide = project.allocated_guide_name || fallbackGuide?.full_name || "Unassigned";
              const selection = selectedGuides[project.id] ?? "";
              const candidate = selection || currentGuideId || "";
              const allowed = candidate ? canAssignMentor(project, candidate) : false;
              const isAssigned = Boolean(currentGuideId);
              const recommendations = recommendationsByProject.get(project.id) || [];

              return (
                <article key={project.id} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-800">{project.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {project.class_name || classNameById.get(project.class_id) || "-"}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isAssigned ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}>
                      {isAssigned ? "Assigned" : "Unassigned"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {project.idea_title ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        {project.idea_title}
                      </span>
                    ) : null}
                    {project.team_department ? (
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
                        {project.team_department}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Detected Domain</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{project.detected_domain || "General"}</p>
                      {project.detected_subdomain ? (
                        <p className="mt-1 text-xs text-slate-500">{project.detected_subdomain}</p>
                      ) : null}
                      {(project.detected_keywords || []).length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {project.detected_keywords.slice(0, 4).map((keyword) => (
                            <span key={keyword} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-slate-400">No keyword signals yet</p>
                      )}
                      {(project.technologies || []).length > 0 ? (
                        <p className="mt-3 text-[11px] text-slate-400">
                          Tech: {project.technologies.slice(0, 3).join(", ")}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Assigned Guide</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{assignedGuide}</p>
                      {fallbackGuide?.specialization ? (
                        <p className="mt-1 text-xs text-slate-500">{fallbackGuide.specialization}</p>
                      ) : null}
                      {currentGuideId && fallbackGuide ? (
                        <p className="mt-3 text-[11px] text-slate-400">
                          Load: {getGuideWorkload(currentGuideId)}/{getMentorCapacity(fallbackGuide)} teams
                        </p>
                      ) : (
                        <p className="mt-3 text-[11px] text-slate-400">No guide assigned yet</p>
                      )}
                    </div>
                  </div>                  {!isAssigned ? (
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Recommended Mentors</p>
                      <div className="mt-3 space-y-2.5">
                        {recommendations.length > 0 ? (
                          recommendations.map((recommendation, index) => (
                            <button
                              key={recommendation.mentor_id}
                              type="button"
                              onClick={() => setSelectedGuides((prev) => ({ ...prev, [project.id]: recommendation.mentor_id }))}
                              className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                                recommendation.eligible
                                  ? "border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/40 hover:shadow-sm"
                                  : "border-slate-200 bg-slate-50/80 opacity-80"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {index === 0 ? (
                                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
                                        Best Fit
                                      </span>
                                    ) : null}
                                    <p className="truncate text-sm font-semibold text-slate-800">
                                      {recommendation.mentor_name}
                                    </p>
                                  </div>
                                  <p className="mt-1 text-[11px] text-slate-500">
                                    {recommendation.reasons.join(" • ") || "General fit"}
                                  </p>
                                </div>
                                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                                  {recommendation.score}%
                                </span>
                              </div>
                            </button>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400">No suggestions yet</p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 border-t border-slate-200/70 pt-4">
                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      <select
                        value={selection}
                        onChange={(event) => setSelectedGuides((prev) => ({ ...prev, [project.id]: event.target.value }))}
                        className="glass-input min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm text-slate-700"
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
                        className="rounded-xl px-4 py-2.5 text-sm font-semibold btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {selection === NONE_GUIDE_VALUE ? "Unassign" : isAssigned ? "Reassign" : "Assign"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {filteredProjects.length === 0 && !loading ? (
              <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-10 text-center shadow-sm">
                <div className="mx-auto max-w-sm space-y-2">
                  <p className="text-sm font-medium text-slate-700">No teams matched this filter.</p>
                  <p className="text-sm text-slate-500">Try switching the class filter or refresh the latest project data.</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="hidden overflow-x-auto xl:block">
            <table className="min-w-[1280px] w-full text-sm">
              <thead className="bg-slate-100/70 text-slate-600">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Project Name</th>
                  <th className="px-6 py-3 text-left font-semibold">Detected Domain</th>
                  <th className="px-6 py-3 text-left font-semibold">Recommended Mentors</th>
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
                  const recommendations = recommendationsByProject.get(project.id) || [];

                  return (
                    <tr key={project.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-2">
                          <div>
                            <p className="font-semibold text-slate-800">{project.title}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {project.class_name || classNameById.get(project.class_id) || "-"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {project.idea_title ? (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {project.idea_title}
                              </span>
                            ) : null}
                            {project.team_department ? (
                              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
                                {project.team_department}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{project.detected_domain || "General"}</p>
                            {project.detected_subdomain ? (
                              <p className="text-xs text-slate-500">{project.detected_subdomain}</p>
                            ) : null}
                          </div>
                          {(project.detected_keywords || []).length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {project.detected_keywords.slice(0, 4).map((keyword) => (
                                <span key={keyword} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">No keyword signals yet</p>
                          )}
                          {(project.technologies || []).length > 0 ? (
                            <p className="text-[11px] text-slate-400">
                              Tech: {project.technologies.slice(0, 3).join(", ")}
                            </p>
                          ) : null}
                        </div>
                      </td>

                                            <td className="px-6 py-4 align-top">
                        {!isAssigned ? (
                          <div className="space-y-2.5">
                            {recommendations.length > 0 ? (
                              recommendations.map((recommendation, index) => (
                                <button
                                  key={recommendation.mentor_id}
                                  type="button"
                                  onClick={() => setSelectedGuides((prev) => ({ ...prev, [project.id]: recommendation.mentor_id }))}
                                  className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                                    recommendation.eligible
                                      ? "border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/40 hover:shadow-sm"
                                      : "border-slate-200 bg-slate-50/80 opacity-80"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {index === 0 ? (
                                          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">
                                            Best Fit
                                          </span>
                                        ) : null}
                                        <p className="truncate text-sm font-semibold text-slate-800">
                                          {recommendation.mentor_name}
                                        </p>
                                      </div>
                                      <p className="mt-1 text-[11px] text-slate-500">
                                        {recommendation.reasons.join(" • ") || "General fit"}
                                      </p>
                                      <p className="mt-1 text-[11px] text-slate-400">
                                        {recommendation.remainingCapacity > 0
                                          ? `${recommendation.remainingCapacity} slots available`
                                          : "Currently at capacity"}
                                      </p>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                                      {recommendation.score}%
                                    </span>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400">No suggestions yet</p>
                            )}
                            <p className="text-[11px] text-slate-400">
                              Suggestions are advisory. Admin still decides the final assignment.
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">Mentor already assigned.</p>
                        )}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="space-y-1.5">
                          <p className="font-medium text-slate-700">{assignedGuide}</p>
                          {fallbackGuide?.specialization ? (
                            <p className="text-xs text-slate-500">{fallbackGuide.specialization}</p>
                          ) : null}
                          {currentGuideId && fallbackGuide ? (
                            <p className="text-[11px] text-slate-400">
                              Load: {getGuideWorkload(currentGuideId)}/{getMentorCapacity(fallbackGuide)} teams
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400">No guide assigned yet</p>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        {isAssigned ? (
                          <div className="space-y-1.5">
                            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              Assigned
                            </span>
                            <p className="text-[11px] text-slate-400">Team already has a confirmed guide.</p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                              Unassigned
                            </span>
                            <p className="text-[11px] text-slate-400">Needs admin approval and assignment.</p>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="flex min-w-[220px] flex-col gap-2.5">
                          <select
                            value={selection}
                            onChange={(event) => setSelectedGuides((prev) => ({ ...prev, [project.id]: event.target.value }))}
                            className="glass-input rounded-xl px-3 py-2.5 text-sm text-slate-700"
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
                            className="rounded-xl px-3 py-2.5 text-sm font-semibold btn-primary disabled:cursor-not-allowed disabled:opacity-50"
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
                    <td colSpan={6} className="px-6 py-10 text-center">
                      <div className="mx-auto max-w-sm space-y-2">
                        <p className="text-sm font-medium text-slate-700">No teams matched this filter.</p>
                        <p className="text-sm text-slate-500">Try switching the class filter or refresh the latest project data.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppFrame>
  );
}

