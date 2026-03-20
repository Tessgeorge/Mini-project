export default function SectionCard({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`bg-white/90 rounded-2xl shadow-sm border border-slate-200/70 ${className}`}>
      {(title || subtitle || action) && (
        <div className="px-6 py-4 border-b border-slate-200/70 flex items-start justify-between gap-4">
          <div>
            {title ? <h3 className="text-base font-semibold text-slate-800">{title}</h3> : null}
            {subtitle ? <p className="text-sm text-slate-500 mt-1">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}
