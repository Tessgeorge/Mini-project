import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../config/apiClient";
import { getStatusMeta } from "../constants/statusConfig";

const EDITABLE_STATUSES = new Set(["draft", "revision_required", "rejected"]);

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

function IdeaStatusBadge({ status }) {
  const meta = getStatusMeta(status, { context: "idea" });

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${meta.pillClass}`}>
      <span className={`size-1.5 rounded-full ${meta.dotClass}`} />
      {meta.label}
    </span>
  );
}

const EMPTY_FORM = {
  title: "",
  description: "",
  technologies: "",
};

function toTechString(value) {
  if (!Array.isArray(value)) return "";
  return value.join(", ");
}

function parseTechnologies(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function IdeaWorkspacePanel({ project, profile, onRefresh }) {
  const [ideas, setIdeas] = useState([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingIdeaId, setSubmittingIdeaId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIdeaId, setEditingIdeaId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [autoEvaluations, setAutoEvaluations] = useState({});

  const loadIdeas = useCallback(async () => {
    if (!project?.id) {
      setIdeas([]);
      setSelectedIdeaId("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/projects/${project.id}/ideas`, { skipCache: true });
      const nextIdeas = Array.isArray(data) ? data : [];
      setIdeas(nextIdeas);
      setSelectedIdeaId((current) => {
        if (current && nextIdeas.some((idea) => idea.id === current)) return current;
        return nextIdeas[0]?.id || "";
      });
    } catch (loadError) {
      setError(loadError.message || "Failed to load ideas.");
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    loadIdeas();
  }, [loadIdeas]);

  const selectedIdea = useMemo(
    () => ideas.find((idea) => idea.id === selectedIdeaId) || ideas[0] || null,
    [ideas, selectedIdeaId]
  );
  const selectedAutoEvaluation = selectedIdea ? (autoEvaluations[selectedIdea.id] || selectedIdea.auto_evaluation || null) : null;

  const teamLeader = useMemo(() => {
    const leader = (project?.team_members || []).find((member) => member.role === "leader");
    return leader?.profiles?.full_name || profile?.full_name || "Team Leader";
  }, [profile?.full_name, project?.team_members]);

  const mentorName = project?.guide?.full_name || project?.mentor?.full_name || "Mentor not assigned";
  const approvedIdea = ideas.find((idea) => String(idea.status).toLowerCase() === "approved") || null;

  const openCreate = () => {
    setEditingIdeaId("");
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
    setError("");
    setNotice("");
  };

  const openEdit = (idea) => {
    if (!idea) return;
    setEditingIdeaId(idea.id);
    setForm({
      title: idea.title || "",
      description: idea.description || "",
      technologies: toTechString(idea.technologies),
    });
    setIsFormOpen(true);
    setError("");
    setNotice("");
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingIdeaId("");
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!project?.id) return;
    if (!form.title.trim()) {
      setError("Idea title is required.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const path = editingIdeaId
        ? `/projects/${project.id}/ideas/${editingIdeaId}`
        : `/projects/${project.id}/ideas`;
      const method = editingIdeaId ? "PUT" : "POST";

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        technologies: parseTechnologies(form.technologies),
      };

      const savedIdea = await apiRequest(path, { method, body: payload });
      await loadIdeas();
      setSelectedIdeaId(savedIdea?.id || "");
      setNotice(editingIdeaId ? "Idea updated." : "New idea version created.");
      closeForm();
      await onRefresh?.();
    } catch (saveError) {
      setError(saveError.message || "Failed to save idea.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitIdea = async (idea) => {
    if (!project?.id || !idea?.id) return;
    setSubmittingIdeaId(idea.id);
    setError("");
    setNotice("");
    try {
      const submitResult = await apiRequest(`/projects/${project.id}/ideas/${idea.id}/submit`, {
        method: "POST",
      });
      if (submitResult?.id && submitResult?.auto_evaluation) {
        setAutoEvaluations((prev) => ({ ...prev, [submitResult.id]: submitResult.auto_evaluation }));
      }
      setNotice(`Version ${idea.version_no} submitted for mentor review.`);
      await loadIdeas();
      await onRefresh?.();
    } catch (submitError) {
      setError(submitError.message || "Failed to submit idea.");
    } finally {
      setSubmittingIdeaId("");
    }
  };

  return (
    <div className="glass-card-strong overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-white/70 flex items-center gap-2.5">
        <div className="size-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(0,210,196,0.12)" }}>
          <span className="material-symbols-outlined text-sm" style={{ color: "#00D2C4" }}>lightbulb</span>
        </div>
        <h2 className="text-sm font-black text-slate-900">Idea Workspace</h2>
        <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-100/70 px-2 py-0.5 rounded-full">
          {ideas.length} version{ideas.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Team Name</p>
            <p className="mt-2 text-base font-black text-slate-900 break-words">{project?.team_name || project?.title || "Untitled Team"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Team Leader</p>
            <p className="mt-2 text-base font-black text-slate-900 break-words">{teamLeader}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Assigned Mentor</p>
            <p className="mt-2 text-base font-black text-slate-900 break-words">{mentorName}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Approved Idea</p>
            <p className="mt-2 text-base font-black text-slate-900 break-words">{approvedIdea?.title || "Not approved yet"}</p>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}
        {notice ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-1 rounded-2xl border border-slate-200 bg-white/70 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <p className="text-sm font-black text-slate-900">Idea Versions</p>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black text-black transition-all hover:opacity-90"
                style={{ backgroundColor: "#00D2C4" }}
              >
                <span className="material-symbols-outlined text-sm">add</span>
                New Idea
              </button>
            </div>

            {loading ? (
              <div className="px-4 py-8 text-sm text-slate-500">Loading ideas...</div>
            ) : ideas.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300">lightbulb_circle</span>
                <p className="mt-2 text-sm font-semibold text-slate-700">No ideas yet</p>
                <p className="text-xs text-slate-500 mt-1">Create the first draft and iterate with your mentor.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {ideas.map((idea) => (
                  <button
                    key={idea.id}
                    type="button"
                    onClick={() => setSelectedIdeaId(idea.id)}
                    className={`w-full px-4 py-4 text-left transition-all ${selectedIdea?.id === idea.id ? "bg-teal-50/70" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{idea.title}</p>
                        <p className="text-xs text-slate-500 mt-1">Version {idea.version_no} · {formatDateTime(idea.created_at)}</p>
                      </div>
                      <IdeaStatusBadge status={idea.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white/70 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-900">Idea Details</p>
                <p className="text-xs text-slate-500 mt-0.5">Only one approved idea can be active for a team at a time.</p>
              </div>
              {selectedIdea && EDITABLE_STATUSES.has(String(selectedIdea.status).toLowerCase()) ? (
                <button
                  type="button"
                  onClick={() => openEdit(selectedIdea)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Edit
                </button>
              ) : null}
            </div>

            {isFormOpen ? (
              <div className="p-4 sm:p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Title</label>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    placeholder="Enter idea title"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Description</label>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 resize-none"
                    placeholder="Describe the problem, objective, and expected outcome"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Technologies</label>
                  <input
                    value={form.technologies}
                    onChange={(event) => setForm((prev) => ({ ...prev, technologies: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    placeholder="React, Node.js, Python"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex-1 rounded-xl px-4 py-3 text-sm font-black text-black hover:opacity-90"
                    style={{ backgroundColor: "#00D2C4" }}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : editingIdeaId ? "Save Changes" : "Create Idea"}
                  </button>
                </div>
              </div>
            ) : !selectedIdea ? (
              <div className="p-6 text-sm text-slate-500">Select an idea version to view details.</div>
            ) : (
              <div className="p-4 sm:p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">{selectedIdea.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Version {selectedIdea.version_no} · Created {formatDateTime(selectedIdea.created_at)}
                      {selectedIdea.submitted_at ? ` · Submitted ${formatDateTime(selectedIdea.submitted_at)}` : ""}
                    </p>
                  </div>
                  <IdeaStatusBadge status={selectedIdea.status} />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {selectedIdea.description || "No description added for this version."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Technologies</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(selectedIdea.technologies || []).length > 0 ? (
                      selectedIdea.technologies.map((item) => (
                        <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                          {item}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No technologies added.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">Mentor Feedback</p>
                      <p className="text-xs text-slate-500 mt-0.5">Latest review and comments for this idea.</p>
                    </div>
                  </div>
                  {selectedAutoEvaluation ? (
                    <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300 bg-white px-2.5 py-1 text-xs font-bold text-teal-700">
                          <span className="material-symbols-outlined text-sm">auto_awesome</span>
                          Auto Review
                        </span>
                        <span className="text-xs font-bold text-slate-700">Score: {selectedAutoEvaluation.score}/100</span>
                        <span className={`text-xs font-bold ${selectedAutoEvaluation.status === "Good" ? "text-emerald-700" : "text-amber-700"}`}>
                          {selectedAutoEvaluation.status}
                        </span>
                      </div>
                      {Array.isArray(selectedAutoEvaluation.feedback) && selectedAutoEvaluation.feedback.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {selectedAutoEvaluation.feedback.map((item) => (
                            <li key={item}>- {item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                  {selectedIdea.latest_review ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <IdeaStatusBadge status={selectedIdea.latest_review.action} />
                        <span className="text-xs text-slate-500">by {selectedIdea.latest_review.reviewer?.full_name || "Mentor"} · {formatDateTime(selectedIdea.latest_review.created_at)}</span>
                      </div>
                      <p className="mt-3 text-sm text-slate-700 leading-relaxed">
                        {selectedIdea.latest_review.comment || "No comment added for this review."}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No mentor feedback yet. Submit this idea to start the review cycle.</p>
                  )}
                </div>

                {EDITABLE_STATUSES.has(String(selectedIdea.status).toLowerCase()) ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => openEdit(selectedIdea)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                    >
                      Edit Version
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmitIdea(selectedIdea)}
                      className="flex-1 rounded-xl px-4 py-3 text-sm font-black text-black hover:opacity-90"
                      style={{ backgroundColor: "#00D2C4" }}
                      disabled={submittingIdeaId === selectedIdea.id}
                    >
                      {submittingIdeaId === selectedIdea.id ? "Submitting..." : "Submit for Mentor Review"}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
