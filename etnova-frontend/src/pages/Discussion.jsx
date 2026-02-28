import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import supabase from "../config/supabaseClient";
import { apiRequest } from "../config/apiClient";

/* ── Topics ───────────────────────────────────────────────────────────── */
const TOPICS = [
  { id: "General", icon: "chat_bubble", color: "#00C4B4" },
  { id: "Architecture", icon: "architecture", color: "#6366F1" },
  { id: "Documentation", icon: "description", color: "#f59e0b" },
  { id: "Submission Planning", icon: "event_note", color: "#10b981" },
  { id: "Presentation", icon: "slideshow", color: "#ec4899" },
];

const READS_STORAGE_PREFIX = "etnova_discussion_reads";

/* ── Helpers ───────────────────────────────────────────────────────────── */
function fmtDay(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
    new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name = "U") {
  return (name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
function avatarColor(name = "U") {
  const palette = ["#00897B", "#6366F1", "#d97706", "#059669", "#db2777", "#2563eb", "#7c3aed", "#dc2626"];
  return palette[(name.charCodeAt(0) || 0) % palette.length];
}

function toMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function Avatar({ name, size = 32 }) {
  const bg = avatarColor(name);
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 select-none"
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.38 }}>
      {initials(name)}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function Discussion() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [topic, setTopic] = useState(TOPICS[0].id);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null); // full message object
  const [sending, setSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [readByTopic, setReadByTopic] = useState({});
  const [onlineUserIds, setOnlineUserIds] = useState({});

  const channelRef = useRef(null);
  const typingTimeout = useRef(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);

  const getReadsStorageKey = useCallback((projectId, userId) => {
    return `${READS_STORAGE_PREFIX}:${projectId || "none"}:${userId || "none"}`;
  }, []);

  const loadLocalReads = useCallback((projectId, userId) => {
    try {
      const storageKey = getReadsStorageKey(projectId, userId);
      const raw = localStorage.getItem(storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }, [getReadsStorageKey]);

  const persistLocalReads = useCallback((map, projectId, userId) => {
    try {
      const storageKey = getReadsStorageKey(projectId, userId);
      localStorage.setItem(storageKey, JSON.stringify(map));
    } catch {
      // best-effort only
    }
  }, [getReadsStorageKey]);

  const loadReadState = useCallback(async (projectId, userId) => {
    const local = loadLocalReads(projectId, userId);
    setReadByTopic(local);

    try {
      const { data, error: readErr } = await supabase
        .from("discussion_reads")
        .select("topic, last_seen_at")
        .eq("project_id", projectId)
        .eq("user_id", userId);
      if (readErr) throw readErr;

      const fromDb = {};
      (data || []).forEach((r) => {
        if (r.topic) fromDb[r.topic] = r.last_seen_at;
      });

      const merged = {};
      const allTopics = new Set([...Object.keys(local), ...Object.keys(fromDb)]);
      allTopics.forEach((topicId) => {
        const localSeen = local[topicId];
        const dbSeen = fromDb[topicId];
        merged[topicId] = toMs(localSeen) >= toMs(dbSeen) ? localSeen : dbSeen;
      });
      setReadByTopic(merged);
      persistLocalReads(merged, projectId, userId);
    } catch {
      // fallback to local-only reads if table is not available yet
    }
  }, [loadLocalReads, persistLocalReads]);

  const markTopicRead = useCallback(async (topicId, seenAtIso) => {
    if (!project?.id || !profile?.id || !topicId || !seenAtIso) return;

    setReadByTopic((prev) => {
      const prevMs = toMs(prev[topicId]);
      const nextMs = toMs(seenAtIso);
      if (nextMs <= prevMs) return prev;
      const next = { ...prev, [topicId]: seenAtIso };
      persistLocalReads(next, project.id, profile.id);
      return next;
    });

    try {
      const { error: upsertErr } = await supabase
        .from("discussion_reads")
        .upsert(
          {
            project_id: project.id,
            user_id: profile.id,
            topic: topicId,
            last_seen_at: seenAtIso,
          },
          { onConflict: "project_id,user_id,topic" }
        );
      if (upsertErr) throw upsertErr;
    } catch {
      // local state already updated; DB persistence is best-effort
    }
  }, [persistLocalReads, profile?.id, project?.id]);

  /* ── Derived ── */
  const participants = useMemo(() => {
    if (!project) return [];
    const team = (project.team_members || []).map(m => ({
      id: m.student_id,
      name: m.profiles?.full_name || "Team Member",
      role: m.role === "leader" ? "Leader" : "Member",
    }));
    const extras = [];
    if (project.mentor) extras.push({ id: project.mentor.id, name: project.mentor.full_name, role: "Mentor" });
    if (project.coordinator) extras.push({ id: project.coordinator.id, name: project.coordinator.full_name, role: "Coordinator" });
    const seen = new Set();
    return [...team, ...extras].filter(p => p.id && !seen.has(p.id) && seen.add(p.id));
  }, [project]);

  const participantMap = useMemo(() => {
    const m = {};
    participants.forEach(p => { m[p.id] = p; });
    return m;
  }, [participants]);

  const visibleMessages = useMemo(() =>
    messages.filter(m => m.topic === topic), [messages, topic]);

  const msgMap = useMemo(() => {
    const m = {};
    messages.forEach(msg => { m[msg.id] = msg; });
    return m;
  }, [messages]);

  const unreadByTopic = useMemo(() => {
    const map = {};
    TOPICS.forEach((t) => {
      const seenAt = readByTopic[t.id];
      const seenMs = toMs(seenAt);
      map[t.id] = messages.filter((m) =>
        m.topic === t.id &&
        m.sender_id !== profile?.id &&
        toMs(m.created_at) > seenMs
      ).length;
    });
    return map;
  }, [messages, profile?.id, readByTopic]);

  const syncOnlinePresence = useCallback((channel) => {
    if (!channel) return;
    const state = channel.presenceState?.() || {};
    const next = {};

    Object.values(state).forEach((entries) => {
      (entries || []).forEach((entry) => {
        const userId = entry?.userId || entry?.user_id || entry?.id;
        if (userId) next[userId] = true;
      });
    });

    setOnlineUserIds(next);
  }, []);

  /* ── Load messages ── */
  const loadMessages = useCallback(async (projectId) => {
    const { data, error: e } = await supabase
      .from("discussion_messages")
      .select("id, project_id, sender_id, topic, message, reply_to, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (e) throw e;
    setMessages(data || []);
  }, []);

  /* ── Init ── */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError("");
      try {
        const [p, projects] = await Promise.all([apiRequest("/profile"), apiRequest("/projects")]);
        if (!mounted) return;
        setProfile(p);
        const cur = projects?.[0];
        if (!cur?.id) return;
        const detail = await apiRequest(`/projects/${cur.id}`);
        if (!mounted) return;
        setProject(detail);
        await loadMessages(detail.id);
        await loadReadState(detail.id, p.id);

        const channel = supabase
          .channel(`discussion-${detail.id}`, {
            config: { presence: { key: p.id } },
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "discussion_messages", filter: `project_id=eq.${detail.id}` },
            () => loadMessages(detail.id))
          .on("presence", { event: "sync" }, () => syncOnlinePresence(channel))
          .on("broadcast", { event: "typing" }, ({ payload }) => {
            if (!payload || payload.userId === p.id) return;
            setTypingUsers(prev => {
              const next = { ...prev };
              if (payload.isTyping) next[payload.userId] = payload.userName;
              else delete next[payload.userId];
              return next;
            });
          });

        channel.subscribe(async (status) => {
          if (status !== "SUBSCRIBED") return;
          await channel.track({
            userId: p.id,
            userName: p.full_name || p.email || "Participant",
            activePage: "discussion",
            onlineAt: new Date().toISOString(),
          });
          syncOnlinePresence(channel);
        });
        channelRef.current = channel;
      } catch (e) {
        if (mounted) setError(e.message || "Failed to load chat.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      if (channelRef.current) {
        channelRef.current.untrack?.();
        supabase.removeChannel(channelRef.current);
      }
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      setOnlineUserIds({});
    };
  }, [loadMessages, loadReadState, syncOnlinePresence]);

  /* ── Auto-scroll ── */
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [visibleMessages]);

  /* ── Mark active topic as seen ── */
  useEffect(() => {
    if (!project?.id || !profile?.id) return;
    if (!visibleMessages.length) return;
    const latest = visibleMessages[visibleMessages.length - 1];
    if (!latest) return;
    if (toMs(latest.created_at) <= toMs(readByTopic[topic])) return;
    markTopicRead(topic, latest.created_at);
  }, [markTopicRead, profile?.id, project?.id, readByTopic, topic, visibleMessages]);

  /* ── Typing ── */
  const sendTyping = (isTyping) => {
    channelRef.current?.send({
      type: "broadcast", event: "typing",
      payload: { userId: profile?.id, userName: profile?.full_name || "Participant", topic, isTyping }
    });
  };
  const handleTextChange = (val) => {
    setText(val);
    sendTyping(val.trim().length > 0);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTyping(false), 1500);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 128) + "px"; }
  };

  /* ── Send ── */
  const postMessage = async () => {
    if (!text.trim() || !profile || !project?.id || sending) return;
    const content = text.trim();
    setText(""); setReplyTo(null); sendTyping(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    try {
      const { data: ins, error: e } = await supabase
        .from("discussion_messages")
        .insert({ project_id: project.id, sender_id: profile.id, topic, message: content, reply_to: replyTo?.id || null })
        .select("id, project_id, sender_id, topic, message, reply_to, created_at")
        .single();
      if (e) throw e;
      setMessages(prev => prev.some(m => m.id === ins.id) ? prev : [...prev, ins]);
    } catch (e) {
      setError(e.message || "Failed to send.");
      setText(content); // restore on fail
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (msg) => {
    if (!msg?.id || !profile?.id || !project?.id) return;
    if (msg.sender_id !== profile.id) return;

    const ok = window.confirm("Delete this message?");
    if (!ok) return;

    const deletedId = msg.id;
    setDeletingMessageId(deletedId);
    setMessages((prev) => prev.filter((m) => m.id !== deletedId));
    setReplyTo((prev) => (prev?.id === deletedId ? null : prev));

    try {
      const { error: delErr } = await supabase
        .from("discussion_messages")
        .delete()
        .eq("id", deletedId)
        .eq("sender_id", profile.id);
      if (delErr) throw delErr;
    } catch (e) {
      setError(e.message || "Failed to delete message.");
      await loadMessages(project.id);
    } finally {
      setDeletingMessageId(null);
    }
  };

  /* ── States ── */
  const currentTopic = TOPICS.find(t => t.id === topic) || TOPICS[0];
  const typingList = Object.values(typingUsers);

  if (loading) return (
    <div className="etnova-bg min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="size-12 border-4 border-white/30 border-t-[#00C4B4] rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-slate-600 text-sm font-semibold">Loading chat...</p>
      </div>
    </div>
  );
  if (!project) return (
    <div className="etnova-bg min-h-screen flex items-center justify-center text-slate-500 text-sm">No project found.</div>
  );

  /* ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="h-full etnova-bg p-3 md:p-4">
      <div className="h-full flex overflow-hidden rounded-3xl border border-white/75 shadow-[0_20px_60px_rgba(15,23,42,0.10)] bg-white/35 backdrop-blur-[6px]">

      {/* ─────────────── LEFT SIDEBAR ─────────────── */}
      <div className="w-[300px] flex-shrink-0 flex flex-col glass-sidebar border-r border-white/70 overflow-hidden">

        {/* Project name */}
        <div className="px-5 py-4 border-b border-white/70"
          style={{ background: "linear-gradient(135deg,rgba(0,196,180,0.13) 0%,rgba(99,102,241,0.08) 100%)" }}>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Team Discussion</p>
          <h2 className="text-sm font-black text-slate-900 mt-1 truncate">{project.title}</h2>
          <p className="text-[11px] text-slate-500 mt-1">{participants.length} participants</p>
        </div>

        {/* Topics */}
        <div className="px-3 py-3 border-b border-white/70">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 px-2 mb-2">Channels</p>
          <div className="space-y-1">
            {TOPICS.map(t => {
              const active = topic === t.id;
              const unread = active ? 0 : (unreadByTopic[t.id] || 0);
              return (
                <button key={t.id} onClick={() => setTopic(t.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-all duration-150 ${active ? "font-bold text-slate-900" : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
                    }`}
                  style={active ? {
                    background: `linear-gradient(135deg, ${t.color}22 0%, ${t.color}0A 100%)`,
                    border: `1px solid ${t.color}30`,
                    boxShadow: `0 4px 14px ${t.color}20`,
                  } : {}}>
                  <span className="material-symbols-outlined text-[18px] flex-shrink-0"
                    style={{ color: active ? t.color : "#94a3b8" }}>{t.icon}</span>
                  <span className="flex-1 truncate text-xs">{t.id}</span>
                  {unread > 0 && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full text-white flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: t.color, minWidth: 18, textAlign: "center" }}>{unread}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Participants */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 px-2 mb-2">
            Members · {participants.length}
          </p>
          <div className="space-y-1">
            {participants.map(p => (
              <div key={p.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/55 transition-all border border-transparent hover:border-white/50">
                <div className="relative flex-shrink-0">
                  <Avatar name={p.name} size={30} />
                  {onlineUserIds[p.id] && (
                    <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-400 ring-1 ring-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                  <p className="text-[10px] text-slate-400">{p.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────── CHAT PANEL ─────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white/35">

        {/* Chat header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-white/70"
          style={{ background: "rgba(255,255,255,0.90)", backdropFilter: "blur(20px)" }}>
          <div className="size-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${currentTopic.color}15` }}>
            <span className="material-symbols-outlined text-[20px]" style={{ color: currentTopic.color }}>{currentTopic.icon}</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-slate-900 leading-none">{topic}</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">{participants.length} participants · {visibleMessages.length} messages</p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-100 flex items-center gap-2 text-sm text-rose-700">
            <span className="material-symbols-outlined text-[16px]">error</span>{error}
            <button onClick={() => setError("")} className="ml-auto"><span className="material-symbols-outlined text-sm">close</span></button>
          </div>
        )}

        {/* ── Messages area ── */}
        <div className="flex-1 overflow-y-auto"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 90% 60% at 0% 0%,   rgba(0,196,180,0.07) 0%, transparent 55%),
              radial-gradient(ellipse 70% 50% at 100% 100%, rgba(99,102,241,0.06) 0%, transparent 50%),
              url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='30' cy='30' r='1' fill='%23cbd5e1' fill-opacity='0.35'/%3E%3C/svg%3E")
            `,
            backgroundColor: "#eef2f7",
          }}>

          {/* Inner wrapper: min-h-full + justify-end pins messages to bottom */}
          <div className="min-h-full flex flex-col justify-end py-4">

            {visibleMessages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center select-none py-12">
                <div className="size-16 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${currentTopic.color}12`, border: `1.5px dashed ${currentTopic.color}40` }}>
                  <span className="material-symbols-outlined text-3xl" style={{ color: `${currentTopic.color}90` }}>{currentTopic.icon}</span>
                </div>
                <p className="text-sm font-bold text-slate-600">No messages in #{topic}</p>
                <p className="text-xs text-slate-400">Say something to get started!</p>
              </div>
            ) : (
              <div className="space-y-0.5 w-full px-3 md:px-4">
                {visibleMessages.map((msg, idx) => {
                  const mine = msg.sender_id === profile?.id;
                  const sender = participantMap[msg.sender_id];
                  const prev = visibleMessages[idx - 1];
                  const next = visibleMessages[idx + 1];
                  const newDay = !prev || fmtDay(prev.created_at) !== fmtDay(msg.created_at);
                  const samePrev = !newDay && prev?.sender_id === msg.sender_id;
                  const sameNext = next?.sender_id === msg.sender_id && fmtDay(next.created_at) === fmtDay(msg.created_at);
                  const isFirst = !samePrev; // first in sender-group
                  const isLast = !sameNext; // last in sender-group
                  const quotedMsg = msg.reply_to ? msgMap[msg.reply_to] : null;
                  const quotedSender = quotedMsg ? participantMap[quotedMsg.sender_id] : null;

                  return (
                    <div key={msg.id}>
                      {/* Day divider */}
                      {newDay && (
                        <div className="flex items-center gap-3 my-5">
                          <div className="flex-1 h-px" style={{ backgroundColor: "rgba(148,163,184,0.3)" }} />
                          <span className="px-3 py-1 rounded-full text-[11px] font-semibold text-slate-500 select-none"
                            style={{ backgroundColor: "rgba(255,255,255,0.75)", border: "1px solid rgba(226,232,240,0.6)" }}>
                            {fmtDay(msg.created_at)}
                          </span>
                          <div className="flex-1 h-px" style={{ backgroundColor: "rgba(148,163,184,0.3)" }} />
                        </div>
                      )}

                      {/* Message row */}
                      <div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"} ${!isFirst ? "mt-0.5" : "mt-3"}`}>

                        {/* Avatar (other, only on last bubble of group) */}
                        {!mine && (
                          <div className="w-8 flex-shrink-0 flex items-end">
                            {isLast ? <Avatar name={sender?.name} size={28} /> : <div className="w-7" />}
                          </div>
                        )}

                        <div className={`flex flex-col gap-0.5 max-w-[68%] ${mine ? "items-end" : "items-start"}`}>

                          {/* Sender name (other, first bubble only) */}
                          {!mine && isFirst && (
                            <p className="text-[11px] font-black ml-3 select-none"
                              style={{ color: avatarColor(sender?.name || "U") }}>
                              {sender?.name || "Participant"}
                              <span className="ml-1 font-medium" style={{ color: "#94a3b8" }}>· {sender?.role}</span>
                            </p>
                          )}

                          {/* Bubble */}
                          <div className="group relative">
                            <div
                              className="px-3.5 py-2.5 text-sm leading-relaxed relative"
                              style={{
                                ...(mine ? {
                                  background: "linear-gradient(130deg, #14B8A6 0%, #0F766E 100%)",
                                  color: "#ffffff",
                                  borderRadius: isFirst && isLast ? "18px 4px 18px 18px"
                                    : isFirst ? "18px 4px 14px 18px"
                                      : isLast ? "18px 4px 18px 18px"
                                        : "18px 4px 14px 18px",
                                  boxShadow: "0 1px 8px rgba(20,184,166,0.30), 0 1px 2px rgba(0,0,0,0.06)",
                                } : {
                                  background: "rgba(255,255,255,0.96)",
                                  color: "#1e293b",
                                  border: "1px solid rgba(226,232,240,0.7)",
                                  borderRadius: isFirst && isLast ? "4px 18px 18px 18px"
                                    : isFirst ? "4px 18px 14px 18px"
                                      : isLast ? "4px 18px 18px 18px"
                                        : "4px 18px 14px 18px",
                                  boxShadow: "0 1px 4px rgba(15,23,42,0.07)",
                                }),
                              }}
                            >
                              {/* Quote block */}
                              {quotedMsg && (
                                <div className="mb-2 pl-2.5 py-1.5 pr-2 rounded-lg text-xs leading-snug"
                                  style={{
                                    borderLeft: `3px solid ${mine ? "rgba(255,255,255,0.5)" : currentTopic.color}`,
                                    backgroundColor: mine ? "rgba(255,255,255,0.15)" : `${currentTopic.color}0D`,
                                  }}>
                                  <p className="font-bold mb-0.5 truncate"
                                    style={{ color: mine ? "rgba(255,255,255,0.85)" : currentTopic.color }}>
                                    {quotedSender?.name || "Participant"}
                                  </p>
                                  <p className="truncate" style={{ color: mine ? "rgba(255,255,255,0.75)" : "#64748b" }}>
                                    {quotedMsg.message}
                                  </p>
                                </div>
                              )}

                              {/* Message text */}
                              <p className="whitespace-pre-wrap break-words">{msg.message}</p>

                              {/* Timestamp + tick */}
                              <div className={`flex items-center gap-1 mt-1 ${mine ? "justify-end" : "justify-end"}`}>
                                <span className="text-[10px] select-none" style={{ color: mine ? "rgba(255,255,255,0.65)" : "#94a3b8" }}>
                                  {fmtTime(msg.created_at)}
                                </span>
                                {mine && (
                                  <span className="material-symbols-outlined select-none" style={{ fontSize: 12, color: "rgba(255,255,255,0.70)" }}>done_all</span>
                                )}
                              </div>
                            </div>

                            {/* Message actions on hover */}
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 ${mine ? "-left-8" : "-right-8"} opacity-0 group-hover:opacity-100 transition-all flex flex-col gap-1`}
                            >
                              <button
                                onClick={() => setReplyTo(msg)}
                                title="Reply"
                                className="size-6 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: "rgba(255,255,255,0.90)", border: "1px solid #e2e8f0", color: "#64748b", boxShadow: "0 1px 4px rgba(0,0,0,0.10)" }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>reply</span>
                              </button>

                              {mine && (
                                <button
                                  onClick={() => deleteMessage(msg)}
                                  title={deletingMessageId === msg.id ? "Deleting..." : "Delete message"}
                                  disabled={deletingMessageId === msg.id}
                                  className="size-6 rounded-full flex items-center justify-center disabled:opacity-60"
                                  style={{ backgroundColor: "rgba(255,245,245,0.95)", border: "1px solid #fecaca", color: "#ef4444", boxShadow: "0 1px 4px rgba(0,0,0,0.10)" }}
                                >
                                  {deletingMessageId === msg.id ? (
                                    <div className="size-3 border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
                                  ) : (
                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} className="h-1" />
              </div>
            )}
          </div>{/* end min-h-full inner wrapper */}
        </div>{/* end messages scroll area */}

        {/* ── Input area ── */}
        <div className="flex-shrink-0 border-t border-white/70 px-4 py-2.5"
          style={{ background: "rgba(255,255,255,0.94)", backdropFilter: "blur(20px)" }}>

          {/* Typing indicator */}
          {typingList.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-0.5 h-4">
                {[0, 1, 2].map(i => (
                  <span key={i} className="size-1.5 rounded-full bg-slate-400 inline-block"
                    style={{ animation: `wa-bounce 1.4s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
              <p className="text-xs text-slate-400">
                {typingList.slice(0, 2).join(", ")}{typingList.length > 2 ? ` +${typingList.length - 2}` : ""} {typingList.length > 1 ? "are" : "is"} typing…
              </p>
            </div>
          )}

          {/* Reply preview */}
          {replyTo && (
            <div className="flex items-start gap-2 mb-2.5 px-3 py-2 rounded-xl"
              style={{ borderLeft: `3px solid ${currentTopic.color}`, backgroundColor: `${currentTopic.color}0E` }}>
              <span className="material-symbols-outlined text-sm flex-shrink-0 mt-0.5" style={{ color: currentTopic.color }}>reply</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black truncate" style={{ color: currentTopic.color }}>
                  {participantMap[replyTo.sender_id]?.name || "Participant"}
                </p>
                <p className="text-xs text-slate-500 truncate">{replyTo.message}</p>
              </div>
              <button onClick={() => setReplyTo(null)}
                className="flex-shrink-0 size-5 rounded-full flex items-center justify-center hover:bg-white/60 transition-all">
                <span className="material-symbols-outlined text-slate-400" style={{ fontSize: 14 }}>close</span>
              </button>
            </div>
          )}

          {/* Compose row */}
          <div className="flex items-end gap-2.5">
            {/* Avatar */}
            <div className="flex-shrink-0 pb-1">
              <Avatar name={profile?.full_name} size={32} />
            </div>

            {/* Text input */}
            <div className="flex-1 flex items-end gap-2 px-4 py-2 rounded-2xl"
              style={{ background: "rgba(241,245,249,0.80)", border: "1.5px solid rgba(203,213,225,0.60)" }}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => handleTextChange(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postMessage(); } }}
                rows={1}
                placeholder={`Message #${topic}`}
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none leading-relaxed"
                style={{ minHeight: 22, maxHeight: 128 }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={postMessage}
              disabled={sending || !text.trim()}
              title="Send"
              className="size-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, #00C4B4 0%, #00897B 100%)",
                boxShadow: text.trim() ? "0 4px 14px rgba(0,196,180,0.40)" : "none",
                transform: text.trim() ? "scale(1.05)" : "scale(0.97)",
              }}>
              {sending
                ? <div className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-white" style={{ fontSize: 18, marginLeft: 2 }}>send</span>
              }
            </button>
          </div>


        </div>
      </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes wa-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30%             { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
