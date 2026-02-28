import { useState } from "react";

const DEADLINES = [
    { label: "Abstract Submission", date: "2026-03-01", note: "Mandatory" },
    { label: "Project Proposal", date: "2026-03-15", note: "Mandatory" },
    { label: "Progress Report", date: "2026-04-10", note: "Mandatory Review" },
    { label: "Final Report", date: "2026-05-01", note: "End-semester" },
    { label: "Presentation / PPT", date: "2026-05-15", note: "Viva Included" },
];

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildCalendar(year, month) {
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = firstDay - 1; i >= 0; i--)
        cells.push({ day: prevDays - i, cur: false });
    for (let d = 1; d <= daysInMonth; d++)
        cells.push({ day: d, cur: true });
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++)
        cells.push({ day: d, cur: false });
    return cells;
}

export default function DeadlinesCalendar() {
    const now = new Date();
    const [viewYear, setViewYear] = useState(now.getFullYear());
    const [viewMonth, setViewMonth] = useState(now.getMonth());

    const cells = buildCalendar(viewYear, viewMonth);

    // Deadline dates as Set of "YYYY-MM-DD"
    const deadlineDates = new Set(DEADLINES.map(d => d.date));

    const isToday = (day, cur) => {
        return cur &&
            day === now.getDate() &&
            viewMonth === now.getMonth() &&
            viewYear === now.getFullYear();
    };

    const isDeadline = (day, cur) => {
        if (!cur) return false;
        const mm = String(viewMonth + 1).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        return deadlineDates.has(`${viewYear}-${mm}-${dd}`);
    };

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const upcomingDeadlines = DEADLINES
        .filter(d => new Date(d.date) >= new Date(now.toDateString()))
        .slice(0, 4);

    return (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <div className="size-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(0,210,196,0.12)" }}>
                    <span className="material-symbols-outlined text-base" style={{ color: "#00D2C4" }}>calendar_month</span>
                </div>
                <h3 className="font-black text-slate-900">Deadlines</h3>
            </div>

            <div className="p-5">
                {/* Month nav */}
                <div className="flex items-center justify-between mb-3">
                    <button onClick={prevMonth} className="size-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-all text-slate-500">
                        <span className="material-symbols-outlined text-base">chevron_left</span>
                    </button>
                    <span className="text-sm font-black text-slate-800">{MONTHS[viewMonth]} {viewYear}</span>
                    <button onClick={nextMonth} className="size-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-all text-slate-500">
                        <span className="material-symbols-outlined text-base">chevron_right</span>
                    </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                    {DAYS.map((d, i) => (
                        <div key={i} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-y-0.5">
                    {cells.map((cell, i) => {
                        const today = isToday(cell.day, cell.cur);
                        const deadline = isDeadline(cell.day, cell.cur);

                        let cls = "flex items-center justify-center size-7 mx-auto rounded-full text-[12px] font-semibold transition-all ";
                        if (!cell.cur) cls += "text-slate-300";
                        else if (today) cls += "text-white font-black";
                        else if (deadline) cls += "text-white font-black";
                        else cls += "text-slate-700 hover:bg-slate-100 cursor-default";

                        let style = {};
                        if (today) style = { backgroundColor: "#0F2322" };
                        else if (deadline) style = { backgroundColor: "#00D2C4" };

                        return (
                            <div key={i} className="py-0.5">
                                <div className={cls} style={style}>{cell.day}</div>
                            </div>
                        );
                    })}
                </div>

                {/* Upcoming deadlines list */}
                {upcomingDeadlines.length > 0 && (
                    <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
                        {upcomingDeadlines.map((dl, i) => {
                            const d = new Date(dl.date);
                            const mon = MONTHS[d.getMonth()].toUpperCase();
                            const day = d.getDate();
                            return (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="min-w-[40px] rounded-xl text-center py-1.5 px-1"
                                        style={{ backgroundColor: "rgba(0,210,196,0.1)" }}>
                                        <p className="text-[9px] font-black uppercase" style={{ color: "#00D2C4" }}>{mon}</p>
                                        <p className="text-base font-black text-slate-900 leading-none">{day}</p>
                                    </div>
                                    <div className="pt-1">
                                        <p className="text-sm font-bold text-slate-800 leading-snug">{dl.label}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{dl.note}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
