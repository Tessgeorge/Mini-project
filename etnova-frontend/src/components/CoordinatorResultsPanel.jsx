import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { apiRequest } from "../config/apiClient";
import {
  fetchCoordinatorResultsBreakdown,
  fetchCoordinatorInternalMarks,
  saveCoordinatorInternalMarks,
  publishCoordinatorResults,
} from "../services/rubrics";

function formatMarks(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(1);
}

const FINAL_MARKS_TOTAL = 150;

function getGradeLabel(row) {
  if (!row?.updated_at) return "-";

  const finalMarks = Number(row?.final_marks);
  if (Number.isNaN(finalMarks)) return "-";

  const percentage = (finalMarks / FINAL_MARKS_TOTAL) * 100;

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

function getGradeBadgeClass(grade) {
  if (grade === "-" || grade == null) return "bg-slate-100 text-slate-500";
  if (["S", "A+", "A"].includes(grade)) return "bg-emerald-50 text-emerald-700";
  if (["B+", "B", "C+"].includes(grade)) return "bg-teal-50 text-teal-700";
  if (["C", "D", "P"].includes(grade)) return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}

function buildDraft(rows) {
  return (rows || []).reduce((acc, row) => {
    acc[row.student_id] = {
      attendance_marks: row.attendance_marks ?? 0,
      report_marks: row.report_marks ?? 0,
    };
    return acc;
  }, {});
}

function emitCoordinatorStudentsUpdated(classId) {
  if (!classId || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("coordinator-students-updated", {
    detail: { classId },
  }));
}

export default function CoordinatorResultsPanel({ projectId = null, classId = null, students = [] }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [accessRestricted, setAccessRestricted] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [results, setResults] = useState([]);
  const [internalRows, setInternalRows] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [draft, setDraft] = useState({});
  const [publishOpen, setPublishOpen] = useState(false);
  const [manageStudentsOpen, setManageStudentsOpen] = useState(false);
  const [studentForm, setStudentForm] = useState({ id: "", full_name: "", email: "", roll_number: "" });
  const [studentSaving, setStudentSaving] = useState(false);
  const publishRef = useRef(null);
  const studentIdsKey = useMemo(
    () => (students || []).map((student) => student?.student_id).filter(Boolean).sort().join("|"),
    [students]
  );

  useEffect(() => {
    if (!publishOpen) return;
    const close = (e) => {
      if (publishRef.current && !publishRef.current.contains(e.target)) {
        setPublishOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [publishOpen]);

  const handlePublish = async (type) => {
    setPublishOpen(false);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await publishCoordinatorResults(type);
      await loadAll();
      let successMsg = "Results updated.";
      if (type === "internal") successMsg = "Internal marks published to students.";
      else if (type === "admin") successMsg = "Results sent to Admin for final publishing.";
      else if (type === "unpublish_internal") successMsg = "Internal marks have been revoked. Final marks (if published by admin) remain visible.";
      else if (type === "unpublish_admin") successMsg = "Submission to Admin revoked.";
      setNotice(successMsg);
    } catch (err) {
      setError(err.message || "Failed to publish.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = () => {
    setError("");
    setNotice("");

    if (filteredResults.length === 0) {
      setNotice("No results available to download yet.");
      return;
    }

    try {
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text("Marks & Results", 14, 15);
      doc.setFontSize(10);

      const dateStr = new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      doc.text(`${filteredResults.length} students  -  Generated: ${dateStr}`, 14, 22);

      const tableColumn = ["Sl. No.", "Student", "Project", "Internal (Out of 75)", "External (Out of 75)", "Total Marks", "Grade"];
      const tableRows = filteredResults.map((row, idx) => [
        idx + 1,
        row.full_name || row.student_id || "-",
        row.project_title || "-",
        formatMarks(row.cie_total),
        formatMarks(row.ese_total),
        formatMarks(row.final_marks),
        getGradeLabel(row),
      ]);

      autoTable(doc, {
        startY: 28,
        head: [tableColumn],
        body: tableRows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: "bold" },
        theme: "grid",
      });

      const filename = `Marks_Report_${dateStr.replace(/\s+/g, "_")}.pdf`;
      const blob = doc.output("blob");
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      console.error("PDF export failed:", err);
      setError("Failed to download PDF. Please try again.");
    }
  };

  const loadAll = useCallback(async () => {
    const requests = [fetchCoordinatorResultsBreakdown(projectId)];

    if (classId && !projectId) {
      const data = await apiRequest("/coordinator/students", { skipCache: true });
      setClassStudents(data || []);
    }

    if (projectId || students.length > 0) {
      requests.push(fetchCoordinatorInternalMarks());
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        const timeoutError = new Error("Coordinator results request timed out.");
        timeoutError.code = "REQUEST_TIMEOUT";
        reject(timeoutError);
      }, 12000);
    });

    const [resultData, internalData] = await Promise.race([
      Promise.all(requests),
      timeoutPromise,
    ]);

    setResults(resultData || []);
    setInternalRows(internalData || []);
    setDraft(buildDraft(internalData || []));
  }, [classId, projectId, students.length]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      setAccessRestricted(false);
      try {
        if (cancelled) return;
        await loadAll();
      } catch (err) {
        console.error("[CoordinatorResultsPanel] Load failed", {
          projectId,
          studentCount: students.length,
          error: err,
        });

        if (!cancelled) {
          const message = err?.message || "Failed to load coordinator result breakdown.";
          const isAccessDenied =
            err?.status === 401 ||
            err?.status === 403 ||
            /access denied|authentication required|coordinator access required|scope not found|not a coordinator/i.test(message);

          setAccessRestricted(isAccessDenied);
          setResults([]);
          setInternalRows([]);
          setDraft({});
          setError(isAccessDenied ? "" : message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [loadAll, projectId, studentIdsKey, students.length]);

  const scopedResults = useMemo(() => {
    const effectiveStudents = projectId
      ? students
      : classStudents.map((student) => ({
          student_id: student.id,
          full_name: student.full_name,
          email: student.email,
          roll_number: student.roll_number || student.email || "-",
        }));
    const studentMap = new Map((effectiveStudents || []).map((student) => [student.student_id, student]));
    const raw = projectId ? results.filter((row) => row.project_id === projectId) : results;
    const filtered = studentMap.size > 0
      ? raw.filter((row) => studentMap.has(row.student_id))
      : raw;
    const merged = [...filtered];

    if (studentMap.size > 0) {
      effectiveStudents.forEach((student) => {
        if (merged.some((row) => row.student_id === student.student_id)) return;
        merged.push({
          student_id: student.student_id,
          full_name: student.full_name || student.student_id,
          email: student.email || null,
          roll_number: student.roll_number || "-",
          project_id: projectId,
          project_title: filtered[0]?.project_title || "-",
          attendance_marks: 0,
          report_marks: 0,
          review_total: 0,
          guide_total: 0,
          cie_total: 0,
          ese_total: 0,
          final_marks: 0,
          review_rounds: [],
          breakdown: { guide: [], ese: [] },
          status: "pending",
          is_published: false,
        });
      });
    }

    return merged.sort((a, b) => {
      const nameA = a.full_name || a.student_id || "";
      const nameB = b.full_name || b.student_id || "";
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [classStudents, projectId, results, students]);

  const summary = useMemo(() => {
    const projectCount = new Set(
      scopedResults
        .map((row) => row.project_id)
        .filter(Boolean)
    ).size;
    const published = scopedResults.filter((row) => row.is_published).length;
    return {
      total: scopedResults.length,
      projectCount,
      published,
    };
  }, [scopedResults]);

  const normalizedStudentSearch = studentSearch.trim().toLowerCase();

  const filteredResults = useMemo(() => {
    if (!normalizedStudentSearch) return scopedResults;

    return scopedResults.filter((row) => {
      const haystack = [
        row.full_name,
        row.roll_number,
        row.email,
        row.project_title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedStudentSearch);
    });
  }, [normalizedStudentSearch, scopedResults]);

  const scopedStudentIds = useMemo(() => {
    if (students.length > 0) {
      return new Set(students.map((student) => student.student_id));
    }
    return new Set(scopedResults.map((row) => row.student_id));
  }, [scopedResults, students]);

  const scopedInternalRows = useMemo(() => {
    const internalMap = new Map(internalRows.map((row) => [row.student_id, row]));

    if (students.length > 0) {
      return students.map((student) => {
        const existing = internalMap.get(student.student_id);
        return {
          student_id: student.student_id,
          full_name: existing?.full_name || student.full_name || student.student_id,
          roll_number: existing?.roll_number || student.roll_number || "-",
          attendance_marks: existing?.attendance_marks ?? 0,
          report_marks: existing?.report_marks ?? 0,
        };
      });
    }

    return projectId ? internalRows.filter((row) => scopedStudentIds.has(row.student_id)) : internalRows;
  }, [internalRows, projectId, scopedStudentIds, students]);

  const resultTableColumnCount = projectId ? 12 : (classId ? 10 : 9);

  const handleDraftChange = (studentId, field, value) => {
    setDraft((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [field]: value,
      },
    }));
  };

  const handleSaveInternal = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const entries = scopedInternalRows.map((row) => ({
        student_id: row.student_id,
        attendance_marks: Number(draft?.[row.student_id]?.attendance_marks ?? 0),
        report_marks: Number(draft?.[row.student_id]?.report_marks ?? 0),
      }));
      const saved = await saveCoordinatorInternalMarks(entries);
      setInternalRows(saved || []);
      setDraft(buildDraft(saved || []));
      await loadAll();
      setNotice("Attendance and report marks saved.");
    } catch (err) {
      setError(err.message || "Failed to save internal component marks.");
    } finally {
      setSaving(false);
    }
  };

  const resetStudentForm = () => {
    setStudentForm({ id: "", full_name: "", email: "", roll_number: "" });
    setManageStudentsOpen(false);
  };

  const handleStudentFormChange = (field, value) => {
    setStudentForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditStudent = (row) => {
    const matchingStudent = classStudents.find((student) => student.id === row.student_id);
    setStudentForm({
      id: row.student_id,
      full_name: row.full_name || "",
      email: matchingStudent?.email || "",
      roll_number: row.roll_number && row.roll_number !== row.student_id ? row.roll_number : "",
    });
    setManageStudentsOpen(true);
    setError("");
    setNotice("");
  };

  const handleSaveStudent = async () => {
    const fullName = String(studentForm.full_name || "").trim();
    const email = String(studentForm.email || "").trim().toLowerCase();
    const rollNumber = String(studentForm.roll_number || "").trim();

    if (!classId || projectId) return;
    if (!fullName) {
      setError("Student name is required.");
      return;
    }
    if (!email) {
      setError("Email is required.");
      return;
    }

    setStudentSaving(true);
    setError("");
    setNotice("");
    try {
      if (studentForm.id) {
        const updatedStudent = await apiRequest(`/coordinator/students/${studentForm.id}`, {
          method: "PUT",
          body: { full_name: fullName, email, roll_number: rollNumber || null },
        });
        setClassStudents((prev) => prev.map((student) => (
          student.id === studentForm.id
            ? {
                ...student,
                full_name: updatedStudent?.full_name || fullName,
                email: updatedStudent?.email || email,
                roll_number: updatedStudent?.roll_number ?? (rollNumber || null),
              }
            : student
        )));
        setNotice("Student details updated.");
      } else {
        const applyResult = await apiRequest("/coordinator/student-import/apply", {
          method: "POST",
          body: {
            students: [
              {
                full_name: fullName,
                email,
                roll_number: rollNumber || null,
              },
            ],
          },
        });
        const createdCount = Number(applyResult?.summary?.created || 0);
        const updatedCount = Number(applyResult?.summary?.updated || 0);
        if (createdCount === 0 && updatedCount === 0) {
          throw new Error(applyResult?.skipped?.[0]?.reason || "Student was not created.");
        }
        setNotice("Student added to the class roster.");
      }

      resetStudentForm();
      await loadAll();
      emitCoordinatorStudentsUpdated(classId);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save student.");
    } finally {
      setStudentSaving(false);
    }
  };

  const handleDeleteStudent = async (row) => {
    if (!classId || projectId || !row?.student_id) return;
    if (!window.confirm(`Delete ${row.full_name || "this student"} from the results roster?`)) return;

    setStudentSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/coordinator/students/${row.student_id}`, {
        method: "DELETE",
      });
      setClassStudents((prev) => prev.filter((student) => student.id !== row.student_id));

      if (studentForm.id === row.student_id) {
        resetStudentForm();
      }

      setNotice("Student removed from this class.");
      await loadAll();
      emitCoordinatorStudentsUpdated(classId);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to delete student.");
    } finally {
      setStudentSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Students</p>
          <p className="mt-2 text-2xl font-black text-slate-900">{summary.total}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Project</p>
          <p className="mt-2 text-2xl font-black text-sky-700">{summary.projectCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Published</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">{summary.published}</p>
        </div>
      </div>

      {accessRestricted ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Access not granted.
        </div>
      ) : null}
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      {!projectId && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Marks & Results</h2>
          </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">download</span> Download PDF
              </button>
              <div className="relative" ref={publishRef}>
                <button
                  type="button"
                  onClick={() => setPublishOpen((o) => !o)}
                  disabled={saving || loading || scopedResults.length === 0}
                  className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl text-[#0f172a] transition-all disabled:opacity-50"
                  style={{ backgroundColor: "#00D2C4" }}
                >
                  <span className="material-symbols-outlined text-[18px]">publish</span>
                  {saving ? "Publishing..." : "Publish Results"}
                  <span className="material-symbols-outlined text-[18px]">{publishOpen ? "expand_less" : "expand_more"}</span>
                </button>
                {publishOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-100 rounded-xl shadow-lg z-10 py-1 overflow-hidden">
                    <button
                      onClick={() => handlePublish("internal")}
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700 border-b border-slate-50 transition-colors"
                    >
                      <span className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-[18px] leading-none text-teal-600">add_circle</span>
                        <span>
                          Publish Internal Marks
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5">Students can view internal scores</p>
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => handlePublish("unpublish_internal")}
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 border-b border-slate-50 transition-colors"
                    >
                      <span className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-[18px] leading-none text-rose-600">delete</span>
                        <span>
                          Revoke Internal Marks
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5">Remove internal marks (can be done even after admin publishes final results)</p>
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5">Hide internal scores from students</p>
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => handlePublish("admin")}
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 border-b border-slate-50 transition-colors"
                    >
                      <span className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-[18px] leading-none text-blue-600">add_circle</span>
                        <span>
                          Send to Admin for Final
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5">Admin finalizes and publishes total marks</p>
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => handlePublish("unpublish_admin")}
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                    >
                      <span className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-[18px] leading-none text-amber-600">delete</span>
                        <span>
                          Revoke Admin Submission
                          <p className="text-[10px] text-slate-400 font-normal mt-0.5">Withdraw results sent to Admin</p>
                        </span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {projectId && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-800">Internal Components</p>
              <p className="text-xs text-slate-400 mt-1">Coordinator enters attendance and final report marks here. These values feed the internal total out of 75.</p>
            </div>
          <button
            type="button"
            onClick={handleSaveInternal}
            disabled={saving || loading || scopedInternalRows.length === 0}
            className="rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Internal Marks"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Roll No</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Student</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Attendance / 10</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Report / 10</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading internal marks...</td></tr>
              ) : scopedInternalRows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No students available.</td></tr>
              ) : (
                scopedInternalRows.map((row) => (
                  <tr key={row.student_id}>
                    <td className="px-4 py-3 text-slate-500">{row.roll_number || "-"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.full_name || row.student_id}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={draft?.[row.student_id]?.attendance_marks ?? 0}
                        onChange={(event) => handleDraftChange(row.student_id, "attendance_marks", event.target.value)}
                        className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={draft?.[row.student_id]?.report_marks ?? 0}
                        onChange={(event) => handleDraftChange(row.student_id, "report_marks", event.target.value)}
                        className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">Final Results Breakdown</p>
            {normalizedStudentSearch ? (
              <p className="mt-1 text-xs text-slate-400">
                Showing {filteredResults.length} of {scopedResults.length} students
              </p>
            ) : null}
          </div>
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
            <input
              type="search"
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="Search student, roll no, email..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {!projectId && <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Roll No</th>}
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Student</th>
                {!projectId && <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Email</th>}
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Project</th>
                {projectId && <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Attendance</th>}
                {projectId && <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Report</th>}
                {projectId && <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Review Avg</th>}
                {projectId && <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Guide</th>}
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Internal /75</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">External /75</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Final</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Grade</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Status</th>
                {!projectId && classId && <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={resultTableColumnCount} className="px-4 py-8 text-center text-slate-500">Loading coordinator result breakdown...</td></tr>
              ) : accessRestricted ? (
                <tr><td colSpan={resultTableColumnCount} className="px-4 py-8 text-center text-slate-500">Access not granted.</td></tr>
              ) : scopedResults.length === 0 ? (
                <tr><td colSpan={resultTableColumnCount} className="px-4 py-8 text-center text-slate-500">No results available yet.</td></tr>
              ) : filteredResults.length === 0 ? (
                <tr><td colSpan={resultTableColumnCount} className="px-4 py-8 text-center text-slate-500">No students matched your search.</td></tr>
              ) : (
                filteredResults.map((row) => (
                  <tr key={row.student_id} className="align-top">
                    {!projectId && <td className="px-4 py-4 text-slate-500">{row.roll_number || "-"}</td>}
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{row.full_name || row.student_id}</p>
                      {projectId ? <p className="text-xs text-slate-400">{row.roll_number || row.student_id}</p> : null}
                    </td>
                    {!projectId && <td className="px-4 py-4 text-slate-500">{row.email || "-"}</td>}
                    <td className="px-4 py-4 text-slate-600">{row.project_title || "-"}</td>
                    {projectId && <td className="px-4 py-4 font-semibold text-slate-700">{formatMarks(row.attendance_marks)}</td>}
                    {projectId && <td className="px-4 py-4 font-semibold text-slate-700">{formatMarks(row.report_marks)}</td>}
                    {projectId && (
                      <td className="px-4 py-4 text-slate-700">
                        <p className="font-semibold">{formatMarks(row.review_total)}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {(row.review_rounds || []).map((item) => `${item.label}: ${item.marks ?? "-"}`).join(" | ") || "-"}
                        </p>
                      </td>
                    )}
                    {projectId && (
                      <td className="px-4 py-4 text-slate-700">
                        <p className="font-semibold">{formatMarks(row.guide_total)}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {(row.breakdown?.guide || []).map((item) => `${item.rubric_title}: ${item.marks ?? "-"}`).join(" | ") || "-"}
                        </p>
                      </td>
                    )}
                    <td className="px-4 py-4 font-semibold text-slate-900">{formatMarks(row.cie_total)}</td>
                    <td className="px-4 py-4 text-slate-700">
                      <p className="font-semibold">{formatMarks(row.ese_total)}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {(row.breakdown?.ese || []).map((item) => `${item.rubric_title}: ${item.marks ?? "-"}`).join(" | ") || "-"}
                      </p>
                    </td>
                    <td className="px-4 py-4 font-black text-teal-700">{formatMarks(row.final_marks)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${getGradeBadgeClass(getGradeLabel(row))}`}>
                        {getGradeLabel(row)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {row.status || "pending"}
                      </span>
                    </td>
                    {!projectId && classId && (
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditStudent(row)}
                            title="Edit student"
                            className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStudent(row)}
                            disabled={studentSaving}
                            title="Delete student"
                            className="inline-flex size-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
