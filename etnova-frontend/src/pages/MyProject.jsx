import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProjectDiaryPanel from "../components/ProjectDiaryPanel";
import {
  fetchStudentBootstrapData,
  invalidateStudentBootstrapCache,
} from "../services/studentData";

function getAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() >= 5 ? y : y - 1;
  return `${start}-${start + 1}`;
}

function normalizeTechnologyStacks(stacks) {
  if (!stacks) return [];
  if (Array.isArray(stacks)) {
    return stacks.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(stacks)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function SectionHead({ icon, title, badge }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="flex items-center gap-2 text-base font-black text-slate-900 leading-tight">
        <span className="material-symbols-outlined text-lg" style={{ color: "#00D2C4" }}>
          {icon}
        </span>
        {title}
      </h2>
      {badge ? <div className="self-start sm:self-auto">{badge}</div> : null}
    </div>
  );
}

function FieldBlock({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <div className="text-sm font-bold text-slate-900">{children}</div>
    </div>
  );
}

function StatusBadge({ project }) {
  const normalized = (project?.status || "pending").toLowerCase();
  const hasApprovedIdea = Boolean(project?.approved_idea_id);
  const map = {
    pending: {
      cls: "bg-amber-50 text-amber-700 border-amber-200",
      icon: "hourglass_top",
      label: "In Progress",
    },
    active: {
      cls: "bg-amber-50 text-amber-700 border-amber-200",
      icon: "hourglass_top",
      label: "In Progress",
    },
    approved: {
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: "verified",
      label: "Approved",
    },
    completed: {
      cls: "bg-blue-50 text-blue-700 border-blue-200",
      icon: "task_alt",
      label: "Completed",
    },
    rejected: {
      cls: "bg-rose-50 text-rose-700 border-rose-200",
      icon: "cancel",
      label: "Rejected",
    },
  };

  const shouldShowApproved = hasApprovedIdea && normalized !== "completed";
  const view = shouldShowApproved ? map.approved : (map[normalized] || map.pending);
  const { cls, icon, label } = view;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${cls}`}>
      <span className="material-symbols-outlined text-sm">{icon}</span>
      {label}
    </span>
  );
}

function Avatar({ name, size = 9 }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const palette = ["#00D2C4", "#6366f1", "#f59e0b", "#10b981", "#f43f5e", "#8b5cf6"];
  const bg = palette[initial.charCodeAt(0) % palette.length];
  return (
    <div
      className={`size-${size} rounded-full flex items-center justify-center font-black text-white text-sm flex-shrink-0`}
      style={{ backgroundColor: bg }}
    >
      {initial}
    </div>
  );
}

export default function MyProject() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { profile: me, projects } = await fetchStudentBootstrapData();
        setProfile(me);
        setProject(projects?.[0] || null);
      } catch (err) {
        setError(err.message || "Failed to load project");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const teamName = project?.title ? `${project.title} Team` : "My Team";
  const mentorContact = project?.mentor || project?.guide || null;
  const mentorDepartment =
    mentorContact?.department || project?.mentor?.department || project?.guide?.department || "-";
  const department =
    profile?.department || project?.team_members?.[0]?.profiles?.department || "-";
  const displayedIdea = useMemo(
    () => project?.approved_idea || project?.current_idea || project?.active_idea || null,
    [project?.active_idea, project?.approved_idea, project?.current_idea],
  );

  const technologyStacks = useMemo(
    () => normalizeTechnologyStacks(displayedIdea?.technologies || project?.technology_stacks),
    [displayedIdea?.technologies, project?.technology_stacks],
  );

  const displayedDomain = displayedIdea?.domain || project?.domain || "";
  const displayedDescription = displayedIdea?.description || project?.description || "";

  if (loading) {
    return (
      <div className="min-h-screen etnova-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block size-12 border-4 border-slate-200 border-t-[#00D2C4] rounded-full animate-spin" />
          <p className="mt-4 text-slate-600 font-medium">Loading project record...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen etnova-bg flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="size-20 rounded-2xl mx-auto mb-5 flex items-center justify-center bg-slate-100">
            <span className="material-symbols-outlined text-4xl text-slate-400">folder_off</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">No Project Found</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Join or create a project to view its official academic record here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full md:min-h-screen etnova-bg">
      <div className="glass-topbar sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#00D2C4" }}>
              <span className="material-symbols-outlined text-black">folder_open</span>
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-none">My Project</h1>
              <p className="text-xs text-slate-500 mt-0.5">Official academic identity record</p>
            </div>
          </div>
          <StatusBadge project={project} />
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-6">
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </div>
        )}

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1" style={{ background: "linear-gradient(90deg,#00D2C4,#00a89d)" }} />
          <div className="p-4 sm:p-6">
            <SectionHead
              icon="article"
              title="Project Overview"
            />

            <div className="mb-5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Project Title
              </p>
              <h3 className="max-w-4xl break-words text-xl font-black leading-snug text-slate-900 sm:text-2xl">
                {project?.title || "Untitled Project"}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
              <FieldBlock label="Academic Year">{getAcademicYear()}</FieldBlock>
              <FieldBlock label="Department">{department}</FieldBlock>
              <FieldBlock label="Domain / Category">{displayedDomain || "Not specified"}</FieldBlock>
              <FieldBlock label="Project ID">
                <span className="font-mono text-xs text-slate-600">
                  {`PRJ-${project.id?.slice(0, 8)?.toUpperCase()}`}
                </span>
              </FieldBlock>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {displayedDescription || "Description not added yet."}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Technology Stacks
              </p>
              {technologyStacks.length ? (
                <div className="flex flex-wrap gap-2">
                  {technologyStacks.map((stack) => (
                    <span
                      key={stack}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200"
                    >
                      {stack}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No technology stack added yet.</p>
              )}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="glass-card-strong overflow-hidden">
            <div className="px-4 sm:px-6 py-5 border-b border-slate-100">
              <SectionHead
                icon="group"
                title="Team Summary"
                badge={
                  <button
                    onClick={() => navigate("/student/team")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-black text-xs font-bold transition-all hover:opacity-90"
                    style={{ backgroundColor: "#00D2C4" }}
                  >
                    <span className="material-symbols-outlined text-sm">manage_accounts</span>
                    Manage Team
                  </button>
                }
              />
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">{teamName}</p>
              <div className="space-y-3">
                {(project.team_members || []).length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No team members found.</p>
                ) : (
                  (project.team_members || [])
                    .sort((a, b) => (a.role === "leader" ? -1 : b.role === "leader" ? 1 : 0))
                    .map((member) => (
                      <div key={member.id} className="flex items-center gap-3">
                        <Avatar name={member.profiles?.full_name} size={8} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate">
                            {member.profiles?.full_name || "Unnamed"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {member.profiles?.roll_number || member.profiles?.email || ""}
                          </p>
                        </div>
                        {member.role === "leader" && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                            style={{ backgroundColor: "rgba(0,210,196,0.12)", color: "#00897B" }}
                          >
                            <span className="material-symbols-outlined text-xs">star</span>
                            Leader
                          </span>
                        )}
                      </div>
                    ))
                )}
              </div>
              <p className="mt-4 text-[10px] text-slate-400 italic flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">lock</span>
                Read-only - use Manage Team to make changes.
              </p>
            </div>
          </section>

          <section className="glass-card-strong overflow-hidden">
            <div className="px-4 sm:px-6 py-5 border-b border-slate-100">
              <SectionHead icon="school" title="Mentor Information" />
            </div>
            <div className="p-5">
              {!mentorContact ? (
                <div className="py-8 flex flex-col items-center text-center gap-3">
                  <div className="size-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl text-slate-400">person_off</span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-700">Pending Assignment</p>
                    <p className="text-xs text-slate-400 mt-1">
                      A guide will be assigned by the administrator.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <Avatar name={mentorContact.full_name} size={12} />
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="font-black text-slate-900 text-base">{mentorContact.full_name}</p>
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        <span className="material-symbols-outlined text-xs">verified</span>
                        Assigned
                      </span>
                    </div>
                    <div className="space-y-2 pt-1">
                      {[
                        { label: "Role", value: project?.guide ? "Project Guide" : "Mentor" },
                        { label: "Email", value: mentorContact.email || "-" },
                        { label: "Department", value: mentorDepartment },
                      ].map((row) => (
                        <div key={row.label}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{row.label}</p>
                          <p className="text-sm font-bold text-slate-800 break-all">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <ProjectDiaryPanel
          project={project}
          currentUserId={profile?.id}
          currentUserName={profile?.full_name}
          role="student"
        />

      </main>
    </div>
  );
}

