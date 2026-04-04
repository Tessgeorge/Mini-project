import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabase";
import useAdminAuth from "../hooks/useAdminAuth";
import useAdminProfilePanel from "../hooks/useAdminProfilePanel";
import { emitAdminDataUpdated } from "../utils/adminLiveSync";
import AppFrame from "../components/AppFrame";
import Sidebar from "../components/admin/Sidebar";
import TopNavbar from "../components/admin/TopNavbar";
import AdminProfileSettingsModal from "../components/admin/AdminProfileSettingsModal";
import ProfileMenu from "../components/ProfileMenu";

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
  const navigate = useNavigate();
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const {
    adminProfile,
    showProfileMenu,
    setShowProfileMenu,
    showProfileSettings,
    setShowProfileSettings,
    refreshAdminProfile,
  } = useAdminProfilePanel();
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
        .select("id, class_section");
      if (classError) {
        console.error("Error fetching classes:", classError);
        throw classError;
      }

      const classNameById = new Map((classRows || []).map((row) => [row.id, row.class_section]));

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
        classes: { class_section: classNameById.get(row.class_id) || null },
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

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate("/signin");
    }
  };

  const handleNavigate = (itemId) => {
    if (itemId === "dashboard") return navigate("/admin");
    if (itemId === "guide-allocation") return navigate("/admin/guide-allocation");
    if (itemId === "mentor-management") return navigate("/admin/mentor-management");
    if (itemId === "review-management") return navigate("/admin/review-management");
    if (itemId === "rubrics-management") return navigate("/admin/rubrics");
  };

  return (
    <AppFrame
      sidebar={<Sidebar activeItem="review-management" onSignOut={handleSignOut} onNavigate={handleNavigate} />}
      header={(
        <TopNavbar
          adminName={adminProfile.full_name || "Admin"}
          academicYearLabel="2026 - S6 Mini Project"
          pageTitle="Review Stages"
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
      <section className="p-6">
      <div className="max-w-7xl mx-auto bg-white/90 rounded-2xl shadow-sm border border-slate-200/70 p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Review Stages</h1>
          <p className="text-sm text-slate-500 mt-1">Class-wise stage controls with live Supabase updates</p>
        </div>

        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white/70">
          <table className="w-full text-sm">
            <thead className="bg-slate-100/70 text-slate-600">
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
            <tbody className="divide-y divide-slate-200/70">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading review stages...</td></tr>
              ) : stages.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No review stages found.</td></tr>
              ) : (
                stages.map((row) => (
                  <tr key={stageKey(row)} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-800">{row.classes?.class_section || "Unknown Class"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.stage_name}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDeadline(row.deadline)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.is_active ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-600"}`}>{row.is_active ? "Active" : "Inactive"}</span></td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.is_completed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{row.is_completed ? "Completed" : "Pending"}</span></td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.is_locked ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{row.is_locked ? "Locked" : "Unlocked"}</span></td>
                    <td className="px-4 py-3 min-w-[320px] space-y-2">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => toggleActive(row)} disabled={busy !== ""} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{row.is_active ? "Deactivate" : "Activate"}</button>
                        <button type="button" onClick={() => toggleComplete(row)} disabled={busy !== ""} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{row.is_completed ? "Undo Complete" : "Complete"}</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={unlockComments[stageKey(row)] || ""}
                          onChange={(event) => setUnlockComments((prev) => ({ ...prev, [stageKey(row)]: event.target.value }))}
                          placeholder="Unlock comment"
                          className="flex-1 glass-input rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                        />
                        <button type="button" onClick={() => unlock(row)} disabled={busy !== "" || !row.is_locked} className="px-3 py-1.5 rounded-lg btn-primary text-xs font-semibold disabled:opacity-60">Unlock</button>
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
      <AdminProfileSettingsModal
        isOpen={showProfileSettings}
        onClose={() => setShowProfileSettings(false)}
        onSuccess={refreshAdminProfile}
      />
    </AppFrame>
  );
}
