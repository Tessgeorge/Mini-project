import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import IdeaWorkspacePanel from "../components/IdeaWorkspacePanel";
import { fetchStudentBootstrapData, invalidateStudentBootstrapCache } from "../services/studentData";

function StatusBadge({ status }) {
  const normalized = (status || "pending").toLowerCase();
  const map = {
    pending: {
      cls: "bg-amber-50 text-amber-700 border-amber-200",
      icon: "hourglass_top",
      label: "Pending",
    },
    approved: {
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: "verified",
      label: "Approved",
    },
    rejected: {
      cls: "bg-rose-50 text-rose-700 border-rose-200",
      icon: "cancel",
      label: "Rejected",
    },
    completed: {
      cls: "bg-blue-50 text-blue-700 border-blue-200",
      icon: "task_alt",
      label: "Completed",
    },
  };

  const config = map[normalized] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${config.cls}`}>
      <span className="material-symbols-outlined text-sm">{config.icon}</span>
      {config.label}
    </span>
  );
}

export default function IdeaWorkspace() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [project, setProject] = useState(null);

  const loadData = async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const { profile: me, projects } = await fetchStudentBootstrapData({ force });
      setProfile(me || null);
      setProject(projects?.[0] || null);
    } catch (loadError) {
      setError(loadError.message || "Failed to load idea workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen etnova-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block size-12 border-4 border-slate-200 border-t-[#00D2C4] rounded-full animate-spin" />
          <p className="mt-4 text-slate-600 font-medium">Loading idea workspace...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen etnova-bg flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="size-20 rounded-2xl mx-auto mb-5 flex items-center justify-center bg-slate-100">
            <span className="material-symbols-outlined text-4xl text-slate-400">lightbulb_circle</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">No Team Found</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Create or join a team first to start managing project ideas.
          </p>
          <button
            type="button"
            onClick={() => navigate("/student/dashboard")}
            className="mt-6 px-5 py-3 rounded-xl text-black font-bold text-sm hover:opacity-90 transition-all"
            style={{ backgroundColor: "#00D2C4" }}
          >
            Back to Dashboard
          </button>
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
              <span className="material-symbols-outlined text-black">lightbulb</span>
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-none">Idea Workspace</h1>
              <p className="text-xs text-slate-500 mt-0.5">Manage draft ideas, submissions, and mentor feedback</p>
            </div>
          </div>
          <StatusBadge status={project.status} />
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-5">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <IdeaWorkspacePanel
          project={project}
          profile={profile}
          onRefresh={async () => {
            invalidateStudentBootstrapCache();
            await loadData(true);
          }}
        />
      </main>
    </div>
  );
}
