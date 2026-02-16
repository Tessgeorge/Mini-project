import { useState } from "react";
import Sidebar from "./Sidebar";
import StudentDashboard from "../pages/StudentDashboard";
import MyProject from "../pages/MyProject";

export default function StudentLayout({ onLogout }) {
  const [currentView, setCurrentView] = useState("dashboard");

  const handleNavigate = (viewId) => {
    setCurrentView(viewId);
  };

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return <StudentDashboard />;
      case "project":
        return <MyProject />;
      case "submissions":
        return (
          <div className="min-h-screen bg-background-light p-6 md:p-8">
            <div className="max-w-4xl mx-auto text-center py-20">
              <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">upload_file</span>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Submissions</h2>
              <p className="text-slate-600">This page is coming soon...</p>
            </div>
          </div>
        );
      case "analytics":
        return (
          <div className="min-h-screen bg-background-light p-6 md:p-8">
            <div className="max-w-4xl mx-auto text-center py-20">
              <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">analytics</span>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Analytics</h2>
              <p className="text-slate-600">This page is coming soon...</p>
            </div>
          </div>
        );
      case "settings":
        return (
          <div className="min-h-screen bg-background-light p-6 md:p-8">
            <div className="max-w-4xl mx-auto text-center py-20">
              <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">settings</span>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Settings</h2>
              <p className="text-slate-600">This page is coming soon...</p>
            </div>
          </div>
        );
      default:
        return <StudentDashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background-light">
      <Sidebar currentView={currentView} onNavigate={handleNavigate} onLogout={onLogout} />
      <main className="flex-1 md:ml-64">
        {renderView()}
      </main>
    </div>
  );
}
