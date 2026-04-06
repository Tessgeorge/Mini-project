import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiRequest } from "../config/apiClient";
import { getStatusMeta } from "../constants/statusConfig";
import Modal from "./Modal";

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
  subdomain: "",
  description: "",
  technologies: "",
  confidence_score: 0,
  keywords: "",
};

const COPILOT_STATES = {
  CLOSED: "closed",
  OPEN: "open",
  MINIMIZED: "minimized",
};
const CHAT_MESSAGE_EDIT_WINDOW_MS = 10 * 60 * 1000;

const STARTER_ASSISTANT_MESSAGE = {
  id: "assistant-welcome",
  role: "assistant",
  content:
    "Tell me what you have in mind, even if it is rough. I will help you turn it into a strong, mentor-ready idea step by step.",
};

const EMPTY_ASSISTANT_META = {
  readiness: "exploring",
  follow_up_questions: [],
};

const ASSISTANT_MODES = {
  IDEA_REFINEMENT: "idea_refinement",
  IMPLEMENTATION_PLANNING: "implementation_planning",
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

function formatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMessageDateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const isSameDay =
    date.getDate() === today.getDate()
    && date.getMonth() === today.getMonth()
    && date.getFullYear() === today.getFullYear();

  if (isSameDay) return "Today";

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate()
    && date.getMonth() === yesterday.getMonth()
    && date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildChatTimeline(messages) {
  const timeline = [];
  let lastDateLabel = "";

  for (const message of messages) {
    const nextDateLabel = formatMessageDateLabel(message?.created_at);
    if (nextDateLabel && nextDateLabel !== lastDateLabel) {
      timeline.push({
        id: `divider-${message.id || nextDateLabel}`,
        type: "divider",
        label: nextDateLabel,
      });
      lastDateLabel = nextDateLabel;
    }

    timeline.push({
      ...message,
      type: "message",
    });
  }

  return timeline;
}

function normalizeAssistantDraftPayload(value) {
  if (!value || typeof value !== "object") return null;

  return {
    title: String(value.title || "").trim(),
    description: String(value.description || "").trim(),
    technologies: Array.isArray(value.technologies)
      ? value.technologies.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    domain: String(value.domain || "").trim(),
    subdomain: String(value.subdomain || "").trim(),
    confidence_score: Number.isFinite(Number(value.confidence_score)) ? Number(value.confidence_score) : 0,
    keywords: Array.isArray(value.keywords)
      ? value.keywords.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
  };
}

function formatChatListTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate()
    && date.getMonth() === today.getMonth()
    && date.getFullYear() === today.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function isDraftConfirmationMessage(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;

  const directMatches = new Set([
    "yes",
    "yes please",
    "yeah",
    "yep",
    "sure",
    "ok",
    "okay",
    "go ahead",
    "continue",
    "proceed",
    "draft it",
    "show draft",
    "show the draft",
    "finalize it",
    "finalise it",
    "prepare draft",
    "make the draft",
    "create the draft",
    "generate the draft",
    "apply it",
  ]);

  if (directMatches.has(normalized)) return true;

  const phraseMatches = [
    "can you draft",
    "please draft",
    "draft an idea",
    "draft the idea",
    "draft idea",
    "give me the draft",
    "where is the draft",
    "show the idea draft",
    "show me the draft",
    "let s draft",
    "lets draft",
    "go with this",
    "this looks good",
    "this is fine",
    "draft this idea",
    "prepare the idea",
    "turn this into a draft",
    "finalize the idea",
    "finalise the idea",
  ];

  return phraseMatches.some((phrase) => normalized.includes(phrase));
}

function hasMeaningfulAssistantDraft(draft) {
  if (!draft || typeof draft !== "object") return false;

  return Boolean(
    String(draft.title || "").trim()
    || String(draft.description || "").trim()
    || String(draft.domain || "").trim()
    || String(draft.subdomain || "").trim()
    || (Array.isArray(draft.technologies) && draft.technologies.length > 0)
    || (Array.isArray(draft.keywords) && draft.keywords.length > 0)
  );
}

function CopilotAvatar({ role }) {
  const isAssistant = role === "assistant";

  return (
    <div
      className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-black ${
        isAssistant
          ? "border-white/80 bg-white text-slate-700 shadow-sm"
          : "border-transparent text-slate-950 shadow-sm"
      }`}
      style={isAssistant ? undefined : { backgroundColor: "rgba(0,210,196,0.18)" }}
    >
      <span className="material-symbols-outlined text-[16px]">
        {isAssistant ? "auto_awesome" : "person"}
      </span>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((item) => (
          <span
            key={item}
            className="size-2 rounded-full bg-teal-300 animate-pulse"
            style={{ animationDelay: `${item * 0.15}s` }}
          />
        ))}
      </div>
      <span></span>
    </div>
  );
}

function MessageAttachmentPreview({ attachment }) {
  const isImage = attachment?.mimeType?.startsWith("image/");

  if (isImage && attachment?.dataUrl) {
    return (
      <a
        href={attachment.dataUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block overflow-hidden rounded-2xl border border-slate-200 bg-white/80"
      >
        <img
          src={attachment.dataUrl}
          alt={attachment?.name || "Attached image"}
          className="max-h-48 w-full object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={attachment?.dataUrl || "#"}
      target="_blank"
      rel="noreferrer"
      className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700"
    >
      <span className="material-symbols-outlined text-[16px]">attach_file</span>
      <span className="max-w-[180px] truncate">{attachment?.name || "Attachment"}</span>
    </a>
  );
}

function AssistantDraftPreview({ draft, readiness }) {
  if (!draft) return null;

  const confidencePercent = typeof draft.confidence_score === "number"
    ? `${Math.round(Math.max(0, Math.min(1, draft.confidence_score)) * 100)}%`
    : "Not available";
  const technologies = Array.isArray(draft.technologies) ? draft.technologies.filter(Boolean) : [];
  const keywords = Array.isArray(draft.keywords) ? draft.keywords.filter(Boolean) : [];

  return (
    <div className="rounded-3xl border border-teal-100 bg-white/80 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Current Draft Preview</p>
          <h3 className="mt-1 text-base font-black text-slate-900">{draft.title || "Untitled idea draft"}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Ask for any change here first, then use <span className="font-semibold text-slate-700">Apply</span> when the draft feels right.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {readiness === "ready_to_apply" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              <span className="material-symbols-outlined text-[14px]">task_alt</span>
              Ready to apply
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
              <span className="material-symbols-outlined text-[14px]">sync</span>
              Still refining
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            Confidence {confidencePercent}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Domain</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{draft.domain || "Not set yet"}</p>
          {draft.subdomain ? (
            <p className="mt-1 text-xs text-slate-500">{draft.subdomain}</p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Keywords</p>
          {keywords.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {keywords.map((keyword) => (
                <span key={keyword} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  {keyword}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-500">No keywords yet</p>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Description</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
          {draft.description || "The assistant is still shaping the description."}
        </p>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Suggested Technologies</p>
        {technologies.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {technologies.map((item) => (
              <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {item}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-slate-500">No technologies suggested yet.</p>
        )}
      </div>
    </div>
  );
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
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [messages, setMessages] = useState([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantAttachment, setAssistantAttachment] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantChatsLoading, setAssistantChatsLoading] = useState(false);
  const [assistantMessagesLoading, setAssistantMessagesLoading] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const [assistantDraft, setAssistantDraft] = useState(null);
  const [assistantMeta, setAssistantMeta] = useState(EMPTY_ASSISTANT_META);
  const [assistantMode, setAssistantMode] = useState(ASSISTANT_MODES.IDEA_REFINEMENT);
  const [assistantWidgetState, setAssistantWidgetState] = useState(COPILOT_STATES.CLOSED);
  const [assistantExpanded, setAssistantExpanded] = useState(false);
  const [assistantSidebarHidden, setAssistantSidebarHidden] = useState(false);
  const [chatMenuOpenId, setChatMenuOpenId] = useState("");
  const [chatDialog, setChatDialog] = useState({ type: "", chat: null, value: "" });
  const [editingAssistantMessage, setEditingAssistantMessage] = useState({ messageId: "", value: "" });
  const assistantEndRef = useRef(null);
  const assistantInputRef = useRef(null);

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
      const data = await apiRequest(`/projects/${project.id}/ideas`);
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

  useEffect(() => {
    if (selectedIdeaId) return;
    setAssistantDraft(null);
    setAssistantMeta(EMPTY_ASSISTANT_META);
    setAssistantMode(ASSISTANT_MODES.IDEA_REFINEMENT);
  }, [selectedIdeaId]);

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
  const normalizedProjectStatus = String(project?.status || "").toLowerCase();
  const workspaceLocked = Boolean((project?.approved_idea_id || approvedIdea?.id) && normalizedProjectStatus !== "rejected");
  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) || null,
    [activeChatId, chats]
  );
  const assistantIsOpen = assistantWidgetState === COPILOT_STATES.OPEN;
  const assistantIsMinimized = assistantWidgetState === COPILOT_STATES.MINIMIZED;
  const assistantCanApply = Boolean(
    assistantDraft?.title
      || assistantDraft?.description
      || assistantDraft?.domain
      || (assistantDraft?.technologies || []).length
  );

  useEffect(() => {
    if (!assistantIsOpen) return;
    setEditingAssistantMessage({ messageId: "", value: "" });
  }, [assistantIsOpen, activeChatId, messages.length]);

  useEffect(() => {
    if (!assistantIsOpen) return;
    setAssistantMeta(EMPTY_ASSISTANT_META);
  }, [activeChatId, assistantIsOpen]);

  useEffect(() => {
    if (!assistantIsOpen) return;
    setAssistantDraft(normalizeAssistantDraftPayload(activeChat?.latest_draft));
  }, [activeChat?.latest_draft, assistantIsOpen]);

  const openCreate = () => {
    if (workspaceLocked) {
      setError("");
      setNotice("Idea submission is locked after approval. It will reopen only if the approved idea is later rejected during review.");
      return;
    }
    setEditingIdeaId("");
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
    setError("");
    setNotice("");
  };

  const openEdit = (idea) => {
    if (!idea) return;
    if (workspaceLocked) {
      setError("");
      setNotice("Idea submission is locked after approval. It will reopen only if the approved idea is later rejected during review.");
      return;
    }
    setEditingIdeaId(idea.id);
    setForm({
      title: idea.title || "",
      domain: idea.domain || project?.domain || "",
      subdomain: idea.subdomain || "",
      description: idea.description || "",
      technologies: toTechString(idea.technologies),
      confidence_score: Number(idea.confidence_score || 0),
      keywords: Array.isArray(idea.keywords) ? idea.keywords.join(", ") : "",
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
    if (workspaceLocked) {
      setError("");
      setNotice("Idea submission is locked after approval. It will reopen only if the approved idea is later rejected during review.");
      return;
    }
    if (isFormOpen) return;
    if (selectedIdea && EDITABLE_STATUSES.has(String(selectedIdea.status || "").toLowerCase())) {
      openEdit(selectedIdea);
      return;
    }
    openCreate();
  };

  const openAssistant = () => {
    setAssistantWidgetState(COPILOT_STATES.OPEN);
    setAssistantError("");
  };

  const minimizeAssistant = () => {
    setAssistantWidgetState(COPILOT_STATES.MINIMIZED);
  };

  const closeAssistant = () => {
    setAssistantWidgetState(COPILOT_STATES.CLOSED);
    setAssistantError("");
  };

  const toggleAssistantExpanded = () => {
    setAssistantExpanded((current) => !current);
  };

  const toggleAssistantSidebar = () => {
    setAssistantSidebarHidden((current) => !current);
    setChatMenuOpenId("");
  };

  const applyAssistantSuggestion = (mode = "all") => {
    if (!assistantDraft) return;
    if (workspaceLocked) {
      setError("");
      setNotice("The copilot can still help refine ideas, but the idea submission form is locked after approval until a later rejection reopens it.");
      setAssistantWidgetState(COPILOT_STATES.CLOSED);
      return;
    }
    ensureFormOpen();
    setForm((prev) => ({
      title: mode === "all" || mode === "title" ? assistantDraft.title || prev.title : prev.title,
      domain: mode === "all" || mode === "domain" ? assistantDraft.domain || prev.domain : prev.domain,
      subdomain: assistantDraft.subdomain || prev.subdomain,
      description: mode === "all" || mode === "description" ? assistantDraft.description || prev.description : prev.description,
      technologies:
        mode === "all" || mode === "technologies"
          ? toTechString(assistantDraft.technologies)
          : prev.technologies,
      confidence_score: assistantDraft.confidence_score ?? prev.confidence_score,
      keywords:
        Array.isArray(assistantDraft.keywords) && assistantDraft.keywords.length > 0
          ? assistantDraft.keywords.join(", ")
          : prev.keywords,
    }));
    setNotice("AI draft applied to the idea form. Review it, adjust anything you want, and save when ready.");
    setError("");
    setAssistantWidgetState(COPILOT_STATES.CLOSED);
  };

  const handleAssistantAttachmentChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const allowedMime = isImage || ["application/pdf", "text/plain", "text/markdown", "text/csv", "application/json"].includes(file.type);
    if (!allowedMime) {
      setAssistantError("Please upload an image, PDF, or text-based file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setAssistantError("Please upload a file smaller than 4 MB.");
      return;
    }

    setAssistantError("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAssistantAttachment({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        dataUrl,
      });
    } catch (fileError) {
      setAssistantError(fileError.message || "Failed to read the selected file.");
    } finally {
      event.target.value = "";
    }
  };

  const clearAssistantAttachment = () => {
    setAssistantAttachment(null);
  };

  const handleCreateChat = async () => {
    if (!project?.id) return;
    setAssistantError("");
    try {
      const createdChat = await apiRequest(`/projects/${project.id}/idea-chats`, {
        method: "POST",
      });
      setChats((current) => [{
        ...createdChat,
        latest_draft: normalizeAssistantDraftPayload(createdChat?.latest_draft),
      }, ...current]);
      setActiveChatId(createdChat?.id || "");
      setMessages([]);
      setAssistantDraft(null);
      setAssistantMeta(EMPTY_ASSISTANT_META);
      setAssistantMode(ASSISTANT_MODES.IDEA_REFINEMENT);
      setAssistantInput("");
      clearAssistantAttachment();
    } catch (chatError) {
      setAssistantError(chatError.message || "Failed to create a new chat.");
    }
  };

  const handleRenameChat = async (chat) => {
    if (!chat?.id) return;
    setChatMenuOpenId("");
    setChatDialog({
      type: "rename",
      chat,
      value: chat.title || "New chat",
    });
  };

  const confirmRenameChat = async () => {
    const chat = chatDialog.chat;
    if (!chat?.id) return;
    const trimmedTitle = String(chatDialog.value || "").trim();
    if (!trimmedTitle) {
      setAssistantError("Chat title cannot be empty.");
      return;
    }

    setAssistantError("");
    try {
      const updatedChat = await apiRequest(`/idea-chats/${chat.id}`, {
        method: "PUT",
        body: { title: trimmedTitle },
      });
      setChats((current) =>
        current.map((item) => (item.id === updatedChat.id ? {
          ...item,
          ...updatedChat,
          latest_draft: normalizeAssistantDraftPayload(updatedChat?.latest_draft),
        } : item))
      );
      setChatDialog({ type: "", chat: null, value: "" });
    } catch (chatError) {
      setAssistantError(chatError.message || "Failed to rename the chat.");
    }
  };

  const handleDeleteChat = async (chat) => {
    if (!chat?.id) return;
    setChatMenuOpenId("");
    setChatDialog({ type: "delete", chat, value: "" });
  };

  const confirmDeleteChat = async () => {
    const chat = chatDialog.chat;
    if (!chat?.id) return;
    setAssistantError("");
    try {
      await apiRequest(`/idea-chats/${chat.id}`, { method: "DELETE" });
      const isDeletingActiveChat = activeChatId === chat.id;
      const nextChatId = chats.find((item) => item.id !== chat.id)?.id || "";
      setChats((current) => current.filter((item) => item.id !== chat.id));
      if (isDeletingActiveChat) {
        setActiveChatId(nextChatId);
        setMessages([]);
        setAssistantDraft(null);
        setAssistantMeta(EMPTY_ASSISTANT_META);
      }
      setChatDialog({ type: "", chat: null, value: "" });
    } catch (chatError) {
      setAssistantError(chatError.message || "Failed to delete the chat.");
    }
  };

  const loadChats = useCallback(async () => {
    if (!project?.id || !assistantIsOpen) return;
    setAssistantChatsLoading(true);
    setAssistantError("");
    try {
      const response = await apiRequest(`/projects/${project.id}/idea-chats`);
      const nextChats = (Array.isArray(response) ? response : []).map((chat) => ({
        ...chat,
        latest_draft: normalizeAssistantDraftPayload(chat?.latest_draft),
      }));
      setChats(nextChats);
      setActiveChatId((current) => {
        if (current && nextChats.some((chat) => chat.id === current)) return current;
        return nextChats[0]?.id || "";
      });
    } catch (chatError) {
      setAssistantError(chatError.message || "Failed to load copilot chats.");
      setChats([]);
      setActiveChatId("");
      setMessages([]);
      setAssistantDraft(null);
      setAssistantMeta(EMPTY_ASSISTANT_META);
    } finally {
      setAssistantChatsLoading(false);
    }
  }, [assistantIsOpen, project?.id]);

  const loadActiveChatMessages = useCallback(async () => {
    if (!activeChatId || !assistantIsOpen) return;
    setAssistantMessagesLoading(true);
    setAssistantError("");
    try {
      const response = await apiRequest(`/idea-chats/${activeChatId}/messages`);
      setMessages(Array.isArray(response?.messages) ? response.messages : []);
      setAssistantDraft(normalizeAssistantDraftPayload(response?.latest_draft));
      setAssistantMeta({
        readiness: response?.readiness || EMPTY_ASSISTANT_META.readiness,
        follow_up_questions: Array.isArray(response?.follow_up_questions)
          ? response.follow_up_questions
          : EMPTY_ASSISTANT_META.follow_up_questions,
      });
      setAssistantMode(response?.mode || ASSISTANT_MODES.IDEA_REFINEMENT);
      if (response?.chat) {
        setChats((current) => {
          const normalizedChat = {
            ...response.chat,
            latest_draft: normalizeAssistantDraftPayload(response.chat?.latest_draft),
          };
          const exists = current.some((chat) => chat.id === normalizedChat.id);
          if (!exists) return [normalizedChat, ...current];
          return current.map((chat) => (chat.id === normalizedChat.id ? { ...chat, ...normalizedChat } : chat));
        });
      }
    } catch (chatError) {
      setAssistantError(chatError.message || "Failed to load chat messages.");
      setMessages([]);
      setAssistantDraft(null);
      setAssistantMeta(EMPTY_ASSISTANT_META);
    } finally {
      setAssistantMessagesLoading(false);
    }
  }, [activeChatId, assistantIsOpen]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    loadActiveChatMessages();
  }, [loadActiveChatMessages]);

  useEffect(() => {
    if (!assistantIsOpen) return;
    assistantEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, assistantLoading, assistantIsOpen]);

  useEffect(() => {
    if (!assistantIsOpen) return;
    assistantInputRef.current?.focus();
  }, [assistantIsOpen, messages.length, activeChatId]);

  useEffect(() => {
    if (!assistantIsOpen || typeof document === "undefined") return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [assistantIsOpen]);

  useEffect(() => {
    if (!workspaceLocked || !isFormOpen) return;
    closeForm();
  }, [workspaceLocked, isFormOpen]);

  useEffect(() => {
    setAssistantInput("");
    clearAssistantAttachment();
    setEditingAssistantMessage({ messageId: "", value: "" });
  }, [activeChatId]);

  useEffect(() => {
    if (!chatMenuOpenId || typeof document === "undefined") return undefined;

    const handleDocumentClick = () => {
      setChatMenuOpenId("");
    };

    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [chatMenuOpenId]);

  const handleSendAssistantMessage = async () => {
    if (!activeChatId) {
      setAssistantError("Create a new chat before starting a conversation.");
      return;
    }
    const trimmedInput = assistantInput.trim();
    if (!trimmedInput && !assistantAttachment?.dataUrl) {
      setAssistantError("Add a message or an attachment before asking the assistant.");
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content:
        trimmedInput ||
        (assistantAttachment?.name
          ? `Please analyze the attached ${assistantAttachment.mimeType?.startsWith("image/") ? "image" : "file"} (${assistantAttachment.name}) and help refine the idea.`
          : "Please help me refine this idea."),
      attachments: assistantAttachment ? [assistantAttachment] : [],
    };
    const tempUserMessage = {
      ...userMessage,
      created_at: new Date().toISOString(),
    };
    const tempUserId = tempUserMessage.id;

    setMessages((current) => [...current, tempUserMessage]);
    setAssistantLoading(true);
    setAssistantError("");
    setNotice("");
    setAssistantInput("");
    try {
      const response = await apiRequest(`/idea-chats/${activeChatId}/messages`, {
        method: "POST",
        body: {
          message: trimmedInput,
          attachment: assistantAttachment || undefined,
          currentDraft: {
            title: form.title,
            domain: form.domain,
            subdomain: form.subdomain,
            description: form.description,
            technologies: parseTechnologies(form.technologies),
            confidence_score: Number(form.confidence_score || 0),
            keywords: parseTechnologies(form.keywords),
          },
        },
      });
      if (!response?.assistant_message?.content && !response?.reply) {
        throw new Error("The assistant did not return a response.");
      }
      setMessages((current) => {
        const withoutTemp = current.filter((message) => message.id !== tempUserId);
        return [
          ...withoutTemp,
          response.user_message || tempUserMessage,
          response.assistant_message || {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: response.reply,
            created_at: new Date().toISOString(),
          },
        ];
      });
      setChats((current) => {
        const nextChat = response.chat || current.find((chat) => chat.id === activeChatId) || null;
        if (!nextChat) return current;
        const withoutActive = current.filter((chat) => chat.id !== nextChat.id);
        return [{
          ...nextChat,
          title: response.title || nextChat.title || null,
          latest_draft: normalizeAssistantDraftPayload(
            response?.mode === ASSISTANT_MODES.IMPLEMENTATION_PLANNING
              ? nextChat?.latest_draft
              : (nextChat?.latest_draft || response?.draft_patch)
          ),
        }, ...withoutActive];
      });
      setAssistantMode(response?.mode || ASSISTANT_MODES.IDEA_REFINEMENT);
      setAssistantDraft(
        response?.mode === ASSISTANT_MODES.IMPLEMENTATION_PLANNING
          ? null
          : normalizeAssistantDraftPayload(response.draft_patch)
      );
      setAssistantMeta({
        readiness: response?.readiness || EMPTY_ASSISTANT_META.readiness,
        follow_up_questions: Array.isArray(response?.follow_up_questions)
          ? response.follow_up_questions
          : EMPTY_ASSISTANT_META.follow_up_questions,
      });
      clearAssistantAttachment();
    } catch (generationError) {
      setMessages((current) => current.filter((message) => message.id !== tempUserId));
      setAssistantError(generationError.message || "Failed to get a response from the assistant.");
    } finally {
      setAssistantLoading(false);
    }
  };

  const latestEditableUserMessageId = useMemo(() => {
    if (!messages.length || assistantLoading) return "";
    const candidate = [...messages].reverse().find((entry) => entry?.role === "user");
    if (!candidate?.id) return "";
    const createdAtMs = new Date(candidate.created_at).getTime();
    if (!Number.isFinite(createdAtMs)) return "";
    if ((Date.now() - createdAtMs) > CHAT_MESSAGE_EDIT_WINDOW_MS) return "";
    return candidate.id;
  }, [assistantLoading, messages]);

  const startEditingAssistantMessage = (message) => {
    if (!message?.id) return;
    setEditingAssistantMessage({
      messageId: message.id,
      value: message.content || "",
    });
    setAssistantError("");
  };

  const cancelEditingAssistantMessage = () => {
    setEditingAssistantMessage({ messageId: "", value: "" });
  };

  const saveEditedAssistantMessage = async (messageId) => {
    const nextContent = editingAssistantMessage.value.trim();
    if (!messageId || messageId !== editingAssistantMessage.messageId) return;
    if (!nextContent) {
      setAssistantError("Edited message cannot be empty.");
      return;
    }

    setAssistantLoading(true);
    setAssistantError("");
    try {
      const response = await apiRequest(`/idea-chats/${activeChatId}/messages/${messageId}`, {
        method: "PUT",
        body: {
          message: nextContent,
          currentDraft: {
            title: form.title,
            domain: form.domain,
            subdomain: form.subdomain,
            description: form.description,
            technologies: parseTechnologies(form.technologies),
            confidence_score: Number(form.confidence_score || 0),
            keywords: parseTechnologies(form.keywords),
          },
        },
      });

      setMessages((current) => {
        const withoutReplacedAssistant = response?.replaced_assistant_message_id
          ? current.filter((entry) => entry.id !== response.replaced_assistant_message_id)
          : [...current];

        return withoutReplacedAssistant.map((entry) => {
          if (entry.id === messageId) {
            return response.user_message || { ...entry, content: nextContent };
          }
          return entry;
        }).concat(response.assistant_message ? [response.assistant_message] : []);
      });
      setChats((current) => {
        const nextChat = response.chat || current.find((chat) => chat.id === activeChatId) || null;
        if (!nextChat) return current;
        const withoutActive = current.filter((chat) => chat.id !== nextChat.id);
        return [{
          ...nextChat,
          title: response.title || nextChat.title || null,
          latest_draft: normalizeAssistantDraftPayload(
            response?.mode === ASSISTANT_MODES.IMPLEMENTATION_PLANNING
              ? nextChat?.latest_draft
              : (nextChat?.latest_draft || response?.draft_patch)
          ),
        }, ...withoutActive];
      });
      setAssistantMode(response?.mode || ASSISTANT_MODES.IDEA_REFINEMENT);
      setAssistantDraft(
        response?.mode === ASSISTANT_MODES.IMPLEMENTATION_PLANNING
          ? null
          : normalizeAssistantDraftPayload(response.draft_patch)
      );
      setAssistantMeta({
        readiness: response?.readiness || EMPTY_ASSISTANT_META.readiness,
        follow_up_questions: Array.isArray(response?.follow_up_questions)
          ? response.follow_up_questions
          : EMPTY_ASSISTANT_META.follow_up_questions,
      });
      cancelEditingAssistantMessage();
    } catch (editError) {
      setAssistantError(editError.message || "Failed to update the message.");
    } finally {
      setAssistantLoading(false);
    }
  };

  const handleAssistantInputKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!assistantLoading) {
        handleSendAssistantMessage();
      }
    }
  };

  const handleFollowUpClick = (question) => {
    setAssistantInput(question);
    setAssistantError("");
    requestAnimationFrame(() => {
      assistantInputRef.current?.focus();
    });
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
        subdomain: form.subdomain.trim(),
        description: form.description.trim(),
        technologies: parseTechnologies(form.technologies),
        confidence_score: Number(form.confidence_score || 0),
        keywords: parseTechnologies(form.keywords),
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

  const visibleAssistantMessages = messages.length ? messages : [STARTER_ASSISTANT_MESSAGE];
  const assistantTimeline = useMemo(
    () => buildChatTimeline(visibleAssistantMessages),
    [visibleAssistantMessages]
  );
  const latestAssistantMessageId = useMemo(
    () => [...visibleAssistantMessages].reverse().find((message) => message.role === "assistant")?.id || null,
    [visibleAssistantMessages]
  );
  const draftPreviewAnchorMessageId = useMemo(() => {
    if (assistantMode === ASSISTANT_MODES.IMPLEMENTATION_PLANNING) return "";
    if (!messages.length || !hasMeaningfulAssistantDraft(assistantDraft)) return "";

    const hasExplicitDraftRequest = messages.some(
      (entry) => entry?.role === "user" && isDraftConfirmationMessage(entry?.content)
    );
    const latestAssistantMessage = [...messages].reverse().find((entry) => entry?.role === "assistant") || null;
    const assistantMentionsDraft = /\bdraft\b/i.test(String(latestAssistantMessage?.content || ""));
    const shouldRevealDraft =
      assistantMeta.readiness === "ready_to_apply"
      || hasExplicitDraftRequest
      || assistantMentionsDraft;

    if (!shouldRevealDraft) return "";

    return latestAssistantMessage?.id || "";
  }, [assistantDraft, assistantMeta.readiness, assistantMode, messages]);

  const floatingAssistantButton = typeof document !== "undefined" && assistantWidgetState === COPILOT_STATES.CLOSED
    ? createPortal(
      <button
        type="button"
        onClick={openAssistant}
        className="fixed bottom-6 right-6 z-[70] flex size-14 items-center justify-center rounded-full text-black shadow-[0_18px_40px_rgba(0,210,196,0.24)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:opacity-95"
        style={{ backgroundColor: "#00D2C4" }}
        aria-label="Open Idea Copilot"
      >
        <span className="material-symbols-outlined text-[24px]">psychology</span>
      </button>,
      document.body
    )
    : null;

  const assistantPortal = typeof document !== "undefined" && assistantWidgetState !== COPILOT_STATES.CLOSED
    ? createPortal(
      <>
        {assistantIsMinimized ? (
          <button
            type="button"
            onClick={openAssistant}
            className="fixed bottom-6 right-6 z-[80] inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/95 px-4 py-3 text-sm font-black text-slate-800 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur transition-all duration-300 ease-out hover:-translate-y-0.5"
          >
            <span className="relative inline-flex">
              <span className="inline-flex size-2 rounded-full bg-teal-400" aria-hidden="true" />
              <span className="absolute inset-0 animate-ping rounded-full bg-teal-300/70" aria-hidden="true" />
            </span>
            Idea Copilot
            <span className="material-symbols-outlined text-[18px] text-slate-500">expand_less</span>
          </button>
        ) : null}

        {assistantIsOpen ? (
          <div
            className="fixed inset-0 z-[75] bg-black/30 opacity-100 backdrop-blur-sm transition-opacity duration-300 ease-out"
            onClick={closeAssistant}
            aria-hidden="true"
          />
        ) : null}

        <div
          className={`fixed bottom-6 right-4 z-[80] flex ${assistantExpanded ? "h-[84vh] max-h-[860px] max-w-[920px]" : "h-[76vh] max-h-[760px] max-w-[520px]"} w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[32px] border border-white/30 bg-gradient-to-b from-white via-slate-50/95 to-slate-100/90 shadow-[0_25px_80px_rgba(15,23,42,0.18)] transition-all duration-300 ease-out sm:right-6 ${
            assistantIsOpen
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none translate-y-6 opacity-0"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-slate-200/70 bg-white/70 px-4 py-3 backdrop-blur-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={toggleAssistantSidebar}
                    className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 transition duration-200 hover:scale-[1.03] hover:bg-white hover:text-slate-700"
                    aria-label={assistantSidebarHidden ? "Show chat history" : "Hide chat history"}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {assistantSidebarHidden ? "left_panel_open" : "left_panel_close"}
                    </span>
                  </button>
                  <span className="relative inline-flex">
                    <span className="inline-flex size-2.5 rounded-full bg-teal-400" aria-hidden="true" />
                    <span className="absolute inset-0 animate-ping rounded-full bg-teal-300/70" aria-hidden="true" />
                  </span>
                  <p className="text-base font-black tracking-tight text-slate-950">Idea Copilot</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {assistantCanApply ? (
                  <button
                    type="button"
                    onClick={() => applyAssistantSuggestion("all")}
                    className="inline-flex items-center gap-1 rounded-full bg-teal-500 px-3.5 py-2 text-xs font-black text-white shadow-[0_8px_20px_rgba(20,184,166,0.18)] transition duration-200 hover:scale-[1.02] hover:bg-teal-600"
                  >
                    <span className="material-symbols-outlined text-[15px]">upload</span>
                    Apply
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={toggleAssistantExpanded}
                  className="rounded-full border border-slate-200/80 bg-white/90 p-2 text-slate-500 transition duration-200 hover:scale-[1.03] hover:bg-white hover:text-slate-700"
                  aria-label={assistantExpanded ? "Collapse Idea Copilot" : "Expand Idea Copilot"}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {assistantExpanded ? "close_fullscreen" : "open_in_full"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={minimizeAssistant}
                  className="rounded-full border border-slate-200/80 bg-white/90 p-2 text-slate-500 transition duration-200 hover:scale-[1.03] hover:bg-white hover:text-slate-700"
                  aria-label="Minimize Idea Copilot"
                >
                  <span className="material-symbols-outlined text-[18px]">remove</span>
                </button>
                <button
                  type="button"
                  onClick={closeAssistant}
                  className="rounded-full border border-slate-200/80 bg-white/90 p-2 text-slate-500 transition duration-200 hover:scale-[1.03] hover:bg-white hover:text-slate-700"
                  aria-label="Close Idea Copilot"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <aside
              className={`flex shrink-0 flex-col bg-slate-50/75 backdrop-blur-sm transition-all duration-300 ease-out ${
                assistantSidebarHidden
                  ? "w-0 overflow-hidden border-r-0 opacity-0"
                  : "w-[180px] border-r border-slate-200/60 opacity-100"
              }`}
            >
              <div className="p-3">
                <button
                  type="button"
                  onClick={handleCreateChat}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-3 py-2.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(20,184,166,0.15)] transition duration-200 hover:scale-[1.01] hover:bg-teal-600"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  New Chat
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {assistantError && !activeChat ? (
                  <div className="mb-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    {assistantError}
                  </div>
                ) : null}

                {assistantChatsLoading ? (
                  <div className="px-2 py-4 text-xs text-slate-500">Loading chats...</div>
                ) : chats.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-3 py-5 text-center">
                    <p className="text-sm font-black text-slate-800">No chats yet</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      Start a new thread for each idea direction.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {chats.map((chat) => {
                      const isActive = chat.id === activeChatId;
                      return (
                        <div
                          key={chat.id}
                          className={`group rounded-xl border px-3 py-2.5 transition duration-200 ${
                            isActive
                              ? "border-teal-200/80 bg-teal-50/60 shadow-[0_8px_18px_rgba(20,184,166,0.08)]"
                              : "border-transparent bg-white/60 hover:border-slate-200/80 hover:bg-white/90"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveChatId(chat.id)}
                              className="min-w-0 flex-1 text-left"
                              title={chat.title || "New chat"}
                            >
                              <>
                                <p className="truncate text-[13px] font-semibold text-slate-800">
                                  {chat.title || "New chat"}
                                </p>
                                <p className="mt-1 text-[10px] font-medium text-slate-400">
                                  {formatChatListTime(chat.updated_at || chat.created_at)}
                                </p>
                              </>
                            </button>
                            <div className="relative shrink-0">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setChatMenuOpenId((current) => (current === chat.id ? "" : chat.id));
                                }}
                                className="rounded-lg p-1.5 text-slate-400 opacity-0 transition duration-200 hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 group-focus-within:opacity-100"
                                aria-label={`More options for ${chat.title || "chat"}`}
                              >
                                <span className="material-symbols-outlined text-[16px]">more_horiz</span>
                              </button>

                              {chatMenuOpenId === chat.id ? (
                                <div
                                  className="absolute right-0 top-9 z-10 w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleRenameChat(chat)}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 transition duration-200 hover:bg-slate-50"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">edit</span>
                                    Rename
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteChat(chat)}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 transition duration-200 hover:bg-rose-50"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">delete</span>
                                    Delete
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto px-5 py-5">
                {!activeChat ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="max-w-[260px] rounded-3xl border border-white/70 bg-white/75 px-6 py-7 text-center shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                      <p className="text-base font-black text-slate-900">Start a new chat</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-500">
                        Explore different angles, then apply the strongest draft to your workspace.
                      </p>
                    </div>
                  </div>
                ) : assistantMessagesLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="rounded-2xl border border-white/80 bg-white/90 px-5 py-4 text-sm text-slate-500 shadow-sm">
                      Loading messages...
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assistantError ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {assistantError}
                      </div>
                    ) : null}

                    {assistantTimeline.map((entry) => {
                      if (entry.type === "divider") {
                        return (
                          <div key={entry.id} className="flex items-center gap-3 py-1">
                            <div className="h-px flex-1 bg-slate-200/80" />
                            <span className="rounded-full border border-white/70 bg-white/85 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 shadow-sm">
                              {entry.label}
                            </span>
                            <div className="h-px flex-1 bg-slate-200/80" />
                          </div>
                        );
                      }

                      const isAssistant = entry.role === "assistant";
                      const showContextualApply = isAssistant && assistantCanApply && latestAssistantMessageId === entry.id;
                      const canEditMessage = !isAssistant && entry.id === latestEditableUserMessageId;
                      const isEditingMessage = editingAssistantMessage.messageId === entry.id;

                      return (
                        <div key={entry.id} className="space-y-3">
                          <div
                            className={`group/message flex gap-3 transition-opacity duration-200 ${isAssistant ? "justify-start" : "justify-end"}`}
                          >
                            {isAssistant ? <CopilotAvatar role="assistant" /> : null}
                            <div className={`max-w-[84%] ${isAssistant ? "" : "order-first"}`}>
                              <div
                                className={`group relative rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                                  isAssistant
                                    ? "border border-slate-200/80 bg-slate-50/90 text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
                                    : "text-slate-950"
                                }`}
                                style={isAssistant ? undefined : { backgroundColor: "rgba(0,210,196,0.18)" }}
                              >
                                {isEditingMessage ? (
                                  <div className="space-y-3">
                                    <textarea
                                      value={editingAssistantMessage.value}
                                      onChange={(event) => setEditingAssistantMessage((current) => ({ ...current, value: event.target.value }))}
                                      rows={4}
                                      className="w-full resize-none rounded-2xl border border-white/70 bg-white/65 px-3 py-2.5 text-sm leading-relaxed text-slate-900 outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-500/10"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={cancelEditingAssistantMessage}
                                        className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white"
                                        disabled={assistantLoading}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => saveEditedAssistantMessage(entry.id)}
                                        className="rounded-full bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
                                        disabled={assistantLoading}
                                      >
                                        Send again
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="whitespace-pre-wrap">{entry.content}</p>
                                )}
                                {Array.isArray(entry.attachments) && entry.attachments.length > 0 ? (
                                  <div className="space-y-2">
                                    {entry.attachments.map((attachment, index) => (
                                      <MessageAttachmentPreview
                                        key={`${entry.id}-attachment-${index}`}
                                        attachment={attachment}
                                      />
                                    ))}
                                  </div>
                                ) : null}

                                {showContextualApply ? (
                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    {assistantMode !== ASSISTANT_MODES.IMPLEMENTATION_PLANNING && assistantMeta.readiness === "ready_to_apply" ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                                        <span className="material-symbols-outlined text-[14px]">task_alt</span>
                                        Ready to apply
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                              <div className={`mt-1 flex items-center gap-2 px-1 text-[11px] text-slate-400 ${isAssistant ? "justify-start" : "justify-end"}`}>
                                {canEditMessage && !isEditingMessage ? (
                                  <button
                                    type="button"
                                    onClick={() => startEditingAssistantMessage(entry)}
                                    className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-[11px] font-semibold text-slate-500 opacity-0 transition duration-200 group-hover/message:opacity-100 group-focus-within/message:opacity-100 hover:border-slate-200 hover:bg-white/80 hover:text-slate-700"
                                    aria-label="Edit message"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">edit</span>
                                    Edit
                                  </button>
                                ) : null}
                                <span>{formatMessageTime(entry.created_at)}</span>
                              </div>
                            </div>
                            {!isAssistant ? <CopilotAvatar role="user" /> : null}
                          </div>

                          {isAssistant && entry.id === draftPreviewAnchorMessageId ? (
                            <div className="flex gap-3 justify-start">
                              <CopilotAvatar role="assistant" />
                              <div className="max-w-[84%]">
                                <AssistantDraftPreview
                                  draft={assistantDraft}
                                  readiness={assistantMeta.readiness}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {assistantLoading ? (
                      <div className="flex items-end gap-3">
                        <CopilotAvatar role="assistant" />
                        <TypingIndicator />
                      </div>
                    ) : null}

                    {!assistantLoading && assistantMeta.follow_up_questions.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pl-11">
                        {assistantMeta.follow_up_questions.map((question) => (
                          <button
                            key={question}
                            type="button"
                            onClick={() => handleFollowUpClick(question)}
                            className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-600 transition duration-200 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <div ref={assistantEndRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200/60 bg-transparent px-5 py-3">
                <div className="flex flex-col gap-3">
                  {assistantAttachment ? (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/45 px-3.5 py-2.5 shadow-sm backdrop-blur-sm">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{assistantAttachment.name}</p>
                        <p className="text-xs text-slate-500">
                          This {assistantAttachment.mimeType?.startsWith("image/") ? "image" : "file"} will be included with your next message.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={clearAssistantAttachment}
                        className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 transition duration-200 hover:bg-rose-50 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}

                  <div className="rounded-full border border-white/70 bg-white/45 px-3 py-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-md transition duration-200 focus-within:border-teal-300 focus-within:ring-4 focus-within:ring-teal-500/10">
                    <div className="flex items-end gap-2">
                      <label className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition duration-200 hover:bg-white hover:text-slate-700">
                        <span className="material-symbols-outlined text-[18px]">attach_file</span>
                        <input type="file" accept="image/*,.pdf,.txt,.md,.csv,.json" className="hidden" onChange={handleAssistantAttachmentChange} />
                      </label>

                      <textarea
                        ref={assistantInputRef}
                        rows={1}
                        value={assistantInput}
                        onChange={(event) => setAssistantInput(event.target.value)}
                        onKeyDown={handleAssistantInputKeyDown}
                        className="max-h-24 min-h-[38px] flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
                        placeholder={activeChat ? "Describe your idea..." : "Create or select a chat first..."}
                        disabled={!activeChat || assistantLoading}
                      />

                      <button
                        type="button"
                        onClick={handleSendAssistantMessage}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-500 text-white shadow-[0_10px_24px_rgba(20,184,166,0.18)] transition duration-200 hover:scale-[1.03] hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!activeChat || assistantLoading}
                      >
                        <span className="material-symbols-outlined text-[17px]">send</span>
                      </button>
                    </div>
                  </div>

                  <p className="px-1 text-[11px] text-slate-400">
                  
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>,
      document.body
    )
    : null;

  return (
    <>
      <Modal
        isOpen={chatDialog.type === "rename"}
        onClose={() => setChatDialog({ type: "", chat: null, value: "" })}
        title="Rename chat"
        maxWidth="max-w-md"
        zIndexClass="z-[120]"
      >
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              Chat title
            </label>
            <input
              value={chatDialog.value}
              onChange={(event) => setChatDialog((current) => ({ ...current, value: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/15"
              placeholder="Enter a chat title"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setChatDialog({ type: "", chat: null, value: "" })}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmRenameChat}
              className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={chatDialog.type === "delete"}
        onClose={() => setChatDialog({ type: "", chat: null, value: "" })}
        title="Delete chat"
        maxWidth="max-w-md"
        zIndexClass="z-[120]"
      >
        <div className="space-y-4 p-6">
          <p className="text-sm leading-relaxed text-slate-600">
            Delete <span className="font-semibold text-slate-900">{chatDialog.chat?.title || "this chat"}</span>?
            This will remove its messages from the copilot history.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setChatDialog({ type: "", chat: null, value: "" })}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteChat}
              className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

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
                disabled={workspaceLocked}
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
                        <p className="text-xs text-slate-500 mt-1">
                          Version {idea.version_no} - {idea.domain || "General"}
                          {idea.subdomain ? ` / ${idea.subdomain}` : ""} - {formatDateTime(idea.created_at)}
                        </p>
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
                {workspaceLocked ? (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    Idea submission is locked after approval. It will reopen only if the approved idea is later rejected during review.
                  </p>
                ) : null}
              </div>
              {selectedIdea && !workspaceLocked && EDITABLE_STATUSES.has(String(selectedIdea.status).toLowerCase()) ? (
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
                  
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Subdomain</label>
                  <input
                    value={form.subdomain}
                    onChange={(event) => setForm((prev) => ({ ...prev, subdomain: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    placeholder="Computer Vision / EdTech / Queue Analytics"
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
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Keywords</label>
                  <input
                    value={form.keywords}
                    onChange={(event) => setForm((prev) => ({ ...prev, keywords: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    placeholder="automation, student productivity, task prioritisation"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Use short tags separated by commas.
                  </p>
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
                  {selectedIdea.subdomain ? (
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {selectedIdea.subdomain}
                    </p>
                  ) : null}
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
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Subdomain</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {selectedIdea.subdomain || "Not specified"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Keywords</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(selectedIdea.keywords || []).length > 0 ? (
                      selectedIdea.keywords.map((item) => (
                        <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
                          {item}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No keywords added.</p>
                    )}
                  </div>
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

                {!workspaceLocked && EDITABLE_STATUSES.has(String(selectedIdea.status).toLowerCase()) ? (
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
                ) : workspaceLocked ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    This idea section is locked because an idea has already been approved. You can continue using the copilot, but editing or resubmitting ideas will reopen only if the approved idea is later rejected during review.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      </div>
      {floatingAssistantButton}
      {assistantPortal}
    </>
  );
}




