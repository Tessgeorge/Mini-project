import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { STUDENT_NAV_ITEMS } from "../constants/studentNavigation";

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
      import("../pages/IdeaWorkspace");
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
      <Sidebar onLogout={onLogout} navItems={STUDENT_NAV_ITEMS} portalSubtitle="Student Portal" />
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
    </div>
  );
}
