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
const STAGE_ORDER = ["Idea", "Abstract", "Zeroth Review", "First Review", "Second Review", "Final Review"];
const DEADLINE_FILTER = {
  STAGE: "stage_deadline",
  MENTOR_EVAL: "mentor_evaluation_deadline",
};

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

function stageAliases(stageName) {
  const normalized = normalizeStageName(stageName);
  if (normalized === "Zeroth Review") return ["Zeroth Review", "0th Review"];
  if (normalized === "First Review") return ["First Review", "1st Review"];
  if (normalized === "Second Review") return ["Second Review", "2nd Review"];
  return [normalized];
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

function toTimePart(iso, fallback = "09:00") {
  if (!iso) return fallback;
  return iso.slice(11, 16) || fallback;
}

function isUuid(value) {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function fetchSubmissionCountsByStage(stageIds, selectedClass) {
  if (!Array.isArray(stageIds) || stageIds.length === 0) return {};

  const queryOptions = [
    { table: "stage_submissions", idColumn: "stage_id", classColumn: "class_id" },
    { table: "stage_submissions", idColumn: "review_stage_id", classColumn: "class_id" },
    { table: "review_stage_submissions", idColumn: "stage_id", classColumn: "class_id" },
    { table: "review_stage_submissions", idColumn: "review_stage_id", classColumn: "class_id" },
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
  const [selectedClassName, setSelectedClassName] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [deadlineFilter] = useState(DEADLINE_FILTER.STAGE);
  const [hasMentorEvalDeadlineColumn, setHasMentorEvalDeadlineColumn] = useState(true);
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
    if (!classId && deadlineFilter !== DEADLINE_FILTER.MENTOR_EVAL) {
      setStages([]);
      return;
    }

    if (deadlineFilter !== DEADLINE_FILTER.MENTOR_EVAL) {
      await ensureDefaultStages(classId, { silentRls: true });
    }

    let data = null;
    let fetchError = null;

    const preferred = await supabase
      .from("review_stages")
      .select("id, stage_name, class_id, deadline, mentor_evaluation_deadline, is_active, is_completed, is_locked")
      .eq("class_id", classId)
      .order("stage_name", { ascending: true });

    data = preferred.data;
    fetchError = preferred.error;

    if (fetchError) {
      const fetchMsg = String(fetchError.message || "").toLowerCase();
      if (fetchMsg.includes("mentor_evaluation_deadline")) {
        setHasMentorEvalDeadlineColumn(false);
        const fallback = await supabase
          .from("review_stages")
          .select("id, stage_name, class_id, deadline, is_active, is_completed, is_locked")
          .eq("class_id", classId)
          .order("stage_name", { ascending: true });
        data = fallback.data;
        fetchError = fallback.error;
      }
    } else {
      setHasMentorEvalDeadlineColumn(true);
    }

    if (fetchError) {
      throw new Error(fetchError.message || "Failed to load review stages.");
    }

    if (deadlineFilter === DEADLINE_FILTER.MENTOR_EVAL) {
      let globalRows = null;
      let globalError = null;
      const globalPreferred = await supabase
        .from("review_stages")
        .select("id, stage_name, class_id, deadline, mentor_evaluation_deadline, is_active, is_completed, is_locked")
        .order("stage_name", { ascending: true });

      globalRows = globalPreferred.data;
      globalError = globalPreferred.error;

      if (globalError) {
        const globalMsg = String(globalError.message || "").toLowerCase();
        if (globalMsg.includes("mentor_evaluation_deadline")) {
          setHasMentorEvalDeadlineColumn(false);
          const globalFallback = await supabase
            .from("review_stages")
            .select("id, stage_name, class_id, deadline, is_active, is_completed, is_locked")
            .order("stage_name", { ascending: true });
          globalRows = globalFallback.data;
          globalError = globalFallback.error;
        }
      } else {
        setHasMentorEvalDeadlineColumn(true);
      }

      if (globalError) {
        throw new Error(globalError.message || "Failed to load mentor evaluation deadlines.");
      }

      const grouped = STAGE_ORDER.map((stageName, index) => {
        const matches = (globalRows || []).filter((row) => stageAliases(row.stage_name).includes(stageName) || normalizeStageName(row.stage_name) === stageName);
        const first = matches[0] || null;
        const synthetic = {
          is_locked: matches.some((row) => Boolean(row.is_locked)),
          is_completed: matches.some((row) => Boolean(row.is_completed)),
          is_active: matches.some((row) => Boolean(row.is_active)),
        };

        return {
          id: first?.id || `global-${index}`,
          name: stageName,
          className: "all",
          deadline: first?.mentor_evaluation_deadline || first?.deadline || null,
          status: toDisplayStatus(normalizeStatusFromFlags(synthetic)),
          statusValue: normalizeStatusFromFlags(synthetic),
          submissions: 0,
        };
      });

      setStages(grouped);
      return;
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

    const stageIds = rows.map((row) => row.id);
    const submissionCounts = await fetchSubmissionCountsByStage(stageIds, classId);

    const mappedStages = rows.map((row) => ({
      id: row.id,
      name: normalizeStageName(row.stage_name),
      className: row.class_id,
      deadline: deadlineFilter === DEADLINE_FILTER.MENTOR_EVAL
        ? (row.mentor_evaluation_deadline || row.deadline || null)
        : (row.deadline || null),
      status: toDisplayStatus(normalizeStatusFromFlags(row)),
      statusValue: normalizeStatusFromFlags(row),
      submissions: submissionCounts[row.id] || 0,
    }));

    setStages(mappedStages);
  }, [deadlineFilter, ensureDefaultStages]);

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
      .not("deadline", "is", null)
      .lt("deadline", nowIso);

    if (fetchError || !data || data.length === 0) return false;

    const ids = data.map((row) => row.id);
    const { error: updateError } = await supabase
      .from("review_stages")
      .update({ is_locked: true, is_active: false, is_completed: true })
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
      const effectiveClassName = className || selectedClassName || fetchedClasses[0]?.name || "";
      const classRow = fetchedClasses.find((row) => row.name === effectiveClassName) || null;
      const effectiveClassId = classRow?.id || "";

      if (!effectiveClassName || !effectiveClassId) {
        setSelectedClassName("");
        setSelectedClassId("");
        setStages([]);
        return;
      }

      if (effectiveClassName !== selectedClassName) setSelectedClassName(effectiveClassName);
      if (effectiveClassId !== selectedClassId) setSelectedClassId(effectiveClassId);

      const didAutoLock = await autoLockExpiredStages(effectiveClassId);
      await fetchStages(effectiveClassId);
      if (didAutoLock) {
        await fetchStages(effectiveClassId);
      }
    } catch (err) {
      setStages([]);
      setError(err.message || "Failed to load review management data.");
    } finally {
      if (!keepLoading) setLoading(false);
    }
  }, [autoLockExpiredStages, fetchClasses, fetchStages, selectedClassId, selectedClassName]);

  useEffect(() => {
    const classParam = searchParams.get("class");
    refreshData(classParam || "");
  }, [refreshData, searchParams]);

  useEffect(() => {
    if (!selectedClassId) {
      setStages([]);
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        await autoLockExpiredStages(selectedClassId);
        await fetchStages(selectedClassId);
      } catch (err) {
        setStages([]);
        setError(err.message || "Failed to load review stages.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [autoLockExpiredStages, fetchStages, selectedClassId]);

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

  const setGlobalMentorStageStatus = useCallback(async (stageName, nextStatus) => {
    const payload = {
      is_active: nextStatus === STATUS.ACTIVE,
      is_completed: nextStatus === STATUS.COMPLETED,
      is_locked: nextStatus === STATUS.LOCKED,
    };

    const { error: updateError } = await supabase
      .from("review_stages")
      .update(payload)
      .in("stage_name", stageAliases(stageName));

    if (updateError) {
      throw new Error(updateError.message || "Failed to update mentor evaluation stage.");
    }
  }, []);

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
    if (deadlineFilter === DEADLINE_FILTER.MENTOR_EVAL) {
      if (stage.statusValue === STATUS.LOCKED) return;
    } else if (stage.statusValue !== STATUS.ACTIVE && stage.statusValue !== STATUS.COMPLETED) {
      return;
    }

    setActionBusyId(stageId);
    setError("");
    try {
      if (deadlineFilter === DEADLINE_FILTER.MENTOR_EVAL) {
        if (stage.statusValue === STATUS.COMPLETED) {
          await setGlobalMentorStageStatus(stage.name, STATUS.INACTIVE);
        } else {
          await setGlobalMentorStageStatus(stage.name, STATUS.COMPLETED);
        }
        await fetchStages(selectedClassId);
        return;
      }

      const effectiveStageId = await resolveStageId(stage);
      if (stage.statusValue === STATUS.COMPLETED) {
        await setSingleStageStatus(effectiveStageId, STATUS.INACTIVE);
        await fetchStages(selectedClassId);
        return;
      }

      await setSingleStageStatus(effectiveStageId, STATUS.COMPLETED);

      if (deadlineFilter !== DEADLINE_FILTER.MENTOR_EVAL) {
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
    if (!stage || stage.statusValue === STATUS.LOCKED || (deadlineFilter !== DEADLINE_FILTER.MENTOR_EVAL && stage.statusValue === STATUS.COMPLETED)) return;

    setActionBusyId(stageId);
    setError("");
    try {
      if (deadlineFilter === DEADLINE_FILTER.MENTOR_EVAL) {
        await setGlobalMentorStageStatus(stage.name, STATUS.LOCKED);
        await fetchStages(selectedClassId);
        return;
      }

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
      if (deadlineFilter === DEADLINE_FILTER.MENTOR_EVAL) {
        await setGlobalMentorStageStatus(stage.name, STATUS.INACTIVE);
        await fetchStages(selectedClassId);
        return;
      }

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
    if (deadlineFilter !== DEADLINE_FILTER.MENTOR_EVAL && stage.statusValue === STATUS.COMPLETED) return;
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
      const stage = stages.find((item) => item.id === stageId) || editingStage;
      const deadlineDate = new Date(deadlineIso);
      const isFutureDeadline = !Number.isNaN(deadlineDate.getTime()) && deadlineDate.getTime() > Date.now();
      const useMentorEvalColumn = deadlineFilter === DEADLINE_FILTER.MENTOR_EVAL && hasMentorEvalDeadlineColumn;
      const updatePayload = useMentorEvalColumn
        ? { mentor_evaluation_deadline: deadlineIso }
        : { deadline: deadlineIso };
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
      const { error: updateError } = deadlineFilter === DEADLINE_FILTER.MENTOR_EVAL
        ? await updateQuery.in("stage_name", stageAliases(stage?.name))
        : await updateQuery
          .eq("id", await resolveStageId(stage))
          .eq("class_id", selectedClassId);

      if (updateError) {
        throw new Error(updateError.message || "Failed to update deadline.");
      }

      await autoLockExpiredStages(selectedClassId);
      await fetchStages(selectedClassId);
      resetDeadlineModal();
    } catch (err) {
      const errMsg = String(err.message || "");
      if (deadlineFilter === DEADLINE_FILTER.MENTOR_EVAL && /mentor_evaluation_deadline/i.test(errMsg)) {
        setHasMentorEvalDeadlineColumn(false);
        setError("Mentor evaluation deadline column is unavailable; using stage deadline fallback.");
      } else {
        setError(err.message || "Failed to save deadline.");
      }
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
                value={selectedClassName}
                onChange={(event) => {
                  const nextClassName = event.target.value;
                  setSelectedClassName(nextClassName);
                  refreshData(nextClassName);
                }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/40 min-w-[180px]"
              >
                {classes.length === 0 ? <option value="">No classes</option> : null}
                {classes.map((classItem) => (
                  <option key={classItem.id} value={classItem.name}>{classItem.name}</option>
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
            <ReviewTimeline stages={stages} selectedClass={selectedClassName} />
          </section>

          <StageTable
            loading={loading}
            stages={stages}
            selectedClass={selectedClassName}
            deadlineLabel="Deadline"
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
        onDeadlineDateChange={setDeadlineDate}
        onDeadlineTimeChange={setDeadlineTime}
        saving={savingDeadline}
        onClose={resetDeadlineModal}
        onSave={handleSaveDeadline}
      />
    </div>
  );
}
