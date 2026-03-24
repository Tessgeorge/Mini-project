import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../config/apiClient";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ status }) {
  const value = String(status || "draft").toLowerCase();
  const styles = {
    draft: "bg-slate-100 text-slate-700 border-slate-200",
    submitted: "bg-amber-50 text-amber-700 border-amber-200",
    revision_required: "bg-orange-50 text-orange-700 border-orange-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const labels = {
    draft: "Draft",
    submitted: "Submitted",
    revision_required: "Revision Required",
    approved: "Approved",
    rejected: "Rejected",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${styles[value] || styles.draft}`}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {labels[value] || status || "Draft"}
    </span>
  );
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "submitted", label: "Submitted" },
  { id: "revision_required", label: "Revision" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

export default function MentorIdeaQueue({
  onRefresh,
  projectId = "",
  title = "Submitted Ideas",
  subtitle = "Review versions submitted by your assigned teams.",
  hideFilters = false,
}) {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("submitted");
  const [reviewDrafts, setReviewDrafts] = useState({});

  const loadIdeas = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/mentor/ideas", { skipCache: true });
      setIdeas(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load submitted ideas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIdeas();
  }, [loadIdeas]);

  const filteredIdeas = useMemo(() => {
    const scoped = projectId ? ideas.filter((idea) => idea.project_id === projectId) : ideas;
    if (hideFilters || filter === "all") return scoped;
    return scoped.filter((idea) => String(idea.status || "").toLowerCase() === filter);
  }, [filter, hideFilters, ideas, projectId]);

  const handleReview = async (idea, action) => {
    if (!idea?.id) return;
    setSaving(idea.id + ":" + action);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/mentor/ideas/${idea.id}/review`, {
        method: "POST",
        body: {
          action,
          comment: reviewDrafts[idea.id] || "",
        },
      });
      setNotice(`Idea "${idea.title}" marked as ${action.replace("_", " ")}.`);
      setReviewDrafts((prev) => ({ ...prev, [idea.id]: "" }));
      await loadIdeas();
      await onRefresh?.();
    } catch (reviewError) {
      setError(reviewError.message || "Failed to review idea.");
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{title}</p>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>
        {!hideFilters ? (
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                  filter === item.id ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mx-6 mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {notice ? (
        <div className="mx-6 mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
      ) : null}

      {loading ? (
        <div className="px-6 py-10 text-sm text-gray-500">Loading submitted ideas...</div>
      ) : filteredIdeas.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="mx-auto size-12 rounded-full bg-slate-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-400">lightbulb</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-700">No ideas in this queue</p>
          <p className="text-xs text-slate-500 mt-1">Submitted versions from assigned teams will appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {filteredIdeas.map((idea) => {
            const project = idea.project || {};
            const feedback = idea.latest_review?.comment || "";
            const busyPrefix = `${idea.id}:`;

            return (
              <div key={idea.id} className="px-6 py-5">
                <div className="flex flex-col xl:flex-row gap-5 xl:items-start xl:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-gray-900">{idea.title}</h3>
                      <StatusPill status={idea.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Team {project.team_name || project.title || "Untitled Team"} · Version {idea.version_no} · Created {formatDateTime(idea.created_at)}
                      {idea.submitted_at ? ` · Submitted ${formatDateTime(idea.submitted_at)}` : ""}
                    </p>
                    <p className="text-sm text-gray-700 mt-3 leading-relaxed whitespace-pre-wrap">
                      {idea.description || "No description added."}
                    </p>
                    {(idea.technologies || []).length > 0 ? (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {idea.technologies.map((item) => (
                          <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {idea.latest_review ? (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Latest Feedback</p>
                        <p className="mt-2 text-sm text-slate-700 leading-relaxed">
                          {feedback || "No written feedback for the latest review."}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="xl:w-[360px] rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-sm font-black text-gray-800">Review Actions</p>
                    <textarea
                      rows={4}
                      value={reviewDrafts[idea.id] || ""}
                      onChange={(event) => setReviewDrafts((prev) => ({ ...prev, [idea.id]: event.target.value }))}
                      placeholder="Add mentor feedback for this version..."
                      className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 resize-none"
                    />
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleReview(idea, "approved")}
                        disabled={saving.startsWith(busyPrefix)}
                        className="rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-black text-white hover:bg-emerald-600 disabled:opacity-60"
                      >
                        {saving === `${idea.id}:approved` ? "Saving..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReview(idea, "revision_required")}
                        disabled={saving.startsWith(busyPrefix)}
                        className="rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-black text-white hover:bg-amber-600 disabled:opacity-60"
                      >
                        {saving === `${idea.id}:revision_required` ? "Saving..." : "Revision"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReview(idea, "rejected")}
                        disabled={saving.startsWith(busyPrefix)}
                        className="rounded-xl bg-rose-500 px-3 py-2.5 text-xs font-black text-white hover:bg-rose-600 disabled:opacity-60"
                      >
                        {saving === `${idea.id}:rejected` ? "Saving..." : "Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
