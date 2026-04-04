import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppFrame from "../components/AppFrame";
import Sidebar from "../components/admin/Sidebar";
import TopNavbar from "../components/admin/TopNavbar";
import useAdminProfilePanel from "../hooks/useAdminProfilePanel";
import {
  RUBRIC_STAGE_OPTIONS,
  fetchAdminClasses,
  deleteAdminRubric,
  fetchAdminFinalResults,
  fetchAdminRubrics,
  publishAdminFinalResults,
  revokeAdminFinalResults,
  saveAdminRubrics,
} from "../services/rubrics";
import supabase from "../config/supabaseClient";
import Modal from "../components/Modal";
import AdminProfileSettingsModal from "../components/admin/AdminProfileSettingsModal";
import ProfileMenu from "../components/ProfileMenu";

const ADMIN_RUBRIC_STAGE_OPTIONS = RUBRIC_STAGE_OPTIONS.filter((item) => item.value !== "guide");
const ADMIN_REVIEW_RUBRIC_OPTIONS = [
  { value: "zeroth_review", label: "Zeroth Review", total: 40, description: "Separate rubric set without Design and Module Description." },
  { value: "shared_review", label: "Other Reviews", total: 40, description: "Shared rubric set used for first and second review." },
];

function makeDraftRow(stageMeta, index = 0) {
  return {
    id: `draft-${stageMeta.value}-${index}-${Date.now()}`,
    title: "",
    max_marks: 0,
    order_no: index + 1,
    is_active: true,
    isNew: true,
  };
}

function getFinalResultStatusMeta(row) {
  if (row?.is_published) {
    return {
      label: "Published",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  const status = String(row?.status || "").trim().toLowerCase();
  if (status === "internal_published") {
    return {
      label: "Coordinator Published",
      className: "bg-amber-100 text-amber-700",
    };
  }
  if (status === "internal_and_sent" || status === "sent_to_admin") {
    return {
      label: "Ready for Admin",
      className: "bg-sky-100 text-sky-700",
    };
  }

  return {
    label: row?.status || "pending",
    className: "bg-slate-100 text-slate-700",
  };
}

const FINAL_MARKS_TOTAL = 150;

function getGradeFromFinalMarks(finalMarks) {
  const numericMarks = Number(finalMarks);
  if (finalMarks == null || Number.isNaN(numericMarks)) return "-";

  const percentage = (numericMarks / FINAL_MARKS_TOTAL) * 100;

  if (percentage >= 90) return "S";
  if (percentage >= 85) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 75) return "B+";
  if (percentage >= 70) return "B";
  if (percentage >= 65) return "C+";
  if (percentage >= 60) return "C";
  if (percentage >= 55) return "D";
  if (percentage >= 50) return "P";
  return "F";
}

export default function AdminRubrics() {
  const navigate = useNavigate();
  const finalResultsRef = useRef(null);
  const {
    adminProfile,
    showProfileMenu,
    setShowProfileMenu,
    showProfileSettings,
    setShowProfileSettings,
    refreshAdminProfile,
  } = useAdminProfilePanel();
  const [stage, setStage] = useState(ADMIN_RUBRIC_STAGE_OPTIONS[0].value);
  const [reviewRubricMode, setReviewRubricMode] = useState(ADMIN_REVIEW_RUBRIC_OPTIONS[0].value);
  const [rubrics, setRubrics] = useState([]);
  const [finalResults, setFinalResults] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [finalResultsClassFilter, setFinalResultsClassFilter] = useState("all");
  const [finalResultsSearch, setFinalResultsSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const stageMeta = useMemo(
    () => ADMIN_RUBRIC_STAGE_OPTIONS.find((item) => item.value === stage) || ADMIN_RUBRIC_STAGE_OPTIONS[0],
    [stage]
  );
  const selectedReviewRubricMeta = useMemo(
    () => ADMIN_REVIEW_RUBRIC_OPTIONS.find((item) => item.value === reviewRubricMode) || ADMIN_REVIEW_RUBRIC_OPTIONS[0],
    [reviewRubricMode]
  );
  const selectedReviewStage = reviewRubricMode === "zeroth_review" ? "zeroth_review" : null;
  const rubricHeading = stage === "review"
    ? `${selectedReviewRubricMeta.label} Rubrics`
    : `${stageMeta.label} Rubrics`;

  const loadData = useCallback(async (selectedStage = stage, selectedReviewMode = reviewRubricMode) => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const reviewStage = selectedStage === "review" && selectedReviewMode === "zeroth_review" ? "zeroth_review" : null;
      const [rubricRows, finalRows, classRows] = await Promise.all([
        fetchAdminRubrics(selectedStage, reviewStage),
        fetchAdminFinalResults(),
        fetchAdminClasses(),
      ]);
      setRubrics((rubricRows || []).map((row, index) => ({ ...row, isNew: false, localKey: row.id || `row-${index}` })));
      setFinalResults(finalRows || []);
      setAvailableClasses(classRows || []);
    } catch (err) {
      setError(err.message || "Failed to load rubric management data.");
    } finally {
      setLoading(false);
    }
  }, [reviewRubricMode, stage]);

  useEffect(() => {
    loadData(stage, reviewRubricMode);
  }, [loadData, reviewRubricMode, stage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#final-results") return;

    const timer = window.setTimeout(() => {
      finalResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);

    return () => window.clearTimeout(timer);
  }, []);

  const activeTotal = useMemo(
    () => rubrics.filter((item) => item.is_active !== false).reduce((sum, item) => sum + Number(item.max_marks || 0), 0),
    [rubrics]
  );
  const finalResultClassOptions = useMemo(() => {
    const options = (availableClasses || []).map((row) => ({
      value: row.id,
      label: row.class_name || row.id,
    }));

    const hasUnassignedResults = finalResults.some((row) => !row.class_id);
    if (hasUnassignedResults) {
      options.push({ value: "unassigned", label: "Unassigned Class" });
    }

    return options.sort((left, right) => left.label.localeCompare(right.label));
  }, [availableClasses, finalResults]);

  const filteredFinalResults = useMemo(() => {
    const searchTerm = finalResultsSearch.trim().toLowerCase();
    return finalResults.filter((row) => {
      const classKey = row.class_id || "unassigned";
      const matchesClass = finalResultsClassFilter === "all" || classKey === finalResultsClassFilter;
      const matchesSearch = !searchTerm || [
        row.full_name,
        row.roll_number,
        row.student_id,
        row.class_name,
      ].some((value) => String(value || "").toLowerCase().includes(searchTerm));
      return matchesClass && matchesSearch;
    });
  }, [finalResults, finalResultsClassFilter, finalResultsSearch]);

  const finalResultsByClass = useMemo(() => {
    return filteredFinalResults.reduce((acc, row) => {
      const key = row.class_id || "unassigned";
      if (!acc[key]) {
        acc[key] = {
          classLabel: row.class_name || "Unassigned Class",
          rows: [],
        };
      }
      acc[key].rows.push(row);
      return acc;
    }, {});
  }, [filteredFinalResults]);

  const handleChange = (index, key, value) => {
    setRubrics((prev) => prev.map((item, itemIndex) => (
      itemIndex === index
        ? { ...item, [key]: key === "is_active" ? value : key === "title" ? value : Number(value) }
        : item
    )));
  };

  const addRubric = () => {
    setRubrics((prev) => [...prev, makeDraftRow(stageMeta, prev.length)]);
  };

  const removeRubric = async (row) => {
    setError("");
    setNotice("");
    try {
      if (!row.id || row.isNew) {
        setRubrics((prev) => prev.filter((item) => item !== row));
        return;
      }
      await deleteAdminRubric(row.id);
      await loadData(stage, reviewRubricMode);
      setNotice("Rubric deleted.");
    } catch (err) {
      setError(err.message || "Failed to delete rubric.");
    }
  };

  const saveRubrics = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = rubrics.map((row, index) => ({
        id: row.isNew ? undefined : row.id,
        title: String(row.title || "").trim(),
        max_marks: Number(row.max_marks || 0),
        order_no: Number(row.order_no || index + 1),
        is_active: row.is_active !== false,
      }));
      const result = await saveAdminRubrics(stage, payload, selectedReviewStage);
      setRubrics((result || []).map((row, index) => ({ ...row, isNew: false, localKey: row.id || `row-${index}` })));
      setNotice(`${rubricHeading} saved.`);
    } catch (err) {
      setError(err.message || "Failed to save rubrics.");
    } finally {
      setSaving(false);
    }
  };

  const publishResults = async () => {
    setPublishing(true);
    setError("");
    setNotice("");
    try {
      // Collect all student IDs from the current filtered results
      // If no filters applied, publish all final results
      const studentIds = finalResults.map(row => row.student_id).filter(Boolean);
      
      if (studentIds.length === 0) {
        setError("No students found to publish results for.");
        setPublishing(false);
        return;
      }

      await publishAdminFinalResults(studentIds);
      const refreshed = await fetchAdminFinalResults();
      setFinalResults(refreshed || []);
      setNotice(`Final results published successfully for ${studentIds.length} student(s).`);
    } catch (err) {
      setError(err.message || "Failed to publish final results.");
    } finally {
      setPublishing(false);
    }
  };

  const revokeResults = async () => {
    setPublishing(true);
    setError("");
    setNotice("");
    try {
      // Get all published student IDs from current finalResults
      const publishedStudents = finalResults.filter(row => row.is_published === true).map(row => row.student_id).filter(Boolean);
      
      if (publishedStudents.length === 0) {
        setError("No published results found to revoke. All results are either unpublished or pending.");
        setPublishing(false);
        return;
      }

      await revokeAdminFinalResults(publishedStudents);
      const refreshed = await fetchAdminFinalResults();
      setFinalResults(refreshed || []);
      setNotice(`Final results revoked for ${publishedStudents.length} student(s). Internal marks published by coordinator remain unaffected.`);
      setShowRevokeConfirm(false);
    } catch (err) {
      setError(err.message || "Failed to revoke results.");
    } finally {
      setPublishing(false);
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
      sidebar={<Sidebar activeItem="rubrics-management" onSignOut={handleSignOut} onNavigate={handleNavigate} />}
      header={<TopNavbar adminName={adminProfile.full_name || "Admin"} academicYearLabel="2026 - S6 Mini Project" pageTitle="Rubrics Management" onHomeClick={() => navigate("/admin")} onProfileClick={() => setShowProfileMenu((value) => !value)} />}
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
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Rubrics Management</h1>
            <p className="text-slate-500 mt-1">Configure rubric criteria per stage and monitor final-only results for admin access.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1">
              {ADMIN_RUBRIC_STAGE_OPTIONS.map((option) => {
                const isActive = stage === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStage(option.value)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-teal-600 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {option.label} ({option.total})
                  </button>
                );
              })}
            </div>
            {stage === "review" ? (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1">
                {ADMIN_REVIEW_RUBRIC_OPTIONS.map((option) => {
                  const isActive = reviewRubricMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setReviewRubricMode(option.value)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                        isActive
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {option.label} ({option.total})
                    </button>
                  );
                })}
              </div>
            ) : null}
            <button type="button" onClick={addRubric} className="rounded-xl border border-teal-200 bg-white px-4 py-2.5 text-sm font-semibold text-teal-700">
              Add Rubric
            </button>
            <button type="button" onClick={saveRubrics} disabled={saving || loading} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </section>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <section
          id="final-results"
          ref={finalResultsRef}
          className="bg-white/90 rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-200/70">
            <h2 className="text-lg font-semibold text-slate-800">{rubricHeading}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {stage === "review"
                ? `${selectedReviewRubricMeta.description} Active total: ${activeTotal}/${stageMeta.total}.`
                : `Active total: ${activeTotal}/${stageMeta.total}.`}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100/70 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Title</th>
                  <th className="px-4 py-3 text-left font-semibold">Max Marks</th>
                  <th className="px-4 py-3 text-left font-semibold">Order</th>
                  <th className="px-4 py-3 text-left font-semibold">Active</th>
                  <th className="px-4 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Loading rubrics...</td></tr>
                ) : rubrics.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No rubrics configured yet.</td></tr>
                ) : (
                  rubrics.map((row, index) => (
                    <tr key={row.localKey || row.id || index}>
                      <td className="px-4 py-3">
                        <input value={row.title || ""} onChange={(event) => handleChange(index, "title", event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" min="0" value={row.max_marks || 0} onChange={(event) => handleChange(index, "max_marks", event.target.value)} className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="number" min="1" value={row.order_no || index + 1} onChange={(event) => handleChange(index, "order_no", event.target.value)} className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={row.is_active !== false} onChange={(event) => handleChange(index, "is_active", event.target.checked)} />
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => removeRubric(row)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white/90 rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/70 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Final Results</h2>
              <p className="text-sm text-slate-500 mt-1">Admin-only final marks view grouped class wise. No mark breakdown is shown here.</p>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={publishResults} disabled={publishing || loading} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {publishing ? "Publishing..." : "Publish Final Results"}
              </button>
              <button
                type="button"
                onClick={() => setShowRevokeConfirm(true)}
                disabled={publishing || loading}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:bg-rose-700"
              >
                {publishing ? "Revoking..." : "Revoke Results"}
              </button>
            </div>
          </div>
          <div className="px-6 py-4 border-b border-slate-200/70 bg-slate-50/60">
            <div className="flex flex-col lg:flex-row gap-3">
              <select
                value={finalResultsClassFilter}
                onChange={(event) => setFinalResultsClassFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
              >
                <option value="all">All Classes</option>
                {finalResultClassOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={finalResultsSearch}
                onChange={(event) => setFinalResultsSearch(event.target.value)}
                placeholder="Search student, roll number, or class"
                className="w-full lg:max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700"
              />
            </div>
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center text-slate-500">Loading final results...</div>
          ) : finalResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500">No final results available.</div>
          ) : filteredFinalResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500">No final results match the selected filters.</div>
          ) : (
            Object.entries(finalResultsByClass).map(([classKey, group]) => (
              <div key={classKey} className="border-t border-slate-200/70 first:border-t-0">
                <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-200/70">
                  <h3 className="text-sm font-bold text-slate-700">{group.classLabel}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100/70 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Student</th>
                        <th className="px-4 py-3 text-left font-semibold">Student ID</th>
                        <th className="px-4 py-3 text-left font-semibold">Final Marks</th>
                        <th className="px-4 py-3 text-left font-semibold">Grade</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70">
                      {group.rows.map((row) => (
                        <tr key={row.student_id}>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="font-medium text-slate-900">{row.full_name || "-"}</div>
                            <div className="text-xs text-slate-400">{row.roll_number || ""}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{row.student_id}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{row.final_marks ?? "-"}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{getGradeFromFinalMarks(row.final_marks)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getFinalResultStatusMeta(row).className}`}>
                              {getFinalResultStatusMeta(row).label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      <Modal
        isOpen={showRevokeConfirm}
        onClose={() => {
          if (!publishing) setShowRevokeConfirm(false);
        }}
        title="Revoke Final Results"
        maxWidth="max-w-lg"
        disableClose={publishing}
      >
        <div className="space-y-5 p-6">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <span className="material-symbols-outlined text-[20px]">warning</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Are you sure you want to revoke final results?
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Marks published by coordinator will remain unaffected.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowRevokeConfirm(false)}
              disabled={publishing}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={revokeResults}
              disabled={publishing}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? "Revoking..." : "Confirm Revoke"}
            </button>
          </div>
        </div>
      </Modal>
      <AdminProfileSettingsModal
        isOpen={showProfileSettings}
        onClose={() => setShowProfileSettings(false)}
        onSuccess={refreshAdminProfile}
      />
    </AppFrame>
  );
}
