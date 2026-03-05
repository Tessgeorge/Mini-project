import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import supabase from "../config/supabaseClient";
import Sidebar from "../components/admin/Sidebar";
import TopNavbar from "../components/admin/TopNavbar";
import ReviewTimeline from "../components/admin/ReviewTimeline";
import StageTable from "../components/admin/StageTable";
import DeadlineModal from "../components/admin/DeadlineModal";
import StageStatCard from "../components/admin/StageStatCard";

const ADMIN_NAME = "Meenakshi";

const STATUS = {
  INACTIVE: "inactive",
  ACTIVE: "active",
  COMPLETED: "completed",
  LOCKED: "locked",
};

let submissionCountStrategy = null;
let submissionCountStrategyChecked = false;

function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === STATUS.ACTIVE || value === STATUS.COMPLETED || value === STATUS.LOCKED) {
    return value;
  }
  return STATUS.INACTIVE;
}

function toDisplayStatus(status) {
  if (status === STATUS.ACTIVE) return "Active";
  if (status === STATUS.COMPLETED) return "Completed";
  if (status === STATUS.LOCKED) return "Locked";
  return "Inactive";
}

function toDatePart(iso) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function toTimePart(iso, fallback = "09:00") {
  if (!iso) return fallback;
  return iso.slice(11, 16) || fallback;
}

async function fetchSubmissionCountsByStage(stageIds, selectedClass) {
  if (!Array.isArray(stageIds) || stageIds.length === 0) return {};

  const queryOptions = [
    { table: "stage_submissions", idColumn: "stage_id", classColumn: "class" },
    { table: "stage_submissions", idColumn: "review_stage_id", classColumn: "class" },
    { table: "review_stage_submissions", idColumn: "stage_id", classColumn: "class" },
    { table: "review_stage_submissions", idColumn: "review_stage_id", classColumn: "class" },
    { table: "stage_submissions", idColumn: "stage_id", classColumn: "class_name" },
    { table: "review_stage_submissions", idColumn: "stage_id", classColumn: "class_name" },
  ];

  const optionsToTry = submissionCountStrategyChecked
    ? (submissionCountStrategy ? [submissionCountStrategy] : [])
    : queryOptions;

  for (const option of optionsToTry) {
    let query = supabase
      .from(option.table)
      .select(option.idColumn)
      .in(option.idColumn, stageIds);

    if (option.classColumn) {
      query = query.eq(option.classColumn, selectedClass);
    }

    const { data, error } = await query;
    if (error) continue;

    submissionCountStrategy = option;
    submissionCountStrategyChecked = true;

    return (data || []).reduce((acc, row) => {
      const key = row?.[option.idColumn];
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  submissionCountStrategyChecked = true;
  return {};
}

export default function AdminReviewManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusyId, setActionBusyId] = useState("");

  const [editingStage, setEditingStage] = useState(null);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("09:00");
  const [savingDeadline, setSavingDeadline] = useState(false);

  const fetchClasses = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("review_stages")
      .select("class")
      .order("class", { ascending: true });

    if (fetchError) {
      throw new Error(fetchError.message || "Failed to load classes.");
    }

    const uniqueClasses = [...new Set((data || []).map((row) => row.class).filter(Boolean))];
    setClasses(uniqueClasses);
    return uniqueClasses;
  }, []);

  const fetchStages = useCallback(async (className) => {
    if (!className) {
      setStages([]);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("review_stages")
      .select("id, stage_name, class, deadline, status, created_at")
      .eq("class", className)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (fetchError) {
      throw new Error(fetchError.message || "Failed to load review stages.");
    }

    const rows = data || [];
    const stageIds = rows.map((row) => row.id);
    const submissionCounts = await fetchSubmissionCountsByStage(stageIds, className);

    const mappedStages = rows.map((row) => ({
      id: row.id,
      name: row.stage_name,
      className: row.class,
      deadline: row.deadline || null,
      status: toDisplayStatus(normalizeStatus(row.status)),
      statusValue: normalizeStatus(row.status),
      submissions: submissionCounts[row.id] || 0,
      createdAt: row.created_at,
    }));

    setStages(mappedStages);
  }, []);

  const autoLockExpiredStages = useCallback(async (className) => {
    if (!className) return false;

    const nowIso = new Date().toISOString();
    const { data, error: fetchError } = await supabase
      .from("review_stages")
      .select("id")
      .eq("class", className)
      .in("status", [STATUS.INACTIVE, STATUS.ACTIVE])
      .not("deadline", "is", null)
      .lt("deadline", nowIso);

    if (fetchError || !data || data.length === 0) return false;

    const ids = data.map((row) => row.id);
    const { error: updateError } = await supabase
      .from("review_stages")
      .update({ status: STATUS.LOCKED })
      .in("id", ids);

    if (updateError) return false;
    return true;
  }, []);

  const refreshData = useCallback(async (className, options = {}) => {
    const { keepLoading = false } = options;
    if (!keepLoading) setLoading(true);
    setError("");

    try {
      const fetchedClasses = await fetchClasses();
      const effectiveClass = className || selectedClass || fetchedClasses[0] || "";

      if (!effectiveClass) {
        setSelectedClass("");
        setStages([]);
        return;
      }

      if (effectiveClass !== selectedClass) {
        setSelectedClass(effectiveClass);
      }

      const didAutoLock = await autoLockExpiredStages(effectiveClass);
      await fetchStages(effectiveClass);
      if (didAutoLock) {
        await fetchStages(effectiveClass);
      }
    } catch (err) {
      setStages([]);
      setError(err.message || "Failed to load review management data.");
    } finally {
      if (!keepLoading) setLoading(false);
    }
  }, [autoLockExpiredStages, fetchClasses, fetchStages, selectedClass]);

  useEffect(() => {
    const classParam = searchParams.get("class");
    refreshData(classParam || "");
  }, [refreshData, searchParams]);

  useEffect(() => {
    if (!selectedClass) {
      setStages([]);
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        await autoLockExpiredStages(selectedClass);
        await fetchStages(selectedClass);
      } catch (err) {
        setStages([]);
        setError(err.message || "Failed to load review stages.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [autoLockExpiredStages, fetchStages, selectedClass]);

  useEffect(() => {
    if (!selectedClass) return undefined;

    const timer = setInterval(async () => {
      const didAutoLock = await autoLockExpiredStages(selectedClass);
      if (didAutoLock) {
        await fetchStages(selectedClass);
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [autoLockExpiredStages, fetchStages, selectedClass]);

  useEffect(() => {
    const channel = supabase
      .channel("review-management-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "review_stages" },
        async (payload) => {
          const changedClass = payload.new?.class || payload.old?.class || "";
          if (!selectedClass || changedClass === selectedClass || !changedClass) {
            await refreshData(selectedClass || "", { keepLoading: true });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshData, selectedClass]);

  const summary = useMemo(() => {
    const totalStages = stages.length;
    const activeStage = stages.find((stage) => stage.statusValue === STATUS.ACTIVE)?.name || "-";
    const completedStages = stages.filter((stage) => stage.statusValue === STATUS.COMPLETED).length;
    const inactiveStages = stages.filter((stage) => stage.statusValue === STATUS.INACTIVE).length;
    return { totalStages, activeStage, completedStages, inactiveStages };
  }, [stages]);

  const setSingleStageStatus = useCallback(async (stageId, nextStatus) => {
    const { error: updateError } = await supabase
      .from("review_stages")
      .update({ status: nextStatus })
      .eq("id", stageId)
      .eq("class", selectedClass);

    if (updateError) {
      throw new Error(updateError.message || "Failed to update stage status.");
    }
  }, [selectedClass]);

  const activateStage = async (stageId) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage || !selectedClass || stage.statusValue !== STATUS.INACTIVE) return;

    setActionBusyId(stageId);
    setError("");
    try {
      const { error: deactivateError } = await supabase
        .from("review_stages")
        .update({ status: STATUS.INACTIVE })
        .eq("class", selectedClass)
        .eq("status", STATUS.ACTIVE)
        .neq("id", stageId);

      if (deactivateError) {
        throw new Error(deactivateError.message || "Failed to reset active stage.");
      }

      await setSingleStageStatus(stageId, STATUS.ACTIVE);
      await fetchStages(selectedClass);
    } catch (err) {
      setError(err.message || "Failed to activate stage.");
    } finally {
      setActionBusyId("");
    }
  };

  const completeStage = async (stageId) => {
    const currentIndex = stages.findIndex((item) => item.id === stageId);
    const stage = stages[currentIndex];
    if (!stage || !selectedClass || stage.statusValue !== STATUS.ACTIVE) return;

    setActionBusyId(stageId);
    setError("");
    try {
      await setSingleStageStatus(stageId, STATUS.COMPLETED);

      const nextStage = stages
        .slice(currentIndex + 1)
        .find((item) => item.statusValue === STATUS.INACTIVE);

      if (nextStage) {
        const { error: deactivateError } = await supabase
          .from("review_stages")
          .update({ status: STATUS.INACTIVE })
          .eq("class", selectedClass)
          .eq("status", STATUS.ACTIVE)
          .neq("id", nextStage.id);

        if (deactivateError) {
          throw new Error(deactivateError.message || "Failed to reset active stage.");
        }

        await setSingleStageStatus(nextStage.id, STATUS.ACTIVE);
      }

      await fetchStages(selectedClass);
    } catch (err) {
      setError(err.message || "Failed to complete stage.");
    } finally {
      setActionBusyId("");
    }
  };

  const lockStage = async (stageId) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage || stage.statusValue === STATUS.LOCKED || stage.statusValue === STATUS.COMPLETED) return;

    setActionBusyId(stageId);
    setError("");
    try {
      await setSingleStageStatus(stageId, STATUS.LOCKED);
      await fetchStages(selectedClass);
    } catch (err) {
      setError(err.message || "Failed to lock stage.");
    } finally {
      setActionBusyId("");
    }
  };

  const unlockStage = async (stageId) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage || stage.statusValue !== STATUS.LOCKED) return;

    setActionBusyId(stageId);
    setError("");
    try {
      await setSingleStageStatus(stageId, STATUS.INACTIVE);
      await fetchStages(selectedClass);
    } catch (err) {
      setError(err.message || "Failed to unlock stage.");
    } finally {
      setActionBusyId("");
    }
  };

  const handleOpenDeadlineModal = (stage) => {
    setEditingStage(stage);
    setDeadlineDate(toDatePart(stage.deadline));
    setDeadlineTime(toTimePart(stage.deadline, "09:00"));
  };

  const resetDeadlineModal = () => {
    setEditingStage(null);
    setDeadlineDate("");
    setDeadlineTime("09:00");
    setSavingDeadline(false);
  };

  const handleSaveDeadline = async (stageId, deadlineIso) => {
    if (!stageId || !deadlineIso) return;
    setSavingDeadline(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("review_stages")
        .update({ deadline: deadlineIso })
        .eq("id", stageId)
        .eq("class", selectedClass);

      if (updateError) {
        throw new Error(updateError.message || "Failed to update deadline.");
      }

      await autoLockExpiredStages(selectedClass);
      await fetchStages(selectedClass);
      resetDeadlineModal();
    } catch (err) {
      setError(err.message || "Failed to save deadline.");
      setSavingDeadline(false);
    }
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
              <p className="text-gray-500">Control review stages and class deadlines in realtime</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 font-medium" htmlFor="class-filter">Class</label>
              <select
                id="class-filter"
                value={selectedClass}
                onChange={(event) => setSelectedClass(event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40 min-w-[180px]"
              >
                {classes.length === 0 ? <option value="">No classes</option> : null}
                {classes.map((className) => (
                  <option key={className} value={className}>{className}</option>
                ))}
              </select>
            </div>
          </section>

          {error ? (
            <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </section>
          ) : null}

          <section className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Review Timeline Overview</h2>
            <ReviewTimeline stages={stages} selectedClass={selectedClass} />
          </section>

          <StageTable
            loading={loading}
            stages={stages}
            selectedClass={selectedClass}
            actionBusyId={actionBusyId}
            onEditDeadline={handleOpenDeadlineModal}
            onActivateStage={activateStage}
            onCompleteStage={completeStage}
            onLockStage={lockStage}
            onUnlockStage={unlockStage}
          />

          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <StageStatCard title="Total Stages" value={summary.totalStages} icon="total" borderClass="border-t-teal-500" />
            <StageStatCard title="Active Stage" value={summary.activeStage} icon="active" borderClass="border-t-cyan-500" />
            <StageStatCard title="Completed Stages" value={summary.completedStages} icon="completed" borderClass="border-t-emerald-500" />
            <StageStatCard title="Inactive Stages" value={summary.inactiveStages} icon="upcoming" borderClass="border-t-gray-400" />
          </section>
        </div>
      </main>

      <DeadlineModal
        stage={editingStage}
        isOpen={Boolean(editingStage)}
        deadlineDate={deadlineDate}
        deadlineTime={deadlineTime}
        onDeadlineDateChange={setDeadlineDate}
        onDeadlineTimeChange={setDeadlineTime}
        saving={savingDeadline}
        onClose={resetDeadlineModal}
        onSave={handleSaveDeadline}
      />
    </div>
  );
}
