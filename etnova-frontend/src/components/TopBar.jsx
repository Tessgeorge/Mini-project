import React, { useEffect, useMemo, useRef, useState } from "react";

export default function TopBar({
  title,
  subtitle = "Home",
  profile,
  onProfileClick,
  notificationCount = 0,
  onNotificationClick,
  badgeLabel,
  searchValue = "",
  onSearchChange,
  onSearchSubmit,
  searchResults = [],
  onSearchResultSelect,
  searchPlaceholder = "Search...",
  showSearch = true,
}) {
  const initial = profile?.full_name?.charAt(0).toUpperCase() || "U";
  const searchWrapRef = useRef(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const normalizedQuery = (searchValue || "").trim();
  const shouldShowSearch = searchFocused && normalizedQuery.length > 0;
  const hasResults = searchResults.length > 0;

  useEffect(() => {
    function onPointerDown(event) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const firstSearchResult = useMemo(() => (hasResults ? searchResults[0] : null), [hasResults, searchResults]);

  return (
    <header className="glass-topbar flex items-center justify-between px-4 sm:px-6 md:px-8 py-3.5 sticky top-0 z-10 w-full">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className="text-slate-400 font-medium hidden sm:inline">{subtitle}</span>
        <span className="material-symbols-outlined text-xs text-slate-300 hidden sm:inline">chevron_right</span>
        <span className="font-bold text-slate-800 truncate">{title}</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {badgeLabel ? (
          <span className="hidden md:inline-flex px-3 py-1 rounded-full text-xs font-semibold badge-teal">
            {badgeLabel}
          </span>
        ) : null}

        {showSearch ? (
        <div ref={searchWrapRef} className="relative w-56 hidden sm:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
          <input
            className="glass-input w-full pl-9 pr-9 py-2 text-sm placeholder:text-slate-400 text-slate-700"
            placeholder={searchPlaceholder}
            type="text"
            value={searchValue}
            onFocus={() => setSearchFocused(true)}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchFocused(false);
                return;
              }
              if (e.key === "Enter") {
                if (firstSearchResult) {
                  onSearchResultSelect?.(firstSearchResult);
                } else {
                  onSearchSubmit?.(searchValue);
                }
              }
            }}
          />
          {normalizedQuery && (
            <button
              type="button"
              onClick={() => onSearchChange?.("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              title="Clear search"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}

          {shouldShowSearch && (
            <div className="absolute top-[calc(100%+0.5rem)] left-0 right-0 z-50 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 text-[10px] uppercase tracking-[0.14em] font-bold text-slate-400">
                Search Results
              </div>
              {hasResults ? (
                <div className="max-h-72 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="w-full px-3 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-start gap-2.5"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onSearchResultSelect?.(result);
                        setSearchFocused(false);
                      }}
                    >
                      <span className="material-symbols-outlined text-base text-slate-500 mt-0.5">
                        {result.icon || "search"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">{result.label}</p>
                        {result.meta && <p className="text-xs text-slate-500 truncate">{result.meta}</p>}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-3 py-3 text-sm text-slate-500">No results found.</p>
              )}
            </div>
          )}
        </div>
        ) : null}

        <button
          className="relative p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/60 transition-all"
          onClick={() => onNotificationClick?.()}
          title="Notifications"
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          {notificationCount > 0 && (
            <span
              className="absolute top-1 right-1 size-4 flex items-center justify-center rounded-full text-[9px] font-black text-white"
              style={{ backgroundColor: "#ef4444" }}
            >
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

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
