import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  const [searchTerm, setSearchTerm] = useState("");

  const content = useMemo(() => {
    return ROLE_HELP_CONTENT[role] || ROLE_HELP_CONTENT.student;
  }, [role]);

  useEffect(() => {
    setOpenFaqIndex(0);
    setSearchTerm("");
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

  const hasResults = filteredFaqs.length > 0 || filteredGuides.length > 0 || filteredContacts.length > 0 || filteredModules.length > 0;

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
