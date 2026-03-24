const TONES = {
  error: {
    wrap: "border-rose-200 bg-rose-50 text-rose-700",
    icon: "error",
  },
  success: {
    wrap: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: "check_circle",
  },
  warning: {
    wrap: "border-amber-200 bg-amber-50 text-amber-700",
    icon: "warning",
  },
  info: {
    wrap: "border-sky-200 bg-sky-50 text-sky-700",
    icon: "info",
  },
};

export default function FeedbackBanner({ tone = "info", icon, className = "", children }) {
  const meta = TONES[tone] || TONES.info;

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${meta.wrap} ${className}`.trim()}>
      <span className="material-symbols-outlined text-base mt-0.5">{icon || meta.icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
