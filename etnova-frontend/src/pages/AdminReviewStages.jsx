import { useCallback, useEffect, useState } from "react";
import supabase from "../lib/supabase";
import useAdminAuth from "../hooks/useAdminAuth";
import { emitAdminDataUpdated } from "../utils/adminLiveSync";

function formatDeadline(deadline) {
  if (!deadline) return "-";
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN");
}

function stageKey(row) {
  return `${row.class_id}::${row.stage_name}`;
}

export default function AdminReviewStages() {
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [unlockComments, setUnlockComments] = useState({});
  const [error, setError] = useState("");

  const fetchReviewStages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: classRows, error: classError } = await supabase
        .from("classes")
        .select("id, class_name");
      if (classError) {
        console.error("Error fetching classes:", classError);
        throw classError;
      }

      const classNameById = new Map((classRows || []).map((row) => [row.id, row.class_name]));

      const { data, error: fetchError } = await supabase
        .from("review_stages")
        .select("class_id, stage_name, deadline, is_active, is_completed, is_locked")
        .order("class_id", { ascending: true })
        .order("stage_name", { ascending: true });
      if (fetchError) {
        console.error("Error fetching stages:", fetchError);
        throw fetchError;
      }

      const rows = (data || []).map((row) => ({
        ...row,
        classes: { class_name: classNameById.get(row.class_id) || null },
      }));
      setStages(rows);
    } catch (err) {
      setError(err.message || "Failed to fetch review stages.");
    } finally {
      setLoading(false);
    }
  }, []);

  const autoLockStages = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const { data, error: candidatesError } = await supabase
        .from("review_stages")
        .select("class_id, stage_name")
        .eq("is_completed", false)
        .eq("is_locked", false)
        .lt("deadline", now);
      if (candidatesError) throw candidatesError;
      if (!data || data.length === 0) return;

      for (const stage of data) {
        const { error: lockError } = await supabase
          .from("review_stages")
          .update({ is_locked: true, is_active: false })
          .eq("class_id", stage.class_id)
          .eq("stage_name", stage.stage_name);
        if (lockError) throw lockError;
      }

      await fetchReviewStages();
    } catch (err) {
      setError(err.message || "Failed auto-locking expired stages.");
    }
  }, [fetchReviewStages]);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    fetchReviewStages();
  }, [authLoading, fetchReviewStages, isAdmin]);

  useEffect(() => {
    if (authLoading || !isAdmin) return undefined;
    autoLockStages();
    const timer = setInterval(autoLockStages, 60000);
    return () => clearInterval(timer);
  }, [authLoading, autoLockStages, isAdmin]);

  const toggleActive = async (row) => {
    const key = stageKey(row);
    setBusy(`a-${key}`);
    setError("");
    try {
      if (row.is_locked) throw new Error("Locked stage cannot be activated/deactivated.");
      if (row.is_completed) throw new Error("Completed stage cannot be activated.");

      if (row.is_active) {
        const { error: offError } = await supabase
          .from("review_stages")
          .update({ is_active: false })
          .eq("class_id", row.class_id)
          .eq("stage_name", row.stage_name);
        if (offError) throw offError;
      } else {
        const { error: offOthersError } = await supabase
          .from("review_stages")
          .update({ is_active: false })
          .eq("class_id", row.class_id)
          .neq("stage_name", row.stage_name);
        if (offOthersError) throw offOthersError;

        const { error: onError } = await supabase
          .from("review_stages")
          .update({ is_active: true })
          .eq("class_id", row.class_id)
          .eq("stage_name", row.stage_name);
        if (onError) throw onError;
      }
      await fetchReviewStages();
      emitAdminDataUpdated();
    } catch (err) {
      setError(err.message || "Failed toggling active stage.");
    } finally {
      setBusy("");
    }
  };

  const toggleComplete = async (row) => {
    const key = stageKey(row);
    setBusy(`c-${key}`);
    setError("");
    try {
      if (row.is_locked) throw new Error("Locked stage cannot be completed/undone.");
      if (!row.is_active && !row.is_completed) throw new Error("Only active stage can be completed.");

      const { error: completeError } = await supabase
        .from("review_stages")
        .update({ is_completed: !row.is_completed, is_active: false })
        .eq("class_id", row.class_id)
        .eq("stage_name", row.stage_name);
      if (completeError) throw completeError;
      await fetchReviewStages();
      emitAdminDataUpdated();
    } catch (err) {
      setError(err.message || "Failed toggling stage completion.");
    } finally {
      setBusy("");
    }
  };

  const unlock = async (row) => {
    const key = stageKey(row);
    setBusy(`u-${key}`);
    setError("");
    try {
      const comment = (unlockComments[key] || "").trim();
      if (!row.is_locked) throw new Error("Stage is already unlocked.");
      if (!comment) throw new Error("Unlock comment is required.");

      const { error: unlockError } = await supabase
        .from("review_stages")
        .update({ is_locked: false })
        .eq("class_id", row.class_id)
        .eq("stage_name", row.stage_name);
      if (unlockError) throw unlockError;
      setUnlockComments((prev) => ({ ...prev, [key]: "" }));
      await fetchReviewStages();
      emitAdminDataUpdated();
    } catch (err) {
      setError(err.message || "Failed to unlock stage.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="bg-gray-50 min-h-screen p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-md border border-gray-100 p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Review Stages</h1>
          <p className="text-sm text-gray-500 mt-1">Class-wise stage controls with live Supabase updates</p>
        </div>

        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Class</th>
                <th className="text-left px-4 py-3 font-semibold">Stage</th>
                <th className="text-left px-4 py-3 font-semibold">Deadline</th>
                <th className="text-left px-4 py-3 font-semibold">Active</th>
                <th className="text-left px-4 py-3 font-semibold">Completed</th>
                <th className="text-left px-4 py-3 font-semibold">Locked</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading review stages...</td></tr>
              ) : stages.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No review stages found.</td></tr>
              ) : (
                stages.map((row) => (
                  <tr key={stageKey(row)} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800">{row.classes?.class_name || "Unknown Class"}</td>
                    <td className="px-4 py-3 text-gray-700">{row.stage_name}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDeadline(row.deadline)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.is_active ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-600"}`}>{row.is_active ? "Active" : "Inactive"}</span></td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.is_completed ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{row.is_completed ? "Completed" : "Pending"}</span></td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.is_locked ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-600"}`}>{row.is_locked ? "Locked" : "Unlocked"}</span></td>
                    <td className="px-4 py-3 min-w-[320px] space-y-2">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => toggleActive(row)} disabled={busy !== ""} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">{row.is_active ? "Deactivate" : "Activate"}</button>
                        <button type="button" onClick={() => toggleComplete(row)} disabled={busy !== ""} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">{row.is_completed ? "Undo Complete" : "Complete"}</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={unlockComments[stageKey(row)] || ""}
                          onChange={(event) => setUnlockComments((prev) => ({ ...prev, [stageKey(row)]: event.target.value }))}
                          placeholder="Unlock comment"
                          className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                        />
                        <button type="button" onClick={() => unlock(row)} disabled={busy !== "" || !row.is_locked} className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-60">Unlock</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
