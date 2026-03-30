import { useEffect, useState } from "react";
import DiscussionChat from "../components/DiscussionChat";
import { fetchStudentBootstrapData } from "../services/studentData";

export default function StudentDiscussion() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const bootstrap = await fetchStudentBootstrapData();
        if (!mounted) return;

        setProfile(bootstrap?.profile || null);
        const currentProject = bootstrap?.projects?.[0] || null;
        setProject(currentProject);
      } catch (e) {
        if (!mounted) return;
        setError(e.message || "Failed to load discussion.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="etnova-bg min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="size-12 border-4 border-white/30 border-t-[#00C4B4] rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-slate-600 text-sm font-semibold">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="etnova-bg min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  if (!project?.id || !profile?.id) {
    return (
      <div className="etnova-bg min-h-screen flex items-center justify-center text-slate-500 text-sm">No project found.</div>
    );
  }

  return (
    <DiscussionChat
      projectId={project.id}
      userId={profile.id}
      userRole="student"
      userName={profile.full_name || "Student"}
      initialProject={project}
      initialMembers={project.team_members || []}
      initialTitle={project.title || "Team Discussion"}
    />
  );
}
