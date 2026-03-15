import { NavLink } from "react-router-dom";

const DEFAULT_NAV = [
  { to: "/student/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/student/profile", label: "My Project", icon: "folder_open" },
  { to: "/student/team", label: "My Team", icon: "group" },
  { to: "/student/submissions", label: "Submissions", icon: "upload_file" },
  { to: "/student/chat", label: "Discussion", icon: "forum" },
  { to: "/student/marks", label: "Marks", icon: "grading" },
];

export default function Sidebar({
  onLogout,
  navItems = DEFAULT_NAV,
  activeItem = "",
  onNavigate,
  portalSubtitle = "Academic Portal",
  showMobileNav,
}) {
  const shouldShowMobileNav = typeof showMobileNav === "boolean"
    ? showMobileNav
    : navItems.every((item) => Boolean(item.to));

  return (
    <>
      <aside className="glass-sidebar w-64 flex flex-col justify-between p-6 fixed h-full z-20 hidden md:flex">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <div
              className="size-10 rounded-xl flex items-center justify-center shadow-sm shrink-0"
              style={{ background: "linear-gradient(135deg,#00C4B4 0%,#00897B 100%)" }}
            >
              <span className="material-symbols-outlined text-white">auto_stories</span>
            </div>
            <div>
              <h1 className="text-slate-900 text-lg font-extrabold leading-none tracking-tight">ETNOVA</h1>
              <p className="text-slate-400 text-[11px] font-semibold tracking-wide mt-0.5">{portalSubtitle}</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map((item, index) => {
              const key = item.id || item.to || `${item.label}-${index}`;

              if (item.to) {
                return (
                  <NavLink
                    key={key}
                    to={item.to}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold w-full text-left transition-all ${
                        isActive
                          ? "text-teal-700 bg-teal-50 border border-teal-200 shadow-[0_2px_12px_rgba(0,196,180,0.10)]"
                          : "text-slate-500 hover:text-slate-900 hover:bg-white/70 border border-transparent"
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[20px] shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                );
              }

              const isActive = activeItem === item.id;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onNavigate?.(item.id)}
                  className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold w-full text-left transition-all ${
                    isActive
                      ? "text-teal-700 bg-teal-50 border border-teal-200 shadow-[0_2px_12px_rgba(0,196,180,0.10)]"
                      : "text-slate-500 hover:text-slate-900 hover:bg-white/70 border border-transparent"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px] shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onLogout}
            className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      {shouldShowMobileNav ? (
        <nav className="fixed md:hidden bottom-0 inset-x-0 border-t border-slate-200 bg-white z-30 pb-[env(safe-area-inset-bottom)]">
          <div className="flex overflow-x-auto no-scrollbar">
            {navItems.map((item, index) => {
              const key = item.id || item.to || `${item.label}-${index}`;
              return item.to ? (
                <NavLink
                  key={key}
                  to={item.to}
                  className={({ isActive }) =>
                    `min-w-[84px] flex-1 py-2.5 flex flex-col items-center gap-1 text-xs font-semibold ${
                      isActive ? "text-teal-600" : "text-slate-500"
                    }`
                  }
                >
                  <span className="material-symbols-outlined text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ) : (
                <button
                  key={key}
                  type="button"
                  onClick={() => onNavigate?.(item.id)}
                  className={`min-w-[84px] flex-1 py-2.5 flex flex-col items-center gap-1 text-xs font-semibold ${
                    activeItem === item.id ? "text-teal-600" : "text-slate-500"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      ) : null}
    </>
  );
}
