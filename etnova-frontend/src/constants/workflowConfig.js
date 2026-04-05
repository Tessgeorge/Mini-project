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
  return role === "mentor" ? stage.mentorTab : stage.studentTab;
}

export function getWorkflowActionLabel(stageValue, role = "student") {
  const destination = getWorkflowDestination(stageValue, role);
  if (role === "mentor") {
    return destination === "ideas" ? "Open Idea Reviews" : "Open Evaluation";
  }
  return destination === "ideas" ? "Open Idea Workspace" : "Open Submissions";
}

function normalizeDocumentType(value) {
  return String(value || "").trim().toLowerCase();
}

function extractEvaluationStages(evaluations = []) {
  return new Set(
    evaluations
      .map((entry) => normalizeWorkflowStage(entry?.phase || entry?.evaluation_type))
      .filter(Boolean)
  );
}

function extractDocumentTypes(documents = []) {
  return new Set(documents.map((entry) => normalizeDocumentType(entry?.document_type)).filter(Boolean));
}

export function getWorkflowSnapshot({ project, documents = [], evaluations = [] }) {
  const documentTypes = extractDocumentTypes(documents);
  const evaluationStages = extractEvaluationStages(evaluations);
  const normalizedProjectStatus = String(project?.status || "").trim().toLowerCase();
  const hasApprovedIdea = Boolean(project?.approved_idea_id) || normalizedProjectStatus === "completed";

  let stageKey = "idea";
  let isCompleted = false;

  if (normalizedProjectStatus === "completed") {
    stageKey = "final_review";
    isCompleted = true;
  } else if (!hasApprovedIdea) {
    stageKey = "idea";
  } else if (!documentTypes.has("abstract")) {
    stageKey = "abstract";
  } else if (!evaluationStages.has("zeroth_review")) {
    stageKey = "zeroth_review";
  } else if (!evaluationStages.has("first_review")) {
    stageKey = "first_review";
  } else if (!evaluationStages.has("second_review")) {
    stageKey = "second_review";
  } else if (!evaluationStages.has("final_review")) {
    stageKey = "final_review";
  } else {
    stageKey = "final_review";
    isCompleted = true;
  }

  const meta = getWorkflowStageMeta(stageKey);
  const index = WORKFLOW_TIMELINE.findIndex((stage) => stage.key === meta.key);
  const progressPercent = isCompleted
    ? 100
    : Math.round(((Math.max(index, 0) + 1) / WORKFLOW_TIMELINE.length) * 100);

  return {
    ...meta,
    index: Math.max(index, 0),
    isCompleted,
    progressPercent,
  };
}
