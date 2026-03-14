import { useState, useEffect, useRef } from "react";
import { supabase } from "../config/supabaseClient";
import { apiRequest } from "../config/apiClient";
import MentorDiscussion from "./MentorDiscussion";

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ic = {
  Overview: () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  Submissions: () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  Feedback: () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  Evaluation: () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  Activity: () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  Download: () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  Send: () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
  Plus: () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  Eye: () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  Check: () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>,
  Lock: () => <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
  Star: () => <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  X: () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  Clock: () => <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  ArrR: () => <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>,
  Info: () => <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
};

// ─── Constants ────────────────────────────────────────────────────────────────
// 6 milestones as per admin workflow
const PHASES = ["Idea", "Abstract", "0th Review", "1st Review", "2nd Review", "Final"];

// Per-milestone metadata: tab to route to on click, tooltip requirement, week label
const MILESTONE_META = [
  { tab: "overview", req: "Project idea finalised and guide assigned by admin" },
  { tab: "submissions", req: "Upload abstract, problem statement & literature survey" },
  { tab: "evaluation", req: "0th review — concept validation & initial guide feedback" },
  { tab: "evaluation", req: "1st review — prototype demo & progress evaluation" },
  { tab: "evaluation", req: "2nd review — implementation completeness & testing check" },
  { tab: "evaluation", req: "Final presentation, viva & full project demo to panel" },
];

const MC = ["#14b8a6", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899"];
const RUBRIC = [
  { key: "problem_definition", label: "Problem Definition", max: 20 },
  { key: "technical_approach", label: "Technical Approach", max: 25 },
  { key: "implementation", label: "Implementation Quality", max: 25 },
  { key: "presentation", label: "Presentation & Report", max: 15 },
  { key: "viva", label: "Viva / Q&A", max: 15 },
];
const MAX_SCORE = RUBRIC.reduce((s, c) => s + c.max, 0);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sClr = s => s >= 90 ? "text-emerald-600" : s >= 70 ? "text-amber-500" : "text-red-500";
const sBg = s => s >= 90 ? "bg-emerald-500" : s >= 70 ? "bg-amber-400" : "bg-red-400";

function ago(ts) {
  if (!ts) return "—";
  const d = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return Math.floor(d / 60) + "m ago";
  if (d < 86400) return Math.floor(d / 3600) + "h ago";
  if (d < 172800) return "Yesterday";
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
function normalizeReviewStageName(stageName) {
  const value = String(stageName || "").trim().toLowerCase();
  if (value === "0th review") return "Zeroth Review";
  if (value === "1st review") return "First Review";
  if (value === "2nd review") return "Second Review";
  if (value === "zeroth review") return "Zeroth Review";
  if (value === "first review") return "First Review";
  if (value === "second review") return "Second Review";
  if (value === "idea") return "Idea";
  if (value === "abstract") return "Abstract";
  if (value === "final review") return "Final Review";
  return String(stageName || "").trim();
}
function fmtSz(b) {
  if (!b) return "";
  if (b < 1024) return b + "B";
  if (b < 1048576) return (b / 1024).toFixed(1) + "KB";
  return (b / 1048576).toFixed(1) + "MB";
}
function gradFromTitle(txt = "") {
  const g = ["linear-gradient(135deg,#14b8a6,#3b82f6)", "linear-gradient(135deg,#06b6d4,#2563eb)",
    "linear-gradient(135deg,#0ea5e9,#6366f1)", "linear-gradient(135deg,#22c55e,#0ea5e9)", "linear-gradient(135deg,#14b8a6,#0284c7)"];
  const s = [...(txt || "p")].reduce((a, c) => a + c.charCodeAt(0), 0);
  return g[s % g.length];
}
function getInitials(txt = "") {
  return (txt || "P").trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "P";
}
function getLogoUrl(proj) {
  return proj?.logo_url || proj?.logo || proj?.project_logo || proj?.thumbnail_url || null;
}
function fmtSz2(b) { return fmtSz(b); }

const ST_PILL = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  submitted: "bg-teal-50 text-teal-700 border-teal-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  under_review: "bg-blue-50 text-blue-700 border-blue-200",
};
const ST_DOT = {
  active: "bg-emerald-500", pending: "bg-amber-400", completed: "bg-blue-500",
  submitted: "bg-teal-500", rejected: "bg-red-400", approved: "bg-emerald-500", under_review: "bg-blue-500",
};

function Pill({ status }) {
  const k = (status || "pending").toLowerCase().replace(/\s+/g, "_");
  return (
    <span className={"inline-flex items-center gap-2 text-sm font-bold px-3.5 py-1.5 rounded-full border shadow-sm " + (ST_PILL[k] || ST_PILL.pending)}>
      <span className={"w-2 h-2 rounded-full " + (ST_DOT[k] || "bg-amber-400")} />{status || "Pending"}
    </span>
  );
}
function FIcon({ name }) {
  const e = name?.split(".").pop()?.toLowerCase();
  const m = {
    pdf: ["#ef4444", "PDF"], pptx: ["#f97316", "PPT"], ppt: ["#f97316", "PPT"],
    xlsx: ["#22c55e", "XLS"], xls: ["#22c55e", "XLS"], docx: ["#3b82f6", "DOC"], doc: ["#3b82f6", "DOC"], zip: ["#8b5cf6", "ZIP"]
  };
  const [c, l] = m[e] || ["#6b7280", "FILE"];
  return <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0" style={{ background: c }}>{l}</div>;
}
function Ring({ pct, size = 56, stroke = 5 }) {
  const r = (size - stroke * 2) / 2, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#14b8a6" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
    </svg>
  );
}
function Spin() { return <div className="flex justify-center py-16"><div className="w-7 h-7 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" /></div>; }

// ─── Review / Rubric Modal ────────────────────────────────────────────────────
function ReviewModal({ proj, onClose, onSubmit }) {
  const [phase, setPhase] = useState("Phase 1");
  const [sc, setSc] = useState({ problem_definition: 0, technical_approach: 0, implementation: 0, presentation: 0, viva: 0 });
  const [fb, setFb] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const total = Object.values(sc).reduce((s, v) => s + Number(v), 0);
  const submit = async () => {
    if (!fb.trim()) { setErr("Please add written feedback."); return; }
    setSaving(true); setErr("");
    await onSubmit({ phase, scores: sc, total, feedback: fb });
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-800 to-teal-800 px-6 py-5 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-teal-300 font-bold uppercase tracking-widest mb-1">Add Review</p>
              <h3 className="text-white font-extrabold text-lg leading-tight">{proj.title}</h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white mt-1 transition-colors"><Ic.X /></button>
          </div>
          <select value={phase} onChange={e => setPhase(e.target.value)}
            className="mt-3 w-full bg-white/10 border border-white/20 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-400">
            {PHASES.map(p => <option key={p} className="text-gray-800 bg-white">{p}</option>)}
          </select>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-5 py-3 border border-gray-100">
            <span className="text-sm font-semibold text-gray-600">Total Score</span>
            <span className={"text-3xl font-extrabold " + sClr(Math.round((total / MAX_SCORE) * 100))}>
              {total}<span className="text-base font-normal text-gray-400"> / {MAX_SCORE}</span>
            </span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Rubric Scores</p>
            <div className="space-y-5">
              {RUBRIC.map(c => (
                <div key={c.key}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-gray-700">{c.label}</label>
                    <div className="flex items-center gap-1.5">
                      <span className={"text-sm font-extrabold " + (sc[c.key] >= c.max * 0.8 ? "text-emerald-600" : sc[c.key] >= c.max * 0.5 ? "text-amber-500" : "text-red-500")}>{sc[c.key]}</span>
                      <span className="text-xs text-gray-400">/ {c.max}</span>
                    </div>
                  </div>
                  <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="absolute h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 pointer-events-none transition-all" style={{ width: (sc[c.key] / c.max * 100) + "%" }} />
                    <input type="range" min="0" max={c.max} value={sc[c.key]} onChange={e => setSc(s => ({ ...s, [c.key]: Number(e.target.value) }))} className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Written Feedback</label>
            <textarea rows={4} placeholder="Provide structured, constructive feedback for the team..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none leading-relaxed"
              value={fb} onChange={e => setFb(e.target.value)} />
          </div>
          {err && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-2.5 border border-red-100">{err}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 text-sm">Cancel</button>
            <button onClick={submit} disabled={saving} className="flex-1 bg-teal-400 hover:bg-teal-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 active:scale-95">{saving ? "Submitting…" : "Submit Review"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Milestone Timeline (6 phases, interactive) ───────────────────────────────
function MilestoneTimeline({ phaseIdx, onTabSwitch, milestoneDates }) {
  const [tip, setTip] = useState(null);
  const fillPct = phaseIdx === 0 ? 0 : Math.round((phaseIdx / (PHASES.length - 1)) * 100);

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <p className="font-bold text-gray-800 flex items-center gap-2 text-sm">
          <Ic.Activity /> Milestone Timeline
        </p>

      </div>

      <div className="relative flex items-start justify-between">
        {/* Grey base track */}
        <div className="absolute top-[17px] left-3 right-3 h-0.5 bg-gray-200 rounded-full z-0" />
        {/* Teal progress fill */}
        <div
          className="absolute top-[17px] left-3 h-0.5 rounded-full z-0 transition-all duration-700"
          style={{ width: `calc(${fillPct}% - 6px)`, background: "linear-gradient(90deg,#14b8a6 0%,#3b82f6 100%)" }}
        />

        {PHASES.map((ph, i) => {
          const done = i < phaseIdx;
          const cur = i === phaseIdx;
          const locked = i > phaseIdx;
          const meta = MILESTONE_META[i];

          return (
            <div
              key={ph}
              className="flex flex-col items-center gap-2 z-10 flex-1 relative"
              onMouseEnter={() => setTip(i)}
              onMouseLeave={() => setTip(null)}
            >
              {/* Tooltip */}
              {tip === i && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 pointer-events-none">
                  <div className="bg-gray-900 text-white rounded-xl px-3 py-2.5 shadow-2xl border border-white/10 text-left"
                    style={{ minWidth: "160px", maxWidth: "210px" }}>
                    <p className="text-xs font-bold text-teal-400 mb-1">{ph}</p>
                    <p className="text-xs text-gray-300 leading-relaxed">{meta.req}</p>
                    <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-white/10">
                      <Ic.Clock />
                      <span className="text-xs text-slate-400">
                        {milestoneDates?.[i]
                          ? new Date(milestoneDates[i]).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : "No deadline set"}
                      </span>
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
                      style={{ borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid #111827" }} />
                  </div>
                </div>
              )}

              {/* Node circle */}
              <button
                type="button"
                onClick={() => { if (!locked) onTabSwitch(meta.tab); }}
                disabled={locked}
                className={[
                  "w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-200 focus:outline-none",
                  done ? "bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-200 hover:scale-110 cursor-pointer" : "",
                  cur ? "bg-white border-teal-400 shadow-lg shadow-teal-200/70 ring-4 ring-teal-400/20 hover:scale-110 cursor-pointer" : "",
                  locked ? "bg-gray-100 border-gray-200 cursor-not-allowed opacity-50" : "",
                ].join(" ")}
              >
                {done && <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>}
                {cur && <div className="w-3 h-3 rounded-full bg-teal-400 animate-pulse" />}
                {locked && <Ic.Lock />}
              </button>

              {/* Label */}
              <div className="flex flex-col items-center gap-0.5">
                <span className={[
                  "text-[11px] font-bold text-center leading-tight",
                  done ? "text-emerald-600" : cur ? "text-teal-600" : "text-gray-300"
                ].join(" ")}>{ph}</span>
                <span className={[
                  "text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                  done ? "bg-emerald-50 text-emerald-600" : cur ? "bg-teal-50 text-teal-600" : "bg-gray-50 text-gray-300"
                ].join(" ")}>
                  {done ? "Done" : cur ? "Active" : "Locked"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 🔔 Action Required ───────────────────────────────────────────────────────
// ─── 📢 Mentor Announcements (Communication Hub) ──────────────────────────────
const ANNOUNCE_TYPES = [
  { key: "general", label: "General", color: "#6b7280", bg: "bg-gray-50", border: "border-gray-200", badge: "bg-gray-100 text-gray-600" },
  { key: "urgent", label: "Urgent", color: "#ef4444", bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-700" },
  { key: "reminder", label: "Reminder", color: "#f59e0b", bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700" },
  { key: "feedback", label: "Feedback", color: "#14b8a6", bg: "bg-teal-50", border: "border-teal-200", badge: "bg-teal-100 text-teal-700" },
  { key: "milestone", label: "Milestone", color: "#14b8a6", bg: "bg-teal-50", border: "border-teal-200", badge: "bg-teal-100 text-teal-700" },
];

function typeStyle(key) {
  return ANNOUNCE_TYPES.find(t => t.key === key) || ANNOUNCE_TYPES[0];
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return Math.floor(d / 60) + "m ago";
  if (d < 86400) return Math.floor(d / 3600) + "h ago";
  if (d < 172800) return "Yesterday";
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function MentorAnnouncements({ projId, mentorId, mentorName }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ type: "general", title: "", body: "", pinned: false });
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    fetchAnnouncements();
  }, [projId]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .eq("project_id", projId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    setAnnouncements(data || []);
    setLoading(false);
  };

  const post = async () => {
    if (!form.title.trim()) { setErr("Title is required."); return; }
    if (!form.body.trim()) { setErr("Message body is required."); return; }
    setPosting(true); setErr("");
    const { data, error } = await supabase
      .from("announcements")
      .insert([{
        project_id: projId,
        guide_id: mentorId,
        type: form.type,
        title: form.title.trim(),
        body: form.body.trim(),
        pinned: form.pinned,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();
    if (error) { setErr(error.message || "Failed to post."); setPosting(false); return; }
    setAnnouncements(prev => form.pinned ? [data, ...prev] : [data, ...prev.filter(a => !a.pinned), ...prev.filter(a => a.pinned)]);
    setForm({ type: "general", title: "", body: "", pinned: false });
    setComposing(false);
    setPosting(false);
  };

  const deleteAnn = async (id) => {
    await supabase.from("announcements").delete().eq("id", id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  const togglePin = async (ann) => {
    const newPinned = !ann.pinned;
    await supabase.from("announcements").update({ pinned: newPinned }).eq("id", ann.id);
    setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, pinned: newPinned } : a)
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)));
  };

  const visible = filter === "all"
    ? announcements
    : announcements.filter(a => a.type === filter);

  const TYPE_ICONS = {
    general: "📋",
    urgent: "🚨",
    reminder: "⏰",
    feedback: "💬",
    milestone: "🎯",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-base flex-shrink-0">📢</div>
          <div>
            <p className="font-bold text-gray-800 text-sm leading-tight">Mentor Announcements</p>
            <p className="text-[11px] text-gray-400">Visible to your entire team</p>
          </div>
          {announcements.length > 0 && (
            <span className="bg-teal-100 text-teal-700 text-xs font-bold px-2 py-0.5 rounded-full">{announcements.length}</span>
          )}
        </div>
        <button
          onClick={() => { setComposing(c => !c); setErr(""); }}
          className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all active:scale-95 ${composing
            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
            : "bg-teal-500 hover:bg-teal-600 text-white shadow-sm shadow-teal-200"
            }`}>
          {composing
            ? <><Ic.X /> Cancel</>
            : <><Ic.Plus /> New Post</>}
        </button>
      </div>

      {/* ── Compose form ── */}
      {composing && (
        <div className="px-5 py-4 bg-teal-50/50 border-b border-teal-100">
          {/* Type selector */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {ANNOUNCE_TYPES.map(t => (
              <button key={t.key} onClick={() => setForm(f => ({ ...f, type: t.key }))}
                className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${form.type === t.key
                  ? `${t.badge} border-current`
                  : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                  }`}>
                {TYPE_ICONS[t.key]} {t.label}
              </button>
            ))}
          </div>

          {/* Title */}
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Announcement title…"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 mb-2.5"
          />

          {/* Body */}
          <textarea
            rows={3}
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Write your message to the team… (supports deadlines, instructions, feedback)"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none leading-relaxed mb-2.5"
          />

          {/* Options row */}
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div
                onClick={() => setForm(f => ({ ...f, pinned: !f.pinned }))}
                className={`w-9 h-5 rounded-full transition-all relative ${form.pinned ? "bg-teal-500" : "bg-gray-200"}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.pinned ? "left-4" : "left-0.5"}`} />
              </div>
              <span className="text-xs font-semibold text-gray-600 group-hover:text-gray-800">📌 Pin to top</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setComposing(false)}
                className="text-xs font-semibold text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all">
                Cancel
              </button>
              <button onClick={post} disabled={posting}
                className="flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white disabled:opacity-50 transition-all active:scale-95">
                {posting ? "Posting…" : <><Ic.Send /> Post</>}
              </button>
            </div>
          </div>

          {err && (
            <p className="mt-2 text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{err}</p>
          )}
        </div>
      )}

      {/* ── Filter chips ── */}
      {announcements.length > 0 && (
        <div className="flex gap-1.5 px-5 py-3 border-b border-gray-50 overflow-x-auto scrollbar-none">
          <button onClick={() => setFilter("all")}
            className={`text-xs font-semibold px-3 py-1 rounded-full border flex-shrink-0 transition-all ${filter === "all" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}>All</button>
          {ANNOUNCE_TYPES.filter(t => announcements.some(a => a.type === t.key)).map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`text-xs font-semibold px-3 py-1 rounded-full border flex-shrink-0 transition-all ${filter === t.key ? `${t.badge} border-current` : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}>
              {TYPE_ICONS[t.key]} {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Announcement feed ── */}
      {loading ? (
        <div className="py-8 flex justify-center"><div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : visible.length === 0 ? (
        <div className="py-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center mb-3 text-2xl">📢</div>
          <p className="text-sm font-semibold text-gray-600">No announcements yet</p>
          <p className="text-xs text-gray-400 mt-1">Post updates, reminders or feedback for your team</p>
          <button onClick={() => setComposing(true)}
            className="mt-4 text-xs font-bold px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl transition-all active:scale-95">
            Post First Announcement
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
          {visible.map(ann => {
            const ts = typeStyle(ann.type);
            const isExpanded = expanded === ann.id;
            const needsExpand = ann.body.length > 120;
            return (
              <div key={ann.id}
                className={`px-5 py-4 border-l-[3px] transition-all hover:bg-gray-50/50 ${ann.pinned ? "bg-yellow-50/30" : ""}`}
                style={{ borderLeftColor: ts.color }}>

                {/* Top row */}
                <div className="flex items-start gap-3">
                  <div className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICONS[ann.type]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {ann.pinned && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">📌 Pinned</span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ts.badge} border-current`}>{ts.label}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">{fmtTime(ann.created_at)}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 leading-snug">{ann.title}</p>
                    <p className={`text-xs text-gray-600 mt-1 leading-relaxed ${!isExpanded && needsExpand ? "line-clamp-2" : ""}`}>
                      {ann.body}
                    </p>
                    {needsExpand && (
                      <button onClick={() => setExpanded(isExpanded ? null : ann.id)}
                        className="text-[11px] font-semibold text-teal-600 hover:text-teal-800 mt-1 transition-colors">
                        {isExpanded ? "Show less ▲" : "Read more ▼"}
                      </button>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg,#14b8a6,#0284c7)" }}>
                        {(mentorName || "G")[0].toUpperCase()}
                      </div>
                      <span className="text-[11px] text-gray-500 font-semibold">{mentorName || "Guide"}</span>
                      <span className="text-[11px] text-gray-300">·</span>
                      <span className="text-[11px] text-gray-400">Project Guide</span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                    <button onClick={() => togglePin(ann)} title={ann.pinned ? "Unpin" : "Pin"}
                      className={`p-1.5 rounded-lg transition-all hover:bg-gray-100 ${ann.pinned ? "text-amber-500" : "text-gray-300 hover:text-amber-400"}`}>
                      <svg width="11" height="11" fill={ann.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    </button>
                    <button onClick={() => deleteAnn(ann.id)} title="Delete"
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                      <Ic.X />
                    </button>
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

// ─── 📅 Upcoming Deadlines ────────────────────────────────────────────────────
function UpcomingDeadlines({ phaseIdx, milestoneDates, reviewDeadlines = [] }) {
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [active, setActive] = useState(null);
  const classDeadlineItems = (reviewDeadlines || [])
    .filter((item) => Boolean(item?.deadline))
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4);

  if (classDeadlineItems.length > 0) {
    const firstDOW = new Date(view.y, view.m, 1).getDay();
    const totalDays = new Date(view.y, view.m + 1, 0).getDate();
    const monthLabel = new Date(view.y, view.m, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
    const todayKey = today.toISOString().slice(0, 10);
    const deadlineMap = classDeadlineItems.reduce((acc, item) => {
      const key = item.deadline.slice(0, 10);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const keyForDay = (day) => `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const prev = () => setView((v) => {
      const d = new Date(v.y, v.m - 1, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
    const next = () => setView((v) => {
      const d = new Date(v.y, v.m + 1, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
    const activeItems = active ? (deadlineMap[active] || []) : [];

    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
          <p className="font-bold text-gray-800 text-sm">Upcoming Deadlines</p>
          <span className="ml-auto text-xs text-gray-400">{classDeadlineItems.length} shown</span>
        </div>

        <div className="p-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="mb-4 flex items-center justify-between">
              <button type="button" onClick={() => { setActive(null); prev(); }} className="size-8 rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-slate-100">
                ‹
              </button>
              <p className="text-sm font-black text-slate-800">{monthLabel}</p>
              <button type="button" onClick={() => { setActive(null); next(); }} className="size-8 rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-slate-100">
                ›
              </button>
            </div>

            <div className="mb-2 grid grid-cols-7">
              {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                <p key={d} className="text-center text-[10px] font-bold text-slate-400">{d}</p>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1">
              {Array.from({ length: firstDOW }).map((_, i) => <div key={`blank-${i}`} />)}
              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1;
                const key = keyForDay(day);
                const items = deadlineMap[key] || [];
                const hasDeadline = items.length > 0;
                const isPast = key < todayKey;
                const isToday = key === todayKey;
                const isActive = active === key;

                return (
                  <div key={key} className="relative flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => hasDeadline && setActive(isActive ? null : key)}
                      className={`size-8 rounded-xl text-[11px] font-bold transition-all ${isToday ? "bg-slate-900 text-white" : "text-slate-600"} ${hasDeadline ? "cursor-pointer" : "hover:bg-white"}`}
                      style={hasDeadline && !isToday ? {
                        backgroundColor: isPast ? "rgba(254,226,226,0.9)" : "rgba(204,251,241,0.95)",
                        color: isPast ? "#dc2626" : "#0f766e",
                        outline: isActive ? "2px solid #14b8a6" : "1px solid rgba(20,184,166,0.18)",
                      } : {}}
                    >
                      {day}
                    </button>
                    {hasDeadline ? (
                      <div className={`mt-1 h-1.5 rounded-full ${items.length > 1 ? "w-3.5" : "w-1.5"} ${isPast ? "bg-red-400" : "bg-teal-400"}`} />
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-white bg-white p-3">
              {activeItems.length === 0 ? (
                <p className="text-xs text-slate-400">Select a marked date to view the coordinator-set student deadlines for this class.</p>
              ) : (
                <div className="space-y-2">
                  {activeItems.map((item) => {
                    const due = new Date(item.deadline);
                    const isPast = !Number.isNaN(due.getTime()) && due < new Date();
                    return (
                      <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800">{item.title}</p>
                          <p className="text-[11px] text-slate-500">
                            {due.toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold whitespace-nowrap ${isPast ? "border-red-200 bg-red-50 text-red-600" : "border-teal-200 bg-teal-50 text-teal-700"}`}>
                          {isPast ? "Overdue" : "Upcoming"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <Ic.Info />
            Coordinator-set student deadlines for this project's class
          </p>
        </div>
      </div>
    );
  }

  // Show current + next 2 unfinished milestones
  const items = PHASES
    .map((ph, i) => ({ ph, i, meta: MILESTONE_META[i], status: i < phaseIdx ? "done" : i === phaseIdx ? "current" : "upcoming" }))
    .filter(m => m.status !== "done")
    .slice(0, 3);

  const style = (dist) => {
    if (dist === 0) return { bg: "bg-red-50", lb: "#ef4444", badge: "bg-red-100 text-red-700", dot: "bg-red-500", label: "Due Now" };
    if (dist === 1) return { bg: "bg-amber-50", lb: "#f59e0b", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400", label: "Up Next" };
    return { bg: "bg-slate-50", lb: "#e2e8f0", badge: "bg-gray-100 text-gray-500", dot: "bg-gray-300", label: "Upcoming" };
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
        <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-base">📅</div>
        <p className="font-bold text-gray-800 text-sm">Upcoming Deadlines</p>
        <span className="ml-auto text-xs text-gray-400">{Math.max(0, PHASES.length - phaseIdx)} left</span>
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <p className="text-sm font-semibold text-emerald-600">All milestones complete!</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map(({ ph, i, meta }) => {
            const dist = i - phaseIdx;
            const s = style(dist);
            return (
              <div key={i} className={`px-5 py-4 ${s.bg} border-l-[3px]`} style={{ borderLeftColor: s.lb }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${s.dot}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold text-gray-800">{ph}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.badge}`}>{s.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{meta.req}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="flex items-center gap-1 justify-end">
                      <Ic.Clock />
                      <span className="text-xs font-semibold text-gray-700">
                        {milestoneDates?.[i]
                          ? new Date(milestoneDates[i]).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : "No date set"}
                      </span>
                    </div>
                    {milestoneDates?.[i] && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(milestoneDates[i]) < new Date() ? "⚠️ Past due" : "Upcoming"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <Ic.Info />
          {milestoneDates?.some(Boolean) ? "Deadlines set by admin" : "No deadlines set yet — contact admin"} · {Math.max(0, PHASES.length - phaseIdx)} milestone{(PHASES.length - phaseIdx) !== 1 ? "s" : ""} remaining
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 1 — OVERVIEW
// ══════════════════════════════════════════════════════════════════
function TabOverview({ proj, evaluations, members, documents, onAddReview, onNavigateTab, mentorId, mentorName, milestoneDates, reviewDeadlines }) {
  const avg = evaluations.length ? Math.round(evaluations.reduce((s, e) => s + Number(e.score || 0), 0) / evaluations.length) : null;
  const phaseIdx = Math.min([...new Set(evaluations.map(e => e.phase))].length, PHASES.length - 1);

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Members", value: members.length, color: "text-teal-500", bg: "bg-teal-50", border: "border-teal-100" },
          { label: "Reviews", value: evaluations.length, color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-100" },
          { label: "Avg Score", value: avg ? avg + "%" : "—", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
          { label: "Phase", value: PHASES[phaseIdx], color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} rounded-2xl p-4 border shadow-sm`}>
            <p className={"text-2xl font-extrabold " + s.color}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left 2/3 */}
        <div className="xl:col-span-2 space-y-5">
          {/* 6-phase milestone timeline */}
          <MilestoneTimeline phaseIdx={phaseIdx} onTabSwitch={onNavigateTab} milestoneDates={milestoneDates} />
          {/* Action Required */}
          <MentorAnnouncements projId={proj.id} mentorId={mentorId} mentorName={mentorName} />
        </div>

        {/* Right 1/3 */}
        <div className="space-y-5">
          {/* Team Members */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Team Members</p>
            <div className="space-y-3">
              {members.length === 0 && <p className="text-sm text-gray-400">No members found.</p>}
              {members.map((tm, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: MC[i % MC.length] }}>{tm.profiles?.full_name?.[0] || "?"}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{tm.profiles?.full_name || "—"}</p>
                    <p className="text-xs text-gray-400">{tm.profiles?.roll_number || tm.profiles?.department || "—"}</p>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize flex-shrink-0">{tm.role || "member"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <UpcomingDeadlines phaseIdx={phaseIdx} milestoneDates={milestoneDates} reviewDeadlines={reviewDeadlines} />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 2 — SUBMISSIONS (unchanged)
// ══════════════════════════════════════════════════════════════════
function TabSubmissions({ projId, members, mentorName }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  const notifyTeam = async (type, title, message) => {
    const students = members.map(m => m.student_id).filter(Boolean);
    if (students.length === 0) return;
    const notifications = students.map(uid => ({
      user_id: uid,
      type,
      title,
      message,
      read: false,
      created_at: new Date().toISOString()
    }));
    await supabase.from("notifications").insert(notifications);
  };


  useEffect(() => {
    setLoading(true);
    supabase.from("documents")
      .select("id,project_id,uploaded_by,document_type,file_name,file_url,file_size,version,status,uploaded_at,feedback,profiles:uploaded_by(full_name,email,roll_number)")
      .eq("project_id", projId).order("uploaded_at", { ascending: false })
      .then(({ data }) => { setDocs(data || []); setLoading(false); });
  }, [projId]);

  const openDoc = (doc) => {
    setViewing(doc);
    setFeedback(doc.feedback || "");
  };


  const saveFeedback = async () => {
    if (!viewing) return;
    setSaving(true);
    try {
      const data = await apiRequest(`/documents/${viewing.id}/approve`, {
        method: "PUT",
        body: { feedback: feedback.trim() }
      });
      if (data) {
        setDocs(d => d.map(x => x.id === data.id ? { ...x, ...data } : x));
        setViewing(v => (v && v.id === data.id ? { ...v, ...data } : v));
      }
    } catch (err) {
      console.error("Feedback error:", err);
      alert("Failed to save feedback: " + err.message);
    }
    setSaving(false);
  };

  const setStatus = async (doc, status) => {
    try {
      const data = await apiRequest(`/documents/${doc.id}/approve`, {
        method: "PUT",
        body: { status }
      });
      if (data) {
        setDocs(d => d.map(x => x.id === data.id ? { ...x, status: data.status } : x));
        if (viewing?.id === data.id) setViewing(v => ({ ...v, status: data.status }));
      }
    } catch (err) {
      console.error("Status update error:", err);
      alert("Failed to update status: " + err.message);
    }
  };

  const deleteDoc = async (doc) => {
    await supabase.from("documents").delete().eq("id", doc.id);
    setDocs(d => d.filter(x => x.id !== doc.id));
    setDeleting(null);
    if (viewing?.id === doc.id) setViewing(null);
  };

  const canPreview = (name) => {
    const ext = (name || "").split(".").pop().toLowerCase();
    return ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
  };

  const sStyle = (s) => {
    const k = (s || "submitted").toLowerCase().replace(/\s+/g, "_");
    return {
      submitted: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400" },
      under_review: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
      approved: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
      rejected: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", dot: "bg-red-400" },
    }[k] || { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", dot: "bg-gray-400" };
  };

  const statuses = ["all", ...new Set(docs.map(d => d.status?.toLowerCase()).filter(Boolean))];
  const filtered = filter === "all" ? docs : docs.filter(d => d.status?.toLowerCase() === filter);

  if (loading) return <Spin />;

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-gray-800">{docs.length} Submission{docs.length !== 1 ? "s" : ""}</p>
          <p className="text-xs text-gray-400 mt-0.5">Review, approve or reject team documents</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuses.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={"text-xs font-semibold px-3 py-1.5 rounded-full border capitalize transition-all " + (
                filter === s ? "bg-teal-400 text-white border-teal-400" : "bg-white text-gray-500 border-gray-200 hover:border-teal-300 hover:text-teal-600"
              )}>
              {s === "all" ? "All" : s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* ── Document list ── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-14 border border-gray-100 text-center">
          <div className="text-4xl mb-3">📂</div>
          <p className="text-gray-500 font-semibold">No submissions found</p>
          <p className="text-xs text-gray-400 mt-1">{filter !== "all" ? `No documents with status "${filter.replace(/_/g, " ")}"` : "Team hasn't uploaded any documents yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(doc => {
            const ss = sStyle(doc.status);
            return (
              <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">

                {/* Main row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <FIcon name={doc.file_name} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{doc.file_name || "—"}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">{doc.document_type || "Document"}</span>
                      {doc.file_size && <><span className="text-gray-200">·</span><span className="text-xs text-gray-400">{fmtSz(doc.file_size)}</span></>}
                      {doc.version && <><span className="text-gray-200">·</span><span className="text-xs text-gray-400">v{doc.version}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium text-gray-700">{doc.profiles?.full_name || "—"}</p>
                      <p className="text-xs text-gray-400">{doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</p>
                    </div>
                    {/* Status pill */}
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${ss.bg} ${ss.text} ${ss.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
                      {(doc.status || "submitted").replace(/_/g, " ")}
                    </span>
                    {/* Action icons */}
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => openDoc(doc)} title="View & Review"
                        className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-xl transition-all">
                        <Ic.Eye />
                      </button>
                      <a href={doc.file_url} download={doc.file_name} target="_blank" rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all inline-flex items-center justify-center"
                        title="Download">
                        <Ic.Download />
                      </a>
                      <button onClick={() => setDeleting(doc)} title="Delete"
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Feedback strip (if exists) */}
                {doc.feedback && (
                  <div className="px-5 pb-4 pt-0">
                    <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-2.5">
                      <p className="text-xs font-bold text-teal-700 mb-1 flex items-center gap-1.5">
                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                        Guide Feedback
                      </p>
                      <p className="text-xs text-teal-700 leading-relaxed">{doc.feedback}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ Full-Screen Document Review Modal ══ */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
            style={{ maxWidth: "900px", maxHeight: "92vh" }}>

            {/* Modal header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-white">
              <FIcon name={viewing.file_name} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{viewing.file_name}</p>
                <p className="text-xs text-gray-400">
                  Uploaded by <span className="font-semibold text-gray-600">{viewing.profiles?.full_name || "—"}</span>
                  {" · "}{viewing.uploaded_at ? new Date(viewing.uploaded_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                </p>
              </div>

              {/* Accept / Reject toggles */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setStatus(viewing, "approved")}
                  className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border transition-all active:scale-95 ${viewing.status === "approved"
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-200"
                    : "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    }`}>
                  <Ic.Check />
                  {viewing.status === "approved" ? "Approved ✓" : "Approve"}
                </button>
                <button onClick={() => setStatus(viewing, "rejected")}
                  className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border transition-all active:scale-95 ${viewing.status === "rejected"
                    ? "bg-red-500 text-white border-red-500 shadow-md shadow-red-200"
                    : "bg-white text-red-500 border-red-200 hover:bg-red-50"
                    }`}>
                  <Ic.X />
                  {viewing.status === "rejected" ? "Rejected ✗" : "Reject"}
                </button>
              </div>
              <button onClick={() => setViewing(null)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-all flex-shrink-0">
                <Ic.X />
              </button>
            </div>

            {/* Split body */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* Left — Document preview */}
              <div className="flex-1 bg-gray-50 border-r border-gray-100 flex flex-col min-w-0">
                <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Preview</p>
                  {viewing.file_url && (
                    <a href={viewing.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors">
                      <Ic.Eye /> Open in new tab ↗
                    </a>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  {viewing.file_url && canPreview(viewing.file_name) ? (
                    viewing.file_name?.toLowerCase().endsWith(".pdf") ? (
                      <iframe src={viewing.file_url} className="w-full h-full border-0" title={viewing.file_name} />
                    ) : (
                      <div className="flex items-center justify-center h-full p-6">
                        <img src={viewing.file_url} alt={viewing.file_name}
                          className="max-w-full max-h-full object-contain rounded-xl shadow-lg" />
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-4 p-10">
                      <div className="w-20 h-20 flex-shrink-0"><FIcon name={viewing.file_name} /></div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-700">{viewing.file_name}</p>
                        <p className="text-xs text-gray-400 mt-1">This file type cannot be previewed in browser</p>
                      </div>
                      {viewing.file_url && (
                        <a href={viewing.file_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 bg-teal-400 hover:bg-teal-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all active:scale-95">
                          <Ic.Download /> Download to View
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right — Feedback panel */}
              <div className="w-72 flex flex-col bg-white flex-shrink-0">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Guide Feedback</p>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                  {/* Status summary */}
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${sStyle(viewing.status).bg} ${sStyle(viewing.status).border}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sStyle(viewing.status).dot}`} />
                    <span className={`text-xs font-bold capitalize ${sStyle(viewing.status).text}`}>
                      {(viewing.status || "submitted").replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Feedback textarea */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">
                      Your Feedback
                    </label>
                    <textarea
                      rows={8}
                      placeholder="Write your feedback on this document… mention what's good, what needs improvement, and any corrections needed."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none leading-relaxed"
                      value={feedback}
                      onChange={e => setFeedback(e.target.value)}
                    />
                  </div>

                  {/* Save feedback */}
                  <button onClick={saveFeedback} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-teal-400 hover:bg-teal-500 active:scale-95 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 transition-all">
                    {saving
                      ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</>
                      : <><Ic.Send /> Save Feedback</>}
                  </button>

                  {/* Delete */}
                  <div className="border-t border-gray-100 pt-3">
                    <button onClick={() => setDeleting(viewing)}
                      className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-500 font-semibold py-2.5 rounded-xl text-sm hover:bg-red-50 transition-all active:scale-95">
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                      Delete Document
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Delete Confirm ══ */}
      {deleting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-2xl">🗑️</div>
              <div>
                <p className="font-extrabold text-gray-900">Delete Document?</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  <span className="font-semibold text-gray-700">{deleting.file_name}</span> will be permanently removed. This cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 w-full pt-2">
                <button onClick={() => setDeleting(null)}
                  className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-all">
                  Cancel
                </button>
                <button onClick={() => deleteDoc(deleting)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition-all active:scale-95">
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// TAB 4 — EVALUATION (unchanged)
// ══════════════════════════════════════════════════════════════════
function TabEvaluation({ projId, mentorId, mentorName, members, evaluations, setEvaluations, markingEnabled }) {
  const [showForm, setShowForm] = useState(false);
  const [phase, setPhase] = useState(PHASES[0]);
  const [sc, setSc] = useState({ problem_definition: 0, technical_approach: 0, implementation: 0, presentation: 0, viva: 0 });
  const [fb, setFb] = useState("");
  const [saving, setSaving] = useState(false);
  const total = Object.values(sc).reduce((s, v) => s + Number(v), 0);

  if (!markingEnabled) return (
    <div className="bg-white rounded-2xl p-14 border border-gray-100 shadow-sm text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4 text-3xl">🔒</div>
      <p className="font-bold text-gray-700 text-lg">Evaluation Not Yet Enabled</p>
      <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">Admin hasn't enabled marking for this team. You'll be notified when it becomes available.</p>
    </div>
  );

  const submit = async () => {
    setSaving(true);
    const { data, error } = await supabase.from("evaluations").insert([{ project_id: projId, guide_id: mentorId, phase, score: total, feedback: fb }]).select().single();
    if (!error && data) {
      setEvaluations(p => [data, ...p]);
      setShowForm(false);
      setFb("");
      setSc({ problem_definition: 0, technical_approach: 0, implementation: 0, presentation: 0, viva: 0 });

      // Send notification to team
      const students = (members || []).map(m => m.student_id).filter(Boolean);
      if (students.length > 0) {
        await supabase.from("notifications").insert(students.map(uid => ({
          user_id: uid,
          type: "evaluation",
          title: "New Evaluation Recorded",
          message: `Phase "${phase}" evaluation is complete. Your score is ${total}/${MAX_SCORE}. Evaluated by ${mentorName || "Mentor"}.`,
          read: false,
          created_at: new Date().toISOString()
        })));
      }
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {!showForm && (
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-teal-400 hover:bg-teal-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all active:scale-95"><Ic.Plus /> Add Evaluation</button>
      )}
      {showForm && (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <p className="font-extrabold text-gray-800">New Evaluation — Rubric Based</p>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><Ic.X /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Phase</label>
              <select value={phase} onChange={e => setPhase(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400">
                {PHASES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className={"rounded-xl flex items-center justify-center font-extrabold text-lg " + (total >= 80 ? "bg-emerald-50 text-emerald-700" : total >= 60 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600")}>
              {total}<span className="text-sm font-normal text-gray-400 ml-1">/ {MAX_SCORE}</span>
            </div>
          </div>
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Rubric Criteria</p>
            {RUBRIC.map(c => (
              <div key={c.key} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-sm font-semibold text-gray-700">{c.label}</span>
                  <span className={"text-sm font-extrabold " + (sc[c.key] >= c.max * 0.8 ? "text-emerald-600" : sc[c.key] >= c.max * 0.5 ? "text-amber-500" : "text-red-500")}>
                    {sc[c.key]}<span className="text-xs text-gray-400 font-normal"> / {c.max}</span>
                  </span>
                </div>
                <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div className="absolute h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 pointer-events-none transition-all" style={{ width: (sc[c.key] / c.max * 100) + "%" }} />
                  <input type="range" min="0" max={c.max} value={sc[c.key]} onChange={e => setSc(s => ({ ...s, [c.key]: Number(e.target.value) }))} className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Feedback</label>
            <textarea rows={3} placeholder="Overall feedback for this evaluation phase..." className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" value={fb} onChange={e => setFb(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
            <button onClick={submit} disabled={saving} className="flex-1 bg-teal-400 hover:bg-teal-500 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50 active:scale-95">{saving ? "Submitting…" : "Submit Evaluation"}</button>
          </div>
        </div>
      )}
      {evaluations.length === 0 && !showForm && (
        <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center"><p className="text-gray-400 text-sm">No evaluations yet. Click "Add Evaluation" to begin.</p></div>
      )}
      <div className="space-y-3">
        {evaluations.map((ev, i) => (
          <div key={ev.id || i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div><span className="font-bold text-gray-900">{ev.phase}</span><span className="ml-2 text-xs text-gray-400">{ago(ev.created_at)}</span></div>
              <div className="flex items-center gap-2"><div className={"w-2 h-2 rounded-full " + sBg(ev.score || 0)} /><span className={"text-2xl font-extrabold " + sClr(ev.score || 0)}>{ev.score || 0}<span className="text-sm text-gray-400 font-normal">/100</span></span></div>
            </div>
            {ev.feedback && <p className="text-sm text-gray-500 leading-relaxed border-t border-gray-50 pt-3">{ev.feedback}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 5 — ACTIVITY (unchanged)
// ══════════════════════════════════════════════════════════════════
function TabActivity({ evaluations, documents }) {
  const items = [
    ...evaluations.map(e => ({ emoji: "🎯", time: e.created_at, title: "Evaluation submitted — " + e.phase, sub: "Score: " + (e.score || 0) + "/100", color: "bg-blue-50 border-blue-100", dot: "bg-blue-400" })),
    ...documents.map(d => ({ emoji: "📄", time: d.uploaded_at, title: "Document uploaded — " + (d.file_name || "file"), sub: "by " + (d.profiles?.full_name || "Team member") + " · " + (d.status || "submitted"), color: "bg-teal-50 border-teal-100", dot: "bg-teal-400" })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time));

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{items.length} Event{items.length !== 1 ? "s" : ""}</p>
      {items.length === 0 && <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center"><p className="text-gray-400 text-sm">No activity recorded yet.</p></div>}
      <div className="relative">
        {items.length > 1 && <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-100 z-0" />}
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex gap-4 relative z-10">
              <div className={"w-8 h-8 rounded-full " + item.dot + " flex items-center justify-center text-base flex-shrink-0 mt-0.5 shadow-sm"}>{item.emoji}</div>
              <div className={item.color + " flex-1 rounded-2xl border px-5 py-3.5"}>
                <div className="flex justify-between items-start gap-3">
                  <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{ago(item.time)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN EXPORT — TeamWorkspace
// ══════════════════════════════════════════════════════════════════
const TABS = [
  { key: "overview", label: "Overview", Icon: Ic.Overview },
  { key: "submissions", label: "Submissions", Icon: Ic.Submissions },
  { key: "feedback", label: "Discussions", Icon: Ic.Feedback },
  { key: "evaluation", label: "Evaluation", Icon: Ic.Evaluation },
  { key: "activity", label: "Activity", Icon: Ic.Activity },
];

export default function TeamWorkspace({ proj, mentorId, mentorName, onBack }) {
  const [tab, setTab] = useState("overview");
  const [evaluations, setEvaluations] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [milestoneDates, setMilestoneDates] = useState([]);
  const [reviewDeadlines, setReviewDeadlines] = useState([]);
  const [showReview, setShowReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projectStatus, setProjectStatus] = useState(proj.status);
  const [ideaDecisionBusy, setIdeaDecisionBusy] = useState("");
  const [ideaFeedback, setIdeaFeedback] = useState("");
  const [showIdeaFeedback, setShowIdeaFeedback] = useState(false);
  const [ideaDecisionTarget, setIdeaDecisionTarget] = useState("");
  const members = proj.team_members || [];
  const markingEnabled = true;

  // Supabase fetch
  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from("evaluations").select("*").eq("project_id", proj.id).order("created_at", { ascending: false }),
      supabase.from("documents").select("id,project_id,uploaded_by,document_type,file_name,file_url,file_size,version,status,uploaded_at,feedback,profiles:uploaded_by(full_name,email,roll_number)").eq("project_id", proj.id).order("uploaded_at", { ascending: false }),
      supabase.from("project_milestones").select("phase_index,due_date").eq("project_id", proj.id).order("phase_index", { ascending: true }),
      proj.class_id
        ? supabase
          .from("review_stages")
          .select("id, stage_name, deadline, student_deadline_set_by_coordinator")
          .eq("class_id", proj.class_id)
          .eq("student_deadline_set_by_coordinator", true)
          .not("deadline", "is", null)
          .order("deadline", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]).then(([ev, doc, ms, stages]) => {
      setEvaluations(ev.data || []);
      setDocuments(doc.data || []);
      // Build flat array indexed by phase_index [0..5]
      const dates = Array(6).fill(null);
      (ms.data || []).forEach(r => { dates[r.phase_index] = r.due_date; });
      setMilestoneDates(dates);
      setReviewDeadlines((stages.data || []).map((row) => ({
        id: row.id,
        title: `${proj.class_name || proj.batch || "Class"} - ${normalizeReviewStageName(row.stage_name)}`,
        deadline: row.deadline,
      })));
      setLoading(false);
    });
  }, [proj.batch, proj.class_id, proj.class_name, proj.id]);

  useEffect(() => {
    setProjectStatus(proj.status);
  }, [proj.status]);

  useEffect(() => {
    setIdeaFeedback("");
    setShowIdeaFeedback(false);
    setIdeaDecisionTarget("");
  }, [proj.id]);

  const submitReview = async ({ phase, scores, total, feedback }) => {
    const { data, error } = await supabase.from("evaluations").insert([{ project_id: proj.id, guide_id: mentorId, phase, score: total, feedback }]).select().single();
    if (!error && data) {
      setEvaluations(p => [data, ...p]);
      setShowReview(false);

      // Notify team
      const students = members.map(m => m.student_id).filter(Boolean);
      if (students.length > 0) {
        await supabase.from("notifications").insert(students.map(uid => ({
          user_id: uid,
          type: "evaluation",
          title: "New Review Posted",
          message: `${mentorName || "Mentor"} posted a new review for ${phase}. Total: ${total}/${MAX_SCORE}.`,
          read: false,
          created_at: new Date().toISOString()
        })));
      }
    }
  };

  const handleIdeaDecision = async (status) => {
    if (!proj?.id || !status) return;
    if (!showIdeaFeedback || ideaDecisionTarget !== status) {
      setIdeaDecisionTarget(status);
      setShowIdeaFeedback(true);
      return;
    }

    setIdeaDecisionBusy(status);
    try {
      const updated = await apiRequest(`/projects/${proj.id}/approve`, {
        method: "PUT",
        body: { status, feedback: ideaFeedback.trim() || null },
      });
      setProjectStatus(updated?.status || status);
      setShowIdeaFeedback(false);
      setIdeaDecisionTarget("");
    } finally {
      setIdeaDecisionBusy("");
    }
  };

  const avg = evaluations.length ? Math.round(evaluations.reduce((s, e) => s + Number(e.score || 0), 0) / evaluations.length) : null;
  const phaseIdx = Math.min([...new Set(evaluations.map(e => e.phase))].length, PHASES.length - 1);
  const pct = Math.round((phaseIdx / (PHASES.length - 1)) * 100);
  const logoUrl = getLogoUrl(proj);
  const projInitials = getInitials(proj?.title || "");
  const projGradient = gradFromTitle(proj?.title || "");
  const isDiscussionTab = tab === "feedback";

  return (
    <div className="flex flex-col">
      {/* Hero Banner */}
      <div className={`rounded-2xl overflow-hidden ${isDiscussionTab ? "mb-3" : "mb-6"}`} style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e293b 55%,#134e4a 100%)" }}>
        <div className={isDiscussionTab ? "px-5 pt-4 pb-0" : "px-7 pt-6 pb-0"}>
          {/* Breadcrumb */}
          <nav className={`flex items-center gap-2 ${isDiscussionTab ? "text-xs mb-3" : "text-sm mb-5"}`}>
            <button onClick={onBack} className="text-teal-300 hover:text-teal-200 font-semibold transition-colors">Home</button>
            <span className="text-slate-500">/</span>
            <button onClick={onBack} className="text-teal-300 hover:text-teal-200 font-semibold transition-colors">Projects</button>
            <span className="text-slate-500">/</span>
            <span className="text-slate-200 font-semibold truncate">{proj.title}</span>
          </nav>

          {/* Project header row */}
          <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${isDiscussionTab ? "mb-3" : "mb-5"}`}>
            <div className="flex items-start gap-4">
              <div className={`relative ${isDiscussionTab ? "w-11 h-11 rounded-xl" : "w-14 h-14 rounded-2xl"} border border-white/20 shadow-lg shadow-black/30 overflow-hidden flex items-center justify-center flex-shrink-0`}>
                {logoUrl ? (
                  <img src={logoUrl} alt={proj.title || "Project"} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center text-white font-black ${isDiscussionTab ? "text-xs" : "text-sm"} tracking-wide`} style={{ background: projGradient }}>
                    {projInitials}
                  </div>
                )}
                {!isDiscussionTab && <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900/80 border border-teal-300/30 text-[10px] text-teal-200 flex items-center justify-center">AI</span>}
              </div>
              <div>
                <h1 className={`${isDiscussionTab ? "text-xl" : "text-2xl"} font-extrabold text-white leading-tight`}>{proj.title}</h1>
                {!isDiscussionTab && proj.description && (
                  <p className="text-slate-300 text-sm mt-1 max-w-xl line-clamp-2 leading-relaxed">{proj.description}</p>
                )}
                {!isDiscussionTab && proj.abstract && proj.abstract !== proj.description && (
                  <p className="text-slate-400 text-sm mt-1 max-w-xl line-clamp-1 leading-relaxed">{proj.abstract}</p>
                )}
                <div className={`flex items-center gap-3 ${isDiscussionTab ? "mt-1.5" : "mt-2.5"} flex-wrap`}>
                  <Pill status={projectStatus} />
                  <span className="text-xs text-slate-400">Phase: <span className="text-teal-400 font-semibold">{PHASES[phaseIdx]}</span></span>
                  {avg && <span className={"text-xs font-bold " + sClr(avg)}>Avg: {avg}/100</span>}
                </div>
                {!isDiscussionTab && showIdeaFeedback && (
                  <div className="mt-3 max-w-xl">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Guide Feedback
                    </label>
                    <textarea
                      value={ideaFeedback}
                      onChange={(e) => setIdeaFeedback(e.target.value)}
                      rows={3}
                      placeholder={ideaDecisionTarget === "rejected" ? "Add rejection feedback for the team..." : "Add acceptance feedback for the team..."}
                      className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                    />
                  </div>
                )}
              </div>
            </div>
            {!isDiscussionTab && (
              <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleIdeaDecision("approved")}
                  disabled={ideaDecisionBusy !== ""}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${projectStatus === "approved"
                    ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"} disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  {ideaDecisionBusy === "approved"
                    ? "Accepting..."
                    : showIdeaFeedback && ideaDecisionTarget === "approved"
                      ? "Confirm Accept"
                      : "Accept Idea"}
                </button>
                <button
                  type="button"
                  onClick={() => handleIdeaDecision("rejected")}
                  disabled={ideaDecisionBusy !== ""}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${projectStatus === "rejected"
                    ? "border-rose-300 bg-rose-100 text-rose-800"
                    : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"} disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  {ideaDecisionBusy === "rejected"
                    ? "Rejecting..."
                    : showIdeaFeedback && ideaDecisionTarget === "rejected"
                      ? "Confirm Reject"
                      : "Reject Idea"}
                </button>
                <button onClick={() => setShowReview(true)}
                  className="flex items-center justify-center gap-2 bg-teal-400 hover:bg-teal-300 active:scale-95 text-slate-900 text-sm font-bold px-5 py-2.5 rounded-xl transition-all">
                  <Ic.Star /> Add Review
                </button>
              </div>
            )}
          </div>

          {/* Members + progress */}
          {!isDiscussionTab && <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 pb-4 border-t border-white/10">
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex">
                {members.slice(0, 5).map((tm, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: MC[i % MC.length], marginLeft: i > 0 ? "-7px" : "0" }}>
                    {tm.profiles?.full_name?.[0] || "?"}
                  </div>
                ))}
              </div>
              <span className="text-slate-400 text-xs ml-2">
                {members.map(m => m.profiles?.full_name?.split(" ")[0]).filter(Boolean).slice(0, 3).join(", ")}
                {members.length > 3 ? ` +${members.length - 3}` : ""}&nbsp;· {members.length} member{members.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-3 min-w-[200px]">
              <span className="text-xs text-slate-400 whitespace-nowrap">Progress</span>
              <div className="flex-1 h-3 bg-white/10 border border-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-300 via-cyan-400 to-blue-500 rounded-full transition-all duration-1000 ease-out" style={{ width: pct + "%" }} />
            </div>
            <span className="text-teal-300 font-bold text-xs whitespace-nowrap">{pct}%</span>
          </div>
          </div>}

          {/* Inner tabs */}
          <div className="flex -mb-px overflow-x-auto scrollbar-none">
            {TABS.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={"flex items-center gap-2 " + (isDiscussionTab ? "px-4 py-2.5 text-xs" : "px-5 py-3.5 text-sm") + " font-semibold border-b-2 transition-all whitespace-nowrap flex-shrink-0 " + (
                  tab === key ? "border-teal-400 text-teal-400 bg-white/5" : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}>
                <Icon />{label}
                {key === "evaluation" && !markingEnabled && <Ic.Lock />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      {loading ? <Spin /> : (
        <>
          {tab === "overview" && <TabOverview proj={proj} evaluations={evaluations} members={members} documents={documents} onAddReview={() => setShowReview(true)} onNavigateTab={setTab} mentorId={mentorId} mentorName={mentorName} milestoneDates={milestoneDates} reviewDeadlines={reviewDeadlines} />}
          {tab === "submissions" && <TabSubmissions projId={proj.id} members={members} mentorName={mentorName} />}
          {tab === "feedback" && (
            <MentorDiscussion
              projId={proj.id}
              mentorId={mentorId}
              members={members}
              mentorName={mentorName}
              projectTitle={proj.title}
            />
          )}
          {tab === "evaluation" && <TabEvaluation projId={proj.id} mentorId={mentorId} mentorName={mentorName} members={members} evaluations={evaluations} setEvaluations={setEvaluations} markingEnabled={markingEnabled} />}
          {tab === "activity" && <TabActivity evaluations={evaluations} documents={documents} />}
        </>
      )}
      {showReview && <ReviewModal proj={proj} onClose={() => setShowReview(false)} onSubmit={submitReview} />}
    </div>
  );
}

