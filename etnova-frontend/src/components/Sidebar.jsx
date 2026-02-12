import React from "react";

export default function Sidebar({ currentView, onNavigate, onLogout }) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "project", label: "My Project", icon: "folder_open" },
    { id: "submissions", label: "Submissions", icon: "upload_file" },
    { id: "analytics", label: "Analytics", icon: "analytics" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between p-6 fixed h-full z-20 hidden md:flex">
      <div className="flex flex-col gap-8">
        {/* Branding */}
        <div className="flex items-center gap-3">
          <div
            className="size-10 rounded-lg flex items-center justify-center text-black shadow-sm"
            style={{ backgroundColor: '#00D2C4' }}
          >
            <span className="material-symbols-outlined">auto_stories</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-slate-900 text-lg font-extrabold leading-none">Etnova</h1>
            <p className="text-slate-500 text-xs font-medium">Academic Portal</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200 w-full text-left
                ${currentView === item.id
                  ? "font-bold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              style={currentView === item.id ? {
                backgroundColor: 'rgba(0, 210, 196, 0.1)',
                color: '#00D2C4'
              } : {}}
            >
              <span className={`material-symbols-outlined ${currentView === item.id ? "fill-current" : ""}`}>
                {item.icon}
              </span>
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Bottom actions */}
      <div className="flex flex-col gap-4">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-bold">Support</p>
          <p className="text-xs text-slate-700 leading-snug">Need help with project formatting?</p>
          <button
            className="text-xs font-bold mt-2 block hover:underline text-left"
            style={{ color: '#00D2C4' }}
          >
            Read Guidelines
          </button>
        </div>

        <button
          onClick={onLogout}
          className="w-full text-black font-bold py-3 rounded-lg text-sm transition-all shadow-sm flex items-center justify-center gap-2 hover:opacity-90"
          style={{ backgroundColor: '#00D2C4' }}
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
