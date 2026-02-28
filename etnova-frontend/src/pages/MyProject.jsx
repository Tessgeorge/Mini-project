import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../config/apiClient";

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() >= 5 ? y : y - 1;
  return `${start}-${start + 1}`;
}



// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SectionHead({ icon, title, badge }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="font-black text-slate-900 flex items-center gap-2 text-base">
        <span className="material-symbols-outlined text-lg" style={{ color: "#00D2C4" }}>
          {icon}
        </span>
        {title}
      </h2>
      {badge}
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

function StatusBadge({ status }) {
  const s = (status || "pending").toLowerCase();
  const map = {
    approved: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "verified", label: "Approved" },
    completed: { cls: "bg-blue-50   text-blue-700   border-blue-200", icon: "task_alt", label: "Completed" },
    rejected: { cls: "bg-rose-50   text-rose-700   border-rose-200", icon: "cancel", label: "Rejected" },
    active: { cls: "bg-amber-50  text-amber-700  border-amber-200", icon: "hourglass_top", label: "In Progress" },
  };
  const { cls, icon, label } = map[s] || { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: "hourglass_top", label: "In Progress" };
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

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function MyProject({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [me, projects] = await Promise.all([
          apiRequest("/profile"),
          apiRequest("/projects"),
        ]);
        setProfile(me);
        const p = projects?.[0];
        if (!p?.id) { setProject(null); return; }
        const detail = await apiRequest(`/projects/${p.id}`);
        setProject(detail);
      } catch (err) {
        setError(err.message || "Failed to load project");
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const teamName = project?.title ? `${project.title} Team` : "My Team";
  const department = profile?.department || project?.team_members?.[0]?.profiles?.department || "-";

  const checklist = useMemo(() => {
    const docs = project?.documents || [];
    const evals = project?.evaluations || [];
    return [
      {
        label: "Proposal Submitted",
        sub: "Initial project brief submitted for review",
        done: docs.some((d) => ["proposal", "abstract", "srs"].includes(d.document_type)),
        icon: "description",
      },
      {
        label: "Mid-Review Completed",
        sub: "Progress evaluation conducted by mentor",
        done: evals.some((e) => e.evaluation_type === "mid_review"),
        icon: "rate_review",
      },
      {
        label: "Final Submitted",
        sub: "Final report and presentation uploaded",
        done: docs.some((d) => ["final_report", "presentation"].includes(d.document_type)),
        icon: "task_alt",
      },
    ];
  }, [project]);

  // â”€â”€ Loading â”€â”€
  if (loading) return (
    <div className="min-h-screen etnova-bg flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block size-12 border-4 border-slate-200 border-t-[#00D2C4] rounded-full animate-spin" />
        <p className="mt-4 text-slate-600 font-medium">Loading project record...</p>
      </div>
    </div>
  );

  // â”€â”€ No project â”€â”€
  if (!project) return (
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

  return (
    <div className="min-h-screen etnova-bg">

      {/* â”€â”€ Sticky Page Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="glass-topbar sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#00D2C4" }}>
              <span className="material-symbols-outlined text-black">folder_open</span>
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-none">My Project</h1>
              <p className="text-xs text-slate-500 mt-0.5">Official academic identity record</p>
            </div>
          </div>
          <StatusBadge status={project.status} />
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-7 space-y-6">

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="material-symbols-outlined text-base">error</span>{error}
          </div>
        )}

        {/* â•â• SECTION 1 â€“ Project Overview â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Teal accent bar */}
          <div className="h-1" style={{ background: "linear-gradient(90deg,#00D2C4,#00a89d)" }} />
          <div className="p-6">
            <SectionHead icon="article" title="Project Overview" />

            {/* Title hero */}
            <div className="mb-6 p-5 rounded-xl border border-white/60 bg-white/40">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Project Title</p>
              <h3 className="text-xl font-black text-slate-900">{project.title}</h3>
            </div>

            {/* Grid of fields */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
              <FieldBlock label="Academic Year">{getAcademicYear()}</FieldBlock>
              <FieldBlock label="Department">{department}</FieldBlock>
              <FieldBlock label="Domain / Category">
                {project.domain || department}
              </FieldBlock>
              <FieldBlock label="Project ID">
                <span className="font-mono text-xs text-slate-600">
                  {`PRJ-${project.id?.slice(0, 8)?.toUpperCase()}`}
                </span>
              </FieldBlock>
            </div>

            {/* Abstract */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Abstract</p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {project.abstract || project.description || "Abstract not added yet. Update your project to add the academic abstract."}
              </p>
            </div>
          </div>
        </section>



        {/* â•â• SECTION 3 + 4 â€“ Team & Mentor â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Team Summary */}
          <section className="glass-card-strong overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <SectionHead icon="group" title="Team Summary"
                badge={
                  <button
                    onClick={() => onNavigate?.("team")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-black text-xs font-bold transition-all hover:opacity-90"
                    style={{ backgroundColor: "#00D2C4" }}>
                    <span className="material-symbols-outlined text-sm">manage_accounts</span>
                    Manage Team
                  </button>
                }
              />
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">
                {teamName}
              </p>
              <div className="space-y-3">
                {(project.team_members || []).length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No team members found.</p>
                ) : (
                  (project.team_members || [])
                    .sort((a, b) => a.role === "leader" ? -1 : b.role === "leader" ? 1 : 0)
                    .map((m) => (
                      <div key={m.id} className="flex items-center gap-3">
                        <Avatar name={m.profiles?.full_name} size={8} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate">
                            {m.profiles?.full_name || "Unnamed"}
                          </p>
                          <p className="text-xs text-slate-400">{m.profiles?.roll_number || m.profiles?.email || ""}</p>
                        </div>
                        {m.role === "leader" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                            style={{ backgroundColor: "rgba(0,210,196,0.12)", color: "#00897B" }}>
                            <span className="material-symbols-outlined text-xs">star</span>Leader
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

          {/* Mentor Information */}
          <section className="glass-card-strong overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <SectionHead icon="school" title="Mentor Information" />
            </div>
            <div className="p-5">
              {!project.mentor ? (
                <div className="py-8 flex flex-col items-center text-center gap-3">
                  <div className="size-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl text-slate-400">person_off</span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-700">Pending Assignment</p>
                    <p className="text-xs text-slate-400 mt-1">A mentor will be assigned by the administrator.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <Avatar name={project.mentor.full_name} size={12} />
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="font-black text-slate-900 text-base">{project.mentor.full_name}</p>
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        <span className="material-symbols-outlined text-xs">verified</span>Assigned
                      </span>
                    </div>
                    <div className="space-y-2 pt-1">
                      {[
                        { label: "Designation", value: project.mentor.department || "Faculty Mentor" },
                        { label: "Email", value: project.mentor.email || "-" },
                        { label: "Department", value: project.mentor.department || "-" },
                      ].map((r) => (
                        <div key={r.label}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{r.label}</p>
                          <p className="text-sm font-bold text-slate-800 break-all">{r.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* â•â• SECTION 5 â€“ Project Timeline Checklist â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <section className="glass-card-strong p-6">
          <SectionHead icon="checklist" title="Project Timeline Checklist" />
          <div className="relative">
            {/* Vertical connector */}
            <div className="absolute left-[17px] top-6 bottom-6 w-px bg-slate-100" />
            <div className="space-y-5">
              {checklist.map((item, i) => (
                <div key={item.label} className="flex items-start gap-4">
                  <div
                    className={`size-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${item.done
                      ? "bg-emerald-400 text-white shadow-sm"
                      : i === checklist.findIndex((c) => !c.done)
                        ? "border-2 border-[#00D2C4] text-[#00D2C4] bg-white"
                        : "border-2 border-slate-200 text-slate-300 bg-white"
                      }`}
                  >
                    <span className="material-symbols-outlined text-base">
                      {item.done ? "check" : item.icon}
                    </span>
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-black ${item.done ? "text-slate-900" : "text-slate-500"}`}>
                        {item.label}
                      </p>
                      {item.done
                        ? <span className="text-xs font-bold text-emerald-600">Done</span>
                        : i === checklist.findIndex((c) => !c.done)
                          ? <span className="text-xs font-bold" style={{ color: "#00D2C4" }}>Current</span>
                          : <span className="text-xs text-slate-400">Pending</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>


      </main>
    </div>
  );
}
