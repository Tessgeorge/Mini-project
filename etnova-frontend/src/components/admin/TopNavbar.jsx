function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden="true"
    >
      <path d="M15 18H5.5a1 1 0 0 1-.8-1.6L6 14.8V10a6 6 0 1 1 12 0v4.8l1.3 1.6a1 1 0 0 1-.8 1.6H9" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

export default function TopNavbar({ adminName, academicYearLabel, pageTitle = "Admin Dashboard", onProfileClick }) {
  const initial = adminName?.charAt(0)?.toUpperCase() || "A";

  return (
    <header className="glass-topbar sticky top-0 z-20 px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-gray-500 truncate">Home &gt; {pageTitle}</p>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <span className="hidden md:inline-flex px-3 py-1 rounded-full text-xs font-semibold badge-teal">
          {academicYearLabel}
        </span>

        <button
          type="button"
          className="size-9 rounded-full border border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
          aria-label="Notifications"
        >
          <BellIcon />
        </button>

        <button
          type="button"
          onClick={onProfileClick}
          className="size-9 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center text-sm font-semibold shadow-sm"
          aria-label="Open profile settings"
        >
          {initial}
        </button>
      </div>
    </header>
  );
}
