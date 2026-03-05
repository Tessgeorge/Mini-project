import { useEffect, useMemo, useState } from "react";
import JoinRequestsModal from "../components/JoinRequestsModal";
import { apiRequest } from "../config/apiClient";
import supabase from "../config/supabaseClient";
import { fetchStudentBootstrapData, invalidateStudentBootstrapCache } from "../services/studentData";

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Helpers ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}
function fmtDateTime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isLocked(status) {
  return ["approved", "completed"].includes((status || "").toLowerCase());
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Sub-components ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function Avatar({ name, size = 9, color }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const palette = ["#00D2C4", "#6366f1", "#f59e0b", "#10b981", "#f43f5e", "#8b5cf6"];
  const bg = color || palette[initial.charCodeAt(0) % palette.length];
  const cls = `size-${size} rounded-full flex items-center justify-center font-black text-white text-sm flex-shrink-0`;
  return <div className={cls} style={{ backgroundColor: bg }}>{initial}</div>;
}

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  if (s === "completed") return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
      <span className="material-symbols-outlined text-sm">lock</span>Locked
    </span>
  );
  if (s === "approved") return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="material-symbols-outlined text-sm">verified</span>Approved
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
      <span className="material-symbols-outlined text-sm">group_add</span>Formed
    </span>
  );
}

function RoleBadge({ role }) {
  if (role === "leader") return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
      style={{ backgroundColor: "rgba(0,210,196,0.12)", color: "#00897B", border: "1px solid rgba(0,210,196,0.3)" }}>
      <span className="material-symbols-outlined text-xs">star</span>Leader
    </span>
  );
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
      Member
    </span>
  );
}

function SectionHead({ icon, title, children }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="font-black text-slate-900 flex items-center gap-2 text-base">
        <span className="material-symbols-outlined text-lg" style={{ color: "#00D2C4" }}>{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-900">{value || "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"}</p>
    </div>
  );
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Sprint Board Helpers ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

const PRIORITY = {
  high: { label: "High", cls: "bg-rose-50 text-rose-600 border-rose-200" },
  medium: { label: "Medium", cls: "bg-amber-50 text-amber-600 border-amber-200" },
  low: { label: "Low", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const TASK_STATUS = {
  todo: { label: "To-Do", cls: "bg-slate-100 text-slate-600" },
  in_progress: { label: "In Progress", cls: "bg-blue-50 text-blue-600" },
  done: { label: "Done", cls: "bg-emerald-50 text-emerald-700" },
};

function isUrgent(dueDate) {
  if (!dueDate) return false;
  const diff = (new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24);
  return diff <= 1;
}

function isDoneRecent(task) {
  if (task.status !== "done") return false;
  const updated = task.updated_at || task.created_at;
  if (!updated) return true;
  return (new Date() - new Date(updated)) < 7 * 24 * 60 * 60 * 1000;
}

function fmtShortDate(d) {
  if (!d) return "No due date";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getTaskAssigneeIds(task) {
  const ids = Array.isArray(task?.assignee_ids) ? task.assignee_ids.filter(Boolean) : [];
  if (ids.length > 0) return [...new Set(ids)];
  return task?.assignee_id ? [task.assignee_id] : [];
}

function TaskCard({ task, teamMembers, myId, myRole, onUpdateStatus, onDelete }) {
  const assigneeIds = getTaskAssigneeIds(task);
  const assignees = teamMembers.filter((m) => assigneeIds.includes(m.student_id));
  const isMine = assigneeIds.includes(myId);
  const assigneeFullNames = assignees
    .map((member) => member.profiles?.full_name)
    .filter(Boolean);
  const assigneeNamesLabel = assigneeFullNames.length <= 2
    ? assigneeFullNames.join(", ")
    : `${assigneeFullNames.slice(0, 2).join(", ")} +${assigneeFullNames.length - 2}`;
  const pri = PRIORITY[task.priority] || PRIORITY.medium;
  const sta = TASK_STATUS[task.status] || TASK_STATUS.todo;
  const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p className="text-sm font-black text-slate-900 leading-snug flex-1">{task.title}</p>
        {myRole === "leader" && (
          <button type="button" onClick={() => onDelete(task.id)}
            className="opacity-0 group-hover:opacity-100 size-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all flex-shrink-0">
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        )}
      </div>

      {/* Assignee + Priority row */}
      <div className="flex items-center gap-2 mb-2.5">
        {assignees.length > 0 ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex -space-x-1">
              {assignees.slice(0, 3).map((member) => (
                <div key={member.student_id} className="ring-2 ring-white rounded-full">
                  <Avatar name={member.profiles?.full_name} size={6} />
                </div>
              ))}
            </div>
            <span className="text-[11px] text-slate-500 font-medium truncate">
              {assignees.length === 1
                ? (assignees[0]?.profiles?.full_name?.split(" ")[0] || "Assigned")
                : `${assignees.length} assignees`}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 italic">Unassigned</span>
        )}
        <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${pri.cls}`}>
          {pri.label}
        </span>
      </div>

      {assigneeFullNames.length > 0 && (
        <p className="text-[10px] text-slate-400 mb-2 truncate" title={assigneeFullNames.join(", ")}>
          Assigned: {assigneeNamesLabel}
        </p>
      )}

      {/* Due date */}
      <p className={`text-[11px] font-medium mb-2.5 flex items-center gap-1 ${overdue ? "text-rose-500" : "text-slate-400"}`}>
        <span className="material-symbols-outlined text-xs">{overdue ? "alarm" : "schedule"}</span>
        {fmtShortDate(task.due_date)}
        {overdue && " Ãƒâ€šÂ· Overdue"}
      </p>

      {/* Status control */}
      {(myRole === "leader" || isMine) ? (
        <select
          value={task.status}
          onChange={(e) => onUpdateStatus(task.id, e.target.value)}
          className={`w-full text-[11px] font-bold rounded-lg px-2 py-1.5 border-0 outline-none cursor-pointer ${sta.cls}`}
        >
          <option value="todo">To-Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      ) : (
        <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-bold ${sta.cls}`}>
          {sta.label}
        </span>
      )}
    </div>
  );
}

function SprintColumn({ title, dot, tasks, teamMembers, myId, myRole, onUpdateStatus, onDelete }) {
  return (
    <div className="flex-1 min-w-0 bg-slate-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className={`size-2 rounded-full flex-shrink-0 ${dot}`} />
        <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{title}</p>
        <span className="ml-auto text-[11px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2.5">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-10 text-center">
            <span className="material-symbols-outlined text-2xl text-slate-200 block mb-1">inbox</span>
            <p className="text-xs text-slate-300 font-medium">No tasks</p>
          </div>
        ) : tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            teamMembers={teamMembers}
            myId={myId}
            myRole={myRole}
            onUpdateStatus={onUpdateStatus}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function SprintBoard({ tasks, teamMembers, myRole, profile, onNewTask, onUpdateStatus, onDelete }) {
  const myId = profile?.id;
  const active = tasks.filter((t) => (t.status === "todo" || t.status === "in_progress") && !isUrgent(t.due_date));
  const urgent = tasks.filter((t) => (t.status === "todo" || t.status === "in_progress") && isUrgent(t.due_date));
  const done = tasks.filter((t) => isDoneRecent(t));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-6 py-5 border-b border-slate-100 flex flex-wrap items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-lg" style={{ color: "#00D2C4" }}>
            view_kanban
          </span>
          <h2 className="font-black text-slate-900 text-base">Team Sprint Board</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 ml-1 whitespace-nowrap">
            Internal Workspace
          </span>
        </div>
        {myRole === "leader" && (
          <button type="button" onClick={onNewTask}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-black text-xs font-bold transition-all hover:opacity-90 shrink-0"
            style={{ backgroundColor: "#00D2C4" }}>
            <span className="material-symbols-outlined text-sm">add</span>
            New Task
          </button>
        )}
      </div>

      {/* Board columns */}
      <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <SprintColumn
          title="Urgent"
          dot="bg-rose-400"
          tasks={urgent}
          teamMembers={teamMembers}
          myId={myId}
          myRole={myRole}
          onUpdateStatus={onUpdateStatus}
          onDelete={onDelete}
        />
        <SprintColumn
          title="Active"
          dot="bg-amber-400"
          tasks={active}
          teamMembers={teamMembers}
          myId={myId}
          myRole={myRole}
          onUpdateStatus={onUpdateStatus}
          onDelete={onDelete}
        />
        <SprintColumn
          title="Completed"
          dot="bg-emerald-400"
          tasks={done}
          teamMembers={teamMembers}
          myId={myId}
          myRole={myRole}
          onUpdateStatus={onUpdateStatus}
          onDelete={onDelete}
        />
      </div>

      <div className="px-4 sm:px-5 pb-4 text-[11px] text-slate-400 flex items-start gap-1">
        <span className="material-symbols-outlined text-xs">info</span>
        Not visible to mentor. Does not affect marks or submissions.
        {myRole === "member" && <span className="ml-1">- You can update status of tasks assigned to you.</span>}
      </div>
    </div>
  );
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ New Task Modal ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

function NewTaskModal({ open, onClose, onSave, saving, form, setForm, teamMembers }) {
  if (!open) return null;
  const selectedAssignees = Array.isArray(form.assignee_ids) ? form.assignee_ids : [];
  const toggleAssignee = (studentId) => {
    setForm((f) => {
      const current = Array.isArray(f.assignee_ids) ? f.assignee_ids : [];
      if (current.includes(studentId)) {
        return { ...f, assignee_ids: current.filter((id) => id !== studentId) };
      }
      return { ...f, assignee_ids: [...current, studentId] };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-base" style={{ color: "#00D2C4" }}>add_task</span>
            New Task
          </h3>
          <button type="button" onClick={onClose}
            className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Task Title <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Complete SRS introduction section"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:border-[#00D2C4]"
              style={{ "--tw-ring-color": "#00D2C4" }}
            />
          </div>
          {/* Assignee */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">Assign To</label>
              {selectedAssignees.length > 0 && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, assignee_ids: [] }))}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 overflow-hidden max-h-36 overflow-y-auto">
              {teamMembers.map((m) => {
                const checked = selectedAssignees.includes(m.student_id);
                return (
                  <label
                    key={m.id}
                    className={`px-3 py-2.5 flex items-center gap-2 cursor-pointer border-b border-slate-100 last:border-b-0 ${checked ? "bg-teal-50/50" : "hover:bg-slate-50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAssignee(m.student_id)}
                      className="accent-teal-500"
                    />
                    <span className="text-xs text-slate-700">
                      {m.profiles?.full_name || "Member"} ({m.role})
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {selectedAssignees.length === 0
                ? "No assignees selected."
                : `${selectedAssignees.length} member${selectedAssignees.length !== 1 ? "s" : ""} selected.`}
            </p>
          </div>
          {/* Priority + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Priority</label>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none">
                <option value="todo">To-Do</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>
          </div>
          {/* Due Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none"
            />
          </div>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button type="button" onClick={onSave} disabled={saving || !form.title.trim()}
            className="px-5 py-2 rounded-xl text-black text-sm font-bold disabled:opacity-50 transition-all hover:opacity-90"
            style={{ backgroundColor: "#00D2C4" }}>
            {saving ? "SavingÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Main Component ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬


export default function MyTeam() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showJoinRequests, setShowJoinRequests] = useState(false);

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Sprint Board state ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  const [tasks, setTasks] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", assignee_ids: [], priority: "medium", due_date: "", status: "todo" });
  const [savingTask, setSavingTask] = useState(false);

  const loadTeam = async ({ force = false } = {}) => {
    setLoading(true);
    setError("");
    try {
      const { profile: p, projects } = await fetchStudentBootstrapData({ force });
      setProfile(p);
      const current = projects?.[0];
      setProject(current || null);
    } catch (e) {
      setError(e.message || "Failed to load team");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTeam(); }, []);

  // Load tasks from Supabase
  const loadTasks = async (projectId) => {
    if (!projectId) return;
    try {
      const { data } = await supabase
        .from("team_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      const normalized = (data || []).map((task) => ({
        ...task,
        assignee_ids: getTaskAssigneeIds(task),
      }));
      setTasks(normalized);
    } catch { /* table may not exist yet */ }
  };

  useEffect(() => {
    if (project?.id) loadTasks(project.id);
  }, [project?.id]);

  const saveTask = async () => {
    if (!taskForm.title.trim()) return;
    setSavingTask(true);
    try {
      const assigneeIds = (taskForm.assignee_ids || []).filter(Boolean);
      const payload = {
        project_id: project.id,
        title: taskForm.title.trim(),
        assignee_ids: assigneeIds,
        assignee_id: assigneeIds[0] || null,
        priority: taskForm.priority,
        due_date: taskForm.due_date || null,
        status: taskForm.status,
      };
      const { error } = await supabase.from("team_tasks").insert(payload);
      if (error) throw error;
      setShowTaskModal(false);
      setTaskForm({ title: "", assignee_ids: [], priority: "medium", due_date: "", status: "todo" });
      await loadTasks(project.id);
    } catch (e) {
      if ((e.message || "").includes("assignee_ids")) {
        setError("Please run latest SQL migration to enable multi-assignee tasks.");
      } else {
        setError(e.message || "Failed to create task");
      }
    }
    finally { setSavingTask(false); }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      await supabase.from("team_tasks").update({ status: newStatus }).eq("id", taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (e) { setError(e.message || "Failed to update task"); }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      await supabase.from("team_tasks").delete().eq("id", taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (e) { setError(e.message || "Failed to delete task"); }
  };

  const teamMembers = useMemo(() => project?.team_members || [], [project?.team_members]);
  const leader = teamMembers.find((m) => m.role === "leader");
  const me = teamMembers.find((m) => m.student_id === profile?.id);
  const myRole = me?.role || "member";
  const locked = isLocked(project?.status);

  useEffect(() => {
    const shouldOpenJoinRequests = localStorage.getItem("studentOpenJoinRequests") === "1";
    if (!shouldOpenJoinRequests) return;
    localStorage.removeItem("studentOpenJoinRequests");
    if (myRole === "leader") {
      setShowJoinRequests(true);
    }
  }, [myRole]);

  const recentActivity = useMemo(() => {
    const items = [];
    teamMembers.forEach((m) => {
      const icon = "person_add";
      items.push({
        id: `join-${m.id}`,
        icon,
        text: `${m.profiles?.full_name || "A member"} joined the team`,
        sub: m.role === "leader" ? "Assigned as Team Leader" : "Joined as Member",
        time: m.joined_at,
      });
    });
    if (project?.mentor) items.push({
      id: "mentor-assigned",
      icon: "school",
      text: `Mentor assigned: ${project.mentor.full_name}`,
      sub: "Administrative assignment",
      time: project.updated_at || project.created_at,
    });
    if (project?.coordinator) items.push({
      id: "coord-assigned",
      icon: "admin_panel_settings",
      text: `Coordinator linked: ${project.coordinator.full_name}`,
      sub: "Administrative assignment",
      time: project.updated_at || project.created_at,
    });
    if (["approved", "completed"].includes((project?.status || "").toLowerCase())) items.push({
      id: "approved",
      icon: "verified",
      text: "Team approved by administrator",
      sub: "Team is now locked for editing",
      time: project.updated_at,
    });
    return items.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)).slice(0, 4);
  }, [teamMembers, project]);

  const removeMember = async (studentId, role) => {
    if (role === "leader" || locked) return;
    if (!window.confirm("Remove this member from the team? This action cannot be undone.")) return;
    try {
      await apiRequest(`/projects/${project.id}/team/${studentId}`, { method: "DELETE" });
      invalidateStudentBootstrapCache();
      await loadTeam({ force: true });
    } catch (e) { setError(e.message || "Failed to remove member"); }
  };

  const leaveTeam = async () => {
    if (!project?.id || myRole === "leader") return;
    if (!window.confirm("Are you sure you want to leave this team?")) return;
    try {
      await apiRequest(`/projects/${project.id}/leave`, { method: "DELETE" });
      invalidateStudentBootstrapCache();
      await loadTeam({ force: true });
    } catch (e) { setError(e.message || "Failed to leave team"); }
  };

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Loading ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block size-12 border-4 border-slate-200 border-t-[#00D2C4] rounded-full animate-spin" />
        <p className="mt-4 text-slate-600 font-medium">Loading team structure...</p>
      </div>
    </div>
  );

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ No project ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  if (!project) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="size-20 rounded-2xl mx-auto mb-5 flex items-center justify-center bg-slate-100">
          <span className="material-symbols-outlined text-4xl text-slate-400">group_off</span>
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">No Team Found</h2>
        <p className="text-slate-500 text-sm">Join or create a project to view your team structure here.</p>
      </div>
    </div>
  );

  const teamName = project.title ? `${project.title} Team` : "My Team";
  const teamId = `TM-${project.id?.slice(0, 8)?.toUpperCase()}`;

  return (
    <div className="min-h-full md:min-h-screen etnova-bg">
      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Page Header ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      <div className="glass-topbar sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#00D2C4" }}>
              <span className="material-symbols-outlined text-black">group</span>
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-none">My Team</h1>
              <p className="text-xs text-slate-500 mt-0.5">{project.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {myRole === "member" && !locked && (
              <button onClick={leaveTeam}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold border border-rose-200 text-rose-600 hover:bg-rose-50 transition-all">
                <span className="material-symbols-outlined text-sm">exit_to_app</span>
                <span className="hidden sm:inline">Leave Team</span>
                <span className="sm:hidden">Leave</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-6">

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="material-symbols-outlined text-base">error</span>{error}
          </div>
        )}

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ SECTION 1: Team Header Card ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        <div className="glass-card-strong overflow-hidden">
          <div className="px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#00D2C4] to-[#00a89d] shadow-sm">
                <span className="material-symbols-outlined text-white text-2xl">diversity_3</span>
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">{teamName}</h2>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs font-bold text-slate-400 font-mono tracking-wider">{teamId}</span>
                  {/*<span className="text-slate-300">.</span>*/}
                  <span className="text-xs text-slate-500">Formed {fmtDate(project.created_at)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={project.status} />
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                {teamMembers.length} / 4 Members
              </span>
            </div>
          </div>
          {/* Progress strip */}
          <div className="h-1 w-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(teamMembers.length / 4) * 100}%`, backgroundColor: "#00D2C4" }} />
          </div>
        </div>

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ SECTION 2: Member Management Table ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        <div className="glass-card-strong overflow-hidden">
          <div className="px-4 sm:px-6 py-5 border-b border-slate-100">
            <SectionHead icon="manage_accounts" title="Member Management">
              {myRole === "leader" && !locked && (
                <button
                  onClick={() => setShowJoinRequests(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-black text-xs font-bold transition-all hover:opacity-90"
                  style={{ backgroundColor: "#00D2C4" }}>
                  <span className="material-symbols-outlined text-sm">mail</span>
                  Join Requests
                </button>
              )}
              {myRole === "member" && locked && (
                <span className="text-xs text-slate-400 italic">Read-only ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â team is {project.status}</span>
              )}
            </SectionHead>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 sm:px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Name</th>
                    <th className="text-left px-4 sm:px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Register No.</th>
                    <th className="text-left px-4 sm:px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Department</th>
                    <th className="text-left px-4 sm:px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Role</th>
                    {myRole === "leader" && (
                    <th className="text-left px-4 sm:px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {teamMembers.length === 0 ? (
                    <tr>
                    <td colSpan={myRole === "leader" ? 5 : 4} className="px-4 sm:px-6 py-10 text-center text-sm text-slate-400">
                      No team members found.
                    </td>
                  </tr>
                ) : (
                  teamMembers
                    .sort((a, b) => (a.role === "leader" ? -1 : b.role === "leader" ? 1 : 0))
                    .map((m) => {
                      const isMe = m.student_id === profile?.id;
                      return (
                        <tr key={m.id || m.student_id}
                          className={`transition-colors ${isMe ? "bg-[rgba(0,210,196,0.03)]" : "hover:bg-slate-50"}`}>
                          <td className="px-4 sm:px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={m.profiles?.full_name} size={8} />
                              <div>
                                <p className="font-black text-slate-900 text-sm">
                                  {m.profiles?.full_name || "Unnamed"}
                                </p>
                                {isMe && (
                                  <span className="text-[10px] font-bold text-slate-400">You</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-slate-700 font-mono text-xs">
                            {m.profiles?.roll_number || "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-slate-700 text-sm">
                            {m.profiles?.department || "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"}
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            <RoleBadge role={m.role} />
                          </td>
                          {myRole === "leader" && (
                            <td className="px-4 sm:px-6 py-4">
                              {m.role !== "leader" ? (
                                <button
                                  title="Remove member"
                                  onClick={() => removeMember(m.student_id, m.role)}
                                  disabled={locked}
                                  className="size-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                                  <span className="material-symbols-outlined text-sm">person_remove</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-300 italic pl-1">ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>

          {locked && (
            <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
              <span className="material-symbols-outlined text-sm">lock</span>
              Member changes are disabled ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â team status is <strong className="ml-1">{project.status}</strong>.
            </div>
          )}
        </div>

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ SECTION 3 + 4: Leader Card & Admin Contacts ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Leader Highlight */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-5 border-b border-slate-100">
              <SectionHead icon="star" title="Team Leader" />
            </div>
            <div className="p-6">
              {leader ? (
                <div className="flex items-start gap-4">
                  <Avatar name={leader.profiles?.full_name} size={14} />
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="font-black text-slate-900 text-base">{leader.profiles?.full_name || "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"}</p>
                      <RoleBadge role="leader" />
                    </div>
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      <InfoRow label="Contact Email" value={leader.profiles?.email} />
                      <InfoRow label="Register No." value={leader.profiles?.roll_number} />
                      <InfoRow label="Department" value={leader.profiles?.department} />
                      <InfoRow label="Leadership Since" value={fmtDate(leader.joined_at)} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <span className="material-symbols-outlined text-3xl text-slate-300 block mb-2">person_off</span>
                  <p className="text-sm text-slate-500">No leader assigned</p>
                </div>
              )}
            </div>
          </div>

          {/* Administrative Contacts */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-5 border-b border-slate-100">
              <SectionHead icon="admin_panel_settings" title="Administrative Contacts" />
            </div>
            <div className="divide-y divide-slate-50">
              {/* Mentor */}
              <div className="p-5 flex items-start gap-4">
                <div className="size-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "rgba(0,210,196,0.1)" }}>
                  <span className="material-symbols-outlined text-base" style={{ color: "#00D2C4" }}>school</span>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Assigned Mentor</p>
                  {project.mentor ? (
                    <>
                      <p className="font-black text-slate-900 text-sm">{project.mentor.full_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{project.mentor.department || "Faculty"}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{project.mentor.email}</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Pending assignment</p>
                  )}
                </div>
                {project.mentor && (
                  <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                    <span className="material-symbols-outlined text-xs">verified</span>Assigned
                  </span>
                )}
              </div>

              {/* Coordinator */}
              <div className="p-5 flex items-start gap-4">
                <div className="size-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-100">
                  <span className="material-symbols-outlined text-base text-slate-500">manage_accounts</span>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Project Coordinator</p>
                  {project.coordinator ? (
                    <>
                      <p className="font-black text-slate-900 text-sm">{project.coordinator.full_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{project.coordinator.department || "Administration"}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{project.coordinator.email}</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Not assigned</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ SECTION 5: System Constraints ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 backdrop-blur overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-blue-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-blue-600">info</span>
            <h3 className="font-black text-blue-900 text-sm">System Constraints & Rules</h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: "group",
                title: "Team Size",
                desc: "Maximum 4 members per project team. Teams under 2 members cannot submit.",
              },
              {
                icon: "edit_off",
                title: "Editing Policy",
                desc: "Member changes are disabled once a Proposal is approved by the mentor or admin.",
              },
              {
                icon: "lock",
                title: "Team Locking",
                desc: "Teams are permanently locked after administrator approval. No structural changes allowed.",
              },
            ].map((c) => (
              <div key={c.title} className="flex items-start gap-3">
                <div className="size-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-sm text-blue-600">{c.icon}</span>
                </div>
                <div>
                  <p className="text-xs font-black text-blue-900">{c.title}</p>
                  <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Sprint Board + Activity ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â side by side ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

          {/* LEFT: Team Sprint Board (wider) */}
          <div className="lg:col-span-2 flex flex-col">
            <SprintBoard
              tasks={tasks}
              teamMembers={teamMembers}
              myRole={myRole}
              profile={profile}
              onNewTask={() => setShowTaskModal(true)}
              onUpdateStatus={updateTaskStatus}
              onDelete={deleteTask}
            />
          </div>

          {/* RIGHT: Recent Team Activity */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 sm:px-6 py-5 border-b border-slate-100">
              <SectionHead icon="history" title="Recent Activity" />
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              {recentActivity.length === 0 ? (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-3xl text-slate-300 block mb-2">timeline</span>
                  <p className="text-sm text-slate-400">No structural activity recorded yet.</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-100" />
                  <div className="space-y-5">
                    {recentActivity.map((item, i) => (
                      <div key={item.id} className="flex items-start gap-4 pl-2">
                        <div className="size-8 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                          style={{ backgroundColor: i === 0 ? "rgba(0,210,196,0.15)" : "rgba(100,116,139,0.08)" }}>
                          <span className="material-symbols-outlined text-sm"
                            style={{ color: i === 0 ? "#00D2C4" : "#94a3b8" }}>
                            {item.icon}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm font-bold text-slate-900">{item.text}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{item.sub}</p>
                          <p className="text-[11px] text-slate-400 mt-1">{fmtDateTime(item.time)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>



      </div>

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Join Requests Modal ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      <JoinRequestsModal
        isOpen={showJoinRequests}
        onClose={() => setShowJoinRequests(false)}
        onRequestHandled={loadTeam}
      />

      {/* ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ New Task Modal ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ */}
      <NewTaskModal
        open={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onSave={saveTask}
        saving={savingTask}
        form={taskForm}
        setForm={setTaskForm}
        teamMembers={teamMembers}
      />
    </div>
  );
}
