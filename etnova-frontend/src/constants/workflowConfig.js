export const WORKFLOW_TIMELINE = [
  {
    key: "idea",
    label: "Idea Approval",
    description: "Draft, refine, and submit a project idea for mentor approval.",
    studentTab: "ideas",
    mentorTab: "ideas",
  },
  {
    key: "abstract",
    label: "Abstract Submission",
    description: "Upload the approved abstract and supporting concept documents.",
    studentTab: "submissions",
    mentorTab: "submissions",
  },
  {
    key: "zeroth_review",
    label: "Zeroth Review",
    description: "Validate scope, feasibility, and initial direction with the mentor.",
    studentTab: "submissions",
    mentorTab: "evaluation",
  },
  {
    key: "first_review",
    label: "First Review",
    description: "Present early implementation progress and planned next steps.",
    studentTab: "submissions",
    mentorTab: "evaluation",
  },
  {
    key: "second_review",
    label: "Second Review",
    description: "Show substantial build progress, testing status, and blockers.",
    studentTab: "submissions",
    mentorTab: "evaluation",
  },
  {
    key: "final_review",
    label: "Final Review",
    description: "Deliver the final report, presentation, and end-stage evaluation.",
    studentTab: "submissions",
    mentorTab: "evaluation",
  },
];

export const EVALUATION_STAGE_OPTIONS = WORKFLOW_TIMELINE
  .filter((stage) => stage.key !== "idea")
  .map((stage) => stage.label);

const STAGE_ALIAS_MAP = {
  idea: "idea",
  "idea approval": "idea",
  research: "idea",

  team_formation: "team_formation",
  "team formation": "team_formation",

  abstract: "abstract",
  "abstract submission": "abstract",
  proposal: "abstract",

  "0th review": "zeroth_review",
  "zeroth review": "zeroth_review",
  "phase 1": "zeroth_review",

  "1st review": "first_review",
  "first review": "first_review",
  "phase 2": "first_review",
  development: "first_review",

  "2nd review": "second_review",
  "second review": "second_review",
  "phase 3": "second_review",
  testing: "second_review",

  "final review": "final_review",
  "final pitch": "final_review",
  final: "final_review",
};

export function normalizeWorkflowStage(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return STAGE_ALIAS_MAP[normalized] || normalized;
}

function humanizeWorkflowStageLabel(value) {
  const source = String(value || "").trim();
  if (!source) return "Untitled Stage";

  return source
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getWorkflowStageMeta(value) {
  const key = normalizeWorkflowStage(value);
  const matched = WORKFLOW_TIMELINE.find((stage) => stage.key === key);
  if (matched) return matched;

  return {
    key,
    label: humanizeWorkflowStageLabel(value || key),
    description: "",
    studentTab: "submissions",
    mentorTab: "submissions",
  };
}

export function getWorkflowDestination(stageValue, role = "student") {
  const stage = getWorkflowStageMeta(stageValue);
  if (stage.key === "team_formation") {
    return "team";
  }
  if (stage.key === "idea") {
    return role === "mentor" ? "ideas" : "ideas";
  }
  return role === "mentor" ? "evaluation" : "submissions";
}

export function getWorkflowActionLabel(stageValue, role = "student") {
  const stage = getWorkflowStageMeta(stageValue);
  if (stage.key === "team_formation") {
    return role === "mentor" ? "Open Team Details" : "Open Team Page";
  }
  if (stage.key === "idea") {
    return role === "mentor" ? "Open Idea Reviews" : "Open Idea Workspace";
  }
  return role === "mentor" ? "Open Evaluation" : "Open Submissions";
}

function normalizeDocumentType(value) {
  return String(value || "").trim().toLowerCase();
}

function getLatestDocumentByType(documents = [], type) {
  const normalizedType = normalizeDocumentType(type);
  return (documents || [])
    .filter((entry) => normalizeDocumentType(entry?.document_type) === normalizedType)
    .sort((a, b) => {
      const versionDelta = Number(b?.version || 0) - Number(a?.version || 0);
      if (versionDelta !== 0) return versionDelta;
      return new Date(b?.uploaded_at || 0).getTime() - new Date(a?.uploaded_at || 0).getTime();
    })[0] || null;
}

function isGuideApproved(document) {
  return String(document?.status || "").trim().toLowerCase() === "approved";
}

function isCoordinatorApproved(document) {
  return Boolean(document?.coordinator_verified);
}

function hasDeadlinePassed(stageKey, deadlines = []) {
  const matchingDeadline = (deadlines || []).find((deadline) => (
    normalizeWorkflowStage(deadline?.stageKey || deadline?.stage) === normalizeWorkflowStage(stageKey)
  ));

  if (!matchingDeadline?.deadline && !matchingDeadline?.date) return false;
  return new Date(matchingDeadline.deadline || matchingDeadline.date).getTime() < Date.now();
}

export function getWorkflowProgress({ project, documents = [], deadlines = [] }) {
  const normalizedProjectStatus = String(project?.status || "").trim().toLowerCase();
  const hasApprovedIdea = Boolean(project?.approved_idea_id) || normalizedProjectStatus === "completed";
  const abstractDocument = getLatestDocumentByType(documents, "abstract");
  const zerothReviewPresentation = getLatestDocumentByType(documents, "zeroth_review_ppt");
  const firstReviewPresentation = getLatestDocumentByType(documents, "first_review_ppt");
  const finalReviewPresentation = getLatestDocumentByType(documents, "final_review_ppt");
  const projectFinalReport = getLatestDocumentByType(documents, "project_final_report");

  const milestones = [
    {
      key: "idea",
      label: "Idea Approval",
      completed: hasApprovedIdea,
      date: project?.approved_idea?.updated_at || project?.approved_idea?.submitted_at || null,
    },
    {
      key: "abstract",
      label: "Abstract Submission",
      completed: isGuideApproved(abstractDocument),
      date: isGuideApproved(abstractDocument) ? abstractDocument?.uploaded_at : null,
    },
    {
      key: "zeroth_review",
      label: "Zeroth Review",
      completed: isGuideApproved(zerothReviewPresentation) && hasDeadlinePassed("zeroth_review", deadlines),
      date: (isGuideApproved(zerothReviewPresentation) && hasDeadlinePassed("zeroth_review", deadlines))
        ? zerothReviewPresentation?.uploaded_at
        : null,
    },
    {
      key: "first_review",
      label: "First Review",
      completed: isGuideApproved(firstReviewPresentation) && hasDeadlinePassed("first_review", deadlines),
      date: (isGuideApproved(firstReviewPresentation) && hasDeadlinePassed("first_review", deadlines))
        ? firstReviewPresentation?.uploaded_at
        : null,
    },
    {
      key: "second_review",
      label: "Second Review",
      completed: hasDeadlinePassed("second_review", deadlines),
      date: hasDeadlinePassed("second_review", deadlines)
        ? ((deadlines || []).find((deadline) => normalizeWorkflowStage(deadline?.stageKey || deadline?.stage) === "second_review")?.deadline || null)
        : null,
    },
    {
      key: "final_review",
      label: "Final Review",
      completed: isGuideApproved(finalReviewPresentation) && hasDeadlinePassed("final_review", deadlines),
      date: (isGuideApproved(finalReviewPresentation) && hasDeadlinePassed("final_review", deadlines))
        ? finalReviewPresentation?.uploaded_at
        : null,
    },
  ];

  const finalReportApproved = isGuideApproved(projectFinalReport) && isCoordinatorApproved(projectFinalReport);
  const currentMilestoneIndex = milestones.findIndex((milestone) => !milestone.completed);
  const completedCount = milestones.filter((milestone) => milestone.completed).length;
  const nextMilestone = currentMilestoneIndex === -1 ? null : milestones[currentMilestoneIndex];
  const allStageMilestonesCompleted = currentMilestoneIndex === -1;
  const isCompleted = (allStageMilestonesCompleted && finalReportApproved) || normalizedProjectStatus === "completed";
  const progressPercent = isCompleted
    ? 100
    : Math.round((completedCount / milestones.length) * 99);

  return {
    milestones,
    completedCount,
    currentMilestoneIndex,
    nextMilestone,
    finalReportApproved,
    isCompleted,
    progressPercent,
  };
}

export function getWorkflowSnapshot({ project, documents = [], deadlines = [] }) {
  let stageKey = "idea";
  const progress = getWorkflowProgress({ project, documents, deadlines });
  const milestoneCompletion = new Map(progress.milestones.map((milestone) => [milestone.key, milestone.completed]));

  if (!milestoneCompletion.get("idea")) {
    stageKey = "idea";
  } else if (!milestoneCompletion.get("abstract")) {
    stageKey = "abstract";
  } else if (!milestoneCompletion.get("zeroth_review")) {
    stageKey = "zeroth_review";
  } else if (!milestoneCompletion.get("first_review")) {
    stageKey = "first_review";
  } else if (!milestoneCompletion.get("second_review")) {
    stageKey = "second_review";
  } else {
    stageKey = "final_review";
  }

  const meta = getWorkflowStageMeta(stageKey);
  const index = WORKFLOW_TIMELINE.findIndex((stage) => stage.key === meta.key);

  return {
    ...meta,
    index: Math.max(index, 0),
    isCompleted: progress.isCompleted,
    progressPercent: progress.progressPercent,
  };
}
