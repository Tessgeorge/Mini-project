import { DEFAULT_GUIDES } from "./adminStorage";

function uniqueClassesFromTeams(teams) {
  return Array.from(new Set(teams.map((team) => team.class)));
}

function mentorPendingReason(pending) {
  if (pending >= 3) return "Marks not entered";
  if (pending === 2) return "Review sheet incomplete";
  return "Pending verification";
}

export function getAcademicActivity({ reviewStages, teams, selectedClass = "All" }) {
  const activeStage = reviewStages.find((stage) => stage.status === "Active")?.name || "-";
  const classList = uniqueClassesFromTeams(teams);
  const scopeTeams = selectedClass === "All" ? teams : teams.filter((team) => team.class === selectedClass);

  const stageTeams = activeStage === "-"
    ? scopeTeams
    : scopeTeams.filter((team) => team.stage === activeStage);

  const submitted = stageTeams.filter((team) => team.submissionStatus === "Submitted").length;
  const late = stageTeams.filter((team) => team.submissionStatus === "Late").length;
  const pendingTeams = stageTeams.filter(
    (team) => team.submissionStatus === "Pending" || team.submissionStatus === "Late"
  );

  const guideNames = Array.from(
    new Set([
      ...DEFAULT_GUIDES.map((guide) => guide.name),
      ...scopeTeams.map((team) => team.guide).filter(Boolean),
    ])
  );

  const mentorRows = guideNames.map((guideName) => {
    const mentorTeams = scopeTeams.filter((team) => team.guide === guideName);
    const pending = mentorTeams.filter((team) => team.submissionStatus !== "Submitted").length;
    return { name: guideName, class: selectedClass === "All" ? "All" : selectedClass, pending };
  }).filter((mentor) => mentor.pending > 0 || scopeTeams.some((team) => team.guide === mentor.name));

  const totalAssigned = scopeTeams.filter((team) => Boolean(team.guide)).length;
  const completed = scopeTeams.filter(
    (team) => team.guide && team.submissionStatus === "Submitted"
  ).length;

  const pendingDetails = mentorRows
    .filter((item) => item.pending > 0)
    .flatMap((item) =>
      scopeTeams
        .filter((team) => team.guide === item.name && team.submissionStatus !== "Submitted")
        .map((team) => ({
          mentor: item.name,
          team: team.name,
          class: team.class,
          reason: mentorPendingReason(item.pending),
        }))
    )
    .slice(0, 6);

  return {
    activeStage,
    classes: classList,
    student: {
      stage: activeStage,
      total: stageTeams.length,
      submitted,
      late,
      teams: pendingTeams.slice(0, 8),
    },
    mentor: {
      totalAssigned,
      completed,
      mentors: mentorRows,
      pendingDetails,
    },
  };
}
