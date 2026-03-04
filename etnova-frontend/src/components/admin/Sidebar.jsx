const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "mentor-management", label: "Mentor Management", icon: "users" },
  { id: "guide-allocation", label: "Guide Allocation", icon: "shuffle" },
  { id: "review-management", label: "Review Management", icon: "clipboard-list" },
  { id: "project-monitoring", label: "Project Monitoring", icon: "chart-donut" },
  { id: "results-reports", label: "Results & Reports", icon: "report" },
  { id: "audit-logs", label: "Audit Logs", icon: "clock" },
];

function Icon({ name, className = "size-5" }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": "true",
  };

  switch (name) {
    case "home":
      return <svg {...props}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>;
    case "book-open":
      return <svg {...props}><path d="M4 5.5a3.5 3.5 0 0 1 3.5-3.5H12v18H7.5A3.5 3.5 0 0 0 4 23z" /><path d="M20 5.5a3.5 3.5 0 0 0-3.5-3.5H12v18h4.5A3.5 3.5 0 0 1 20 23z" /></svg>;
    case "users":
      return <svg {...props}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M14 20a4 4 0 0 1 7.5-1.8" /></svg>;
    case "shuffle":
      return <svg {...props}><path d="M4 6h3.5a4 4 0 0 1 3.2 1.6l5.6 7.8A4 4 0 0 0 19.5 17H20" /><path d="m17 4 3 2-3 2" /><path d="M4 18h3.5a4 4 0 0 0 3.2-1.6" /><path d="M17 20l3-3-3-3" /></svg>;
    case "calendar":
      return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
    case "clipboard-list":
      return <svg {...props}><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M9 4.5h6v3H9zM9 11h6M9 15h6" /></svg>;
    case "chart-donut":
      return <svg {...props}><path d="M12 3a9 9 0 1 0 9 9h-6a3 3 0 1 1-3-3z" /><path d="M12 3a9 9 0 0 1 9 9h-9z" /></svg>;
    case "check-circle":
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></svg>;
    case "report":
      return <svg {...props}><path d="M7 4h10l3 3v13H7z" /><path d="M17 4v4h4M10 12h7M10 16h5" /></svg>;
    case "clock":
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v6l4 2" /></svg>;
    case "logout":
      return <svg {...props}><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" /><path d="m14 16 4-4-4-4M18 12H9" /></svg>;
    default:
      return null;
  }
}

export default function Sidebar({ activeItem = "dashboard", onSignOut, onNavigate }) {
  return (
    <>
      <aside className="glass-sidebar h-screen w-72 shrink-0 flex-col justify-between p-6 hidden lg:flex fixed left-0 top-0">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center shadow-md">
              <Icon name="book-open" className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-gray-900">ETNOVA</p>
              <p className="text-xs text-gray-500">Academic Admin</p>
            </div>
          </div>

          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const isActive = item.id === activeItem;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate?.(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                    isActive
                      ? "bg-teal-50 text-teal-700 border border-teal-200 shadow-sm font-semibold"
                      : "text-gray-600 hover:bg-white/70 hover:text-gray-800 font-medium"
                  }`}
                >
                  <Icon name={item.icon} className="size-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors font-semibold"
        >
          <Icon name="logout" className="size-5" />
          <span>Sign Out</span>
        </button>
      </aside>

      <div className="lg:hidden px-4 pt-4">
        <div className="glass-card rounded-xl p-3 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {NAV_ITEMS.map((item) => {
              const isActive = item.id === activeItem;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate?.(item.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
                    isActive
                      ? "bg-teal-50 border-teal-200 text-teal-700 font-semibold"
                      : "bg-white border-gray-200 text-gray-600 font-medium"
                  }`}
                >
                  <Icon name={item.icon} className="size-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
