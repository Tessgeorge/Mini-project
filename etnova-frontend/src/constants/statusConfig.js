const BASE_STATUS_META = {
  draft: { label: "Draft", bgClass: "bg-slate-100", textClass: "text-slate-700", borderClass: "border-slate-200", dotClass: "bg-slate-400" },
  pending: { label: "Pending", bgClass: "bg-amber-50", textClass: "text-amber-700", borderClass: "border-amber-200", dotClass: "bg-amber-400" },
  submitted: { label: "Submitted", bgClass: "bg-amber-50", textClass: "text-amber-700", borderClass: "border-amber-200", dotClass: "bg-amber-400" },
  revision_required: { label: "Revision Required", bgClass: "bg-orange-50", textClass: "text-orange-700", borderClass: "border-orange-200", dotClass: "bg-orange-400" },
  approved: { label: "Approved", bgClass: "bg-emerald-50", textClass: "text-emerald-700", borderClass: "border-emerald-200", dotClass: "bg-emerald-500" },
  rejected: { label: "Rejected", bgClass: "bg-rose-50", textClass: "text-rose-700", borderClass: "border-rose-200", dotClass: "bg-rose-500" },
  completed: { label: "Completed", bgClass: "bg-blue-50", textClass: "text-blue-700", borderClass: "border-blue-200", dotClass: "bg-blue-500" },
  active: { label: "Active", bgClass: "bg-teal-50", textClass: "text-teal-700", borderClass: "border-teal-200", dotClass: "bg-teal-500" },
};

const CONTEXT_LABELS = {
  idea: {
    submitted: "Submitted",
  },
  submission: {
    submitted: "Pending Review",
  },
  project: {
    pending: "Idea Pending",
    approved: "Idea Approved",
  },
};

export function getStatusMeta(status, options = {}) {
  const { context = "default" } = options;
  const key = String(status || "pending").trim().toLowerCase().replace(/\s+/g, "_");
  const base = BASE_STATUS_META[key] || BASE_STATUS_META.pending;
  const labelOverride = CONTEXT_LABELS[context]?.[key];

  return {
    ...base,
    pillClass: `${base.bgClass} ${base.textClass} ${base.borderClass}`,
    key,
    label: labelOverride || base.label,
  };
}
