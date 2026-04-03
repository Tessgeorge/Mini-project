import DiscussionChat from "../components/DiscussionChat";

export default function MentorDiscussion({
  projId,
  mentorId,
  members = [],
  mentorName = "Mentor",
  projectTitle = "Team Project",
  initialProject = null,
}) {
  const chatShellClass = "h-[calc(100vh-250px)] min-h-[560px] min-h-0";

  if (!projId || !mentorId) {
    return (
      <div className={`${chatShellClass} bg-slate-100 rounded-3xl border border-slate-200 flex items-center justify-center text-slate-500 text-sm`}>
        Discussion unavailable.
      </div>
    );
  }

  return (
    <div className={chatShellClass}>
      <DiscussionChat
        projectId={projId}
        userId={mentorId}
        userRole="mentor"
        userName={mentorName}
        initialProject={initialProject}
        initialMembers={members}
        initialTitle={projectTitle}
        embedded
      />
    </div>
  );
}
