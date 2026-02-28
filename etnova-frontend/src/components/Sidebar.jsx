import { useEffect, useRef, useState } from "react";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "project", label: "My Project", icon: "folder_open" },
  { id: "team", label: "My Team", icon: "group" },
  { id: "submissions", label: "Submissions", icon: "upload_file" },
  { id: "discussion", label: "Discussion", icon: "forum" },
  { id: "marks", label: "Marks", icon: "grading" },
];

export default function Sidebar({ currentView, onNavigate, onLogout }) {
  const navRefs = useRef({});
  const [pillStyle, setPillStyle] = useState({ top: 0, height: 0, opacity: 0 });
  const [mounted, setMounted] = useState(false);

  /* ── Slide the pill to the active item ─────────────────────────────── */
  useEffect(() => {
    const el = navRefs.current[currentView];
    if (!el) return;
    const { offsetTop, offsetHeight } = el;
    setPillStyle({ top: offsetTop, height: offsetHeight, opacity: 1 });
  }, [currentView]);

  /* ── Stagger entrance ───────────────────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <aside className="glass-sidebar w-64 flex flex-col justify-between p-6 fixed h-full z-20 hidden md:flex">

      {/* ── Brand ── */}
      <div className="flex flex-col gap-8">
        <div
          className="flex items-center gap-3"
          style={{
            animation: "sidebarFadeUp 0.4s ease both",
            animationDelay: "0ms",
          }}
        >
          <div
            className="size-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#00C4B4 0%,#00897B 100%)" }}
          >
            <span className="material-symbols-outlined text-white">auto_stories</span>
          </div>
          <div>
            <h1 className="text-slate-900 text-lg font-extrabold leading-none tracking-tight">ETNOVA</h1>
            <p className="text-slate-400 text-[11px] font-semibold tracking-wide mt-0.5">Academic Portal</p>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav className="relative flex flex-col gap-1">
          {/* Sliding pill background */}
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top: pillStyle.top,
              height: pillStyle.height,
              opacity: pillStyle.opacity,
              background: "linear-gradient(135deg, rgba(0,196,180,0.14) 0%, rgba(99,102,241,0.08) 100%)",
              border: "1px solid rgba(0,196,180,0.22)",
              borderRadius: "0.75rem",
              boxShadow: "0 2px 12px rgba(0,196,180,0.10)",
              transition: "top 0.28s cubic-bezier(0.34,1.1,0.64,1), height 0.22s ease, opacity 0.18s ease",
            }}
          />

          {NAV.map((item, i) => {
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => { navRefs.current[item.id] = el; }}
                onClick={() => onNavigate(item.id)}
                className="relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold w-full text-left z-10"
                style={{
                  color: active ? "#00897B" : "#64748b",
                  fontWeight: active ? 700 : 500,
                  transition: "color 0.18s ease",
                  /* Staggered entrance */
                  animation: mounted ? `sidebarFadeUp 0.35s ease both` : "none",
                  animationDelay: `${i * 45}ms`,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "#0f172a"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "#64748b"; }}
              >
                {/* Icon — scales on hover */}
                <span
                  className="material-symbols-outlined text-[20px] flex-shrink-0 transition-transform duration-150"
                  style={{ color: active ? "#00897B" : "inherit" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.18)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Bottom panel ── */}
      <div
        className="flex flex-col gap-3"
        style={{ animation: "sidebarFadeUp 0.4s ease both", animationDelay: "360ms" }}
      >
        <button
          onClick={onLogout}
          className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          Sign Out
        </button>
      </div>

      {/* Keyframes injected locally so no build-tool dependency */}
      <style>{`
        @keyframes sidebarFadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </aside>
  );
}
