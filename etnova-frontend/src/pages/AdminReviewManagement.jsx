import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import supabase from "../config/supabaseClient";
import Sidebar from "../components/admin/Sidebar";
import TopNavbar from "../components/admin/TopNavbar";
import ReviewTimeline from "../components/admin/ReviewTimeline";
import StageTable from "../components/admin/StageTable";
import DeadlineModal from "../components/admin/DeadlineModal";
import StageStatCard from "../components/admin/StageStatCard";
import { loadReviewStages, saveReviewStages } from "../data/adminStorage";

const ADMIN_NAME = "Meenakshi";

function sanitizeActiveStages(stageList) {
  let activeSeen = false;
  return stageList.map((stage) => {
    if (stage.status !== "Active") return stage;
    if (!activeSeen) {
      activeSeen = true;
      return stage;
    }
    return { ...stage, status: "Inactive" };
  });
}

export default function AdminReviewManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stages, setStages] = useState(() =>
    sanitizeActiveStages(loadReviewStages().sort((a, b) => a.id - b.id))
  );
  const [deadlineView, setDeadlineView] = useState("class");
  const [selectedClass, setSelectedClass] = useState("S6 CSE A");
  const [editingStage, setEditingStage] = useState(null);
  const [classADate, setClassADate] = useState("");
  const [classATime, setClassATime] = useState("09:00");
  const [classBDate, setClassBDate] = useState("");
  const [classBTime, setClassBTime] = useState("09:00");
  const [marksDate, setMarksDate] = useState("");
  const [marksTime, setMarksTime] = useState("17:00");

  useEffect(() => {
    const classParam = searchParams.get("class");
    const typeParam = searchParams.get("type");
    if (classParam === "S6 CSE A" || classParam === "S6 CSE B") {
      setSelectedClass(classParam);
      setDeadlineView("class");
    }
    if (typeParam === "evaluations") {
      setDeadlineView("mentor");
    }
  }, [searchParams]);

  useEffect(() => {
    saveReviewStages(stages);
  }, [stages]);

  const autoLockStages = useCallback(() => {
    setStages((prev) =>
      sanitizeActiveStages(prev.map((stage) => {
        if (!stage.deadline) return stage;
        const isExpired = Date.now() > new Date(stage.deadline).getTime();
        if (stage.status === "Completed") return stage;
        if (stage.manuallyUnlocked) return stage;
        if (stage.status === "Locked") {
          if (!isExpired) return { ...stage, status: "Inactive", manuallyUnlocked: false };
          return stage;
        }
        if (isExpired) {
          return { ...stage, status: "Locked", manuallyUnlocked: false };
        }
        return stage;
      }))
    );
  }, []);

  useEffect(() => {
    autoLockStages();
    const timer = setInterval(() => {
      autoLockStages();
    }, 60000);
    return () => clearInterval(timer);
  }, [autoLockStages]);

  const summary = useMemo(() => {
    const totalStages = stages.length;
    const activeStage = stages.find((stage) => stage.status === "Active")?.name || "-";
    const completedStages = stages.filter((stage) => stage.status === "Completed").length;
    const upcomingStages = stages.filter((stage) => stage.status === "Inactive").length;
    return { totalStages, activeStage, completedStages, upcomingStages };
  }, [stages]);

  const isPreviousStageCompleted = (items, index) => {
    if (index === 0) return true;
    return items[index - 1]?.status === "Completed";
  };

  const canActivate = (stageIndex) => {
    const stage = stages[stageIndex];
    if (!stage) return false;
    if (stage.status !== "Inactive") return false;
    return isPreviousStageCompleted(stages, stageIndex);
  };

  const activateStage = (stageIndex) => {
    setStages((prev) => {
      const current = prev[stageIndex];
      if (!current) return prev;
      if (current.status !== "Inactive") return prev;
      if (!isPreviousStageCompleted(prev, stageIndex)) return prev;
      return prev.map((stage, index) => {
        if (stage.status === "Completed" || stage.status === "Locked") return stage;
        if (index === stageIndex) return { ...stage, status: "Active", manuallyUnlocked: false };
        return { ...stage, status: "Inactive", manuallyUnlocked: false };
      });
    });
  };

  const completeStage = (stageIndex) => {
    setStages((prev) => {
      const current = prev[stageIndex];
      if (current.status === "Locked" || current.status !== "Active") return prev;
      if (!isPreviousStageCompleted(prev, stageIndex)) return prev;

      const completed = prev.map((stage, index) =>
        index === stageIndex ? { ...stage, status: "Completed", manuallyUnlocked: false } : stage
      );

      const nextIndex = stageIndex + 1;

      const finalized = completed.map((stage, idx) => {
        if (stage.status === "Completed" || stage.status === "Locked") return stage;
        if (idx === nextIndex) return { ...stage, status: "Active", manuallyUnlocked: false };
        return { ...stage, status: "Inactive", manuallyUnlocked: false };
      });

      return finalized;
    });
  };

  const editDeadline = (stageIndex, newDate, classDeadlines) => {
    setStages((prev) =>
      prev.map((stage, index) => {
        if (index !== stageIndex) return stage;
        const nextStatus = stage.status === "Locked"
          && new Date(newDate).getTime() > Date.now()
          ? "Inactive"
          : stage.status;
        return {
          ...stage,
          status: nextStatus,
          deadline: newDate,
          mentorMarksDeadline: newDate,
          manuallyUnlocked: stage.status === "Locked" && nextStatus === "Inactive" ? false : stage.manuallyUnlocked,
          classDeadlines: classDeadlines || stage.classDeadlines,
        };
      })
    );
  };

  const unlockStage = (stageIndex) => {
    setStages((prev) =>
      prev.map((stage, index) => {
        if (index !== stageIndex) return stage;
        if (stage.status !== "Locked") return stage;
        return { ...stage, status: "Inactive", manuallyUnlocked: true };
      })
    );
  };

  const handleSaveDeadline = (stageId, payload) => {
    const stageIndex = stages.findIndex((stage) => stage.id === stageId);
    if (stageIndex === -1) return;
    editDeadline(stageIndex, payload.mentorMarksDeadline, payload.classDeadlines);
    setEditingStage(null);
    setClassADate("");
    setClassATime("09:00");
    setClassBDate("");
    setClassBTime("09:00");
    setMarksDate("");
    setMarksTime("17:00");
  };

  const handleOpenDeadlineModal = (stage) => {
    setEditingStage(stage);
    setClassADate(stage.classDeadlines?.["S6 CSE A"]?.slice(0, 10) || "");
    setClassATime(stage.classDeadlines?.["S6 CSE A"]?.slice(11, 16) || "09:00");
    setClassBDate(stage.classDeadlines?.["S6 CSE B"]?.slice(0, 10) || "");
    setClassBTime(stage.classDeadlines?.["S6 CSE B"]?.slice(11, 16) || "09:00");
    setMarksDate(stage.mentorMarksDeadline?.slice(0, 10) || "");
    setMarksTime(stage.mentorMarksDeadline?.slice(11, 16) || "17:00");
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate("/signin");
    }
  };

  const handleNavigate = (itemId) => {
    if (itemId === "dashboard") {
      navigate("/admin");
      return;
    }
    if (itemId === "mentor-management") {
      navigate("/admin/mentor-management");
      return;
    }
    if (itemId === "guide-allocation") {
      navigate("/admin/guide-allocation");
      return;
    }
    if (itemId === "review-management") {
      navigate("/admin/review-management");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        activeItem="review-management"
        onSignOut={handleSignOut}
        onNavigate={handleNavigate}
      />

      <main className="lg:ml-72 min-h-screen">
        <TopNavbar
          adminName={ADMIN_NAME}
          academicYearLabel="2026 - S6 Mini Project"
          pageTitle="Review Management"
        />

        <div className="p-4 md:p-6 lg:p-8 bg-gray-50 space-y-6">
          <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold text-gray-800">Review Management</h1>
              <p className="text-gray-500">Control Review Stages and Deadlines</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={deadlineView}
                onChange={(event) => setDeadlineView(event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              >
                <option value="class">Class Deadlines</option>
                <option value="mentor">Mentor Marks Deadlines</option>
              </select>
              {deadlineView === "class" ? (
                <select
                  value={selectedClass}
                  onChange={(event) => setSelectedClass(event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                >
                  <option value="S6 CSE A">S6 CSE A</option>
                  <option value="S6 CSE B">S6 CSE B</option>
                </select>
              ) : null}
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Review Timeline Overview</h2>
            <ReviewTimeline stages={stages} deadlineView={deadlineView} selectedClass={selectedClass} />
          </section>

          <StageTable
            stages={stages}
            onEditDeadline={handleOpenDeadlineModal}
            onActivateStage={activateStage}
            onCompleteStage={completeStage}
            onUnlockStage={unlockStage}
            canActivate={canActivate}
            deadlineView={deadlineView}
            selectedClass={selectedClass}
          />

          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <StageStatCard title="Total Stages" value={summary.totalStages} icon="total" borderClass="border-t-teal-500" />
            <StageStatCard title="Active Stage" value={summary.activeStage} icon="active" borderClass="border-t-cyan-500" />
            <StageStatCard title="Completed Stages" value={summary.completedStages} icon="completed" borderClass="border-t-emerald-500" />
            <StageStatCard title="Inactive Stages" value={summary.upcomingStages} icon="upcoming" borderClass="border-t-gray-400" />
          </section>
        </div>
      </main>

      <DeadlineModal
        stage={editingStage}
        isOpen={Boolean(editingStage)}
        classADate={classADate}
        classATime={classATime}
        classBDate={classBDate}
        classBTime={classBTime}
        marksDate={marksDate}
        marksTime={marksTime}
        onClassADateChange={setClassADate}
        onClassATimeChange={setClassATime}
        onClassBDateChange={setClassBDate}
        onClassBTimeChange={setClassBTime}
        onMarksDateChange={setMarksDate}
        onMarksTimeChange={setMarksTime}
        onClose={() => {
          setEditingStage(null);
          setClassADate("");
          setClassATime("09:00");
          setClassBDate("");
          setClassBTime("09:00");
          setMarksDate("");
          setMarksTime("17:00");
        }}
        onSave={handleSaveDeadline}
      />
    </div>
  );
}
