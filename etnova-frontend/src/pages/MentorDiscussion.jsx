import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../config/supabaseClient";

const CHANNELS = [
  { id: "General", icon: "chat_bubble", color: "#14b8a6" },
  { id: "Architecture", icon: "architecture", color: "#6366f1" },
  { id: "Documentation", icon: "description", color: "#f59e0b" },
  { id: "Submission Planning", icon: "event_note", color: "#10b981" },
  { id: "Presentation", icon: "slideshow", color: "#ec4899" },
];

function toMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function fmtDay(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name = "U") {
  return (name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarColor(name = "U") {
  const palette = ["#059669", "#6366f1", "#0ea5e9", "#db2777", "#f59e0b", "#7c3aed", "#ef4444"];
  return palette[(name.charCodeAt(0) || 0) % palette.length];
}

function Avatar({ name, size = 34 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold select-none flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: avatarColor(name), fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  );
}

export default function MentorDiscussion({
  projId,
  mentorId,
  members = [],
  mentorName = "Mentor",
  projectTitle = "Team Project",
}) {
  const [senderId, setSenderId] = useState(mentorId || null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [topic, setTopic] = useState("General");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const channelStateRef = useRef("INIT");

  const participants = useMemo(() => {
    const base = (members || []).map((m) => ({
      id: m.student_id,
      name: m?.profiles?.full_name || "Team Member",
      role: m.role === "leader" ? "Leader" : "Member",
    }));
    if (senderId) {
      base.push({ id: senderId, name: mentorName || "Mentor", role: "Guide" });
    }
    const seen = new Set();
    return base.filter((p) => p.id && !seen.has(p.id) && seen.add(p.id));
  }, [members, senderId, mentorName, mentorId]);

  const participantMap = useMemo(() => {
    const out = {};
    participants.forEach((p) => {
      out[p.id] = p;
    });
    return out;
  }, [participants]);

  const visibleMessages = useMemo(() => messages.filter((m) => (m.topic || "General") === topic), [messages, topic]);
  const messageMap = useMemo(() => {
    const out = {};
    messages.forEach((m) => {
      out[m.id] = m;
    });
    return out;
  }, [messages]);
  const activeChannel = useMemo(() => CHANNELS.find((ch) => ch.id === topic) || CHANNELS[0], [topic]);

  useEffect(() => {
    setSenderId(mentorId || null);
  }, [mentorId]);

  useEffect(() => {
    if (mentorId) return;
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const uid = data?.user?.id || null;
      if (uid) setSenderId(uid);
    });
    return () => {
      mounted = false;
    };
  }, [mentorId]);

  const upsertMessage = (nextMessage) => {
    if (!nextMessage?.id) return;
    const normalized = { ...nextMessage, topic: nextMessage.topic || "General" };
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === normalized.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = normalized;
        return copy;
      }
      const copy = [...prev, normalized];
      copy.sort((a, b) => toMs(a.created_at) - toMs(b.created_at));
      return copy;
    });
  };

  const removeMessage = (id) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setReplyTo((prev) => (prev?.id === id ? null : prev));
  };

  useEffect(() => {
    let channel;
    let poller;

    const loadMessages = async () => {
      const { data, error: loadError } = await supabase
        .from("discussion_messages")
        .select("id,project_id,sender_id,topic,message,reply_to,created_at")
        .eq("project_id", projId)
        .order("created_at", { ascending: true });
      if (loadError) throw loadError;
      setMessages((data || []).map((m) => ({ ...m, topic: m.topic || "General" })));
    };

    const init = async () => {
      setLoading(true);
      setError("");
      try {
        await loadMessages();
      } catch (err) {
        setError(err.message || "Failed to load discussion.");
      } finally {
        setLoading(false);
      }

      channel = supabase
        .channel(`discussion-${projId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "discussion_messages", filter: `project_id=eq.${projId}` },
          async ({ new: row }) => {
            const { data: fresh } = await supabase
              .from("discussion_messages")
              .select("id,project_id,sender_id,topic,message,reply_to,created_at")
              .eq("id", row.id)
              .single();
            if (fresh) upsertMessage(fresh);
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "discussion_messages", filter: `project_id=eq.${projId}` },
          async ({ new: row }) => {
            const { data: fresh } = await supabase
              .from("discussion_messages")
              .select("id,project_id,sender_id,topic,message,reply_to,created_at")
              .eq("id", row.id)
              .single();
            if (fresh) upsertMessage(fresh);
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "discussion_messages", filter: `project_id=eq.${projId}` },
          ({ old }) => removeMessage(old?.id)
        );

      channel.subscribe((status) => {
        channelStateRef.current = status;
      });

      poller = setInterval(() => {
        if (channelStateRef.current === "SUBSCRIBED") return;
        loadMessages().catch(() => {});
      }, 3000);
    };

    init();
    return () => {
      if (poller) clearInterval(poller);
      if (channel) supabase.removeChannel(channel);
      channelStateRef.current = "CLOSED";
    };
  }, [projId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages]);

  const send = async () => {
    if (!text.trim() || !senderId || sending) return;
    const payload = text.trim();
    setSending(true);
    setError("");
    try {
      const { data: inserted, error: sendError } = await supabase
        .from("discussion_messages")
        .insert({
          project_id: projId,
          sender_id: senderId,
          topic,
          message: payload,
          reply_to: replyTo?.id || null,
        })
        .select("id,project_id,sender_id,topic,message,reply_to,created_at")
        .single();
      if (sendError) throw sendError;
      upsertMessage(inserted);
      setText("");
      setReplyTo(null);
    } catch (err) {
      setError(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (msg) => {
    if (!msg?.id || msg.sender_id !== senderId || deletingMessageId) return;

    const ok = window.confirm("Delete this message?");
    if (!ok) return;

    const deletedId = msg.id;
    const snapshot = messages;
    setDeletingMessageId(deletedId);
    setMessages((prev) => prev.filter((m) => m.id !== deletedId));
    setReplyTo((prev) => (prev?.id === deletedId ? null : prev));
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("discussion_messages")
        .delete()
        .eq("id", deletedId)
        .eq("sender_id", senderId);
      if (deleteError) throw deleteError;
    } catch (err) {
      setMessages(snapshot);
      setError(err.message || "Failed to delete message.");
    } finally {
      setDeletingMessageId(null);
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-250px)] min-h-[560px] bg-slate-100 rounded-3xl border border-slate-200 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-250px)] min-h-[560px] bg-slate-100 rounded-3xl border border-slate-200 overflow-hidden flex">
      <aside className="hidden lg:flex w-80 bg-[#f2f6fb] border-r border-slate-200 flex-col">
        <div className="px-5 py-4 border-b border-slate-200 bg-[#e7eef8]">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Team Discussion</p>
          <h3 className="text-xl font-black text-slate-900 leading-snug mt-1.5 whitespace-normal break-words">{projectTitle}</h3>
          <p className="text-slate-500 mt-1 text-xs">{participants.length} participants</p>
        </div>

        <div className="px-3 py-3 border-b border-slate-200">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 mb-3">Channels</p>
          <div className="space-y-1.5">
            {CHANNELS.map((ch) => {
              const active = topic === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => setTopic(ch.id)}
                  className={
                    "w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs transition-all " +
                    (active
                      ? "bg-teal-50 border-teal-200 text-slate-900 font-semibold"
                      : "bg-transparent border-transparent text-slate-500 hover:bg-white hover:border-slate-200")
                  }
                >
                  <span className="material-symbols-outlined text-base">{ch.icon}</span>
                  <span>{ch.id}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-3 py-3 flex-1 overflow-y-auto">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 mb-3">Members - {participants.length}</p>
          <div className="space-y-1.5">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 px-2 py-1">
                <Avatar name={p.name} size={26} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 leading-tight truncate">{p.name}</p>
                  <p className="text-slate-400 text-[11px]">{p.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: `${activeChannel.color}14`,
              border: `1px solid ${activeChannel.color}30`,
              color: activeChannel.color,
            }}
          >
            <span className="material-symbols-outlined">{activeChannel.icon}</span>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xl leading-tight">{topic}</h4>
            <p className="text-slate-400 text-xs">
              {participants.length} participants - {visibleMessages.length} messages
            </p>
          </div>
        </div>

        {error && <div className="px-5 py-2 text-xs text-rose-700 bg-rose-50 border-b border-rose-100">{error}</div>}

        <div
          className="flex-1 overflow-y-auto px-4 py-3"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.18) 1px, transparent 0)",
            backgroundSize: "34px 34px",
            backgroundColor: "#edf3fa",
          }}
        >
          <div className="min-h-full flex flex-col justify-end">
            {visibleMessages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">No messages in #{topic}</div>
            ) : (
              <div className="space-y-3.5">
                {visibleMessages.map((msg, idx) => {
                  const mine = msg.sender_id === senderId;
                  const sender = participantMap[msg.sender_id];
                  const previous = visibleMessages[idx - 1];
                  const showDay = !previous || fmtDay(previous.created_at) !== fmtDay(msg.created_at);
                  const quotedMessage = msg.reply_to ? messageMap[msg.reply_to] : null;
                  const quotedSender = quotedMessage ? participantMap[quotedMessage.sender_id] : null;

                  return (
                    <div key={msg.id}>
                      {showDay && (
                        <div className="flex items-center gap-3 py-2">
                          <div className="h-px flex-1 bg-slate-300/70" />
                          <span className="px-3 py-1 text-xs text-slate-500 rounded-full bg-white border border-slate-200">{fmtDay(msg.created_at)}</span>
                          <div className="h-px flex-1 bg-slate-300/70" />
                        </div>
                      )}

                      <div className={"flex gap-2.5 items-end " + (mine ? "justify-end" : "justify-start")}>
                        {!mine && <Avatar name={sender?.name || "User"} size={30} />}

                        <div className={"max-w-[75%] " + (mine ? "items-end" : "items-start")}>
                          {!mine && (
                            <p className="text-xs font-semibold text-slate-500 mb-1 ml-1">
                              {sender?.name || "Participant"}
                              <span className="text-slate-400"> - {sender?.role || "Member"}</span>
                            </p>
                          )}
                          <div className="group relative">
                            <div
                              className={
                                "px-3.5 py-2 text-xs rounded-2xl shadow-sm " +
                                (mine ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white" : "bg-white text-slate-800 border border-slate-200")
                              }
                            >
                              {quotedMessage && (
                                <div
                                  className="mb-2 pl-2.5 py-1.5 pr-2 rounded-lg text-[11px] leading-snug"
                                  style={{
                                    borderLeft: `3px solid ${mine ? "rgba(255,255,255,0.55)" : activeChannel.color}`,
                                    backgroundColor: mine ? "rgba(255,255,255,0.16)" : `${activeChannel.color}12`,
                                  }}
                                >
                                  <p className={"font-semibold truncate mb-0.5 " + (mine ? "text-white/85" : "")} style={mine ? {} : { color: activeChannel.color }}>
                                    {quotedSender?.name || "Participant"}
                                  </p>
                                  <p className={mine ? "text-white/75 truncate" : "text-slate-500 truncate"}>{quotedMessage.message}</p>
                                </div>
                              )}

                              <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                              <div className="flex items-center justify-end gap-1 mt-1.5">
                                <p className={"text-[11px] " + (mine ? "text-teal-100" : "text-slate-400")}>{fmtTime(msg.created_at)}</p>
                                {mine && (
                                  <span className="material-symbols-outlined text-[12px] text-teal-100">done_all</span>
                                )}
                              </div>
                            </div>

                            <div
                              className={
                                "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all flex flex-col gap-0.5 " +
                                (mine ? "-left-5" : "-right-5")
                              }
                            >
                              <button
                                onClick={() => setReplyTo(msg)}
                                title="Reply"
                                className="rounded-full flex items-center justify-center p-0"
                                style={{
                                  width: 15,
                                  height: 15,
                                  minWidth: 15,
                                  minHeight: 15,
                                  lineHeight: 1,
                                  backgroundColor: "rgba(255,255,255,0.92)",
                                  border: "1px solid #e2e8f0",
                                  color: "#64748b",
                                  boxShadow: "0 1px 4px rgba(15,23,42,0.10)",
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 10, lineHeight: 1 }}>
                                  reply
                                </span>
                              </button>

                              {mine && (
                                <button
                                  onClick={() => deleteMessage(msg)}
                                  title={deletingMessageId === msg.id ? "Deleting..." : "Delete message"}
                                  disabled={deletingMessageId === msg.id}
                                  className="rounded-full flex items-center justify-center p-0 disabled:opacity-60"
                                  style={{
                                    width: 15,
                                    height: 15,
                                    minWidth: 15,
                                    minHeight: 15,
                                    lineHeight: 1,
                                    backgroundColor: "rgba(255,245,245,0.96)",
                                    border: "1px solid #fecaca",
                                    color: "#ef4444",
                                    boxShadow: "0 1px 4px rgba(15,23,42,0.10)",
                                  }}
                                >
                                  {deletingMessageId === msg.id ? (
                                    <div className="w-1.5 h-1.5 border border-rose-200 border-t-rose-500 rounded-full animate-spin" />
                                  ) : (
                                    <span className="material-symbols-outlined" style={{ fontSize: 10, lineHeight: 1 }}>
                                      delete
                                    </span>
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
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="p-2.5 bg-white border-t border-slate-200">
          {replyTo && (
            <div className="mb-2 px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-sm mt-0.5" style={{ color: activeChannel.color }}>
                reply
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-700 truncate">{participantMap[replyTo.sender_id]?.name || "Participant"}</p>
                <p className="text-xs text-slate-500 truncate">{replyTo.message}</p>
              </div>
              <button type="button" onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <Avatar name={mentorName || "Mentor"} size={32} />
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Message #${topic}`}
              className="flex-1 h-10 max-h-24 border border-slate-300 rounded-2xl px-3.5 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            />
            <button
              onClick={send}
              disabled={sending || !text.trim() || !senderId}
              className="w-10 h-10 rounded-2xl bg-teal-300 hover:bg-teal-400 disabled:opacity-50 text-white flex items-center justify-center"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
