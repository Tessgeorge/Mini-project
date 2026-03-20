import { Suspense, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

const NAV_ITEMS = [
  { to: "/student/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/student/team", label: "Team", icon: "group" },
  { to: "/student/submissions", label: "Docs", icon: "upload_file" },
  { to: "/student/marks", label: "Marks", icon: "grading" },
  { to: "/student/chat", label: "Chat", icon: "forum" },
  { to: "/student/profile", label: "Project", icon: "folder_open" },
];

export default function StudentLayout({ onLogout }) {
  const location = useLocation();
  const isChatRoute =
    location.pathname.startsWith("/student/chat") ||
    location.pathname.startsWith("/student/discussion");
  const mainClasses = isChatRoute
    ? "h-[calc(100dvh-5rem-env(safe-area-inset-bottom))] md:h-screen overflow-hidden"
    : "h-[100dvh] md:h-screen pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 overflow-y-auto";

  useEffect(() => {
    const preload = () => {
      import("../pages/StudentDashboard");
      import("../pages/MyTeam");
      import("../pages/Submissions");
      import("../pages/Marks");
      import("../pages/StudentDiscussion");
      import("../pages/MyProject");
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(preload, { timeout: 2000 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = setTimeout(preload, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-[100dvh] w-full etnova-bg overflow-hidden">
      <Sidebar onLogout={onLogout} />
      <main className={`flex-1 min-h-0 md:ml-64 ${mainClasses}`}>
        <Suspense
          fallback={
            <div className="h-full etnova-bg flex items-center justify-center text-slate-600">
              Loading...
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      <nav className="fixed md:hidden bottom-0 inset-x-0 border-t border-slate-200 bg-white z-30 pb-[env(safe-area-inset-bottom)]">
        <div className="flex overflow-x-auto no-scrollbar">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
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
          ))}
        </div>
      </nav>
    </div>
  );
}
