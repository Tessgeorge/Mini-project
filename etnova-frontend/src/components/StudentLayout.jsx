import { useState } from "react";
import Sidebar from "./Sidebar";

export default function StudentLayout({ children, onLogout }) {
  const [currentView, setCurrentView] = useState("dashboard");

  const handleNavigate = (viewId) => {
    setCurrentView(viewId);
    // You can add routing logic here later if needed
  };

  return (
    <div className="flex min-h-screen bg-background-light">
      <Sidebar currentView={currentView} onNavigate={handleNavigate} onLogout={onLogout} />
      <main className="flex-1 md:ml-64">
        {children}
      </main>
    </div>
  );
}
