import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import supabase from "../config/supabaseClient";
import Sidebar from "../components/admin/Sidebar";
import TopNavbar from "../components/admin/TopNavbar";
import ReviewTimeline from "../components/admin/ReviewTimeline";
import StageTable from "../components/admin/StageTable";
import DeadlineModal from "../components/admin/DeadlineModal";
import StageStatCard from "../components/admin/StageStatCard";
import FeedbackBanner from "../components/FeedbackBanner";
import EmptyStatePanel from "../components/EmptyStatePanel";

const ADMIN_NAME = "Meenakshi";

const STATUS = {
  INACTIVE: "inactive",
  ACTIVE: "active",
  COMPLETED: "completed",
  LOCKED: "locked",
};
const STAGE_ORDER = ["Idea", "Abstract", "Zeroth Review", "First Review", "Second Review", "Final Review"];

let submissionCountStrategy = null;
let submissionCountStrategyChecked = false;

function normalizeStatusFromFlags(row) {
  if (row?.is_locked) return STATUS.LOCKED;
  if (row?.is_completed) return STATUS.COMPLETED;
  if (row?.is_active) return STATUS.ACTIVE;
  return STATUS.INACTIVE;
}

function normalizeStageName(stageName) {
  const value = String(stageName || "").trim().toLowerCase();
  if (value === "0th review") return "Zeroth Review";
  if (value === "1st review") return "First Review";
  if (value === "2nd review") return "Second Review";
  if (value === "zeroth review") return "Zeroth Review";
  if (value === "first review") return "First Review";
  if (value === "second review") return "Second Review";
  if (value === "idea") return "Idea";
  if (value === "abstract") return "Abstract";
  if (value === "final review") return "Final Review";
  return String(stageName || "").trim();
}

function stageOrderIndex(stageName) {
  const normalized = normalizeStageName(stageName).toLowerCase();
  const idx = STAGE_ORDER.findIndex((name) => name.toLowerCase() === normalized);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
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

function toTimePart(iso, fallback = "") {
  if (!iso) return fallback;
  return iso.slice(11, 16) || fallback;
}

function isUuid(value) {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function stageNameFromDocumentType(documentType) {
  const value = String(documentType || "").trim().toLowerCase();
  if (value === "abstract") return "Abstract";
  if (value === "proposal" || value === "srs") return "Zeroth Review";
  if (value === "report") return "First Review";
  if (value === "presentation") return "Second Review";
  if (value === "final_report") return "Final Review";
  return "";
}

async function fetchSubmissionCountsByStage(stageRows, classId) {
  if (!Array.isArray(stageRows) || stageRows.length === 0 || !classId) return {};

  const stageIdByName = new Map(
    stageRows.map((row) => [normalizeStageName(row?.stage_name).toLowerCase(), row?.id]).filter((item) => item[1])
  );
  if (stageIdByName.size === 0) return {};

  const { data, error } = await supabase
    .from("documents")
    .select("id, document_type, projects!inner(class_id)")
    .eq("projects.class_id", classId);

  if (error) return {};

  const counts = {};
  (data || []).forEach((row) => {
    const stageName = stageNameFromDocumentType(row?.document_type);
    if (!stageName) return;
    const stageId = stageIdByName.get(stageName.toLowerCase());
    if (!stageId) return;
    counts[stageId] = (counts[stageId] || 0) + 1;
  });

  submissionCountStrategy = { table: "documents", idColumn: "document_type", classColumn: "projects.class_id" };
  submissionCountStrategyChecked = true;
  return counts;
}

export default function AdminReviewManagement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const latestRefreshTokenRef = useRef(0);

  const [classes, setClasses] = useState([]);
  const [selectedClassName, setSelectedClassName] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusyId, setActionBusyId] = useState("");

  const [editingStage, setEditingStage] = useState(null);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [savingDeadline, setSavingDeadline] = useState(false);

  const fetchClasses = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("classes")
      .select("id, class_name")
      .order("class_name", { ascending: true });

    if (fetchError) {
      throw new Error(fetchError.message || "Failed to load classes.");
    }

    const normalized = (data || []).map((row) => ({
      id: row.id,
      name: row.class_name || String(row.id),
    }));
    setClasses(normalized);
    return normalized;
  }, []);

  const ensureDefaultStages = useCallback(async (classId, options = {}) => {
    const { silentRls = true } = options;
    if (!classId) return;

    const { data, error } = await supabase
      .from("review_stages")
      .select("stage_name")
      .eq("class_id", classId);

    if (error) {
      throw new Error(error.message || "Failed to verify review stages.");
    }

    const existingRows = data || [];
    if (existingRows.length > 0) return;
    const missing = [...STAGE_ORDER];

    const inserts = missing.map((stageName) => ({
      class_id: classId,
      stage_name: stageName,
      coordinator_deadline: null,
      is_active: false,
      is_completed: false,
      is_locked: false,
    }));

    const { error: insertError } = await supabase.from("review_stages").insert(inserts);
    if (insertError) {
      const message = String(insertError.message || "").toLowerCase();
      const isRlsError = insertError.code === "42501" || message.includes("row-level security");
      if (isRlsError && silentRls) {
        return;
      }
      throw new Error(insertError.message || "Failed to create default review stages.");
    }
  }, []);

  const fetchStages = useCallback(async (classId) => {
    if (!classId) {
      setStages([]);
      return;
    }

    await ensureDefaultStages(classId, { silentRls: true });

    const { data, error: fetchError } = await supabase
      .from("review_stages")
      .select("id, stage_name, class_id, coordinator_deadline, is_active, is_completed, is_locked")
      .eq("class_id", classId)
      .order("stage_name", { ascending: true });

    if (fetchError) {
      if (/coordinator_deadline/i.test(String(fetchError.message || ""))) {
        throw new Error('The "coordinator_deadline" column is missing in "review_stages". Run the Supabase ALTER TABLE migration first.');
      }
      throw new Error(fetchError.message || "Failed to load review stages.");
    }

    const rows = [...(data || [])].sort((a, b) => {
      const byOrder = stageOrderIndex(a.stage_name) - stageOrderIndex(b.stage_name);
      if (byOrder !== 0) return byOrder;
      return String(a.stage_name || "").localeCompare(String(b.stage_name || ""));
    });

    if (rows.length === 0) {
      const fallbackStages = STAGE_ORDER.map((stageName, index) => ({
        id: `default-${index}`,
        name: stageName,
        className: classId,
        deadline: null,
        status: toDisplayStatus(STATUS.INACTIVE),
        statusValue: STATUS.INACTIVE,
        submissions: 0,
      }));
      setStages(fallbackStages);
      return;
    }

    const submissionCounts = await fetchSubmissionCountsByStage(rows, classId);

    const mappedStages = rows.map((row) => ({
      id: row.id,
      name: normalizeStageName(row.stage_name),
      className: row.class_id,
      deadline: row.coordinator_deadline || null,
      status: toDisplayStatus(normalizeStatusFromFlags(row)),
      statusValue: normalizeStatusFromFlags(row),
      submissions: submissionCounts[row.id] || 0,
    }));

    setStages(mappedStages);
  }, [ensureDefaultStages]);

  const resolveStageId = useCallback(async (stage) => {
    if (!stage || !selectedClassId) {
      throw new Error("Invalid stage or class selection.");
    }
    if (stage.id && !String(stage.id).startsWith("default-")) return stage.id;

    await ensureDefaultStages(selectedClassId, { silentRls: false });
    const { data, error: fetchError } = await supabase
      .from("review_stages")
      .select("id, stage_name")
      .eq("class_id", selectedClassId);

    if (fetchError) {
      throw new Error(fetchError.message || "Failed to resolve review stage.");
    }

    const matched = (data || []).find(
      (row) => normalizeStageName(row.stage_name).toLowerCase() === normalizeStageName(stage.name).toLowerCase()
    );

    if (!matched?.id) {
      throw new Error("Review stages are not available for this class.");
    }

    return matched.id;
  }, [ensureDefaultStages, selectedClassId]);

  const autoLockExpiredStages = useCallback(async (classId) => {
    if (!classId) return false;

    const nowIso = new Date().toISOString();
    const { data, error: fetchError } = await supabase
      .from("review_stages")
      .select("id")
      .eq("class_id", classId)
      .eq("is_active", true)
      .eq("is_completed", false)
      .not("coordinator_deadline", "is", null)
      .lt("coordinator_deadline", nowIso);

    if (fetchError || !data || data.length === 0) return false;

    const ids = data.map((row) => row.id);
    const { error: updateError } = await supabase
      .from("review_stages")
      .update({ is_locked: true, is_active: false, is_completed: true })
      .in("id", ids);

    if (updateError) return false;
    return true;
  }, []);

  const refreshData = useCallback(async (classRef, options = {}) => {
    const { keepLoading = false } = options;
    const refreshToken = latestRefreshTokenRef.current + 1;
    latestRefreshTokenRef.current = refreshToken;
    if (!keepLoading) setLoading(true);
    setError("");

    try {
      const fetchedClasses = await fetchClasses();
      if (latestRefreshTokenRef.current !== refreshToken) return;
      const effectiveClassRef = classRef || selectedClassId || selectedClassName || fetchedClasses[0]?.id || fetchedClasses[0]?.name || "";
      const classRow = fetchedClasses.find((row) => row.id === effectiveClassRef)
        || fetchedClasses.find((row) => row.name === effectiveClassRef)
        || null;
      const effectiveClassName = classRow?.name || "";
      const effectiveClassId = classRow?.id || "";

      if (!effectiveClassName || !effectiveClassId) {
        if (latestRefreshTokenRef.current !== refreshToken) return;
        setSelectedClassName("");
        setSelectedClassId("");
        setStages([]);
        return;
      }

      if (effectiveClassName !== selectedClassName) setSelectedClassName(effectiveClassName);
      if (effectiveClassId !== selectedClassId) setSelectedClassId(effectiveClassId);

      const didAutoLock = await autoLockExpiredStages(effectiveClassId);
      if (latestRefreshTokenRef.current !== refreshToken) return;
      await fetchStages(effectiveClassId);
      if (latestRefreshTokenRef.current !== refreshToken) return;
      if (didAutoLock) {
        await fetchStages(effectiveClassId);
        if (latestRefreshTokenRef.current !== refreshToken) return;
      }
    } catch (err) {
      if (latestRefreshTokenRef.current !== refreshToken) return;
      setStages([]);
      setError(err.message || "Failed to load review management data.");
    } finally {
      if (!keepLoading && latestRefreshTokenRef.current === refreshToken) setLoading(false);
    }
  }, [autoLockExpiredStages, fetchClasses, fetchStages, selectedClassId, selectedClassName]);

  useEffect(() => {
    const classParam = searchParams.get("class");
    refreshData(classParam || selectedClassId || selectedClassName || "");
  }, [refreshData, searchParams]);

  useEffect(() => {
    if (!selectedClassId) {
      setStages([]);
      setLoading(false);
      return;
    }

    const run = async () => {
      const refreshToken = latestRefreshTokenRef.current + 1;
      latestRefreshTokenRef.current = refreshToken;
      setLoading(true);
      setError("");
      try {
        await autoLockExpiredStages(selectedClassId);
        if (latestRefreshTokenRef.current !== refreshToken) return;
        await fetchStages(selectedClassId);
        if (latestRefreshTokenRef.current !== refreshToken) return;
      } catch (err) {
        if (latestRefreshTokenRef.current !== refreshToken) return;
        setStages([]);
        setError(err.message || "Failed to load review stages.");
      } finally {
        if (latestRefreshTokenRef.current === refreshToken) setLoading(false);
      }
    };

    run();
  }, [autoLockExpiredStages, fetchStages, selectedClassId]);

  useEffect(() => {
    resetDeadlineModal();
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) return undefined;

    const timer = setInterval(async () => {
      const didAutoLock = await autoLockExpiredStages(selectedClassId);
      if (didAutoLock) {
        await fetchStages(selectedClassId);
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [autoLockExpiredStages, fetchStages, selectedClassId]);

  useEffect(() => {
    const channel = supabase
      .channel("review-management-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "review_stages" },
        async (payload) => {
          const changedClass = payload.new?.class_id || payload.old?.class_id || "";
          if (!selectedClassId || changedClass === selectedClassId || !changedClass) {
            await refreshData(selectedClassName || "", { keepLoading: true });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshData, selectedClassId, selectedClassName]);

  const summary = useMemo(() => {
    const totalStages = stages.length;
    const activeStage = stages.find((stage) => stage.statusValue === STATUS.ACTIVE)?.name || "-";
    const completedStages = stages.filter((stage) => stage.statusValue === STATUS.COMPLETED).length;
    const inactiveStages = stages.filter((stage) => stage.statusValue === STATUS.INACTIVE).length;
    return { totalStages, activeStage, completedStages, inactiveStages };
  }, [stages]);

  const setSingleStageStatus = useCallback(async (stageId, nextStatus) => {
    let effectiveStageId = stageId;
    if (!isUuid(effectiveStageId)) {
      const stage = stages.find((item) => item.id === stageId);
      effectiveStageId = await resolveStageId(stage);
    }

    const payload = {
      is_active: nextStatus === STATUS.ACTIVE,
      is_completed: nextStatus === STATUS.COMPLETED,
      is_locked: nextStatus === STATUS.LOCKED,
    };
    const { data: updatedRows, error: updateError } = await supabase
      .from("review_stages")
      .update(payload)
      .select("id")
      .eq("id", effectiveStageId)
      .eq("class_id", selectedClassId);

    if (updateError) {
      throw new Error(updateError.message || "Failed to update stage status.");
    }
    if (!updatedRows || updatedRows.length === 0) {
      throw new Error("Review stage update was not applied.");
    }
  }, [resolveStageId, selectedClassId, stages]);

  const activateStage = async (stageId) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage || !selectedClassId) return;
    if (!stage.deadline && stage.statusValue !== STATUS.ACTIVE) {
      setError("Set a deadline before activating this stage.");
      return;
    }
    if (stage.statusValue !== STATUS.INACTIVE && stage.statusValue !== STATUS.ACTIVE) return;

    setActionBusyId(stageId);
    setError("");
    try {
      const effectiveStageId = await resolveStageId(stage);
      if (stage.statusValue === STATUS.ACTIVE) {
        await setSingleStageStatus(effectiveStageId, STATUS.INACTIVE);
        await fetchStages(selectedClassId);
        return;
      }

      const { error: deactivateError } = await supabase
        .from("review_stages")
        .update({ is_active: false })
        .eq("class_id", selectedClassId)
        .eq("is_active", true)
        .neq("id", effectiveStageId);

      if (deactivateError) {
        throw new Error(deactivateError.message || "Failed to reset active stage.");
      }

      await setSingleStageStatus(effectiveStageId, STATUS.ACTIVE);
      await fetchStages(selectedClassId);
    } catch (err) {
      setError(err.message || "Failed to activate stage.");
    } finally {
      setActionBusyId("");
    }
  };

  const completeStage = async (stageId) => {
    const currentIndex = stages.findIndex((item) => item.id === stageId);
    const stage = stages[currentIndex];
    if (!stage || !selectedClassId) return;
    if (stage.statusValue !== STATUS.ACTIVE && stage.statusValue !== STATUS.COMPLETED) {
      return;
    }

    setActionBusyId(stageId);
    setError("");
    try {
      const effectiveStageId = await resolveStageId(stage);
      if (stage.statusValue === STATUS.COMPLETED) {
        await setSingleStageStatus(effectiveStageId, STATUS.INACTIVE);
        await fetchStages(selectedClassId);
        return;
      }

      await setSingleStageStatus(effectiveStageId, STATUS.COMPLETED);

      const nextStage = stages
        .slice(currentIndex + 1)
        .find((item) => item.statusValue === STATUS.INACTIVE);

      if (nextStage) {
        const effectiveNextStageId = await resolveStageId(nextStage);
        const { error: deactivateError } = await supabase
          .from("review_stages")
          .update({ is_active: false })
          .eq("class_id", selectedClassId)
          .eq("is_active", true)
          .neq("id", effectiveNextStageId);

        if (deactivateError) {
          throw new Error(deactivateError.message || "Failed to reset active stage.");
        }

        await setSingleStageStatus(effectiveNextStageId, STATUS.ACTIVE);
      }

      await fetchStages(selectedClassId);
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
      const effectiveStageId = await resolveStageId(stage);
      await setSingleStageStatus(effectiveStageId, STATUS.LOCKED);
      await fetchStages(selectedClassId);
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
      const effectiveStageId = await resolveStageId(stage);
      await setSingleStageStatus(effectiveStageId, STATUS.INACTIVE);
      await fetchStages(selectedClassId);
    } catch (err) {
      setError(err.message || "Failed to unlock stage.");
    } finally {
      setActionBusyId("");
    }
  };

  const toggleLockStage = async (stageId) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage) return;
    if (stage.statusValue === STATUS.COMPLETED) return;
    if (stage.statusValue === STATUS.LOCKED) {
      await unlockStage(stageId);
      return;
    }
    await lockStage(stageId);
  };

  const renameStage = async (stageId) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage || !selectedClassId) return;

    const nextNameRaw = window.prompt("Enter new stage name", stage.name);
    const nextName = String(nextNameRaw || "").trim();
    if (!nextName || nextName === stage.name) return;

    setActionBusyId(stageId);
    setError("");
    try {
      const effectiveStageId = await resolveStageId(stage);
      const { error: updateError } = await supabase
        .from("review_stages")
        .update({ stage_name: nextName })
        .eq("id", effectiveStageId)
        .eq("class_id", selectedClassId);

      if (updateError) {
        throw new Error(updateError.message || "Failed to rename stage.");
      }

      await fetchStages(selectedClassId);
    } catch (err) {
      setError(err.message || "Failed to rename stage.");
    } finally {
      setActionBusyId("");
    }
  };

  const deleteStage = async (stageId) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage || !selectedClassId) return;
    const ok = window.confirm(`Remove stage "${stage.name}"?`);
    if (!ok) return;

    setActionBusyId(stageId);
    setError("");
    try {
      const effectiveStageId = await resolveStageId(stage);
      const { error: deleteError } = await supabase
        .from("review_stages")
        .delete()
        .eq("id", effectiveStageId)
        .eq("class_id", selectedClassId);

      if (deleteError) {
        throw new Error(deleteError.message || "Failed to remove stage.");
      }

      await fetchStages(selectedClassId);
    } catch (err) {
      setError(err.message || "Failed to remove stage.");
    } finally {
      setActionBusyId("");
    }
  };

  const handleOpenDeadlineModal = (stage) => {
    setEditingStage(stage);
    setDeadlineDate(toDatePart(stage.deadline));
    setDeadlineTime(toTimePart(stage.deadline));
  };

  const resetDeadlineModal = () => {
    setEditingStage(null);
    setDeadlineDate("");
    setDeadlineTime("");
    setSavingDeadline(false);
  };

  const handleSaveDeadline = async (stageId, deadlineIso) => {
    if (!stageId || !deadlineIso) return;
    setSavingDeadline(true);
    setError("");

    try {
      const stage = stages.find((item) => item.id === stageId) || editingStage;
      const deadlineDate = new Date(deadlineIso);
      const isFutureDeadline = !Number.isNaN(deadlineDate.getTime()) && deadlineDate.getTime() > Date.now();
      const updatePayload = { coordinator_deadline: deadlineIso };
      if (isFutureDeadline) {
        updatePayload.is_locked = false;
        if (stage?.statusValue === STATUS.LOCKED) {
          updatePayload.is_completed = false;
          updatePayload.is_active = false;
        }
      }

      const updateQuery = supabase
        .from("review_stages")
        .update(updatePayload);
      const { error: updateError } = await updateQuery
        .eq("id", await resolveStageId(stage))
        .eq("class_id", selectedClassId);

      if (updateError) {
        if (/coordinator_deadline/i.test(String(updateError.message || ""))) {
          throw new Error('The "coordinator_deadline" column is missing in "review_stages". Run the Supabase ALTER TABLE migration first.');
        }
        throw new Error(updateError.message || "Failed to update deadline.");
      }

      await autoLockExpiredStages(selectedClassId);
      await fetchStages(selectedClassId);
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
    <div className="min-h-screen etnova-bg">
      <Sidebar
        activeItem="review-management"
        onSignOut={handleSignOut}
        onNavigate={handleNavigate}
      />

      <main className="flex-1 min-h-0 md:ml-64 h-[100dvh] overflow-y-auto">
        <TopNavbar
          adminName={ADMIN_NAME}
          academicYearLabel="2026 - S6 Mini Project"
          pageTitle="Review Workflow"
        />

        <div className="p-4 md:p-6 lg:p-8 space-y-6">
          <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold text-slate-800">Review Workflow</h1>
              <p className="text-slate-500">Manage review stages and mentor evaluation deadlines for each class in real time</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600 font-medium" htmlFor="class-filter">Class</label>
              <select
                id="class-filter"
                value={selectedClassId}
                onChange={(event) => {
                  const nextClassId = event.target.value;
                  setSelectedClassId(nextClassId);
                  const selectedClass = classes.find((classItem) => classItem.id === nextClassId);
                  setSelectedClassName(selectedClass?.name || "");
                  refreshData(nextClassId);
                }}
                className="glass-input rounded-xl px-3 py-2.5 text-sm text-slate-700 min-w-[180px]"
              >
                {classes.length === 0 ? <option value="">No classes</option> : null}
                {classes.map((classItem) => (
                  <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                ))}
              </select>
            </div>
          </section>

          {error ? <FeedbackBanner tone="error">{error}</FeedbackBanner> : null}

          {classes.length === 0 ? (
            <EmptyStatePanel
              icon="school"
              title="No classes available yet"
              description="Create classes first so review stages and mentor deadlines can be configured for each batch."
              className="bg-white shadow-sm"
            />
          ) : null}

          <section className="bg-white/90 rounded-2xl shadow-sm border border-slate-200/70 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Class Review Timeline</h2>
            <p className="text-sm text-slate-500 mb-4">This timeline is the source of truth for stage availability, deadline control, and coordinator follow-up.</p>
            <ReviewTimeline
              stages={stages}
              selectedClass={selectedClassName}
              deadlineLabel="Mentor evaluation deadline"
            />
          </section>

          <StageTable
            loading={loading}
            stages={stages}
            selectedClass={selectedClassName}
            deadlineLabel="Mentor Evaluation Deadline"
            simplifiedActions={false}
            actionBusyId={actionBusyId}
            onEditDeadline={handleOpenDeadlineModal}
            onActivateStage={activateStage}
            onCompleteStage={completeStage}
            onToggleLockStage={toggleLockStage}
            onRenameStage={renameStage}
            onDeleteStage={deleteStage}
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
        title="Edit Mentor Evaluation Deadline"
        dateLabel="Evaluation Deadline Date"
        timeLabel="Evaluation Deadline Time"
        onDeadlineDateChange={setDeadlineDate}
        onDeadlineTimeChange={setDeadlineTime}
        saving={savingDeadline}
        onClose={resetDeadlineModal}
        onSave={handleSaveDeadline}
      />
    </div>
  );
}


