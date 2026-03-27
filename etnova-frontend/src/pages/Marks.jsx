import { useEffect, useState } from "react";
import { fetchPublishedStudentResult } from "../services/rubrics";
import { apiRequest } from "../config/apiClient";

export default function Marks() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [feedbackItems, setFeedbackItems] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const [data, notifications] = await Promise.all([
          fetchPublishedStudentResult(),
          apiRequest("/notifications", { skipCache: true }),
        ]);
        if (!cancelled) {
          setResult(data || null);
          setFeedbackItems(
            (notifications || []).filter((item) =>
              item.type === "guide_individual_feedback" || item.type === "review_individual_feedback"
            )
          );
        }
      } catch (err) {
        if (!cancelled) {
          setResult(null);
          setFeedbackItems([]);
          setError(err.message || "Final result is not available yet.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-full md:min-h-screen px-4 sm:px-6 py-5 sm:py-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Final Marks</h1>
          <p className="text-sm text-slate-500 mt-1">Published results only. Detailed rubric breakdown is not shown to students.</p>
        </div>

        {loading ? (
          <div className="glass-card-strong p-8 text-center text-slate-500">Loading published result...</div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card p-4">
                <p className="text-xs text-slate-500 font-bold uppercase">Student ID</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 break-all">{result?.student_id}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-slate-500 font-bold uppercase">Final Marks</p>
                <p className="mt-2 text-3xl font-black text-slate-900">{result?.final_marks ?? "-"}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-slate-500 font-bold uppercase">Status</p>
                <p className="mt-2 text-2xl font-black text-emerald-700 capitalize">{result?.status || "-"}</p>
              </div>
            </div>

            <div className="glass-card-strong p-5">
              <h2 className="font-black text-slate-900 mb-2">Published Result</h2>
              <p className="text-sm text-slate-600">
                Your final mark has been published. Internal calculation and rubric-wise evaluation remain controlled in the backend and are visible only to authorized staff.
              </p>
              <p className="text-xs text-slate-400 mt-3">
                Published at: {result?.published_at ? new Date(result.published_at).toLocaleString("en-IN") : "-"}
              </p>
            </div>

            <div className="glass-card-strong p-5">
              <h2 className="font-black text-slate-900 mb-2">Individual Feedback</h2>
              {feedbackItems.length === 0 ? (
                <p className="text-sm text-slate-500">No individual mentor feedback has been shared yet.</p>
              ) : (
                <div className="space-y-3">
                  {feedbackItems.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-sm text-slate-700">{item.message}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {item.created_at ? new Date(item.created_at).toLocaleString("en-IN") : "-"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
