import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import supabase from "../config/supabaseClient";
import useAdminProfilePanel from "../hooks/useAdminProfilePanel";
import AppFrame from "../components/AppFrame";
import Sidebar from "../components/admin/Sidebar";
import TopNavbar from "../components/admin/TopNavbar";
import ReviewTimeline from "../components/admin/ReviewTimeline";
import StageTable from "../components/admin/StageTable";
import DeadlineModal from "../components/admin/DeadlineModal";
import StageStatCard from "../components/admin/StageStatCard";
import AdminProfileSettingsModal from "../components/admin/AdminProfileSettingsModal";
import ProfileMenu from "../components/ProfileMenu";
import Modal from "../components/Modal";
import { createNotifications, formatClassNotificationLabel } from "../utils/notificationHelpers";
import { emitAdminDataUpdated } from "../utils/adminLiveSync";
import { subscribeWithDeferredCleanup } from "../utils/realtimeChannel";

const ADMIN_NAME = "Meenakshi";

const STATUS = {
  INACTIVE: "inactive",
  ACTIVE: "active",
  COMPLETED: "completed",
  LOCKED: "locked",
  PENDING: "pending",
};

const STAGE_ORDER = ["Idea", "Abstract", "Zeroth Review", "First Review", "Second Review", "Final Review"];

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

function parseStageOrder(value, fallback = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function stageNameToEvaluationKey(stageName) {
  const value = normalizeStageName(stageName).toLowerCase();
  if (value === "idea") return "idea";
  if (value === "abstract") return "abstract";
  if (value === "zeroth review") return "zeroth_review";
  if (value === "first review") return "first_review";
  if (value === "second review") return "second_review";
  if (value === "final review") return "final_review";
  return "";
}

function normalizeEvaluationKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "idea" || normalized === "idea approval") return "idea";
  if (normalized === "abstract" || normalized === "abstract submission") return "abstract";
  if (normalized === "zeroth review" || normalized === "0th review" || normalized === "proposal" || normalized === "srs") return "zeroth_review";
  if (normalized === "first review" || normalized === "1st review" || normalized === "report") return "first_review";
  if (normalized === "second review" || normalized === "2nd review" || normalized === "presentation") return "second_review";
  if (normalized === "final review" || normalized === "final_report") return "final_review";
  return normalized;
}

function toDisplayStatus(status) {
  if (status === STATUS.ACTIVE) return "Active";
  if (status === STATUS.COMPLETED) return "Completed";
  if (status === STATUS.PENDING) return "Pending";
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

function isEvaluationStageName(stageName) {
  return Boolean(stageNameToEvaluationKey(stageName));
}

function resolveStatusValue(row, evaluationCompleted) {
  if (row?.is_locked) return evaluationCompleted ? STATUS.COMPLETED : STATUS.PENDING;
  if (row?.is_completed) return STATUS.COMPLETED;
  if (row?.is_active) return STATUS.ACTIVE;
  return STATUS.INACTIVE;
}

async function fetchCoordinatorEvaluationProgressByStage(stageRows, classId) {
  if (!Array.isArray(stageRows) || stageRows.length === 0 || !classId) return {};

  const stageRowsByKey = new Map();
  stageRows.forEach((row) => {
    const key = stageNameToEvaluationKey(row?.stage_name);
    if (!key || !row?.id) return;
    if (!stageRowsByKey.has(key)) stageRowsByKey.set(key, []);
    stageRowsByKey.get(key).push(row.id);
  });
  if (stageRowsByKey.size === 0) return {};

  const { data: coordinatorRows, error: coordinatorError } = await supabase
    .from("profiles")
    .select("id")
    .eq("class_id", classId)
    .eq("is_coordinator", true);

  if (coordinatorError) return {};
  const coordinatorIds = new Set((coordinatorRows || []).map((row) => row.id).filter(Boolean));
  if (coordinatorIds.size === 0) return {};

  const { data: evaluationRows, error: evaluationError } = await supabase
    .from("evaluations")
    .select("project_id, evaluation_type, phase, evaluator_id, guide_id, obtained_marks, max_marks, projects!inner(class_id)")
    .eq("projects.class_id", classId);

  if (evaluationError) return {};

  const progressSets = {};
  (evaluationRows || []).forEach((row) => {
    const evaluatorId = row?.evaluator_id || row?.guide_id;
    if (!coordinatorIds.has(evaluatorId)) return;
    if (row?.obtained_marks == null || row?.max_marks == null) return;

    const stageKey = normalizeEvaluationKey(row?.phase || row?.evaluation_type);
    const stageIds = stageRowsByKey.get(stageKey) || [];
    if (stageIds.length === 0) return;

    stageIds.forEach((stageId) => {
      if (!progressSets[stageId]) {
        progressSets[stageId] = new Set();
      }
      if (row?.project_id) {
        progressSets[stageId].add(row.project_id);
      }
    });
  });

  const counts = {};
  Object.keys(progressSets).forEach((stageId) => {
    counts[stageId] = progressSets[stageId].size;
  });
  return counts;
}

async function fetchProjectCount(classId) {
  if (!classId) return 0;

  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId);

  if (error) return 0;
  return count || 0;
}

export default function AdminReviewManagement() {
  const navigate = useNavigate();
  const {
    adminProfile,
    showProfileMenu,
    setShowProfileMenu,
    showProfileSettings,
    setShowProfileSettings,
    refreshAdminProfile,
  } = useAdminProfilePanel();
  const [searchParams] = useSearchParams();
  const searchClassParam = searchParams.get("class") || "";
  const latestRefreshTokenRef = useRef(0);
  const classesRequestRef = useRef(null);
  const classesRef = useRef([]);
  const selectedClassNameRef = useRef("");
  const selectedClassIdRef = useRef("");

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
  const [stageNameModalOpen, setStageNameModalOpen] = useState(false);
  const [stageNameInput, setStageNameInput] = useState("");
  const [editingNameStageId, setEditingNameStageId] = useState("");
  const [savingStageName, setSavingStageName] = useState(false);
  const [deletingStageId, setDeletingStageId] = useState("");
  const [savingDeleteStage, setSavingDeleteStage] = useState(false);

  useEffect(() => {
    classesRef.current = classes;
  }, [classes]);

  useEffect(() => {
    selectedClassNameRef.current = selectedClassName;
  }, [selectedClassName]);

  useEffect(() => {
    selectedClassIdRef.current = selectedClassId;
  }, [selectedClassId]);

  const ensureClassesLoaded = useCallback(async (force = false) => {
    if (!force && classesRef.current.length > 0) {
      return classesRef.current;
    }

    if (classesRequestRef.current) {
      return classesRequestRef.current;
    }

    const request = (async () => {
      const { data, error: fetchError } = await supabase
        .from("classes")
        .select("id, class_section")
        .order("class_section", { ascending: true });

      if (fetchError) {
        throw new Error(fetchError.message || "Failed to load classes.");
      }

      const normalized = (data || []).map((row) => ({
        id: row.id,
        name: row.class_section || String(row.id),
      }));
      classesRef.current = normalized;
      setClasses((current) => {
        if (
          current.length === normalized.length
          && current.every((row, index) => row.id === normalized[index]?.id && row.name === normalized[index]?.name)
        ) {
          return current;
        }
        return normalized;
      });
      return normalized;
    })();

    classesRequestRef.current = request;

    try {
      return await request;
    } finally {
      if (classesRequestRef.current === request) {
        classesRequestRef.current = null;
      }
    }
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

    const inserts = missing.map((stageName, index) => ({
      class_id: classId,
      stage_name: stageName,
      stage_order: index + 1,
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

    let data = null;
    let fetchError = null;
    {
      const result = await supabase
        .from("review_stages")
        .select("id, stage_name, stage_order, class_id, coordinator_deadline, is_active, is_completed, is_locked")
        .eq("class_id", classId);
      data = result.data;
      fetchError = result.error;
    }

    if (fetchError && /stage_order/i.test(String(fetchError.message || ""))) {
      const fallbackResult = await supabase
        .from("review_stages")
        .select("id, stage_name, class_id, coordinator_deadline, is_active, is_completed, is_locked")
        .eq("class_id", classId);
      data = fallbackResult.data;
      fetchError = fallbackResult.error;
    }

    if (fetchError) {
      if (/coordinator_deadline/i.test(String(fetchError.message || ""))) {
        throw new Error('The "coordinator_deadline" column is missing in "review_stages". Run the Supabase ALTER TABLE migration first.');
      }
      throw new Error(fetchError.message || "Failed to load review stages.");
    }

    const rows = [...(data || [])].sort((a, b) => {
      const byExplicitOrder = parseStageOrder(a.stage_order) - parseStageOrder(b.stage_order);
      if (byExplicitOrder !== 0) return byExplicitOrder;
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

    const [coordinatorEvaluationCounts, classProjectCount] = await Promise.all([
      fetchCoordinatorEvaluationProgressByStage(rows, classId),
      fetchProjectCount(classId),
    ]);

    const mappedStages = rows.map((row) => {
      const normalizedName = normalizeStageName(row.stage_name);
      const shouldTrackEvaluation = isEvaluationStageName(normalizedName);
      const completedOnTime = shouldTrackEvaluation
        ? (classProjectCount > 0 && (coordinatorEvaluationCounts[row.id] || 0) >= classProjectCount)
        : Boolean(row.is_completed);
      const statusValue = shouldTrackEvaluation
        ? (completedOnTime ? STATUS.COMPLETED : STATUS.PENDING)
        : resolveStatusValue(row, completedOnTime);

      return {
        id: row.id,
        order: parseStageOrder(row.stage_order, rows.findIndex((item) => item.id === row.id) + 1),
        name: normalizedName,
        className: row.class_id,
        deadline: row.coordinator_deadline || null,
        status: toDisplayStatus(statusValue),
        statusValue,
        isLocked: Boolean(row.is_locked),
        submissions: coordinatorEvaluationCounts[row.id] || 0,
      };
    });

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
      .select("id, stage_name, coordinator_deadline, is_completed")
      .eq("class_id", classId)
      .eq("is_locked", false)
      .not("coordinator_deadline", "is", null)
      .lt("coordinator_deadline", nowIso);

    if (fetchError || !data || data.length === 0) return false;

    const [classProjectCount, coordinatorEvaluationCounts] = await Promise.all([
      fetchProjectCount(classId),
      fetchCoordinatorEvaluationProgressByStage(data, classId),
    ]);

    for (const row of data) {
      const shouldTrackEvaluation = isEvaluationStageName(row.stage_name);
      const completedOnTime = shouldTrackEvaluation
        ? (classProjectCount > 0 && (coordinatorEvaluationCounts[row.id] || 0) >= classProjectCount)
        : Boolean(row.is_completed);

      const { error: updateError } = await supabase
        .from("review_stages")
        .update({
          is_locked: true,
          is_active: false,
          is_completed: completedOnTime,
          coordinator_deadline: null,
        })
        .eq("id", row.id)
        .eq("class_id", classId);

      if (updateError) return false;
    }

    return true;
  }, []);

  const clearDeadlinesForLockedStages = useCallback(async (classId) => {
    if (!classId) return false;

    const { data, error: fetchError } = await supabase
      .from("review_stages")
      .select("id")
      .eq("class_id", classId)
      .eq("is_locked", true)
      .not("coordinator_deadline", "is", null);

    if (fetchError || !data || data.length === 0) return false;

    const ids = data.map((row) => row.id);
    const { error: updateError } = await supabase
      .from("review_stages")
      .update({ coordinator_deadline: null })
      .in("id", ids)
      .eq("class_id", classId);

    if (updateError) return false;
    return true;
  }, []);

  const reconcileStageCompletionFlags = useCallback(async (classId) => {
    if (!classId) return false;

    const { data: rows, error: fetchError } = await supabase
      .from("review_stages")
      .select("id, stage_name, class_id, coordinator_deadline, is_locked, is_completed")
      .eq("class_id", classId);

    if (fetchError || !rows || rows.length === 0) return false;

    const [classProjectCount, coordinatorEvaluationCounts] = await Promise.all([
      fetchProjectCount(classId),
      fetchCoordinatorEvaluationProgressByStage(rows, classId),
    ]);

    let didChange = false;
    for (const row of rows) {
      const shouldTrackEvaluation = isEvaluationStageName(row.stage_name);
      const desiredCompleted = shouldTrackEvaluation
        ? (classProjectCount > 0 && (coordinatorEvaluationCounts[row.id] || 0) >= classProjectCount)
        : false;

      if (Boolean(row.is_completed) === desiredCompleted) continue;

      const { error: updateError } = await supabase
        .from("review_stages")
        .update({ is_completed: desiredCompleted })
        .eq("id", row.id)
        .eq("class_id", classId);

      if (updateError) continue;
      didChange = true;
    }

    return didChange;
  }, []);

  const refreshData = useCallback(async (classRef, options = {}) => {
    const { keepLoading = false, refreshClasses = false } = options;
    const refreshToken = latestRefreshTokenRef.current + 1;
    latestRefreshTokenRef.current = refreshToken;
    if (!keepLoading) setLoading(true);
    setError("");

    try {
      const fetchedClasses = await ensureClassesLoaded(refreshClasses);
      if (latestRefreshTokenRef.current !== refreshToken) return;
      const effectiveClassRef = classRef
        || selectedClassIdRef.current
        || selectedClassNameRef.current
        || fetchedClasses[0]?.id
        || fetchedClasses[0]?.name
        || "";
      const classRow = fetchedClasses.find((row) => row.id === effectiveClassRef)
        || fetchedClasses.find((row) => row.name === effectiveClassRef)
        || null;
      const effectiveClassName = classRow?.name || "";
      const effectiveClassId = classRow?.id || "";

      if (!effectiveClassName || !effectiveClassId) {
        if (latestRefreshTokenRef.current !== refreshToken) return;
        selectedClassNameRef.current = "";
        selectedClassIdRef.current = "";
        setSelectedClassName("");
        setSelectedClassId("");
        setStages([]);
        return;
      }

      if (effectiveClassName !== selectedClassNameRef.current) {
        selectedClassNameRef.current = effectiveClassName;
        setSelectedClassName(effectiveClassName);
      }
      if (effectiveClassId !== selectedClassIdRef.current) {
        selectedClassIdRef.current = effectiveClassId;
        setSelectedClassId(effectiveClassId);
      }

      const didAutoLock = await autoLockExpiredStages(effectiveClassId);
      const didClearLockedDeadlines = await clearDeadlinesForLockedStages(effectiveClassId);
      const didReconcile = await reconcileStageCompletionFlags(effectiveClassId);
      if (latestRefreshTokenRef.current !== refreshToken) return;
      await fetchStages(effectiveClassId);
      if (latestRefreshTokenRef.current !== refreshToken) return;
      if (didAutoLock || didReconcile || didClearLockedDeadlines) {
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
  }, [autoLockExpiredStages, clearDeadlinesForLockedStages, ensureClassesLoaded, fetchStages, reconcileStageCompletionFlags]);

  useEffect(() => {
    refreshData(searchClassParam, { refreshClasses: true });
  }, [refreshData, searchClassParam]);

  useEffect(() => {
    resetDeadlineModal();
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) return undefined;

    const timer = setInterval(async () => {
      const didAutoLock = await autoLockExpiredStages(selectedClassId);
      const didClearLockedDeadlines = await clearDeadlinesForLockedStages(selectedClassId);
      const didReconcile = await reconcileStageCompletionFlags(selectedClassId);
      if (didAutoLock || didReconcile || didClearLockedDeadlines) {
        await fetchStages(selectedClassId);
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [autoLockExpiredStages, clearDeadlinesForLockedStages, fetchStages, reconcileStageCompletionFlags, selectedClassId]);

  useEffect(() => {
    const channel = supabase
      .channel("review-management-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "review_stages" },
        async (payload) => {
          const changedClass = payload.new?.class_id || payload.old?.class_id || "";
          const activeClassId = selectedClassIdRef.current;
          const activeClassName = selectedClassNameRef.current;
          if (!activeClassId || changedClass === activeClassId || !changedClass) {
            await refreshData(activeClassId || activeClassName || "", { keepLoading: true });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evaluations" },
        async () => {
          if (!selectedClassIdRef.current) return;
          await refreshData(selectedClassIdRef.current, { keepLoading: true });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        async () => {
          if (!selectedClassIdRef.current) return;
          await refreshData(selectedClassIdRef.current, { keepLoading: true });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        async () => {
          if (!selectedClassIdRef.current) return;
          await refreshData(selectedClassIdRef.current, { keepLoading: true });
        }
      )
    return subscribeWithDeferredCleanup(supabase, channel);
  }, [refreshData]);

  const summary = useMemo(() => {
    const totalStages = stages.length;
    const activeStage = stages.find((stage) => stage.statusValue === STATUS.ACTIVE)?.name || "-";
    const completedStages = stages.filter((stage) => stage.statusValue === STATUS.COMPLETED).length;
    const inactiveStages = stages.filter((stage) => stage.statusValue === STATUS.INACTIVE || stage.statusValue === STATUS.PENDING).length;
    return { totalStages, activeStage, completedStages, inactiveStages };
  }, [stages]);

  const lockStage = async (stageId) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage || stage.isLocked) return;

    setActionBusyId(stageId);
    setError("");
    try {
      const effectiveStageId = await resolveStageId(stage);
      const { error: updateError } = await supabase
        .from("review_stages")
        .update({
          is_locked: true,
          is_active: false,
          coordinator_deadline: null,
        })
        .eq("id", effectiveStageId)
        .eq("class_id", selectedClassId);

      if (updateError) {
        throw new Error(updateError.message || "Failed to lock stage.");
      }

      await fetchStages(selectedClassId);
      emitAdminDataUpdated();
    } catch (err) {
      setError(err.message || "Failed to lock stage.");
    } finally {
      setActionBusyId("");
    }
  };

  const unlockStage = async (stageId) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage || !stage.isLocked) return;

    setActionBusyId(stageId);
    setError("");
    try {
      const effectiveStageId = await resolveStageId(stage);

      const { error: deactivateError } = await supabase
        .from("review_stages")
        .update({ is_active: false })
        .eq("class_id", selectedClassId)
        .eq("is_active", true)
        .neq("id", effectiveStageId);

      if (deactivateError) {
        throw new Error(deactivateError.message || "Failed to reset active stage.");
      }

      const { error: unlockError } = await supabase
        .from("review_stages")
        .update({
          is_locked: false,
          is_active: true,
          is_completed: false,
        })
        .eq("id", effectiveStageId)
        .eq("class_id", selectedClassId);

      if (unlockError) {
        throw new Error(unlockError.message || "Failed to unlock stage.");
      }

      await fetchStages(selectedClassId);
      emitAdminDataUpdated();
    } catch (err) {
      setError(err.message || "Failed to unlock stage.");
    } finally {
      setActionBusyId("");
    }
  };

  const toggleLockStage = async (stageId) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage) return;
    if (stage.isLocked) {
      await unlockStage(stageId);
      return;
    }
    await lockStage(stageId);
  };

  const openAddStageModal = () => {
    setEditingNameStageId("");
    setStageNameInput("");
    setStageNameModalOpen(true);
  };

  const openRenameStageModal = (stageId) => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage) return;
    setEditingNameStageId(stageId);
    setStageNameInput(stage.name || "");
    setStageNameModalOpen(true);
  };

  const closeStageNameModal = () => {
    setStageNameModalOpen(false);
    setEditingNameStageId("");
    setStageNameInput("");
  };

  const submitStageName = async () => {
    if (!selectedClassId) return;
    const nextName = String(stageNameInput || "").trim();
    if (!nextName) {
      setError("Stage name is required.");
      return;
    }

      const duplicate = stages.some((stage) => {
      if (editingNameStageId && stage.id === editingNameStageId) return false;
      return normalizeStageName(stage.name).toLowerCase() === normalizeStageName(nextName).toLowerCase();
    });
    if (duplicate) {
      setError("A stage with this name already exists.");
      return;
    }

    setSavingStageName(true);
    setError("");
    try {
      if (editingNameStageId) {
        const stage = stages.find((item) => item.id === editingNameStageId);
        if (!stage) throw new Error("Stage not found.");
        const effectiveStageId = await resolveStageId(stage);
        const { error: updateError } = await supabase
          .from("review_stages")
          .update({ stage_name: nextName })
          .eq("id", effectiveStageId)
          .eq("class_id", selectedClassId);

        if (updateError) {
          throw new Error(updateError.message || "Failed to edit stage.");
        }
      } else {
        const { error: insertError } = await supabase
          .from("review_stages")
          .insert({
            class_id: selectedClassId,
            stage_name: nextName,
            stage_order: stages.length + 1,
            coordinator_deadline: null,
            is_active: false,
            is_completed: false,
            is_locked: true,
          });

        if (insertError) {
          throw new Error(insertError.message || "Failed to add stage.");
        }
      }

      await fetchStages(selectedClassId);
      closeStageNameModal();
      emitAdminDataUpdated();
    } catch (err) {
      setError(err.message || "Failed to save stage.");
    } finally {
      setSavingStageName(false);
    }
  };

  const openDeleteStageModal = (stageId) => {
    setDeletingStageId(stageId || "");
  };

  const closeDeleteStageModal = () => {
    if (savingDeleteStage) return;
    setDeletingStageId("");
  };

  const confirmDeleteStage = async () => {
    if (!selectedClassId || !deletingStageId) return;

    const stage = stages.find((item) => item.id === deletingStageId);
    if (!stage) {
      closeDeleteStageModal();
      return;
    }

    setSavingDeleteStage(true);
    setActionBusyId(stage.id);
    setError("");
    try {
      const effectiveStageId = await resolveStageId(stage);
      const { error: deleteError } = await supabase
        .from("review_stages")
        .delete()
        .eq("id", effectiveStageId)
        .eq("class_id", selectedClassId);

      if (deleteError) {
        throw new Error(deleteError.message || "Failed to delete stage.");
      }

      await fetchStages(selectedClassId);
      setDeletingStageId("");
      emitAdminDataUpdated();
    } catch (err) {
      setError(err.message || "Failed to delete stage.");
    } finally {
      setSavingDeleteStage(false);
      setActionBusyId("");
    }
  };

  const moveStage = async (stageId, direction) => {
    if (!selectedClassId) return;
    const currentIndex = stages.findIndex((item) => item.id === stageId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const current = stages[currentIndex];
    const target = stages[targetIndex];
    setActionBusyId(stageId);
    setError("");
    try {
      const currentOrder = parseStageOrder(current.order, currentIndex + 1);
      const targetOrder = parseStageOrder(target.order, targetIndex + 1);

      const { error: currentErr } = await supabase
        .from("review_stages")
        .update({ stage_order: targetOrder })
        .eq("id", current.id)
        .eq("class_id", selectedClassId);
      if (currentErr) {
        if (/stage_order/i.test(String(currentErr.message || ""))) {
          throw new Error('The "stage_order" column is missing in "review_stages".');
        }
        throw new Error(currentErr.message || "Failed to move stage.");
      }

      const { error: targetErr } = await supabase
        .from("review_stages")
        .update({ stage_order: currentOrder })
        .eq("id", target.id)
        .eq("class_id", selectedClassId);
      if (targetErr) {
        if (/stage_order/i.test(String(targetErr.message || ""))) {
          throw new Error('The "stage_order" column is missing in "review_stages".');
        }
        throw new Error(targetErr.message || "Failed to move stage.");
      }

      await fetchStages(selectedClassId);
      emitAdminDataUpdated();
    } catch (err) {
      setError(err.message || "Failed to reorder stages.");
    } finally {
      setActionBusyId("");
    }
  };

  const moveStageUp = async (stageId) => {
    await moveStage(stageId, "up");
  };

  const moveStageDown = async (stageId) => {
    await moveStage(stageId, "down");
  };

  const handleOpenDeadlineModal = (stage) => {
    if (stage?.isLocked) {
      setError("Unlock this stage before setting deadline.");
      return;
    }
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
      if (stage?.isLocked) {
        throw new Error("Unlock this stage before setting deadline.");
      }
      const deadlineDate = new Date(deadlineIso);
      const isFutureDeadline = !Number.isNaN(deadlineDate.getTime()) && deadlineDate.getTime() > Date.now();
      const updatePayload = { coordinator_deadline: deadlineIso };
      if (isFutureDeadline) {
        if (stage?.statusValue === STATUS.LOCKED || stage?.statusValue === STATUS.PENDING) {
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

      const { data: coordinatorRows, error: coordinatorError } = await supabase
        .from("profiles")
        .select("id")
        .eq("is_coordinator", true)
        .eq("class_id", selectedClassId);

      if (coordinatorError) {
        throw new Error(coordinatorError.message || "Failed to notify coordinators.");
      }

      await createNotifications((coordinatorRows || []).map((coordinator) => ({
        user_id: coordinator.id,
        type: "review_deadline_updated",
        title: "Review Deadline Updated",
        message: `Administrator updated the ${stage?.name || editingStage?.name || "review"} deadline for ${formatClassNotificationLabel({ class_name: selectedClassName })}.`,
      })));

      await autoLockExpiredStages(selectedClassId);
      await fetchStages(selectedClassId);
      resetDeadlineModal();
      emitAdminDataUpdated();
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
      return;
    }
    if (itemId === "rubrics-management") {
      navigate("/admin/rubrics");
    }
  };

  return (
    <AppFrame
      sidebar={(
        <Sidebar
          activeItem="review-management"
          onSignOut={handleSignOut}
          onNavigate={handleNavigate}
        />
      )}
      header={(
        <TopNavbar
          adminName={adminProfile.full_name || ADMIN_NAME}
          academicYearLabel="2026 - S6 Mini Project"
          pageTitle="Review Management"
          onHomeClick={() => navigate("/admin")}
          onProfileClick={() => setShowProfileMenu((value) => !value)}
        />
      )}
      headerOverlay={showProfileMenu ? (
        <div className="fixed top-14 right-2 sm:right-6 md:right-8 z-50">
          <ProfileMenu
            profile={adminProfile}
            isOpen={showProfileMenu}
            onClose={() => setShowProfileMenu(false)}
            onLogout={handleSignOut}
            onEditProfile={() => {
              setShowProfileMenu(false);
              setShowProfileSettings(true);
            }}
            onHelpSupport={() => navigate("/admin/help")}
            roleLabel="Administrator"
            roleIcon="admin_panel_settings"
            infoItems={[
              { label: "Full Name", value: adminProfile.full_name || "-" },
              { label: "Email", value: adminProfile.email || "-" },
              { label: "Role", value: "Administrator" },
              { label: "Department", value: adminProfile.department || "-" },
            ]}
          />
        </div>
      ) : null}
    >
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
          <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold text-slate-800">Review Management</h1>
              <p className="text-slate-500">Control review stages and coordinator evaluation deadlines in realtime</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600 font-medium" htmlFor="class-filter">Class</label>
              <select
                id="class-filter"
                value={selectedClassId}
                onChange={(event) => {
                  const nextClassId = event.target.value;
                  refreshData(nextClassId);
                }}
                className="glass-input rounded-xl px-3 py-2.5 text-sm text-slate-700 min-w-[180px]"
              >
                {classes.length === 0 ? <option value="">No classes</option> : null}
                {classes.map((classItem) => (
                  <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={openAddStageModal}
                disabled={actionBusyId !== ""}
                className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Stage
              </button>
            </div>
          </section>

          {error ? (
            <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </section>
          ) : null}

          <section className="bg-white/90 rounded-2xl shadow-sm border border-slate-200/70 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Review Timeline Overview</h2>
            <ReviewTimeline
              stages={stages}
              selectedClass={selectedClassName}
              deadlineLabel="Coordinator evaluation deadline"
            />
          </section>

          <StageTable
            loading={loading}
            stages={stages}
            selectedClass={selectedClassName}
            deadlineLabel="Coordinator Evaluation Deadline"
            simplifiedActions={false}
            actionBusyId={actionBusyId}
            onEditDeadline={handleOpenDeadlineModal}
            onToggleLockStage={toggleLockStage}
            onRenameStage={openRenameStageModal}
            onDeleteStage={openDeleteStageModal}
            onMoveStageUp={moveStageUp}
            onMoveStageDown={moveStageDown}
          />

          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <StageStatCard title="Total Stages" value={summary.totalStages} icon="total" borderClass="border-t-teal-500" />
            <StageStatCard title="Active Stage" value={summary.activeStage} icon="active" borderClass="border-t-cyan-500" />
            <StageStatCard title="Completed Stages" value={summary.completedStages} icon="completed" borderClass="border-t-emerald-500" />
            <StageStatCard title="Inactive Stages" value={summary.inactiveStages} icon="upcoming" borderClass="border-t-gray-400" />
          </section>
      </div>

      <Modal
        isOpen={stageNameModalOpen}
        onClose={closeStageNameModal}
        title={editingNameStageId ? "Edit Stage Name" : "Add New Stage"}
        maxWidth="max-w-md"
        disableClose={savingStageName}
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">Stage Name</label>
            <input
              type="text"
              value={stageNameInput}
              onChange={(event) => setStageNameInput(event.target.value)}
              placeholder="Enter stage name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeStageNameModal}
              disabled={savingStageName}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitStageName}
              disabled={savingStageName || !stageNameInput.trim()}
              className="px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 disabled:opacity-60"
            >
              {savingStageName ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(deletingStageId)}
        onClose={closeDeleteStageModal}
        title="Delete Stage"
        maxWidth="max-w-md"
        disableClose={savingDeleteStage}
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-700">
            Are you sure you want to delete{" "}
            <span className="font-semibold">
              {stages.find((stage) => stage.id === deletingStageId)?.name || "this stage"}
            </span>
            ?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDeleteStageModal}
              disabled={savingDeleteStage}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteStage}
              disabled={savingDeleteStage}
              className="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-60"
            >
              {savingDeleteStage ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      <DeadlineModal
        stage={editingStage}
        isOpen={Boolean(editingStage)}
        deadlineDate={deadlineDate}
        deadlineTime={deadlineTime}
        title="Edit Coordinator Evaluation Deadline"
        dateLabel="Evaluation Deadline Date"
        timeLabel="Evaluation Deadline Time"
        onDeadlineDateChange={setDeadlineDate}
        onDeadlineTimeChange={setDeadlineTime}
        saving={savingDeadline}
        onClose={resetDeadlineModal}
        onSave={handleSaveDeadline}
      />
      <AdminProfileSettingsModal
        isOpen={showProfileSettings}
        onClose={() => setShowProfileSettings(false)}
        onSuccess={refreshAdminProfile}
      />
    </AppFrame>
  );
}
