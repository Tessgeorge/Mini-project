import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import AppFrame from "./AppFrame";
import { STUDENT_NAV_ITEMS } from "../constants/studentNavigation";
import { invalidateStudentBootstrapCache } from "../services/studentData";

export default function StudentLayout({ onLogout }) {
  const location = useLocation();
  const isChatRoute =
    location.pathname.startsWith("/student/chat") ||
    location.pathname.startsWith("/student/discussion");
  const scrollAreaClassName = isChatRoute
    ? "overflow-hidden"
    : "pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0";

  useEffect(() => {
    // Student pages should prefer fresh project/idea state when navigating
    // because mentor reviews can change the approved idea in the background.
    invalidateStudentBootstrapCache();
  }, [location.pathname]);

  return (
    <AppFrame
      sidebar={<Sidebar onLogout={onLogout} navItems={STUDENT_NAV_ITEMS} portalSubtitle="Student Portal" />}
      scrollAreaClassName={scrollAreaClassName}
    >
      <Suspense
        fallback={
          <div className="h-full etnova-bg flex items-center justify-center text-slate-600">
            Loading...
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </AppFrame>
  );
}
