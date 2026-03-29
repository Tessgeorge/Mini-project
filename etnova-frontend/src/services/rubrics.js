import { apiRequest } from "../config/apiClient";

export const RUBRIC_STAGE_OPTIONS = [
  { value: "review", label: "Review", total: 40 },
  { value: "guide", label: "Guide", total: 15 },
  { value: "ese", label: "External", total: 75 },
];

export const REVIEW_ROUND_OPTIONS = [
  { value: "zeroth_review", label: "Zeroth Review" },
  { value: "first_review", label: "First Review" },
  { value: "second_review", label: "Second Review" },
  { value: "final_review", label: "Final Review" },
];

export function getRubricStageMeta(stage) {
  return RUBRIC_STAGE_OPTIONS.find((item) => item.value === stage) || RUBRIC_STAGE_OPTIONS[0];
}

export function formatRubricStage(stage) {
  return getRubricStageMeta(stage).label;
}

export async function fetchAdminRubrics(stage, reviewStage = null) {
  const params = new URLSearchParams({ stage });
  if (reviewStage) params.set("review_stage", reviewStage);
  return apiRequest(`/admin/rubrics?${params.toString()}`, { skipCache: true });
}

export async function saveAdminRubrics(stage, rubrics, reviewStage = null) {
  return apiRequest(`/admin/rubrics/${encodeURIComponent(stage)}`, {
    method: "PUT",
    body: { rubrics, review_stage: reviewStage },
  });
}

export async function deleteAdminRubric(rubricId) {
  return apiRequest(`/admin/rubrics/${rubricId}`, { method: "DELETE" });
}

export async function fetchAdminFinalResults() {
  return apiRequest("/admin/final-results", { skipCache: true });
}

export async function fetchAdminClasses() {
  return apiRequest("/admin/classes", { skipCache: true });
}

export async function publishAdminFinalResults(studentIds = []) {
  return apiRequest("/admin/final-results/publish", {
    method: "POST",
    body: { student_ids: studentIds },
  });
}

export async function fetchEvaluatorRubrics(stage, reviewStage = null) {
  const params = new URLSearchParams({ stage });
  if (reviewStage) params.set("review_stage", reviewStage);
  return apiRequest(`/evaluation-rubrics?${params.toString()}`, { skipCache: true });
}

export async function fetchProjectRubricMarks(projectId, stage, reviewStage = null) {
  const params = new URLSearchParams();
  if (reviewStage) params.set("review_stage", reviewStage);
  const query = params.toString();
  return apiRequest(`/projects/${projectId}/rubric-marks/${encodeURIComponent(stage)}${query ? `?${query}` : ""}`, { skipCache: true });
}

export async function saveProjectRubricMarks(projectId, stage, entries, reviewStage = null, feedbackEntries = []) {
  return apiRequest(`/projects/${projectId}/rubric-marks/${encodeURIComponent(stage)}`, {
    method: "PUT",
    body: { entries, review_stage: reviewStage, feedback_entries: feedbackEntries },
  });
}

export async function fetchProjectRubricEntryLock(projectId, stage, reviewStage = null) {
  const params = new URLSearchParams();
  if (reviewStage) params.set("review_stage", reviewStage);
  const query = params.toString();
  return apiRequest(`/projects/${projectId}/rubric-marks/${encodeURIComponent(stage)}/lock${query ? `?${query}` : ""}`, { skipCache: true });
}

export async function updateProjectRubricEntryLock(projectId, stage, locked, reviewStage = null) {
  return apiRequest(`/projects/${projectId}/rubric-marks/${encodeURIComponent(stage)}/lock`, {
    method: "PUT",
    body: { locked, review_stage: reviewStage },
  });
}

export async function fetchCoordinatorResultsBreakdown() {
  return apiRequest("/coordinator/final-results/breakdown", { skipCache: true });
}

export async function fetchCoordinatorInternalMarks() {
  return apiRequest("/coordinator/internal-marks", { skipCache: true });
}

export async function saveCoordinatorInternalMarks(entries) {
  return apiRequest("/coordinator/internal-marks", {
    method: "PUT",
    body: { entries },
  });
}

export async function fetchPublishedStudentResult() {
  return apiRequest("/results/me", { skipCache: true });
}
