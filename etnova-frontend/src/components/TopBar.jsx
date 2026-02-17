import React from "react";

export default function TopBar({
  title,
  subtitle = "Home",
  profile,
  onProfileClick,
  notificationCount = 0,
  onNotificationClick
}) {
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-10 w-full">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
          <span
            className="transition-colors cursor-pointer"
            onMouseEnter={(e) => e.currentTarget.style.color = '#00D2C4'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
          >
            {subtitle}
          </span>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-slate-900 font-bold">{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative w-64 hidden sm:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            search
          </span>
          <input
            className="w-full bg-slate-100 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-teal-500/20 focus:outline-none transition-all placeholder:text-slate-400 text-slate-700"
            placeholder="Search..."
            type="text"
          />
        </div>

        <button
          className="relative text-slate-400 hover:text-slate-600 transition-colors"
          onClick={onNotificationClick}
          title="Notifications"
        >
          <span className="material-symbols-outlined">notifications</span>
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 size-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>

        <div
          className="size-9 rounded-full flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-teal-500/30 transition-all font-black text-sm"
          style={{
            backgroundColor: '#00D2C4',
            color: '#000'
          }}
          onClick={onProfileClick}
          title={profile?.full_name || 'Profile'}
        >
          {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  );
}
