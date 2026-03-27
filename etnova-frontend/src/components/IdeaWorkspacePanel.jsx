import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  domain: "",
  description: "",
  technologies: "",
};

const STARTER_ASSISTANT_MESSAGE = {
  id: "assistant-welcome",
  role: "assistant",
  content:
    "Tell me what you have in mind, even if it is rough. I will help you turn it into a strong, mentor-ready idea step by step.",
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });
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
  const [assistantChat, setAssistantChat] = useState(null);
  const [assistantMessages, setAssistantMessages] = useState([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantImageName, setAssistantImageName] = useState("");
  const [assistantImageDataUrl, setAssistantImageDataUrl] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantHistoryLoading, setAssistantHistoryLoading] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const [assistantDraft, setAssistantDraft] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const assistantEndRef = useRef(null);

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
      domain: idea.domain || project?.domain || "",
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

  const ensureFormOpen = () => {
    if (!isFormOpen) {
      setEditingIdeaId("");
      setIsFormOpen(true);
    }
  };

  const applyAssistantSuggestion = (mode = "all") => {
    if (!assistantDraft) return;
    ensureFormOpen();
    setForm((prev) => ({
      title: mode === "all" || mode === "title" ? assistantDraft.title || prev.title : prev.title,
      domain: mode === "all" || mode === "domain" ? assistantDraft.domain || prev.domain : prev.domain,
      description: mode === "all" || mode === "description" ? assistantDraft.description || prev.description : prev.description,
      technologies:
        mode === "all" || mode === "technologies"
          ? toTechString(assistantDraft.technologies)
          : prev.technologies,
    }));
    setNotice("AI draft applied to the idea form. Review it, adjust anything you want, and save when ready.");
    setError("");
  };

  const handleAssistantImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAssistantError("Please upload an image file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setAssistantError("Please upload an image smaller than 4 MB.");
      return;
    }

    setAssistantError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAssistantImageDataUrl(dataUrl);
      setAssistantImageName(file.name);
    } catch (fileError) {
      setAssistantError(fileError.message || "Failed to read the selected image.");
    } finally {
      event.target.value = "";
    }
  };

  const clearAssistantImage = () => {
    setAssistantImageDataUrl("");
    setAssistantImageName("");
  };

  const loadAssistantChat = useCallback(async () => {
    if (!selectedIdea?.id || !assistantOpen) return;
    setAssistantHistoryLoading(true);
    setAssistantError("");
    try {
      const response = await apiRequest(`/ideas/${selectedIdea.id}/chat`, { skipCache: true });
      setAssistantChat(response?.chat || null);
      setAssistantMessages(Array.isArray(response?.messages) ? response.messages : []);
      setAssistantDraft(response?.latest_draft || null);
    } catch (chatError) {
      setAssistantError(chatError.message || "Failed to load assistant chat.");
      setAssistantMessages([]);
      setAssistantDraft(null);
      setAssistantChat(null);
    } finally {
      setAssistantHistoryLoading(false);
    }
  }, [assistantOpen, selectedIdea?.id]);

  useEffect(() => {
    loadAssistantChat();
  }, [loadAssistantChat]);

  useEffect(() => {
    if (!assistantOpen) return;
    assistantEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [assistantMessages, assistantLoading, assistantOpen]);

  const handleSendAssistantMessage = async () => {
    if (!selectedIdea?.id) {
      setAssistantError("Create or select an idea version before starting the assistant chat.");
      return;
    }
    const trimmedInput = assistantInput.trim();
    if (!trimmedInput && !assistantImageDataUrl) {
      setAssistantError("Add a message or an image before asking the assistant.");
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content:
        trimmedInput ||
        (assistantImageName
          ? `Please analyze the attached image (${assistantImageName}) and help refine the idea.`
          : "Please help me refine this idea."),
    };
    const tempUserMessage = {
      ...userMessage,
      created_at: new Date().toISOString(),
    };
    const tempUserId = tempUserMessage.id;

    setAssistantMessages((current) => [...current, tempUserMessage]);
    setAssistantLoading(true);
    setAssistantError("");
    setNotice("");
    setAssistantInput("");
    try {
      const response = await apiRequest(`/ideas/${selectedIdea.id}/chat`, {
        method: "POST",
        body: {
          message: trimmedInput,
          imageDataUrl: assistantImageDataUrl || undefined,
          currentDraft: {
            title: form.title,
            domain: form.domain,
            description: form.description,
            technologies: parseTechnologies(form.technologies),
          },
        },
      });
      if (!response?.assistant_message?.content) {
        throw new Error("The assistant did not return a response.");
      }
      setAssistantMessages((current) => {
        const withoutTemp = current.filter((message) => message.id !== tempUserId);
        return [
          ...withoutTemp,
          response.user_message || tempUserMessage,
          response.assistant_message,
        ];
      });
      setAssistantChat(response.chat || null);
      setAssistantDraft(response.draft_patch || null);
      clearAssistantImage();
    } catch (generationError) {
      setAssistantMessages((current) => current.filter((message) => message.id !== tempUserId));
      setAssistantError(generationError.message || "Failed to get a response from the assistant.");
    } finally {
      setAssistantLoading(false);
    }
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
        domain: form.domain.trim(),
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

  const visibleAssistantMessages = assistantMessages.length ? assistantMessages : [STARTER_ASSISTANT_MESSAGE];

  const assistantPortal = typeof document !== "undefined"
    ? createPortal(
      <>
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          className="fixed bottom-6 right-6 z-[70] flex size-14 items-center justify-center rounded-full text-black shadow-[0_18px_40px_rgba(0,210,196,0.24)] transition-all hover:-translate-y-0.5 hover:scale-[1.02] hover:opacity-95"
          style={{ backgroundColor: "#00D2C4" }}
          aria-label="Open AI idea assistant"
        >
          <span className="material-symbols-outlined text-[24px]">psychology</span>
        </button>

        {assistantOpen ? (
          <div className="fixed bottom-24 right-4 z-[80] w-[calc(100vw-2rem)] max-w-[460px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)] sm:right-6">
              <div className="flex h-[min(720px,calc(100dvh-8rem))] flex-col">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-base font-black text-slate-900">AI Idea Assistant</p>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {assistantChat?.title || selectedIdea?.title || "Start shaping your project idea"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {assistantDraft ? (
                      <button
                        type="button"
                        onClick={() => applyAssistantSuggestion("all")}
                        className="rounded-xl px-3.5 py-2 text-xs font-black text-black hover:opacity-90"
                        style={{ backgroundColor: "#00D2C4" }}
                      >
                        Apply to Workspace
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setAssistantOpen(false)}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50/70 px-4 py-4">
                  {!selectedIdea ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="max-w-md rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
                        <p className="text-base font-black text-slate-900">Create or select an idea first</p>
                        <p className="mt-2 text-sm text-slate-500">
                          Once you pick an idea version, the assistant will keep a separate conversation for it.
                        </p>
                      </div>
                    </div>
                  ) : assistantHistoryLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
                        Loading your conversation...
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-4">
                      {assistantError ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          {assistantError}
                        </div>
                      ) : null}

                      <div className="flex-1 space-y-4">
                        {visibleAssistantMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
                          >
                          <div
                            className={`max-w-[85%] rounded-[24px] px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[70%] ${
                                message.role === "assistant"
                                  ? "border border-slate-200 bg-white text-slate-700"
                                  : "text-slate-950"
                              }`}
                              style={
                                message.role === "assistant"
                                  ? undefined
                                  : { backgroundColor: "rgba(0,210,196,0.18)" }
                              }
                            >
                              {message.content}
                            </div>
                          </div>
                        ))}

                        {assistantLoading ? (
                          <div className="flex justify-start">
                            <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                              Thinking...
                            </div>
                          </div>
                        ) : null}
                        <div ref={assistantEndRef} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 bg-white px-4 py-4">
                  <div className="flex w-full flex-col gap-3">
                    {assistantImageName ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{assistantImageName}</p>
                          <p className="text-xs text-slate-500">This image will be included with your next message.</p>
                        </div>
                        <button
                          type="button"
                          onClick={clearAssistantImage}
                          className="text-xs font-bold text-rose-600 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}

                    <div className="flex items-end gap-3">
                      <label className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white p-3 text-slate-600 hover:bg-slate-50">
                        <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleAssistantImageChange} />
                      </label>
                      <div className="flex-1 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
                        <textarea
                          rows={2}
                          value={assistantInput}
                          onChange={(event) => setAssistantInput(event.target.value)}
                          className="min-h-[64px] w-full resize-none bg-transparent px-4 py-3 text-sm text-slate-900 outline-none"
                          placeholder="Describe your idea, ask for refinement, or attach a sketch..."
                          disabled={!selectedIdea || assistantLoading}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendAssistantMessage}
                        className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ backgroundColor: "#00D2C4" }}
                        disabled={!selectedIdea || assistantLoading}
                      >
                        <span className="material-symbols-outlined text-[22px]">send</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        ) : null}
      </>,
      document.body
    )
    : null;

  return (
    <>
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
                        <p className="text-xs text-slate-500 mt-1">Version {idea.version_no} - {idea.domain || "General"} - {formatDateTime(idea.created_at)}</p>
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Domain</label>
                  <input
                    value={form.domain}
                    onChange={(event) => setForm((prev) => ({ ...prev, domain: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    placeholder="AI / Healthcare / FinTech / IoT"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Keep this editable. We will use it later for mentor recommendations, but students can still refine it.
                  </p>
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
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Domain</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {selectedIdea.domain || "General"}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">{selectedIdea.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Version {selectedIdea.version_no} - Created {formatDateTime(selectedIdea.created_at)}
                      {selectedIdea.submitted_at ? ` - Submitted ${formatDateTime(selectedIdea.submitted_at)}` : ""}
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
                        <span className="text-xs text-slate-500">by {selectedIdea.latest_review.reviewer?.full_name || "Mentor"} - {formatDateTime(selectedIdea.latest_review.created_at)}</span>
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
      {assistantPortal}
    </>
  );
}


