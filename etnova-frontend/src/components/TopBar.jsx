import React from "react";

export default function TopBar({
  title,
  subtitle = "Home",
  profile,
  onProfileClick,
  notificationCount = 0,
  onNotificationClick
}) {
  const initial = profile?.full_name?.charAt(0).toUpperCase() || "U";

  return (
    <header className="glass-topbar flex items-center justify-between px-4 sm:px-6 md:px-8 py-3.5 sticky top-0 z-10 w-full">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className="text-slate-400 font-medium hidden sm:inline">{subtitle}</span>
        <span className="material-symbols-outlined text-xs text-slate-300 hidden sm:inline">chevron_right</span>
        <span className="font-bold text-slate-800 truncate">{title}</span>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Search */}
        <div className="relative w-56 hidden sm:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
          <input
            className="glass-input w-full pl-9 pr-4 py-2 text-sm placeholder:text-slate-400 text-slate-700"
            placeholder="Search…"
            type="text"
          />
        </div>

        {/* Notification bell */}
        <button
          className="relative p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/60 transition-all"
          onClick={onNotificationClick}
          title="Notifications"
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 size-4 flex items-center justify-center rounded-full text-[9px] font-black text-white"
              style={{ backgroundColor: "#ef4444" }}>
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        {/* Avatar */}
        <button
          onClick={onProfileClick}
          title={profile?.full_name || "Profile"}
          className="size-9 rounded-full flex items-center justify-center text-sm font-black ring-2 ring-transparent hover:ring-teal-400/40 transition-all shadow-sm"
          style={{ background: "linear-gradient(135deg,#00C4B4 0%,#00897B 100%)", color: "#fff" }}
        >
          {initial}
        </button>
      </div>
    </header>
  );
}
