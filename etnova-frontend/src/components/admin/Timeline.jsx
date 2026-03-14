function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden="true"
    >
      <path d="m5 12 4 4 10-10" />
    </svg>
  );
}

export default function Timeline({ stages, activeStage }) {
  const activeIndex = stages.findIndex((stage) => stage === activeStage);

  return (
    <div className="w-full overflow-x-auto">
      <ol className="flex min-w-max items-start gap-4">
        {stages.map((stage, index) => {
          const completed = index < activeIndex;
          const active = index === activeIndex;
          const dotClass = completed
            ? "bg-teal-600 text-white border-teal-600"
            : active
              ? "bg-teal-100 text-teal-700 border-teal-600"
              : "bg-white text-gray-400 border-gray-300";

          return (
            <li key={stage} className="flex items-center">
              <div className="flex flex-col items-center min-w-28">
                <div className={`size-7 rounded-full border-2 flex items-center justify-center ${dotClass}`}>
                  {completed ? <CheckIcon /> : <span className="text-[11px] font-semibold">{index + 1}</span>}
                </div>
                <p className={`mt-2 text-xs font-medium text-center ${active ? "text-teal-700" : "text-gray-500"}`}>{stage}</p>
              </div>
              {index < stages.length - 1 ? (
                <div className={`h-0.5 w-10 sm:w-14 lg:w-16 mb-5 ${index < activeIndex ? "bg-teal-500" : "bg-gray-200"}`} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
