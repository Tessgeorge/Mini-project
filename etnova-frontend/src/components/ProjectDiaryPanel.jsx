import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../config/supabaseClient";

const EMPTY_ARRAY = [];
const RECENT_ENTRY_LIMIT = 20;

function formatDateHeader(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown Date";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toIsoFromInput(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function statusBadge(status) {
  const key = String(status || "").toLowerCase();
  if (key === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (key === "rejected") return "bg-rose-50 text-rose-700 border-rose-200";
  if (key === "revision_required") return "bg-amber-50 text-amber-700 border-amber-200";
  if (key === "pending") return "bg-slate-100 text-slate-700 border-slate-200";
  if (key === "submitted") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function escapePdfText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ");
}

function wrapPdfText(text, maxChars = 95) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function pdfSafeLabel(value, fallback = "Entry") {
  return String(value || fallback)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

function buildDiaryPdfBlob({ projectTitle, entries }) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginLeft = 54;
  const marginRight = 54;
  const topY = 746;
  const bottomY = 74;
  const accentRgb = "0.00 0.77 0.71";

  const headerLines = [
    { text: "PROJECT DIARY", size: 9.5, gap: 16, bold: true, tracking: true },
    { text: String(projectTitle || "Untitled Project"), size: 20, gap: 26, bold: true },
    { text: "Official record of submissions, reviews, meetings, and guide observations", size: 10.5, gap: 18, bold: false },
    { text: `Generated on ${formatDateTime(new Date().toISOString())}`, size: 9.5, gap: 24, bold: false, muted: true },
  ];

  const entryBlocks = (entries || []).map((entry) => {
    const entryType = pdfSafeLabel(entry?.type, "Entry");
    const entryStatus = entry?.status ? pdfSafeLabel(entry.status, "") : "";
    const blockLines = [
      { text: entryType, size: 8.5, gap: 12, bold: true, tracking: true, muted: true },
      { text: String(entry.title || "").trim(), size: 13, gap: 16, bold: true },
      { text: entryStatus ? `${formatDateTime(entry.time)}  |  ${entryStatus}` : formatDateTime(entry.time), size: 9.5, gap: 14, muted: true },
      ...wrapPdfText(entry.body || "", 82).map((line) => ({ text: line, size: 10.5, gap: 13.5 })),
      { text: "", size: 8, gap: 12 },
    ];
    const height = blockLines.reduce((sum, line) => sum + (line.gap || 14), 0) + 18;
    return { lines: blockLines, height };
  });

  const pages = [];
  let currentBlocks = [];
  let usedHeight = headerLines.reduce((sum, line) => sum + line.gap, 0) + 10;
  const usableHeight = topY - bottomY;

  entryBlocks.forEach((block) => {
    if (usedHeight + block.height > usableHeight && currentBlocks.length > 0) {
      pages.push(currentBlocks);
      currentBlocks = [];
      usedHeight = headerLines.reduce((sum, line) => sum + line.gap, 0) + 10;
    }
    currentBlocks.push(block);
    usedHeight += block.height;
  });
  if (currentBlocks.length > 0) pages.push(currentBlocks);
  if (!pages.length) {
    pages.push([
      {
        lines: [{ text: "No diary entries available.", size: 11, gap: 14 }],
        height: 20,
      },
    ]);
  }

  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const catalogObj = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesObj = addObject("<< /Type /Pages /Kids [] /Count 0 >>");
  const fontObj = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldObj = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageObjectNumbers = [];
  const totalPages = pages.length;
  pages.forEach((pageBlocks, pageIndex) => {
    const commands = [];
    const leftX = marginLeft;
    const rightX = pageWidth - marginRight;
    let y = topY;

    commands.push("0.8 w");
    commands.push(`${accentRgb} RG`);
    commands.push(`${leftX} ${pageHeight - 50} m ${rightX} ${pageHeight - 50} l S`);
    commands.push("0.45 w");
    commands.push("0.82 0.86 0.91 RG");
    commands.push(`${leftX} ${bottomY - 8} m ${rightX} ${bottomY - 8} l S`);

    headerLines.forEach((line) => {
      const text = escapePdfText(line.text || "");
      if (line.muted) commands.push("0.40 0.47 0.58 rg");
      else commands.push("0.08 0.12 0.22 rg");
      commands.push(`BT /${line.bold ? "F2" : "F1"} ${line.size} Tf ${leftX} ${y} Td (${text}) Tj ET`);
      y -= line.gap;
    });

    commands.push(`${accentRgb} rg`);
    commands.push(`${leftX} ${y + 10} ${rightX - leftX} 1.2 re f`);
    y -= 18;

    pageBlocks.forEach((block) => {
      commands.push("0.93 0.96 0.99 rg");
      commands.push(`${leftX} ${y - block.height + 12} ${rightX - leftX} ${block.height - 6} re f`);
      commands.push("0.86 0.90 0.95 RG");
      commands.push("0.5 w");
      commands.push(`${leftX} ${y - block.height + 12} ${rightX - leftX} ${block.height - 6} re S`);
      commands.push(`${accentRgb} rg`);
      commands.push(`${leftX} ${y - 4} 72 2 re f`);

      block.lines.forEach((line) => {
        const text = escapePdfText(line.text || "");
        if (line.muted) commands.push("0.40 0.47 0.58 rg");
        else if (line.tracking) commands.push(`${accentRgb} rg`);
        else commands.push("0.08 0.12 0.22 rg");
        commands.push(`BT /${line.bold ? "F2" : "F1"} ${line.size || 11} Tf ${leftX} ${y} Td (${text}) Tj ET`);
        y -= line.gap || 14;
      });
      y -= 10;
    });

    const footerLeft = escapePdfText(String(projectTitle || "Project Diary"));
    const footerRight = escapePdfText(`Page ${pageIndex + 1} of ${totalPages}`);
    commands.push("0.40 0.47 0.58 rg");
    commands.push(`BT /F1 8.5 Tf ${leftX} ${bottomY - 24} Td (${footerLeft}) Tj ET`);
    commands.push(`BT /F1 8.5 Tf ${rightX - 54} ${bottomY - 24} Td (${footerRight}) Tj ET`);

    const stream = commands.join("\n");
    const contentObj = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageObj = addObject(
      `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObj} 0 R /F2 ${fontBoldObj} 0 R >> >> /Contents ${contentObj} 0 R >>`,
    );
    pageObjectNumbers.push(pageObj);
  });

  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageObjectNumbers.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function buildDiaryFilename(projectTitle) {
  const normalized = String(projectTitle || "project-diary")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${normalized || "project-diary"}-diary.pdf`;
}

function toTitle(text) {
  return String(text || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

function professionalSubmissionLine(docType) {
  const type = toTitle(docType || "Document");
  if (String(docType || "").toLowerCase() === "abstract") {
    return "The abstract was submitted in a formal academic format, clearly documenting the problem statement, methodology, and expected outcomes.";
  }
  if (String(docType || "").toLowerCase().includes("ppt")) {
    return `The ${type.toLowerCase()} was submitted in a structured presentation format, summarizing progress, technical direction, and key project milestones.`;
  }
  return `The ${type.toLowerCase()} was submitted in the prescribed format with the required academic details and documentation standards.`;
}

function professionalStatusLine(status) {
  if (!status) return "";
  const value = String(status).toLowerCase();
  if (value === "approved") return "The submission has been formally approved by the guide.";
  if (value === "rejected") return "The submission has been formally rejected and requires substantial revision before resubmission.";
  if (value === "revision_required") return "The submission requires revision based on guide feedback before the next review cycle.";
  if (value === "submitted") return "The submission is currently under review.";
  if (value === "pending") return "The submission is pending guide review.";
  return `Current review status: ${toTitle(status)}.`;
}

function professionalIdeaDecisionLine(action) {
  const value = String(action || "").toLowerCase();
  if (value === "approved") return "The guide approved the submitted idea after academic review.";
  if (value === "rejected") return "The guide rejected the submitted idea and requested further refinement.";
  if (value === "revision_required") return "The guide requested revisions before the idea can proceed further in the workflow.";
  return `The guide recorded the decision as ${toTitle(action || "reviewed")}.`;
}

function isIdeaStageEvaluation(evaluation) {
  const value = String(evaluation?.evaluation_type || evaluation?.phase || "").trim().toLowerCase();
  return value === "approval_feedback" || value === "idea" || value === "idea approval";
}

function mapProfileNames(project, currentUserId, currentUserName) {
  const map = {};
  (project?.team_members || []).forEach((member) => {
    if (member?.student_id) {
      map[member.student_id] = member?.profiles?.full_name || "Student";
    }
  });
  const guide = project?.guide || project?.mentor;
  if (guide?.id) {
    map[guide.id] = guide.full_name || "Guide";
  }
  if (currentUserId) {
    map[currentUserId] = currentUserName || map[currentUserId] || "User";
  }
  return map;
}

function buildDiaryEntries({
  project,
  ideas,
  ideaReviews,
  documents,
  evaluations,
  meetings,
  nameByUserId,
  guideUserIds,
  currentTimeMs = Date.now(),
}) {
  const entries = [];
  const mentor = project?.guide || project?.mentor;
  const teamNames = (project?.team_members || [])
    .map((member) => member?.profiles?.full_name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  entries.push({
    id: `intro-${project?.id || "project"}`,
    time: project?.created_at || new Date().toISOString(),
    type: "intro",
    title: "Project diary initialized",
    body: [
      `The project diary was initialized as the official record of submissions, reviews, and guide observations for this project.`,
      `Recorded team members: ${teamNames.length ? teamNames.join(", ") : "Not available"}.`,
      mentor?.full_name ? `Assigned guide: ${mentor.full_name}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  });

  const ideaById = {};
  const reviewsByIdeaId = {};
  (ideaReviews || []).forEach((review) => {
    if (!review?.idea_id) return;
    if (!reviewsByIdeaId[review.idea_id]) reviewsByIdeaId[review.idea_id] = [];
    reviewsByIdeaId[review.idea_id].push(review);
  });

  (ideas || []).forEach((idea) => {
    ideaById[idea.id] = idea;

    const latestReview = (reviewsByIdeaId[idea.id] || [])
      .slice()
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
    const submitterName = nameByUserId[idea.created_by] || "Team member";
    const latestReviewerName = latestReview ? (nameByUserId[latestReview.reviewer_id] || "Guide") : "Guide";
    const normalizedIdeaStatus = String(idea.status || "").toLowerCase();
    const ideaActionLine = normalizedIdeaStatus === "draft"
      ? `Version v${idea.version_no || 1} of the idea "${idea.title || "Untitled idea"}" was saved by ${submitterName} and added to the project record.`
      : `Version v${idea.version_no || 1} of the idea "${idea.title || "Untitled idea"}" was formally submitted by ${submitterName} for guide review and academic consideration.`;

    entries.push({
      id: `idea-submitted-${idea.id}`,
      time: idea.submitted_at || latestReview?.created_at || idea.updated_at || idea.created_at || new Date().toISOString(),
      type: "submission",
      title: `Idea Submission (v${idea.version_no || 1})`,
      body: [
        ideaActionLine,
        professionalStatusLine(idea.status),
        latestReview?.comment ? `Latest guide observation from ${latestReviewerName}: ${latestReview.comment}` : "No guide remarks have been recorded yet for this idea submission.",
      ]
        .filter(Boolean)
        .join(" "),
      status: idea.status,
    });
  });

  const hasIdeaSubmissionEntry = entries.some((entry) => String(entry.id || "").startsWith("idea-submitted-"));
  if (!hasIdeaSubmissionEntry) {
    const ideaStageEvaluations = (evaluations || [])
      .filter((evaluation) => guideUserIds.has(evaluation.evaluator_id) && isIdeaStageEvaluation(evaluation))
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    const latestIdeaReview = (ideaReviews || [])
      .filter((review) => guideUserIds.has(review.reviewer_id))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
    const firstIdeaSignal = ideaStageEvaluations[0] || latestIdeaReview;
    const latestIdeaSignal = latestIdeaReview || ideaStageEvaluations[ideaStageEvaluations.length - 1];

    if (firstIdeaSignal) {
      const latestGuideName = latestIdeaReview
        ? (nameByUserId[latestIdeaReview.reviewer_id] || "Guide")
        : (ideaStageEvaluations[ideaStageEvaluations.length - 1]
          ? (nameByUserId[ideaStageEvaluations[ideaStageEvaluations.length - 1].evaluator_id] || "Guide")
          : "Guide");
      const fallbackStatus = latestIdeaReview?.action || "submitted";
      entries.push({
        id: "idea-submitted-fallback",
        time: firstIdeaSignal.created_at || project?.updated_at || project?.created_at || new Date().toISOString(),
        type: "submission",
        title: "Idea Submission",
        body: [
          `The project idea was submitted for guide review and entered into the official workflow record.`,
          professionalStatusLine(fallbackStatus),
          latestIdeaReview?.comment
            ? `Latest guide observation from ${latestGuideName}: ${latestIdeaReview.comment}`
            : (ideaStageEvaluations[ideaStageEvaluations.length - 1]?.feedback
              ? `Latest guide observation from ${latestGuideName}: ${ideaStageEvaluations[ideaStageEvaluations.length - 1].feedback}`
              : "No written guide remarks are available for this idea submission yet."),
        ]
          .filter(Boolean)
          .join(" "),
        status: fallbackStatus,
      });
    }
  }

  (ideaReviews || []).forEach((review) => {
    if (!guideUserIds.has(review.reviewer_id)) return;
    const idea = ideaById[review.idea_id];
    const reviewerName = nameByUserId[review.reviewer_id] || "Guide";
    const action = String(review.action || "reviewed").replace(/_/g, " ");
    entries.push({
      id: `idea-review-${review.id}`,
      time: review.created_at,
      type: "review",
      title: `Guide Decision on Idea`,
      body: [
        `Guide ${reviewerName} completed the review of the submitted idea.`,
        professionalIdeaDecisionLine(action),
        idea?.title ? `Reviewed entry: Version v${idea.version_no || 1}, titled "${idea.title}".` : "",
        review.comment ? `Recorded guide remarks: ${review.comment}` : "The decision was recorded without additional written remarks.",
      ]
        .filter(Boolean)
        .join(" "),
      status: review.action,
    });
  });

  (documents || []).forEach((doc) => {
    const uploaderName = nameByUserId[doc.uploaded_by] || "Team member";
    const versionLabel = doc.version ? `v${doc.version}` : "v1";
    const docType = String(doc.document_type || "document");
    const docTypeLabel = toTitle(docType);
    entries.push({
      id: `doc-${doc.id}`,
      time: doc.uploaded_at,
      type: "submission",
      title: `${docTypeLabel} Submission (${versionLabel})`,
      body: [
        professionalSubmissionLine(docType),
        `The file "${doc.file_name || "Untitled file"}" (${versionLabel}) was uploaded by ${uploaderName} and entered into the project record.`,
        professionalStatusLine(doc.status),
        doc.feedback ? `Recorded guide feedback: ${doc.feedback}` : "No written guide feedback has been added yet for this submission.",
      ]
        .filter(Boolean)
        .join(" "),
      status: doc.status,
    });

    const normalizedDocStatus = String(doc.status || "").toLowerCase();
    const hasGuideDecision = ["approved", "rejected", "revision_required"].includes(normalizedDocStatus) || Boolean(String(doc.feedback || "").trim());
    if (hasGuideDecision) {
      entries.push({
        id: `doc-review-${doc.id}`,
        time: doc.updated_at || doc.uploaded_at || new Date().toISOString(),
        type: "review",
        title: `Guide Decision on ${docTypeLabel}`,
        body: [
          `The guide reviewed the ${docTypeLabel.toLowerCase()} submission "${doc.file_name || "Untitled file"}" (${versionLabel}).`,
          professionalStatusLine(doc.status),
          doc.feedback ? `Recorded guide feedback: ${doc.feedback}` : "The guide decision was recorded without additional written remarks.",
        ]
          .filter(Boolean)
          .join(" "),
        status: doc.status,
      });
    }
  });

  (evaluations || []).forEach((evaluation) => {
    if (!guideUserIds.has(evaluation.evaluator_id)) return;
    if (String(evaluation.feedback || "").includes("[AUTO IDEA EVAL]")) return;
    const evaluatorName = nameByUserId[evaluation.evaluator_id] || "Guide";

    entries.push({
      id: `eval-${evaluation.id}`,
      time: evaluation.created_at,
      type: "review",
      title: `Guide Review Feedback`,
      body: [
        `Guide ${evaluatorName} recorded formal review feedback for ${toTitle(evaluation.evaluation_type || "review")}.`,
        evaluation.feedback ? `Recorded academic remarks: ${evaluation.feedback}` : "No written feedback was added for this review entry.",
      ]
        .filter(Boolean)
        .join(" "),
    });
  });

  (meetings || []).forEach((meeting) => {
    const approver = nameByUserId[meeting.responded_by] || nameByUserId[meeting.requested_to] || "Guide";
    const meetingTime = new Date(meeting.requested_for || 0).getTime();
    const hasReachedMeetingTime = Number.isFinite(meetingTime) && meetingTime <= currentTimeMs;
    const meetingStatus = String(meeting.status || "").toLowerCase();

    if (meetingStatus === "approved" && meeting.requested_for && !hasReachedMeetingTime) {
      entries.push({
        id: `meeting-scheduled-${meeting.id}`,
        time: meeting.responded_at || meeting.requested_at || meeting.requested_for,
        type: "meeting",
        title: "Meeting Scheduled",
        body: [
          `A project meeting was scheduled with ${approver} for ${formatDateTime(meeting.requested_for)}.`,
          meeting.agenda ? `Recorded agenda: ${meeting.agenda}.` : "",
          meeting.response_note ? `Guide note: ${meeting.response_note}` : "The meeting is confirmed and waiting for the scheduled time.",
        ].filter(Boolean).join(" "),
        status: "approved",
      });
    }

    if (meetingStatus === "approved" && meeting.requested_for && hasReachedMeetingTime) {
      entries.push({
        id: `meeting-approved-${meeting.id}`,
        time: meeting.requested_for,
        type: "meeting",
        title: `Meeting Conducted`,
        body: [
          `A scheduled project meeting was conducted on ${formatDateTime(meeting.requested_for)}.`,
          meeting.agenda ? `Recorded agenda: ${meeting.agenda}.` : "",
          meeting.response_note ? `Guide note: ${meeting.response_note}` : "The meeting was completed without an additional written note.",
        ].filter(Boolean).join(" "),
        status: "approved",
      });
    }
  });

  entries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return entries;
}

export default function ProjectDiaryPanel({
  project,
  currentUserId,
  currentUserName,
  mentorId = null,
  mentorName = "",
  role = "student",
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ideas, setIdeas] = useState(EMPTY_ARRAY);
  const [ideaReviews, setIdeaReviews] = useState(EMPTY_ARRAY);
  const [documents, setDocuments] = useState(EMPTY_ARRAY);
  const [evaluations, setEvaluations] = useState(EMPTY_ARRAY);
  const [meetingRequests, setMeetingRequests] = useState(EMPTY_ARRAY);
  const [meetingDateTime, setMeetingDateTime] = useState("");
  const [meetingAgenda, setMeetingAgenda] = useState("");
  const [requestingMeeting, setRequestingMeeting] = useState(false);
  const [actingMeetingId, setActingMeetingId] = useState("");
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());

  const mentor = project?.guide || project?.mentor || (mentorId ? { id: mentorId, full_name: mentorName || "Guide" } : null);
  const canRequestMeeting = role === "student" && Boolean(currentUserId && mentor?.id);
  const canModerateMeeting = role === "mentor" && Boolean(currentUserId);
  const guideUserIds = useMemo(() => {
    const ids = new Set();
    if (project?.guide?.id) ids.add(project.guide.id);
    if (project?.mentor?.id) ids.add(project.mentor.id);
    if (mentor?.id) ids.add(mentor.id);
    return ids;
  }, [mentor?.id, project?.guide?.id, project?.mentor?.id]);
  const nameByUserId = useMemo(() => {
    const map = mapProfileNames(project, currentUserId, currentUserName);
    if (mentor?.id && mentor?.full_name) {
      map[mentor.id] = mentor.full_name;
    }
    return map;
  }, [currentUserId, currentUserName, mentor?.full_name, mentor?.id, project]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const loadDiary = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    setError("");
    try {
      const [
        ideasRes,
        documentsRes,
        evaluationsRes,
        meetingsRes,
      ] = await Promise.all([
        supabase
          .from("project_ideas")
          .select("id,project_id,version_no,title,status,submitted_at,created_by,created_at,updated_at")
          .eq("project_id", project.id)
          .order("version_no", { ascending: false }),
        supabase
          .from("documents")
          .select("id,project_id,uploaded_by,document_type,file_name,version,status,uploaded_at,feedback")
          .eq("project_id", project.id)
          .order("uploaded_at", { ascending: false }),
        supabase
          .from("evaluations")
          .select("id,project_id,evaluator_id,evaluation_type,obtained_marks,max_marks,feedback,created_at")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("project_meeting_requests")
          .select("id,project_id,requested_by,requested_to,requested_for,agenda,status,response_note,requested_at,responded_at,responded_by")
          .eq("project_id", project.id)
          .order("requested_at", { ascending: false }),
      ]);

      const ideas = ideasRes.data || [];
      const ideaIds = ideas.map((idea) => idea.id).filter(Boolean);
      let ideaReviews = [];
      if (ideaIds.length > 0) {
        const ideaReviewRes = await supabase
          .from("idea_reviews")
          .select("id,idea_id,reviewer_id,action,comment,created_at")
          .in("idea_id", ideaIds)
          .order("created_at", { ascending: false });
        if (ideaReviewRes.error) throw ideaReviewRes.error;
        ideaReviews = ideaReviewRes.data || [];
      }

      if (ideasRes.error) throw ideasRes.error;
      if (documentsRes.error) throw documentsRes.error;
      if (evaluationsRes.error) throw evaluationsRes.error;

      const meetingsError = meetingsRes.error;
      const meetingsMissing = meetingsError && String(meetingsError.code || "").includes("PGRST");
      const meetings = meetingsMissing ? [] : (meetingsRes.data || []);
      if (meetingsError && !meetingsMissing) throw meetingsError;
      setMeetingRequests(meetings);

      setIdeas(ideas);
      setIdeaReviews(ideaReviews);
      setDocuments(documentsRes.data || []);
      setEvaluations(evaluationsRes.data || []);
    } catch (err) {
      setError(err.message || "Failed to load project diary.");
    } finally {
      setLoading(false);
    }
  }, [guideUserIds, nameByUserId, project]);

  useEffect(() => {
    loadDiary();
  }, [loadDiary]);

  useEffect(() => {
    if (!project?.id) return undefined;
    const channel = supabase
      .channel(`project-diary-${project.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_ideas", filter: `project_id=eq.${project.id}` }, () => loadDiary())
      .on("postgres_changes", { event: "*", schema: "public", table: "documents", filter: `project_id=eq.${project.id}` }, () => loadDiary())
      .on("postgres_changes", { event: "*", schema: "public", table: "evaluations", filter: `project_id=eq.${project.id}` }, () => loadDiary())
      .on("postgres_changes", { event: "*", schema: "public", table: "project_meeting_requests", filter: `project_id=eq.${project.id}` }, () => loadDiary())
      .on("postgres_changes", { event: "*", schema: "public", table: "idea_reviews" }, () => loadDiary())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadDiary, project?.id]);

  const entries = useMemo(() => buildDiaryEntries({
    project,
    ideas,
    ideaReviews,
    documents,
    evaluations,
    meetings: meetingRequests,
    nameByUserId,
    guideUserIds,
    currentTimeMs,
  }), [project, ideas, ideaReviews, documents, evaluations, meetingRequests, nameByUserId, guideUserIds, currentTimeMs]);

  const groupedEntries = useMemo(() => {
    const recentEntries = (entries || []).slice(0, RECENT_ENTRY_LIMIT);
    const map = new Map();
    recentEntries.forEach((entry) => {
      const key = formatDateHeader(entry.time);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    });
    return Array.from(map.entries());
  }, [entries]);

  const pendingMeetings = useMemo(
    () => (meetingRequests || []).filter((meeting) => String(meeting.status || "").toLowerCase() === "pending"),
    [meetingRequests],
  );

  const requestMeeting = async () => {
    if (!canRequestMeeting) return;
    const requestedFor = toIsoFromInput(meetingDateTime);
    if (!requestedFor) {
      setError("Please select a valid meeting date and time.");
      return;
    }
    setRequestingMeeting(true);
    setError("");
    try {
      const { error: insertError } = await supabase.from("project_meeting_requests").insert({
        project_id: project.id,
        requested_by: currentUserId,
        requested_to: mentor.id,
        requested_for: requestedFor,
        agenda: meetingAgenda.trim() || null,
        status: "pending",
      });
      if (insertError) throw insertError;
      setMeetingDateTime("");
      setMeetingAgenda("");
      await loadDiary();
    } catch (err) {
      setError(err.message || "Failed to request meeting.");
    } finally {
      setRequestingMeeting(false);
    }
  };

  const moderateMeeting = async (meeting, action) => {
    const meetingId = meeting?.id;
    if (!meetingId || !canModerateMeeting) return;
    setActingMeetingId(meetingId);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("project_meeting_requests")
        .update({
          status: action,
          responded_by: currentUserId,
          responded_at: new Date().toISOString(),
        })
        .eq("id", meetingId)
        .eq("project_id", project.id)
        .eq("status", "pending");
      if (updateError) throw updateError;

      if ((action === "approved" || action === "rejected") && meeting?.requested_by) {
        const approverName = currentUserName || mentor?.full_name || "Guide";
        const meetingTime = formatDateTime(meeting.requested_for);
        const isApproved = action === "approved";
        const { error: notificationError } = await supabase
          .from("notifications")
          .insert([{
            user_id: meeting.requested_by,
            type: "evaluation",
            title: isApproved ? "Meeting Request Approved" : "Meeting Request Rejected",
            message: isApproved
              ? `${approverName} approved your meeting request scheduled for ${meetingTime}.`
              : `${approverName} rejected your meeting request scheduled for ${meetingTime}.`,
            read: false,
            created_at: new Date().toISOString(),
          }]);
        if (notificationError) throw notificationError;
      }

      await loadDiary();
    } catch (err) {
      setError(err.message || "Failed to update meeting status.");
    } finally {
      setActingMeetingId("");
    }
  };

  const openDiaryPdfView = () => {
    const printableEntries = (entries || [])
      .slice(0, RECENT_ENTRY_LIMIT)
      .sort((a, b) => new Date(a?.time || 0).getTime() - new Date(b?.time || 0).getTime());
    const projectTitle = project?.title || project?.team_name || "Project Diary";
    const pdfBlob = buildDiaryPdfBlob({ projectTitle, entries: printableEntries });
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const win = window.open(pdfUrl, "_blank", "noopener,noreferrer");
    if (!win) {
      URL.revokeObjectURL(pdfUrl);
      return;
    }
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
  };

  const downloadDiaryPdf = () => {
    const printableEntries = (entries || [])
      .slice(0, RECENT_ENTRY_LIMIT)
      .sort((a, b) => new Date(a?.time || 0).getTime() - new Date(b?.time || 0).getTime());
    const projectTitle = project?.title || project?.team_name || "Project Diary";
    const pdfBlob = buildDiaryPdfBlob({ projectTitle, entries: printableEntries });
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = buildDiaryFilename(projectTitle);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 10_000);
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="h-1" style={{ background: "linear-gradient(90deg,#0ea5e9,#14b8a6)" }} />
      <div className="p-3 sm:p-4 space-y-3.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-black text-slate-900">Project Diary</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Recent submission timeline</p>
          </div>
          <div className="flex items-center gap-2">
            {mentor?.full_name && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700">
                Guide: {mentor.full_name}
              </span>
            )}
            <button
              type="button"
              onClick={openDiaryPdfView}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Open Diary PDF
            </button>
            <button
              type="button"
              onClick={downloadDiaryPdf}
              aria-label="Download diary PDF"
              title="Download diary PDF"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100"
            >
              <span className="material-symbols-outlined text-base leading-none">download</span>
            </button>
          </div>
        </div>

        {canRequestMeeting && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-800 mb-2">Request meeting with guide</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="datetime-local"
                className="rounded-md border border-slate-300 px-2.5 py-2 text-xs bg-white"
                value={meetingDateTime}
                onChange={(event) => setMeetingDateTime(event.target.value)}
              />
              <input
                type="text"
                maxLength={240}
                placeholder="Agenda (optional)"
                className="rounded-md border border-slate-300 px-2.5 py-2 text-xs bg-white md:col-span-2"
                value={meetingAgenda}
                onChange={(event) => setMeetingAgenda(event.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={requestingMeeting}
              onClick={requestMeeting}
              className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white"
            >
              {requestingMeeting ? "Requesting..." : "Request Meeting"}
            </button>
          </div>
        )}

        {canModerateMeeting && pendingMeetings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-bold text-amber-800 mb-2">Pending meeting requests</p>
            <div className="space-y-2.5">
              {pendingMeetings.map((entry) => {
                const meetingId = entry.id;
                const requesterName = nameByUserId[entry.requested_by] || "Student";
                const summary = `${requesterName} requested ${formatDateTime(entry.requested_for)}.${entry.agenda ? ` Agenda: ${entry.agenda}` : ""}`;
                return (
                  <div key={meetingId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-white px-2.5 py-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Meeting Request</p>
                      <p className="text-xs text-slate-500">{summary}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={actingMeetingId === meetingId}
                        onClick={() => moderateMeeting(entry, "approved")}
                        className="px-2.5 py-1 rounded-md text-[11px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actingMeetingId === meetingId}
                        onClick={() => moderateMeeting(entry, "rejected")}
                        className="px-2.5 py-1 rounded-md text-[11px] font-bold border border-rose-200 bg-rose-50 text-rose-700 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-6 text-center text-xs text-slate-500">Loading diary...</div>
        ) : groupedEntries.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">No diary entries yet.</div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {groupedEntries.map(([dateLabel, dayEntries]) => (
              <div key={dateLabel}>
                <div className="sticky top-0 z-[1] mb-1.5 inline-flex items-center px-2 py-0.5 rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-600">
                  {dateLabel}
                </div>
                <div className="space-y-2">
                  {dayEntries.map((entry) => (
                    <article key={entry.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{entry.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{formatDateTime(entry.time)}</p>
                        </div>
                        {entry.status && entry.type === "submission" && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(entry.status)}`}>
                            {String(entry.status).replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                      {entry.body && (
                        <p className="mt-1.5 text-xs text-slate-700 leading-relaxed line-clamp-3">
                          {entry.body}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
