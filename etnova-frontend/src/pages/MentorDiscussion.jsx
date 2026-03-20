import DiscussionChat from "../components/DiscussionChat";

export default function MentorDiscussion({
  projId,
  mentorId,
  members = [],
  mentorName = "Mentor",
  projectTitle = "Team Project",
}) {
  if (!projId || !mentorId) {
    return (
      <div className="h-[calc(100vh-250px)] min-h-[560px] bg-slate-100 rounded-3xl border border-slate-200 flex items-center justify-center text-slate-500 text-sm">
        Discussion unavailable.
      </div>
    );
  }

  return (
    <DiscussionChat
      projectId={projId}
      userId={mentorId}
      userRole="mentor"
      userName={mentorName}
      initialMembers={members}
      initialTitle={projectTitle}
    />
  );
}
