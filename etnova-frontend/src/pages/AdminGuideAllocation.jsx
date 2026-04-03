import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabase";
import { apiRequest } from "../config/apiClient";
import AppFrame from "../components/AppFrame";
import Sidebar from "../components/admin/Sidebar";
import TopNavbar from "../components/admin/TopNavbar";
import AllocationSummary from "../components/admin/AllocationSummary";
import { subscribeWithDeferredCleanup } from "../utils/realtimeChannel";

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
  let meaningfulSignalCount = 0;

  const hasDomainMatch = signals.domain && interests.some(
    (item) => item.toLowerCase().includes(signals.domain.toLowerCase())
      || signals.domain.toLowerCase().includes(item.toLowerCase()),
  );
  if (hasDomainMatch) {
    score += 32;
    reasons.push("domain interest aligned");
    meaningfulSignalCount += 1;
  }

  const hasSubdomainMatch = signals.subdomain && mentorTerms.some(
    (term) => signals.subdomain.toLowerCase().includes(term) || term.includes(signals.subdomain.toLowerCase()),
  );
  if (hasSubdomainMatch) {
    score += 18;
    reasons.push("subdomain aligned");
    meaningfulSignalCount += 1;
  }

  const keywordMatches = signals.terms.filter((term) => mentorTerms.includes(term));
  if (keywordMatches.length > 0) {
    score += Math.min(18, keywordMatches.length * 6);
    reasons.push(`matched ${keywordMatches.slice(0, 3).join(", ")}`);
    meaningfulSignalCount += 1;
  }

  const hasSpecializationMatch = (
    mentor?.specialization
    && signals.terms.some((term) => String(mentor.specialization).toLowerCase().includes(term))
  );
  if (
    hasSpecializationMatch
  ) {
    score += 12;
    reasons.push("specialization matched");
    meaningfulSignalCount += 1;
  }

  if (mentorDepartment && projectDepartment && mentorDepartment === projectDepartment) {
    score += 8;
    reasons.push("department aligned");
    meaningfulSignalCount += 1;
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
    meaningfulSignalCount,
    hasMeaningfulSignal: meaningfulSignalCount > 0,
    workload,
    capacity,
    remainingCapacity,
    eligible: remainingCapacity > 0,
  };
}

function buildProjectRecommendations(project, mentors, workloadLookup) {
  return mentors
    .map((mentor) => scoreMentorRecommendation(project, mentor, workloadLookup(mentor.id)))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.workload !== right.workload) return left.workload - right.workload;
      return String(left.mentor_name || "").localeCompare(String(right.mentor_name || ""));
    });
}

function buildDisplayRecommendations(project, mentors, workloadLookup, limit = 3) {
  return buildProjectRecommendations(project, mentors, workloadLookup)
    .filter((recommendation) => recommendation.eligible && recommendation.hasMeaningfulSignal)
    .slice(0, limit);
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
      const suggestions = buildDisplayRecommendations(
        project,
        mentors,
        (mentorId) => getGuideWorkload(mentorId),
      )
      nextMap.set(project.id, suggestions);
    });
    return nextMap;
  }, [getGuideWorkload, mentors, projects]);

  const fetchData = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/admin/guide-allocation-data", force ? { skipCache: true } : {});
      setMentors(((data?.mentors || [])).filter(isMentorProfile));
      setProjects(data?.projects || []);
      setClasses(data?.classes || []);
    } catch (err) {
      setError(err.message || "Failed to load guide allocation data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const onFocus = () => fetchData(true);
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchData(true);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    const channel = supabase
      .channel("guide-allocation-projects-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "guide_allocations" }, () => fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "project_ideas" }, () => fetchData(true))
    const cleanupRealtime = subscribeWithDeferredCleanup(supabase, channel);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      cleanupRealtime();
    };
  }, [fetchData]);

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

      const workloadMap = new Map(mentors.map((mentor) => [mentor.id, getGuideWorkload(mentor.id)]));
      const assignments = [];

      const prioritizedProjects = unassignedProjects
        .map((project) => {
          const ranked = buildProjectRecommendations(
            project,
            mentors,
            (mentorId) => workloadMap.get(mentorId) || 0,
          );
          const eligible = ranked.filter((item) => item.eligible);
          return {
            project,
            eligibleCount: eligible.length,
            topScore: eligible[0]?.score ?? -1,
          };
        })
        .sort((left, right) => {
          if (left.eligibleCount !== right.eligibleCount) return left.eligibleCount - right.eligibleCount;
          if (right.topScore !== left.topScore) return right.topScore - left.topScore;
          return String(left.project.title || "").localeCompare(String(right.project.title || ""));
        });

      for (const { project } of prioritizedProjects) {
        const rankedMentors = buildProjectRecommendations(
          project,
          mentors,
          (mentorId) => workloadMap.get(mentorId) || 0,
        );
        const selected = rankedMentors.find((mentor) => mentor.eligible);
        if (!selected) continue;
        workloadMap.set(selected.mentor_id, (workloadMap.get(selected.mentor_id) || 0) + 1);
        assignments.push({ projectId: project.id, mentorId: selected.mentor_id });
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
          ? `Best-fit allocation complete. ${skipped} project(s) left unassigned due to mentor capacity.`
          : "Best-fit allocation complete.",
      );
      await fetchData(true);
    } catch (err) {
      setError(err.message || "Best-fit allocation failed.");
      alert(err.message || "Best-fit allocation failed.");
      await fetchData(true);
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
      await fetchData(true);
    } catch (err) {
      setError(err.message || "Failed to reset allocation.");
      alert(err.message || "Failed to reset allocation.");
      await fetchData(true);
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
      await fetchData(true);
    } catch (err) {
      setError(err.message || "Failed to assign guide.");
      alert(err.message || "Failed to assign guide.");
      await fetchData(true);
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
    return projects.filter((project) => String(project.class_id || "").trim() === String(selectedClassId).trim());
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
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <section className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800">Guide Allocation</h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runRandomAllocation}
              disabled={loading || saving}
              className="rounded-xl px-4 py-2.5 font-semibold shadow-sm btn-primary disabled:opacity-60"
            >
              Run Best-Fit Allocation
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

        <section className="mb-6">
          <div className="max-w-sm space-y-2">
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
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200/70 px-6 py-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Project Allocation Table</h2>
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
              const hasProjectSignals = Boolean(
                project.detected_domain
                || project.detected_subdomain
                || (project.detected_keywords || []).length > 0
                || (project.technologies || []).length > 0
                || project.team_department,
              );

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
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Domain</p>
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
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Assigned Guide</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{isAssigned ? assignedGuide : "Unassigned"}</p>
                    </div>
                  </div>
                  {!isAssigned ? (
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
                                    {recommendation.reasons.join(" | ") || "General fit"}
                                  </p>
                                </div>
                                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                                  {recommendation.score}%
                                </span>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 text-xs text-slate-500">
                            {hasProjectSignals
                              ? "No strong mentor match yet. Add sharper domain, keywords, or specialization data for better recommendations."
                              : "Awaiting idea signals. Save domain, subdomain, or keywords before showing mentor recommendations."}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 border-t border-slate-200/70 pt-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        value={selection}
                        onChange={(event) => setSelectedGuides((prev) => ({ ...prev, [project.id]: event.target.value }))}
                        className="glass-input min-w-0 flex-1 rounded-lg px-3 py-2 text-sm text-slate-700"
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
                        className="rounded-lg px-3 py-2 text-xs font-semibold btn-primary disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[92px]"
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
                  <th className="px-6 py-3 text-left font-semibold">Domain</th>
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
                  const hasProjectSignals = Boolean(
                    project.detected_domain
                    || project.detected_subdomain
                    || (project.detected_keywords || []).length > 0
                    || (project.technologies || []).length > 0
                    || project.team_department,
                  );

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
                                        {recommendation.reasons.join(" | ") || "General fit"}
                                      </p>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                                      {recommendation.score}%
                                    </span>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-500">
                                {hasProjectSignals
                                  ? "No strong mentor match yet."
                                  : "Awaiting idea signals."}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">-</p>
                        )}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="space-y-1.5">
                          <p className="font-medium text-slate-700">{isAssigned ? assignedGuide : "Unassigned"}</p>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        {isAssigned ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Assigned
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="flex min-w-[180px] flex-col gap-2">
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
                            className="self-start rounded-lg px-3 py-2 text-xs font-semibold btn-primary disabled:cursor-not-allowed disabled:opacity-50"
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

