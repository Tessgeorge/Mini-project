import { useEffect, useMemo, useState } from "react";
import { fetchPublishedStudentResult } from "../services/rubrics";
import { apiRequest } from "../config/apiClient";
import supabase from "../config/supabaseClient";

const REVIEW_STAGE_TABS = [
  { key: "zeroth_review", label: "Zeroth Review" },
  { key: "first_review", label: "First Review" },
  { key: "second_review", label: "Second Review" },
  { key: "final_review", label: "Final Review" },
];

function formatScore(value, total = null) {
  if (value == null || Number.isNaN(Number(value))) return total == null ? "-" : `- / ${total}`;
  const numericValue = Number(value);
  const formatted = Number.isInteger(numericValue) ? String(numericValue) : numericValue.toFixed(1);
  return total == null ? formatted : `${formatted} / ${total}`;
}

function formatDateTime(value) {
  if (!value) return "Not published yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not published yet";
  return parsed.toLocaleDateString("en-IN");
}

const FINAL_MARKS_TOTAL = 150;

function getGradeFromFinalMarks(finalMarks) {
  const numericMarks = Number(finalMarks);
  if (finalMarks == null || Number.isNaN(numericMarks)) return "-";

  const percentage = (numericMarks / FINAL_MARKS_TOTAL) * 100;

  if (percentage >= 90) return "S";
  if (percentage >= 85) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 75) return "B+";
  if (percentage >= 70) return "B";
  if (percentage >= 65) return "C+";
  if (percentage >= 60) return "C";
  if (percentage >= 55) return "D";
  if (percentage >= 50) return "P";
  return "F";
}

function getReviewStageKey(item) {
  const title = String(item?.title || "").toLowerCase();
  const message = String(item?.message || "").toLowerCase();
  const source = `${title} ${message}`;

  if (source.includes("zeroth review")) return "zeroth_review";
  if (source.includes("first review")) return "first_review";
  if (source.includes("second review")) return "second_review";
  if (source.includes("final review")) return "final_review";
  return null;
}

function parseReviewerName(message) {
  const normalized = String(message || "").trim();
  const marker = " shared individual ";
  const index = normalized.toLowerCase().indexOf(marker);
  if (index <= 0) return "Reviewer";
  return normalized.slice(0, index).trim() || "Reviewer";
}

function parseFeedbackBody(message) {
  const normalized = String(message || "").trim();
  const marker = ": ";
  const index = normalized.lastIndexOf(marker);
  if (index === -1) return normalized;
  return normalized.slice(index + marker.length).trim() || normalized;
}

function TabButton({ active, label, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
        active
          ? "bg-[#0f766e] text-white shadow-[0_16px_30px_rgba(15,118,110,0.22)]"
          : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {label}
    </button>
  );
}

function ScoreCard({ label, value, tone = "slate", hint }) {
  const toneClass =
    tone === "teal"
      ? "border-teal-200 bg-gradient-to-br from-teal-50 to-white"
      : tone === "amber"
        ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white"
        : "border-slate-200 bg-gradient-to-br from-slate-50 to-white";

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-4 text-4xl font-black tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-3 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}

function DetailCard({ label, value, icon }) {
  const isArray = Array.isArray(value);
  
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
        <p className="text-xs font-bold uppercase tracking-[0.18em]">{label}</p>
      </div>
      {isArray ? (
        <div className="mt-3 space-y-1">
          {value.map((item, idx) => (
            <p key={idx} className="text-sm font-bold leading-6 text-slate-900">{item}</p>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm font-bold leading-6 text-slate-900">{value}</p>
      )}
    </div>
  );
}

function EmptyBlock({ title, body }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-5 py-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <span className="material-symbols-outlined text-[24px]">hourglass_top</span>
      </div>
      <h3 className="mt-4 text-lg font-black text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
}

export default function Marks() {
  const [activeTab, setActiveTab] = useState("result");
  const [activeFeedbackStage, setActiveFeedbackStage] = useState("zeroth_review");
  const [resultLoading, setResultLoading] = useState(true);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [resultError, setResultError] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [result, setResult] = useState(null);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [coordinatorNames, setCoordinatorNames] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setResultLoading(true);
      setFeedbackLoading(true);
      setResultError("");
      setFeedbackError("");

      const [resultResponse, notificationResponse, projectResponse, profileResponse] = await Promise.allSettled([
        fetchPublishedStudentResult(),
        apiRequest("/notifications", { skipCache: true }),
        apiRequest("/projects", { skipCache: true }),
        apiRequest("/profile", { skipCache: true }),
      ]);

      if (cancelled) return;

      if (resultResponse.status === "fulfilled") {
        setResult(resultResponse.value || null);
      } else {
        setResult(null);
        if (resultResponse.reason?.status !== 404) {
          setResultError(resultResponse.reason?.message || "Unable to load result right now.");
        }
      }

      if (notificationResponse.status === "fulfilled") {
        setFeedbackItems(
          (notificationResponse.value || [])
            .filter(
              (item) => item.type === "guide_individual_feedback" || item.type === "review_individual_feedback"
            )
            .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))
        );
      } else {
        setFeedbackItems([]);
        setFeedbackError(notificationResponse.reason?.message || "Unable to load feedback right now.");
      }

      if (projectResponse.status === "fulfilled") {
        const projects = Array.isArray(projectResponse.value) ? projectResponse.value : [];
        const firstProject = projects[0] || null;
        setProjectName(String(firstProject?.title || firstProject?.team_name || "").trim());
      } else {
        setProjectName("");
      }

      // Get coordinators from student's class
      if (profileResponse.status === "fulfilled" && profileResponse.value?.class_id) {
        const classId = profileResponse.value.class_id;
        try {
          // Fetch all coordinators for this class from Supabase
          const { data: coordinators, error } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("class_id", classId)
            .eq("is_coordinator", true);

          if (!error && Array.isArray(coordinators) && coordinators.length > 0) {
            const names = coordinators
              .map(coord => String(coord?.full_name || "").trim())
              .filter(name => name.length > 0);
            setCoordinatorNames(names.length > 0 ? names : ["Coordinator not assigned"]);
          } else {
            setCoordinatorNames(["Coordinator not assigned"]);
          }
        } catch {
          setCoordinatorNames(["Coordinator not assigned"]);
        }
      } else {
        setCoordinatorNames(["Coordinator not assigned"]);
      }

      setResultLoading(false);
      setFeedbackLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const reviewFeedbackByStage = useMemo(() => {
    return feedbackItems
      .filter((item) => item.type === "review_individual_feedback")
      .reduce((acc, item) => {
        const stageKey = getReviewStageKey(item);
        if (!stageKey) return acc;
        if (!acc[stageKey]) acc[stageKey] = [];
        acc[stageKey].push(item);
        return acc;
      }, {});
  }, [feedbackItems]);

  const displayFeedbackStage = useMemo(() => {
    const hasCurrentStageItems = (reviewFeedbackByStage[activeFeedbackStage] || []).length > 0;
    if (hasCurrentStageItems) return activeFeedbackStage;

    const firstAvailable = REVIEW_STAGE_TABS.find((stage) => (reviewFeedbackByStage[stage.key] || []).length > 0);
    return firstAvailable?.key || activeFeedbackStage;
  }, [activeFeedbackStage, reviewFeedbackByStage]);

  const resultPublished = Boolean(result);
  const internalOnly = Boolean(result?.internal_only);
  const adminPublished = Boolean(result?.is_published);
  const currentStageLabel = !resultPublished
    ? "Awaiting publication"
    : adminPublished
      ? "Published"
      : "Internal result published";
  // Map database status to display status
  let statusLabel = "Pending";
  if (result?.is_published === true) {
    statusLabel = "Published";
  } else if (!result) {
    statusLabel = "Pending";
  }
  
  console.log("DEBUG: result =", result); // Debug log
  console.log("DEBUG: statusLabel =", statusLabel); // Debug log
  
  const publicationNote = !resultPublished
    ? "Marks will appear here after the coordinator or admin publishes them."
    : internalOnly
      ? "Coordinator has published your internal marks. External and final marks will appear after publishes the final result."
      : "Your internal, external, and final marks are published and visible only to you.";
  const gradeLabel = adminPublished ? getGradeFromFinalMarks(result?.final_marks) : "Pending";

  return (
    <div className="min-h-full md:min-h-screen px-4 sm:px-6 py-5 sm:py-7">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(240,249,255,0.88)_50%,rgba(236,253,245,0.84))] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-teal-200/20 blur-3xl" />
          <div className="absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-sky-200/20 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-teal-700">Student Marks Center</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Marks</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                Review your published marks and academic feedback in one place. Results are shown per student, so only your own marks are visible here.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Current Project</p>
              <p className="mt-2 text-base font-black text-slate-900">{projectName || "Project not linked yet"}</p>
            </div>
          </div>
        </section>

        <div className="rounded-[1.75rem] border border-white/70 bg-white/75 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex flex-wrap gap-3">
            <TabButton
              active={activeTab === "result"}
              label="Result"
              icon="grading"
              onClick={() => setActiveTab("result")}
            />
            <TabButton
              active={activeTab === "feedback"}
              label="Feedback"
              icon="rate_review"
              onClick={() => setActiveTab("feedback")}
            />
          </div>
        </div>

        {activeTab === "result" ? (
          <section className="rounded-[2rem] border border-white/70 bg-white/82 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.07)] backdrop-blur sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Published Result</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Internal, external, and final marks appear here as soon as they are officially published for you.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">
                <span className="material-symbols-outlined text-[18px] text-teal-700">verified</span>
                {currentStageLabel}
              </div>
            </div>

            {resultLoading ? (
              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                Loading published result...
              </div>
            ) : resultError ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {resultError}
              </div>
            ) : !resultPublished ? (
              <div className="mt-6 space-y-5">
                <EmptyBlock
                  title="Result Not Published Yet"
                  body="Your marks are not available for viewing yet. Once publication is completed, your internal, external, and final marks will appear here."
                />
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,rgba(248,250,252,0.96))] p-5 shadow-sm">
                  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="grid grid-cols-5 bg-[#0f766e] px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white">
                      <div>Project</div>
                      <div>Internal</div>
                      <div>External</div>
                      <div>Final</div>
                      <div>Grade</div>
                    </div>
                    <div className="grid grid-cols-5 items-center px-4 py-4 text-sm text-slate-700">
                      <div className="font-black text-slate-900">{projectName || "Current Project"}</div>
                      <div className="font-bold text-teal-700">{formatScore(result.cie_total, 75)}</div>
                      <div className="font-bold text-amber-700">
                        {adminPublished ? formatScore(result.ese_total, 75) : "Pending"}
                      </div>
                      <div className="font-bold text-slate-900">
                        {adminPublished ? formatScore(result.final_marks, 150) : "Pending"}
                      </div>
                      <div className="font-bold text-sky-700">{gradeLabel}</div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <DetailCard label="Coordinator" value={coordinatorNames.length > 0 ? coordinatorNames : ["Coordinator not assigned"]} icon="supervisor_account" />
                    <DetailCard
                      label="Published On"
                      value={adminPublished ? formatDateTime(result.published_at) : "-"}
                      icon="event"
                    />
                    <DetailCard label="Status" value={statusLabel} icon="analytics" />
                  </div>

                  <div className="mt-5 rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
                        <span className="material-symbols-outlined text-[18px]">info</span>
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">Publication Summary</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{publicationNote}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-[2rem] border border-white/70 bg-white/82 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.07)] backdrop-blur sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Review-wise Feedback</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Feedback is grouped by evaluation source so you can revisit guide notes and review remarks clearly.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">
                <span className="material-symbols-outlined text-[18px] text-sky-700">mail</span>
                {feedbackLoading ? "Loading feedback" : `${feedbackItems.length} item${feedbackItems.length === 1 ? "" : "s"}`}
              </div>
            </div>

            {feedbackLoading ? (
              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                Loading feedback...
              </div>
            ) : feedbackError ? (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {feedbackError}
              </div>
            ) : REVIEW_STAGE_TABS.every((stage) => (reviewFeedbackByStage[stage.key] || []).length === 0) ? (
              <EmptyBlock
                title="No Feedback Shared Yet"
                body="Review feedback will appear here stage by stage when reviewers share remarks with you."
              />
            ) : (
              <div className="mt-6 space-y-5">
                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Review Stages</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {REVIEW_STAGE_TABS.map((stage) => {
                      const itemCount = (reviewFeedbackByStage[stage.key] || []).length;
                      const isActive = displayFeedbackStage === stage.key;
                      return (
                        <button
                          key={stage.key}
                          type="button"
                          onClick={() => setActiveFeedbackStage(stage.key)}
                          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-all ${
                            isActive
                              ? "border-[#14b8a6] bg-[#14b8a6] text-white shadow-[0_12px_24px_rgba(20,184,166,0.24)]"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">rate_review</span>
                          {stage.label}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                              isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {itemCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(reviewFeedbackByStage[displayFeedbackStage] || []).length === 0 ? (
                  <EmptyBlock
                    title={`No ${REVIEW_STAGE_TABS.find((stage) => stage.key === displayFeedbackStage)?.label || "Review"} Feedback`}
                    body="No reviewer feedback has been shared for this review stage yet."
                  />
                ) : (
                  <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,rgba(248,250,252,0.96))] shadow-sm">
                    <div className="space-y-3 p-5">
                      {(reviewFeedbackByStage[displayFeedbackStage] || []).map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition-shadow hover:shadow-md"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-black text-slate-900">{parseReviewerName(item.message)}</p>
                              <p className="mt-2 text-sm leading-7 text-slate-700">{parseFeedbackBody(item.message)}</p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                              <span className="material-symbols-outlined text-[16px]">event</span>
                              {formatDateTime(item.created_at)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
