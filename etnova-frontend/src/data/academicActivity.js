import { DEFAULT_GUIDES } from "./adminStorage";

const PENDING_TEAM_LIMIT = 2;

function uniqueClassesFromTeams(teams, classActiveStageMap = {}) {
  const teamClasses = teams.map((team) => team.class).filter(Boolean);
  const stageClasses = Object.keys(classActiveStageMap || {});
  return Array.from(new Set([...teamClasses, ...stageClasses]));
}

function mentorPendingReason(pending) {
  if (pending >= 3) return "Marks not entered";
  if (pending === 2) return "Review sheet incomplete";
  return "Pending verification";
}

function resolveActiveStage({ selectedClass, classList, classActiveStageMap, reviewStages }) {
  if (selectedClass !== "All") {
    return classActiveStageMap?.[selectedClass] || "-";
  }

  const allStages = classList.map((className) => classActiveStageMap?.[className]).filter(Boolean);

  if (allStages.length === 0) {
    return reviewStages.find((stage) => stage.status === "Active")?.name || "-";
  }

  return new Set(allStages).size === 1 ? allStages[0] : "Multiple";
}

export function getAcademicActivity({ reviewStages, teams, selectedClass = "All", classActiveStageMap = {} }) {
  const classList = uniqueClassesFromTeams(teams, classActiveStageMap);
  const activeStage = resolveActiveStage({ selectedClass, classList, classActiveStageMap, reviewStages });
  const scopeTeams = selectedClass === "All" ? teams : teams.filter((team) => team.class === selectedClass);

  const stageTeams = selectedClass === "All" || activeStage === "-" || activeStage === "Multiple"
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
      teams: pendingTeams
        .map((team) => ({
          ...team,
          status: team.submissionStatus || "Pending",
        }))
        .slice(0, PENDING_TEAM_LIMIT),
    },
    mentor: {
      totalAssigned,
      completed,
      mentors: mentorRows,
      pendingDetails,
    },
  };
}
