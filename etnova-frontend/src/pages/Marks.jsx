import { useEffect, useMemo, useState } from "react";
import { fetchStudentBootstrapData } from "../services/studentData";

const RUBRIC_TEMPLATE = {
  abstract: [
    { name: "Clarity", weight: 30 },
    { name: "Feasibility", weight: 35 },
    { name: "Innovation", weight: 35 },
  ],
  mid_review: [
    { name: "Technical Progress", weight: 40 },
    { name: "Documentation", weight: 30 },
    { name: "Communication", weight: 30 },
  ],
  final_presentation: [
    { name: "Content", weight: 40 },
    { name: "Delivery", weight: 30 },
    { name: "Q&A", weight: 30 },
  ],
  documentation: [
    { name: "Structure", weight: 35 },
    { name: "Completeness", weight: 35 },
    { name: "References", weight: 30 },
  ],
};

function gradeFromPercent(percent) {
  if (percent >= 90) return "A+";
  if (percent >= 80) return "A";
  if (percent >= 70) return "B";
  if (percent >= 60) return "C";
  return "D";
}

export default function Marks() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [project, setProject] = useState(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const { projects } = await fetchStudentBootstrapData();
        const p = projects?.[0];
        if (!p?.id) return;
        // list embeds evaluations inline — no second fetch needed
        setProject(p);
      } catch (e) {
        setError(e.message || "Failed to load marks.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const evaluations = useMemo(() => project?.evaluations || [], [project?.evaluations]);
  const totals = useMemo(() => {
    const obtained = evaluations.reduce((sum, e) => sum + Number(e.obtained_marks || 0), 0);
    const max = evaluations.reduce((sum, e) => sum + Number(e.max_marks || 0), 0);
    const percent = max > 0 ? (obtained / max) * 100 : 0;
    return { obtained, max, percent };
  }, [evaluations]);

  if (loading) return <div className="min-h-screen etnova-bg flex items-center justify-center text-slate-600">Loading marks...</div>;
  if (!project) return <div className="min-h-screen etnova-bg flex items-center justify-center text-slate-600">No project found.</div>;

  return (
    <div className="min-h-screen px-6 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Marks</h1>
          <p className="text-sm text-slate-500 mt-1">Academic evaluation transparency.</p>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500 font-bold uppercase">Total Marks</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{totals.obtained}/{totals.max || 0}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500 font-bold uppercase">Percentage</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{totals.percent.toFixed(1)}%</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500 font-bold uppercase">Final Grade</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{gradeFromPercent(totals.percent)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs text-slate-500 font-bold uppercase">Evaluated Stages</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{evaluations.length}</p>
          </div>
        </div>

        <div className="glass-card-strong p-5">
          <h2 className="font-black text-slate-900 mb-4">Stage-wise Marks</h2>
          {evaluations.length === 0 ? (
            <p className="text-sm text-slate-500">No marks published yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-slate-500 text-xs uppercase">Stage</th>
                    <th className="text-left py-2 text-slate-500 text-xs uppercase">Obtained</th>
                    <th className="text-left py-2 text-slate-500 text-xs uppercase">Max</th>
                    <th className="text-left py-2 text-slate-500 text-xs uppercase">Percent</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluations.map((e) => {
                    const percent = e.max_marks ? (Number(e.obtained_marks) / Number(e.max_marks)) * 100 : 0;
                    return (
                      <tr key={e.id} className="border-b border-slate-50">
                        <td className="py-3 font-semibold capitalize">{e.evaluation_type?.replaceAll("_", " ")}</td>
                        <td className="py-3">{e.obtained_marks}</td>
                        <td className="py-3">{e.max_marks}</td>
                        <td className="py-3">{percent.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="glass-card-strong p-5">
          <h2 className="font-black text-slate-900 mb-4">Rubric Breakdown</h2>
          {evaluations.length === 0 ? (
            <p className="text-sm text-slate-500">Rubric breakdown appears after evaluation.</p>
          ) : (
            <div className="space-y-5">
              {evaluations.map((e) => {
                const rubrics = RUBRIC_TEMPLATE[e.evaluation_type] || [
                  { name: "Criteria 1", weight: 34 },
                  { name: "Criteria 2", weight: 33 },
                  { name: "Criteria 3", weight: 33 },
                ];
                return (
                  <div key={`rubric-${e.id}`} className="glass-card p-4">
                    <p className="text-sm font-black capitalize text-slate-900 mb-3">{e.evaluation_type?.replaceAll("_", " ")}</p>
                    <div className="space-y-2">
                      {rubrics.map((r) => {
                        const approx = ((Number(e.obtained_marks || 0) * r.weight) / 100).toFixed(2);
                        return (
                          <div key={`${e.id}-${r.name}`}>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-700">{r.name}</span>
                              <span className="text-slate-500">{approx} pts ({r.weight}%)</span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-slate-100">
                              <div className="h-2 rounded-full bg-teal-400" style={{ width: `${Math.max(8, r.weight)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-card-strong p-5">
          <h2 className="font-black text-slate-900 mb-4">Performance Chart</h2>
          {evaluations.length === 0 ? (
            <p className="text-sm text-slate-500">No chart data yet.</p>
          ) : (
            <div className="space-y-3">
              {evaluations.map((e) => {
                const percent = e.max_marks ? (Number(e.obtained_marks) / Number(e.max_marks)) * 100 : 0;
                return (
                  <div key={`bar-${e.id}`}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold capitalize">{e.evaluation_type?.replaceAll("_", " ")}</span>
                      <span>{percent.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.max(4, Math.min(100, percent))}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
