import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../config/supabaseClient";

const ROLE_HELP_CONTENT = {
  student: {
    title: "Student Help & Support",
    subtitle: "Support for Idea Workspace, My Team, submissions, marks, deadlines, and account access.",
    backTo: "/student/dashboard",
    accent: "from-teal-500 via-cyan-500 to-sky-500",
    surface: "from-teal-50 via-cyan-50 to-sky-50",
    badge: "text-teal-700 bg-teal-100 border-teal-200",
    icon: "school",
    searchPlaceholder: "Search student help topics",
    modules: ["Dashboard", "Idea Workspace", "My Team", "Team Submissions", "Marks", "Discussion"],
    actionCards: [
      {
        title: "Work On My Idea",
        body: "Open Idea Workspace to draft, refine, and formally submit your project idea.",
        route: "/student/idea-workspace",
        action: "Open Idea Workspace",
      },
      {
        title: "Upload A Submission",
        body: "Go to Team Submissions to upload the required file for the active review stage.",
        route: "/student/submissions",
        action: "Open Submissions",
      },
      {
        title: "Check My Marks",
        body: "View published marks and shared feedback in one place after evaluation is complete.",
        route: "/student/marks",
        action: "Open Marks",
      },
    ],
    issueCards: [
      {
        title: "Upload button is not working",
        detail: "This usually means the stage is not open, the deadline has passed, or that document type is not allowed right now.",
        checks: [
          "Confirm the current stage is active in the dashboard.",
          "Check whether the deadline has already passed.",
          "Make sure your team is uploading the correct document type for that stage.",
        ],
        destination: "Dashboard and Team Submissions",
      },
      {
        title: "Marks are not visible",
        detail: "Marks appear only after review data is completed and officially published.",
        checks: [
          "Verify the stage review is actually finished.",
          "Check whether results are still under review or unpublished.",
          "Look in the Marks page again after the coordinator publishes results.",
        ],
        destination: "Marks",
      },
      {
        title: "Deadline is not showing",
        detail: "Student deadlines should come from your class coordinator and appear in the calendar for your class.",
        checks: [
          "Refresh the dashboard and check the calendar again.",
          "Confirm you are viewing the correct student account and class.",
          "If the class deadline still looks wrong, contact your coordinator.",
        ],
        destination: "Dashboard calendar",
      },
      {
        title: "Idea is still showing as draft",
        detail: "Saving a draft does not count as formal submission. The guide can review it only after you submit the idea.",
        checks: [
          "Open Idea Workspace and confirm the current version is ready.",
          "Use the formal submit action instead of only saving draft changes.",
          "Check the status again after submission.",
        ],
        destination: "Idea Workspace",
      },
    ],
    workflow: [
      "Draft and refine the project idea in Idea Workspace.",
      "Coordinate with teammates in My Team and Discussion.",
      "Upload the required files in Team Submissions for the active stage.",
      "Track published marks and feedback in Marks after review is complete.",
    ],
    roleSections: [
      {
        title: "Idea Work",
        items: [
          "Use Idea Workspace to save drafts, refine content, and formally submit the idea.",
          "Only submitted ideas move into guide review; draft saves remain private to your workflow.",
          "If the project topic changes later through a new submission, the latest approved/submitted topic should be reflected across project views.",
        ],
      },
      {
        title: "Team Work",
        items: [
          "Use My Team and Discussion to coordinate tasks, updates, and project communication.",
          "Keep formal academic files inside Team Submissions instead of chat-style discussion areas.",
          "Watch your team composition and coordinator updates carefully before submission deadlines.",
        ],
      },
      {
        title: "Results And Deadlines",
        items: [
          "Deadlines should come from your class coordinator and apply to your class workflow.",
          "Marks appear only after evaluation is complete and the result is published.",
          "If something is missing, first check stage status, then verify with your coordinator or guide.",
        ],
      },
    ],
    playbooks: [
      {
        title: "How to submit an idea",
        steps: [
          "Open Idea Workspace and finish editing the current idea version.",
          "Save drafts as needed, but use the formal submit action when ready.",
          "Check that the idea status changes from draft to submitted.",
        ],
      },
      {
        title: "How to upload a document",
        steps: [
          "Open Team Submissions for the active stage.",
          "Choose the required document type and upload the correct file.",
          "Confirm the submission appears in the list with the expected status.",
        ],
      },
      {
        title: "How to check guide feedback",
        steps: [
          "Open the relevant submission or idea view.",
          "Look for guide remarks, review status, or requested revisions.",
          "Apply the needed changes before resubmitting.",
        ],
      },
      {
        title: "How to view marks",
        steps: [
          "Open the Marks page from the student module.",
          "Check whether the relevant stage or final result is already published.",
          "Review both marks and written feedback together when available.",
        ],
      },
    ],
    faqs: [
      {
        question: "How do I know which review stage is currently active?",
        answer: "Open the student dashboard and check the workflow tracker. The active stage is highlighted there, and the submissions page only allows uploads for stages that are currently open.",
      },
      {
        question: "What should I do if I cannot upload in Team Submissions?",
        answer: "Check whether the stage is locked, whether the deadline has passed, or whether your team already uploaded the same document type. If the restriction still looks wrong, contact your coordinator.",
      },
      {
        question: "Where should I edit or refine my project idea?",
        answer: "Use Idea Workspace to draft and refine the project idea. Team coordination and task-related discussion should happen in My Team and the discussion module.",
      },
      {
        question: "Why are marks not visible yet?",
        answer: "Marks appear only after the relevant review data is completed and published by the coordinator or admin. If a stage is still under review, the marks page may remain empty.",
      },
      {
        question: "How do I reset my password or recover my account?",
        answer: "Use Forgot Password from the sign-in page. The reset link is sent to the email linked with your ETNOVA account. If recovery still fails, escalate to the academic admin.",
      },
    ],
    guides: [
      "Start from Dashboard to confirm the active stage, upcoming deadlines, and whether your next action is in Idea Workspace or Team Submissions.",
      "Use Idea Workspace for the core proposal content, then use My Team and Discussion to coordinate changes before the final submission.",
      "After uploading in Team Submissions, return to Dashboard and Marks to track approval status, review progress, and released evaluation results.",
    ],
    contacts: [
      "For stage locking, deadlines, or submission access issues: contact your coordinator.",
      "For idea guidance, revisions, and project-level feedback: contact your mentor.",
      "For login or account recovery problems after password reset failure: contact the academic admin.",
    ],
  },
  mentor: {
    title: "Mentor Help & Support",
    subtitle: "Support for My Teams, team discussions, My Class coordinator tasks, and Review Evaluation.",
    backTo: "/mentor",
    accent: "from-emerald-500 via-teal-500 to-cyan-500",
    surface: "from-emerald-50 via-teal-50 to-cyan-50",
    badge: "text-emerald-700 bg-emerald-100 border-emerald-200",
    icon: "groups",
    searchPlaceholder: "Search mentor help topics",
    modules: ["Dashboard", "My Teams", "My Class", "Review Evaluation", "Team Workspace", "Discussion"],
    actionCards: [
      {
        title: "Review Team Progress",
        body: "Open your guided teams, check submissions, and move straight into the team workspace.",
        route: "/mentor",
        action: "Open My Teams",
      },
      {
        title: "Manage Class Work",
        body: "Handle student import, deadlines, results, reviewer access, and class-level coordinator tasks.",
        route: "/mentor?tab=my-class",
        action: "Open My Class",
      },
      {
        title: "Open Review Evaluation",
        body: "Go directly to reviewer-stage evaluation when reviewer access is assigned to your account.",
        route: "/mentor?tab=review-evaluation",
        action: "Open Reviews",
      },
    ],
    issueCards: [
      {
        title: "Review button or marks entry is locked",
        detail: "This usually means the stage is inactive, reviewer access is closed, or the coordinator/admin has locked entry for that stage.",
        checks: [
          "Confirm the correct review stage is currently active.",
          "Check whether reviewer access is open for your account.",
          "Verify that stage entry was not locked by the coordinator or admin.",
        ],
        destination: "Review Evaluation and My Class",
      },
      {
        title: "Deadline is not reaching students or guides",
        detail: "Check that the deadline is set for the correct class and saved as the student deadline for that stage. Calendar items should always be class-scoped.",
        checks: [
          "Verify the deadline was saved for the correct class section.",
          "Confirm it was saved as the student deadline, not only a coordinator date.",
          "Check both the student and guide team calendars after saving.",
        ],
        destination: "My Class deadlines",
      },
      {
        title: "Student import or class roster looks outdated",
        detail: "Use the coordinator import flow and confirm the preview before import. After applying, refresh the class page to confirm the class roster and results table updated together.",
        checks: [
          "Confirm the preview rows are correct before import.",
          "Apply the import and wait for the class roster refresh.",
          "Check that the same students appear in both class roster and results views.",
        ],
        destination: "My Class student import",
      },
      {
        title: "Projects are missing in admin guide allocation",
        detail: "Teams appear in admin guide allocation only after the coordinator locks team formation for that class.",
        checks: [
          "Verify team formation is fully ready for that class.",
          "Lock formation from the coordinator class page.",
          "Refresh the admin guide allocation page after locking.",
        ],
        destination: "My Class team formation",
      },
    ],
    workflow: [
      "Guide teams in My Teams and Team Workspace.",
      "Review idea and document progress before entering marks.",
      "Use My Class for coordinator-side deadlines, roster updates, and results work.",
      "Use Review Evaluation only for the stages where reviewer access is assigned to you.",
    ],
    roleSections: [
      {
        title: "Guide Tasks",
        items: [
          "Review idea submissions, team documents, and discussion updates inside Team Workspace.",
          "Add guide observations and diary notes so the team has a visible academic record.",
          "Approve or reject meeting requests and keep guidance inside the project workflow.",
        ],
      },
      {
        title: "Coordinator Tasks",
        items: [
          "Import or update class students, set student deadlines, and monitor submissions class-wide.",
          "Publish final results only after class-level evaluation data is complete.",
          "Lock team formation when the class is ready to move into admin guide allocation.",
        ],
      },
      {
        title: "Reviewer Tasks",
        items: [
          "Open Review Evaluation only for the stages where reviewer access is enabled.",
          "Check stage rules and entry locks before assuming marks entry is broken.",
          "Complete evaluation with remarks so students can later see meaningful published feedback.",
        ],
      },
    ],
    playbooks: [
      {
        title: "How to set class deadlines",
        steps: [
          "Open My Class and go to the deadlines area for the current class.",
          "Choose the correct stage and set the student deadline.",
          "Save the change and verify it appears in both student and guide calendars.",
        ],
      },
      {
        title: "How to import students correctly",
        steps: [
          "Open My Class and upload the student file.",
          "Review the extracted preview carefully before confirming import.",
          "Confirm the import, then verify the updated class roster and results list.",
        ],
      },
      {
        title: "How to publish final results",
        steps: [
          "Confirm all required class evaluations and final marks are completed.",
          "Open the final results section from My Class.",
          "Publish results only after checking the final breakdown for the class.",
        ],
      },
      {
        title: "How to lock team formation",
        steps: [
          "Make sure all student teams and batch assignments are finalized.",
          "Open the team formation area in My Class.",
          "Lock formation so those teams move forward into admin guide allocation.",
        ],
      },
    ],
    faqs: [
      {
        question: "Where can I review the teams assigned to me?",
        answer: "Use My Teams from the mentor dashboard. Each team workspace brings together submissions, review context, deadlines, discussion, and project details in one place.",
      },
      {
        question: "Why does a review or marks action appear locked or unavailable?",
        answer: "This usually means the stage is not active, review entry is locked, or a prerequisite class-level step has not been completed by the coordinator or admin.",
      },
      {
        question: "When should I use the team discussion page?",
        answer: "Use Discussion for clarification, revision guidance, and quick iteration with students. Formal files and evaluation evidence should still stay inside the submission and review workflow.",
      },
      {
        question: "What if I am both guide and coordinator?",
        answer: "Your dashboard combines both responsibilities. Use My Teams for guide-level project work and My Class for class deadlines, student onboarding, submissions, reviews, and marks management.",
      },
      {
        question: "When will Review Evaluation appear for me?",
        answer: "Review Evaluation appears only when reviewer access is assigned. If it is missing, your account may not currently have reviewer responsibility for that stage or class.",
      },
    ],
    guides: [
      "Start from Dashboard to see pending team work, role-specific actions, and whether you should move into My Teams, My Class, or Review Evaluation.",
      "Open My Teams to review documents, guide project direction, and respond in Discussion without leaving the team workspace.",
      "If you are a coordinator, use My Class for student import, deadline setup, submissions review, review workflow, and marks publication tasks.",
    ],
    contacts: [
      "For missing coordinator or reviewer permissions: contact the academic admin.",
      "For class-level stage mismatches or locked review actions: coordinate with the admin managing review stages.",
      "For access or login recovery issues: use Forgot Password first, then escalate if the issue remains unresolved.",
    ],
  },
  admin: {
    title: "Admin Help & Support",
    subtitle: "Support for Mentor Management, Guide Allocation, Review Management, Rubrics, and controlled onboarding.",
    backTo: "/admin",
    accent: "from-sky-500 via-cyan-500 to-teal-500",
    surface: "from-sky-50 via-cyan-50 to-teal-50",
    badge: "text-sky-700 bg-sky-100 border-sky-200",
    icon: "admin_panel_settings",
    searchPlaceholder: "Search admin help topics",
    modules: ["Dashboard", "Mentor Management", "Guide Allocation", "Review Management", "Rubrics", "Classes"],
    actionCards: [
      {
        title: "Manage Mentors",
        body: "Open mentor management to import mentors, update roles, and maintain coordinator assignments.",
        route: "/admin/mentor-management",
        action: "Open Mentor Management",
      },
      {
        title: "Allocate Guides",
        body: "Open guide allocation to distribute locked class teams among available mentors.",
        route: "/admin/guide-allocation",
        action: "Open Guide Allocation",
      },
      {
        title: "Control Review Stages",
        body: "Open review management to create, lock, order, and verify stage workflows class by class.",
        route: "/admin/review-management",
        action: "Open Review Management",
      },
    ],
    issueCards: [
      {
        title: "Projects are not visible in guide allocation",
        detail: "Teams appear in admin guide allocation only after the coordinator locks team formation for that class.",
        checks: [
          "Confirm the class coordinator has locked team formation.",
          "Refresh guide allocation after the class lock is applied.",
          "Check that the affected teams really belong to that class.",
        ],
        destination: "Guide Allocation",
      },
      {
        title: "Mentor import created unexpected rows",
        detail: "This usually happens when the uploaded file contains duplicates, mixed roles, or malformed identifiers.",
        checks: [
          "Review the extracted preview before confirming import.",
          "Check whether rows are marked create, update, or skip.",
          "Correct the file and re-import if the preview already looks wrong.",
        ],
        destination: "Mentor Management import preview",
      },
      {
        title: "Review stage actions look inconsistent",
        detail: "Stage issues usually come from ordering problems, lock state mismatches, or changing the wrong class.",
        checks: [
          "Verify the target class before editing any stage row.",
          "Check the stage order and whether entry locks are active.",
          "Confirm the stage change matches the current workflow status.",
        ],
        destination: "Review Management",
      },
      {
        title: "Results or rubrics are not behaving as expected",
        detail: "Published results and marks behavior depend on the review workflow, rubrics, and final result state staying aligned.",
        checks: [
          "Confirm rubrics are correct for the target stage.",
          "Check whether marks are published, calculated, or still pending.",
          "Verify the class and stage before changing final publishing actions.",
        ],
        destination: "Rubrics and Final Results",
      },
    ],
    workflow: [
      "Set up mentors and coordinators in Mentor Management first.",
      "Lock-ready classes then distribute teams in Guide Allocation.",
      "Control review stages and entry rules before marks workflows begin.",
      "Verify rubrics and result state before publishing final outputs.",
    ],
    roleSections: [
      {
        title: "Onboarding Control",
        items: [
          "Use Mentor Management for import-based onboarding and role correction.",
          "Prefer preview-confirm-import workflows instead of ad hoc manual changes when possible.",
          "Check profile-role consistency before troubleshooting downstream access issues.",
        ],
      },
      {
        title: "Workflow Control",
        items: [
          "Use Review Management to add stages, change order, and enforce lock rules.",
          "Treat stage edits carefully because they affect mentors, coordinators, students, and results together.",
          "Verify the target class every time before changing deadlines or access behavior.",
        ],
      },
      {
        title: "Allocation And Results",
        items: [
          "Guide Allocation should happen only after class formation is locked by the coordinator.",
          "Rubrics should match the intended review flow before marks are entered or published.",
          "Final results should be published only after evaluation completeness is confirmed.",
        ],
      },
    ],
    playbooks: [
      {
        title: "How to import mentors safely",
        steps: [
          "Open Mentor Management and upload the mentor file.",
          "Review the extracted preview and verify create, update, and skip rows.",
          "Confirm import only after the preview matches the intended mentor data.",
        ],
      },
      {
        title: "How to allocate guides",
        steps: [
          "Open Guide Allocation after the coordinator has locked team formation.",
          "Review the available teams and current guide pool.",
          "Assign or adjust guide allocations and verify class-scoped team distribution.",
        ],
      },
      {
        title: "How to manage review stages",
        steps: [
          "Open Review Management and select the correct class.",
          "Check the current stage order, locks, and active access state.",
          "Apply only the needed stage changes, then verify the workflow behavior.",
        ],
      },
      {
        title: "How to verify rubrics before publishing",
        steps: [
          "Open Rubrics and confirm the stage criteria and totals are correct.",
          "Check that marks entry and review flow match the configured rubric set.",
          "Only then move into final publishing or result actions.",
        ],
      },
    ],
    faqs: [
      {
        question: "How does mentor import work now?",
        answer: "Upload the file, review the extracted preview, confirm the create or update actions, and then apply the import. New accounts receive invitation-based onboarding.",
      },
      {
        question: "Why might an invite email not arrive immediately?",
        answer: "Shared email delivery can hit rate limits if invites or password resets are triggered repeatedly. Wait briefly before retrying and avoid repeated back-to-back test sends.",
      },
      {
        question: "How do I control review stages safely?",
        answer: "Use Review Management to add stages, set order, lock or unlock actions, and verify the target class before changing anything. Always check the current stage status first.",
      },
      {
        question: "When should I use manual user creation instead of import?",
        answer: "Manual creation should be a fallback for exceptional cases. The recommended path is still import-based onboarding because it is more consistent and scalable.",
      },
      {
        question: "How do Guide Allocation and Mentor Management work together?",
        answer: "Mentor Management controls roles and coordinator assignments, while Guide Allocation distributes teams among guides. Role setup should be correct before finalizing allocation decisions.",
      },
    ],
    guides: [
      "Use Mentor Management first for onboarding, role assignment, coordinator mapping, and account lifecycle control.",
      "Use Guide Allocation after mentor roles are ready, so teams are distributed against the correct guide and coordinator structure.",
      "Use Review Management and Rubrics together: stage control should be stable before publishing or locking marks-related evaluation workflows.",
    ],
    contacts: [
      "For onboarding delivery issues: retry after cooldown, then verify email template, redirect URLs, and account identity mapping.",
      "For class-level workflow disputes: coordinate with the relevant mentor or coordinator before changing admin controls.",
      "For critical account recovery: use manual admin intervention only after checking both auth identity and profile consistency.",
    ],
  },
};

function SectionCard({ title, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ModuleChip({ label }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
      {label}
    </span>
  );
}

function ActionCard({ item, onOpen }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
      <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
      <button
        type="button"
        onClick={() => onOpen(item.route)}
        className="mt-4 inline-flex items-center justify-center rounded-2xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
      >
        {item.action}
      </button>
    </div>
  );
}

function IssueCard({ item, isOpen, onToggle }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <h3 className="text-sm font-semibold text-amber-900">{item.title}</h3>
        <span className="material-symbols-outlined text-amber-700">
          {isOpen ? "remove" : "add"}
        </span>
      </button>
      {isOpen ? (
        <>
          <p className="mt-2 text-sm leading-6 text-amber-800">{item.detail}</p>
          {item.destination ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
              Check in: {item.destination}
            </p>
          ) : null}
          {Array.isArray(item.checks) && item.checks.length > 0 ? (
            <div className="mt-3 space-y-2">
              {item.checks.map((check) => (
                <p key={check} className="text-sm leading-6 text-amber-900">
                  {check}
                </p>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function StatusCard({ label, value, helper }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      {helper ? (
        <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
      ) : null}
    </div>
  );
}

function RoleSectionCard({ section, isOpen, onToggle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
        <span className="material-symbols-outlined text-slate-400">
          {isOpen ? "remove" : "add"}
        </span>
      </button>
      {isOpen ? (
        <div className="mt-3 space-y-2">
          {section.items.map((item) => (
            <p key={item} className="text-sm leading-6 text-slate-600">
              {item}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PlaybookCard({ item, isOpen, onToggle }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
        <span className="material-symbols-outlined text-slate-400">
          {isOpen ? "remove" : "add"}
        </span>
      </button>
      {isOpen ? (
        <div className="mt-4 space-y-3">
          {item.steps.map((step, index) => (
            <div key={step} className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                {index + 1}
              </div>
              <p className="text-sm leading-6 text-slate-600">{step}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FaqAccordionItem({ item, isOpen, onToggle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
      >
        <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{item.question}</h3>
        <span className="material-symbols-outlined text-slate-400">
          {isOpen ? "remove" : "add"}
        </span>
      </button>
      {isOpen ? (
        <div className="border-t border-slate-200 px-4 py-4">
          <p className="text-sm leading-6 text-slate-600">{item.answer}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function RoleHelpSupport({ role = "student" }) {
  const navigate = useNavigate();
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [openPlaybookIndex, setOpenPlaybookIndex] = useState(0);
  const [openIssueIndex, setOpenIssueIndex] = useState(0);
  const [openRoleSectionIndex, setOpenRoleSectionIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [mentorStatus, setMentorStatus] = useState({
    loading: role === "mentor",
    guidedTeams: 0,
    reviewStages: 0,
    coordinatorClass: "",
    roleBadges: [],
  });

  const content = useMemo(() => {
    return ROLE_HELP_CONTENT[role] || ROLE_HELP_CONTENT.student;
  }, [role]);

  useEffect(() => {
    setOpenFaqIndex(0);
    setOpenPlaybookIndex(0);
    setOpenIssueIndex(0);
    setOpenRoleSectionIndex(0);
    setSearchTerm("");
  }, [role]);

  useEffect(() => {
    let cancelled = false;

    async function loadMentorStatus() {
      if (role !== "mentor") return;
      setMentorStatus((current) => ({ ...current, loading: true }));
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData?.user;
        if (!user?.id) throw new Error("Not authenticated");

        const [
          profileRes,
          guidedByGuideRes,
          guidedByMentorRes,
          reviewerAccessRes,
        ] = await Promise.all([
          supabase.from("profiles").select("id,is_coordinator,class_id,class_section").eq("id", user.id).single(),
          supabase.from("projects").select("id,status").eq("guide_id", user.id),
          supabase.from("projects").select("id,status").eq("mentor_id", user.id),
          supabase.from("reviewer_access").select("class_id,stage,is_open").eq("mentor_id", user.id).eq("is_open", true),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (guidedByGuideRes.error) throw guidedByGuideRes.error;
        if (guidedByMentorRes.error) throw guidedByMentorRes.error;
        if (reviewerAccessRes.error) throw reviewerAccessRes.error;

        const profile = profileRes.data || {};
        const guidedProjectMap = new Map();
        [...(guidedByGuideRes.data || []), ...(guidedByMentorRes.data || [])].forEach((project) => {
          if (project?.id) guidedProjectMap.set(project.id, project);
        });

        let coordinatorClass = "";
        if (profile?.is_coordinator && profile?.class_id) {
          const { data: classRow } = await supabase
            .from("classes")
            .select("id,class_section")
            .eq("id", profile.class_id)
            .single();
          coordinatorClass = classRow?.class_section || profile?.class_section || "";
        } else if (profile?.class_section) {
          coordinatorClass = profile.class_section;
        }

        const reviewerAccessRows = reviewerAccessRes.data || [];
        const reviewStageLabels = new Set(
          reviewerAccessRows
            .map((row) => String(row?.stage || "").trim())
            .filter(Boolean),
        );
        const roleBadges = [
          guidedProjectMap.size > 0 ? "Guide" : "",
          profile?.is_coordinator ? "Coordinator" : "",
          reviewStageLabels.size > 0 ? "Reviewer" : "",
        ].filter(Boolean);

        if (!cancelled) {
          setMentorStatus({
            loading: false,
            guidedTeams: guidedProjectMap.size,
            reviewStages: reviewStageLabels.size,
            coordinatorClass,
            roleBadges,
          });
        }
      } catch {
        if (!cancelled) {
          setMentorStatus({
            loading: false,
            guidedTeams: 0,
            reviewStages: 0,
            coordinatorClass: "",
            roleBadges: [],
          });
        }
      }
    }

    loadMentorStatus();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredFaqs = useMemo(() => {
    if (!normalizedSearch) return content.faqs;
    return content.faqs.filter((item) => (
      `${item.question} ${item.answer}`.toLowerCase().includes(normalizedSearch)
    ));
  }, [content.faqs, normalizedSearch]);

  const filteredGuides = useMemo(() => {
    if (!normalizedSearch) return content.guides;
    return content.guides.filter((item) => item.toLowerCase().includes(normalizedSearch));
  }, [content.guides, normalizedSearch]);

  const filteredContacts = useMemo(() => {
    if (!normalizedSearch) return content.contacts;
    return content.contacts.filter((item) => item.toLowerCase().includes(normalizedSearch));
  }, [content.contacts, normalizedSearch]);

  const filteredModules = useMemo(() => {
    if (!normalizedSearch) return content.modules;
    return content.modules.filter((item) => item.toLowerCase().includes(normalizedSearch));
  }, [content.modules, normalizedSearch]);

  const filteredActionCards = useMemo(() => {
    const items = content.actionCards || [];
    if (!normalizedSearch) return items;
    return items.filter((item) => `${item.title} ${item.body} ${item.action}`.toLowerCase().includes(normalizedSearch));
  }, [content.actionCards, normalizedSearch]);

  const filteredIssueCards = useMemo(() => {
    const items = content.issueCards || [];
    if (!normalizedSearch) return items;
    return items.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(normalizedSearch));
  }, [content.issueCards, normalizedSearch]);

  const filteredWorkflow = useMemo(() => {
    const items = content.workflow || [];
    if (!normalizedSearch) return items;
    return items.filter((item) => item.toLowerCase().includes(normalizedSearch));
  }, [content.workflow, normalizedSearch]);

  const filteredRoleSections = useMemo(() => {
    const items = content.roleSections || [];
    if (!normalizedSearch) return items;
    return items
      .map((section) => ({
        ...section,
        items: (section.items || []).filter((item) => `${section.title} ${item}`.toLowerCase().includes(normalizedSearch)),
      }))
      .filter((section) => section.items.length > 0);
  }, [content.roleSections, normalizedSearch]);

  const filteredPlaybooks = useMemo(() => {
    const items = content.playbooks || [];
    if (!normalizedSearch) return items;
    return items.filter((item) => `${item.title} ${(item.steps || []).join(" ")}`.toLowerCase().includes(normalizedSearch));
  }, [content.playbooks, normalizedSearch]);

  const hasResults = filteredFaqs.length > 0
    || filteredGuides.length > 0
    || filteredContacts.length > 0
    || filteredModules.length > 0
    || filteredActionCards.length > 0
    || filteredIssueCards.length > 0
    || filteredWorkflow.length > 0
    || filteredRoleSections.length > 0
    || filteredPlaybooks.length > 0;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${content.surface} px-4 py-8 text-slate-900 sm:px-6 lg:px-8`}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className={`overflow-hidden rounded-[32px] bg-gradient-to-br ${content.accent} p-[1px] shadow-[0_20px_60px_-30px_rgba(15,35,34,0.35)]`}>
          <div className="rounded-[31px] bg-white/95 px-6 py-8 backdrop-blur sm:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${content.badge}`}>
                  <span className="material-symbols-outlined text-sm">{content.icon}</span>
                  Role Support
                </div>
                <h1 className="mt-3 text-3xl font-bold text-slate-900">{content.title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                  {content.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(content.backTo)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Back to Workspace
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <label htmlFor={`help-search-${role}`} className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Search Topics
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  search
                </span>
                <input
                  id={`help-search-${role}`}
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={content.searchPlaceholder}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm text-slate-700 outline-none transition focus:border-teal-400"
                />
              </div>
            </div>
          </div>
        </div>

        {!hasResults ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">No Match Found</p>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">No help topics matched your search</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Try a broader keyword like <span className="font-semibold">deadline</span>, <span className="font-semibold">discussion</span>, <span className="font-semibold">review</span>, or <span className="font-semibold">password</span>.
            </p>
          </section>
        ) : null}

        {(role === "mentor" || role === "student" || role === "admin") && (
          <>
            {role === "mentor" && (
              <SectionCard title="Your Mentor Status">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(mentorStatus.roleBadges || []).length === 0 ? (
                      <ModuleChip label={mentorStatus.loading ? "Loading Role..." : "Mentor"} />
                    ) : mentorStatus.roleBadges.map((item) => (
                      <ModuleChip key={item} label={item} />
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <StatusCard
                      label="Guided Teams"
                      value={mentorStatus.loading ? "..." : mentorStatus.guidedTeams}
                      helper="Teams currently assigned to you for project guidance."
                    />
                    <StatusCard
                      label="Reviewer Stages"
                      value={mentorStatus.loading ? "..." : mentorStatus.reviewStages}
                      helper="Open reviewer-access stages currently mapped to your account."
                    />
                    <StatusCard
                      label="Coordinator Class"
                      value={mentorStatus.loading ? "..." : (mentorStatus.coordinatorClass || "Not Assigned")}
                      helper="Shown when your mentor account is also acting as the class coordinator."
                    />
                  </div>
                </div>
              </SectionCard>
            )}

            <SectionCard title="I Want To...">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {filteredActionCards.length === 0 ? (
                  <p className="text-sm text-slate-500">No action items match the current search.</p>
                ) : filteredActionCards.map((item) => (
                  <ActionCard key={item.title} item={item} onOpen={navigate} />
                ))}
              </div>
            </SectionCard>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <SectionCard title={role === "mentor" ? "Role-Based Mentor Work" : role === "student" ? "Role-Based Student Work" : "Role-Based Admin Work"}>
                <div className="space-y-5">
                  {filteredRoleSections.length === 0 ? (
                    <p className="text-sm text-slate-500">No role guidance matches the current search.</p>
                  ) : filteredRoleSections.map((section, index) => (
                    <RoleSectionCard
                      key={section.title}
                      section={section}
                      isOpen={openRoleSectionIndex === index}
                      onToggle={() => setOpenRoleSectionIndex((current) => (current === index ? -1 : index))}
                    />
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Common Problems">
                <div className="space-y-3">
                  {filteredIssueCards.length === 0 ? (
                    <p className="text-sm text-slate-500">No common issues match the current search.</p>
                  ) : filteredIssueCards.map((item, index) => (
                    <IssueCard
                      key={item.title}
                      item={item}
                      isOpen={openIssueIndex === index}
                      onToggle={() => setOpenIssueIndex((current) => (current === index ? -1 : index))}
                    />
                  ))}
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Step-By-Step Playbooks">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {filteredPlaybooks.length === 0 ? (
                  <p className="text-sm text-slate-500">No playbooks match the current search.</p>
                ) : filteredPlaybooks.map((item, index) => (
                  <PlaybookCard
                    key={item.title}
                    item={item}
                    isOpen={openPlaybookIndex === index}
                    onToggle={() => setOpenPlaybookIndex((current) => (current === index ? -1 : index))}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard title={role === "mentor" ? "Mentor Workflow" : role === "student" ? "Student Workflow" : "Admin Workflow"}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {filteredWorkflow.length === 0 ? (
                  <p className="text-sm text-slate-500">No workflow guidance matches the current search.</p>
                ) : filteredWorkflow.map((item, index) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                      {index + 1}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
          <SectionCard title="Frequently Asked Questions">
            <div className="space-y-4">
              {filteredFaqs.length === 0 ? (
                <p className="text-sm text-slate-500">No FAQ items match the current search.</p>
              ) : filteredFaqs.map((item, index) => (
                <FaqAccordionItem
                  key={item.question}
                  item={item}
                  isOpen={openFaqIndex === index}
                  onToggle={() => setOpenFaqIndex((current) => (current === index ? -1 : index))}
                />
              ))}
            </div>
          </SectionCard>

          <div className="space-y-6">
            <SectionCard title="Key Modules">
              <div className="flex flex-wrap gap-2">
                {filteredModules.length === 0 ? (
                  <p className="text-sm text-slate-500">No modules match the current search.</p>
                ) : filteredModules.map((item) => (
                  <ModuleChip key={item} label={item} />
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Quick Guides">
              <div className="space-y-3">
                {filteredGuides.length === 0 ? (
                  <p className="text-sm text-slate-500">No quick guides match the current search.</p>
                ) : filteredGuides.map((item, index) => (
                  <div key={item} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Contact & Escalation">
              <div className="space-y-3">
                {filteredContacts.length === 0 ? (
                  <p className="text-sm text-slate-500">No contact guidance matches the current search.</p>
                ) : filteredContacts.map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-sm leading-6 text-slate-600">{item}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
