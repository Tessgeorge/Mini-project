import { useEffect, useMemo, useState, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

function buildDraft(rows) {
  return (rows || []).reduce((acc, row) => {
    acc[row.student_id] = {
      attendance_marks: row.attendance_marks ?? 0,
      report_marks: row.report_marks ?? 0,
    };
    return acc;
  }, {});
}

export default function CoordinatorResultsPanel({ projectId = null, students = [] }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState([]);
  const [internalRows, setInternalRows] = useState([]);
  const [draft, setDraft] = useState({});
  const [publishOpen, setPublishOpen] = useState(false);
  const publishRef = useRef(null);

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
      else if (type === "unpublish_internal") successMsg = "Internal marks revoked tracking.";
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

    if (scopedResults.length === 0) {
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
      doc.text(`${scopedResults.length} students  -  Generated: ${dateStr}`, 14, 22);

      const tableColumn = ["Sl. No.", "Student", "Project", "Internal (Out of 75)", "External (Out of 75)", "Total Marks"];
      const tableRows = scopedResults.map((row, idx) => [
        idx + 1,
        row.full_name || row.student_id || "-",
        row.project_title || "-",
        formatMarks(row.cie_total),
        formatMarks(row.ese_total),
        formatMarks(row.final_marks),
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

  const loadAll = async () => {
    const requests = [fetchCoordinatorResultsBreakdown()];

    if (projectId || students.length > 0) {
      requests.push(fetchCoordinatorInternalMarks());
    }

    const [resultData, internalData] = await Promise.all(requests);
    setResults(resultData || []);
    setInternalRows(internalData || []);
    setDraft(buildDraft(internalData || []));
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        if (cancelled) return;
        await loadAll();
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load coordinator result breakdown.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const scopedResults = projectId
      ? results.filter((row) => row.project_id === projectId)
      : results;
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
  }, [results, projectId]);

  const scopedResults = useMemo(() => {
    const raw = projectId ? results.filter((row) => row.project_id === projectId) : results;
    return [...raw].sort((a, b) => {
      const nameA = a.full_name || a.student_id || "";
      const nameB = b.full_name || b.student_id || "";
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [results, projectId]);

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

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      {!projectId && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Marks & Results</h2>
            <p className="text-xs text-slate-500 mt-1">{scopedResults.length} students - Internal = Attendance + Report + Review avg</p>
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
                    Publish Internal Marks
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">Students can view internal scores</p>
                  </button>
                  <button
                    onClick={() => handlePublish("unpublish_internal")}
                    className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 border-b border-slate-50 transition-colors"
                  >
                    Revoke Internal Marks
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">Hide internal scores from students</p>
                  </button>
                  <button
                    onClick={() => handlePublish("admin")}
                    className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 border-b border-slate-50 transition-colors"
                  >
                    Send to Admin for Final
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">Admin finalizes and publishes total marks</p>
                  </button>
                  <button
                    onClick={() => handlePublish("unpublish_admin")}
                    className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                  >
                    Revoke Admin Submission
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">Withdraw results sent to Admin</p>
                  </button>
                </div>
              )}
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
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Student</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Roll No</th>
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
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.full_name || row.student_id}</td>
                    <td className="px-4 py-3 text-slate-500">{row.roll_number || "-"}</td>
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
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-bold text-slate-800">Final Results Breakdown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Student</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Project</th>
                {projectId && <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Attendance</th>}
                {projectId && <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Report</th>}
                {projectId && <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Review Avg</th>}
                {projectId && <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Guide</th>}
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Internal /75</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">External /75</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Final</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">Loading coordinator result breakdown...</td></tr>
              ) : scopedResults.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">No results available yet.</td></tr>
              ) : (
                scopedResults.map((row) => (
                  <tr key={row.student_id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{row.full_name || row.student_id}</p>
                      <p className="text-xs text-slate-400">{row.roll_number || row.student_id}</p>
                    </td>
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
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {row.status || "pending"}
                      </span>
                    </td>
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
