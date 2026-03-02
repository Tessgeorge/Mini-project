import { Suspense, lazy, useState } from "react";
import Sidebar from "./Sidebar";

const StudentDashboard = lazy(() => import("../pages/StudentDashboard"));
const MyProject = lazy(() => import("../pages/MyProject"));
const MyTeam = lazy(() => import("../pages/MyTeam"));
const Submissions = lazy(() => import("../pages/Submissions"));
const Marks = lazy(() => import("../pages/Marks"));
const Discussion = lazy(() => import("../pages/Discussion"));

const ALLOWED_VIEWS = new Set([
    "dashboard",
    "team",
    "submissions",
    "marks",
    "discussion",
    "project",
]);

export default function StudentLayout({ onLogout }) {
    const [currentView, setCurrentView] = useState(() => {
        const saved = localStorage.getItem('studentView') || 'dashboard';
        return ALLOWED_VIEWS.has(saved) ? saved : 'dashboard';
    });

    const handleNavigate = (viewId) => {
        const safeView = ALLOWED_VIEWS.has(viewId) ? viewId : 'dashboard';
        localStorage.setItem('studentView', safeView);
        setCurrentView(safeView);
    };

    const renderView = () => {
        switch (currentView) {
            case "dashboard":
                return <StudentDashboard onNavigate={handleNavigate} />;
            case "team":
                return <MyTeam />;
            case "project":
                return <MyProject onNavigate={handleNavigate} />;
            case "submissions":
                return <Submissions />;
            case "marks":
                return <Marks />;
            case "discussion":
                return <Discussion />;
            default:
                return <StudentDashboard />;
        }
    };

    const navItems = [
        { id: "dashboard", label: "Dashboard", icon: "dashboard" },
        { id: "team", label: "Team", icon: "group" },
        { id: "submissions", label: "Docs", icon: "upload_file" },
        { id: "marks", label: "Marks", icon: "grading" },
        { id: "discussion", label: "Chat", icon: "forum" },
        { id: "project", label: "Project", icon: "folder_open" },
    ];

    return (
        <div className="flex min-h-screen etnova-bg">
            <Sidebar currentView={currentView} onNavigate={handleNavigate} onLogout={onLogout} />
            <main className="flex-1 md:ml-64 pb-20 md:pb-0">
                <Suspense
                    fallback={
                        <div className="min-h-full etnova-bg flex items-center justify-center text-slate-600">
                            Loading...
                        </div>
                    }
                >
                    {renderView()}
                </Suspense>
            </main>
            <nav className="fixed md:hidden bottom-0 inset-x-0 border-t border-slate-200 bg-white z-30">
                <div className="flex overflow-x-auto no-scrollbar">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleNavigate(item.id)}
                            className={`min-w-[84px] flex-1 py-2.5 flex flex-col items-center gap-1 text-xs font-semibold ${currentView === item.id ? "text-teal-600" : "text-slate-500"
                                }`}
                        >
                            <span className="material-symbols-outlined text-lg">{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            </nav>
        </div>
    );
}
