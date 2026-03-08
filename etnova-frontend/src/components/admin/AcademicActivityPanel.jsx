import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentActivityCard from "./StudentActivityCard";
import MentorActivityCard from "./MentorActivityCard";
import { getAcademicActivity } from "../../data/academicActivity";

function PanelToggleIcon({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export default function AcademicActivityPanel({ reviewStages = [], teams = [], classActiveStageMap = {}, defaultSelectedClass = "All" }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [selectedClass, setSelectedClass] = useState(defaultSelectedClass || "All");

  useEffect(() => {
    if (!defaultSelectedClass) return;
    setSelectedClass((prev) => (prev === "All" ? defaultSelectedClass : prev));
  }, [defaultSelectedClass]);

  const activity = useMemo(
    () => getAcademicActivity({ reviewStages, teams, selectedClass, classActiveStageMap }),
    [classActiveStageMap, reviewStages, selectedClass, teams]
  );

  const goToReviewPage = (type) => {
    const params = new URLSearchParams();
    params.set("focus", "pending");
    params.set("type", type);
    if (selectedClass !== "All") {
      params.set("class", selectedClass);
    }
    navigate(`/admin/review-management?${params.toString()}`);
  };

  return (
    <aside
      className={`fixed right-0 top-0 h-screen w-[340px] bg-white shadow-xl border-l border-gray-200 z-40 transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 bg-teal-600 text-white rounded-l-xl px-2 py-4 shadow-md hover:bg-teal-700"
        aria-label={open ? "Collapse activity panel" : "Expand activity panel"}
      >
        <PanelToggleIcon open={open} />
      </button>

      <div className="h-full flex flex-col">
        <header className="px-4 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Academic Activity</h2>
          <p className="text-xs text-gray-500 mt-1">Live Review Monitoring</p>
          <span className="inline-flex mt-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 border border-teal-200">
            Active Stage: {activity.activeStage}
          </span>
          <div className="mt-3">
            <label className="block text-[11px] text-gray-500 mb-1">Class Filter</label>
            <select
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            >
              <option value="All">All Classes</option>
              {activity.classes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          <StudentActivityCard
            activity={activity.student}
            onViewAllTeams={() => goToReviewPage("submissions")}
          />
          <MentorActivityCard
            activity={activity.mentor}
            onViewEvaluationDetails={() => goToReviewPage("evaluations")}
          />
        </div>
      </div>
    </aside>
  );
}
