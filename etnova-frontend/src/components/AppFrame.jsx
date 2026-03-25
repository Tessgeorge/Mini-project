export default function AppFrame({
  sidebar,
  header = null,
  headerOverlay = null,
  children,
  scrollAreaClassName = "",
}) {
  return (
    <div className="flex h-[100dvh] w-full etnova-bg overflow-hidden">
      {sidebar}

      <div className="flex-1 min-w-0 md:ml-64 h-[100dvh] flex flex-col overflow-hidden">
        {header ? (
          <div className="relative shrink-0">
            {header}
            {headerOverlay}
          </div>
        ) : null}

        <main className={`flex-1 min-h-0 overflow-y-auto ${scrollAreaClassName}`.trim()}>
          {children}
        </main>
      </div>
    </div>
  );
}
