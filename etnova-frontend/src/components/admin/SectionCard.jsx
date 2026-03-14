export default function SectionCard({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`bg-white rounded-xl shadow-md border border-gray-100 ${className}`}>
      {(title || subtitle || action) && (
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            {title ? <h3 className="text-base font-semibold text-gray-800">{title}</h3> : null}
            {subtitle ? <p className="text-sm text-gray-500 mt-1">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}
