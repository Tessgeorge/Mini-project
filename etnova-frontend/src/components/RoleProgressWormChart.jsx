import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const PHASE_LABELS = ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Final"];

const ROLE_CONFIG = {
  guide: {
    label: "Guide",
    color: "#ef4444",
    softColor: "rgba(239, 68, 68, 0.12)",
    weights: [0.12, 0.34, 0.56, 0.78, 1],
  },
  coordinator: {
    label: "Coordinator",
    color: "#22c55e",
    softColor: "rgba(34, 197, 94, 0.12)",
    weights: [0.1, 0.3, 0.54, 0.8, 1],
  },
};

const STATUS_STYLES = {
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  progress: "border-amber-200 bg-amber-50 text-amber-700",
  idle: "border-rose-200 bg-rose-50 text-rose-700",
};

const endLabelPlugin = {
  id: "roleProgressEndLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const offsets = [-10, 10];

    ctx.save();
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta?.data?.length || meta.hidden) return;

      const point = meta.data[meta.data.length - 1];
      const rawValue = dataset.data?.[dataset.data.length - 1];
      const value = Number.isFinite(Number(rawValue)) ? Math.round(Number(rawValue)) : 0;

      ctx.fillStyle = dataset.borderColor;
      ctx.fillText(
        `${dataset.label} ${value}%`,
        point.x + 10,
        point.y + (offsets[datasetIndex] || 0),
      );
    });

    ctx.restore();
  },
};

function clampPercentage(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(value))));
}

function getFinalProgress(role) {
  if (!role?.assigned) return 0;

  const tasksCompleted = Math.max(0, Number(role?.tasksCompleted || 0));
  const totalTasks = Math.max(0, Number(role?.totalTasks || 0));

  if (totalTasks <= 0) return 0;
  if (tasksCompleted >= totalTasks) return 100;
  return clampPercentage((tasksCompleted / totalTasks) * 100);
}

function normalizeTimeline(roleKey, role = {}) {
  if (!role?.assigned) return PHASE_LABELS.map(() => 0);

  const finalProgress = getFinalProgress(role);
  if (finalProgress === 0) return PHASE_LABELS.map(() => 0);

  if (Array.isArray(role.progressTimeline) && role.progressTimeline.length > 0) {
    const padded = PHASE_LABELS.map((_, index) => {
      const raw = role.progressTimeline[Math.min(index, role.progressTimeline.length - 1)];
      return clampPercentage(raw);
    });

    let previous = 0;
    const monotonic = padded.map((value, index) => {
      const capped = index === padded.length - 1 ? finalProgress : Math.min(value, finalProgress);
      const nextValue = Math.max(previous, capped);
      previous = nextValue;
      return nextValue;
    });
    monotonic[monotonic.length - 1] = finalProgress;
    return monotonic;
  }

  const weights = ROLE_CONFIG[roleKey]?.weights || ROLE_CONFIG.guide.weights;
  let previous = 0;

  return weights.map((weight, index) => {
    if (index === weights.length - 1) return finalProgress;

    const seededValue = clampPercentage(finalProgress * weight);
    const minimumGrowth = finalProgress > 0 ? Math.min(finalProgress, (index + 1) * 6) : 0;
    const nextValue = Math.max(previous, Math.min(finalProgress, Math.max(seededValue, minimumGrowth)));
    previous = nextValue;
    return nextValue;
  });
}

function getStatusMeta(role, progress) {
  if (!role?.assigned) return { label: "Not Assigned", tone: "idle" };
  if (progress >= 100) return { label: "Completed", tone: "completed" };
  return { label: "In Progress", tone: "progress" };
}

export default function RoleProgressWormChart({ roleData = {} }) {
  const summaries = useMemo(() => Object.entries(ROLE_CONFIG).map(([key, config]) => {
    const role = roleData[key] || {};
    const progress = getFinalProgress(role);
    const timeline = normalizeTimeline(key, role);
    const status = getStatusMeta(role, progress);

    return {
      key,
      ...config,
      progress,
      timeline,
      status,
      tasksCompleted: Math.max(0, Number(role?.tasksCompleted || 0)),
      totalTasks: Math.max(0, Number(role?.totalTasks || 0)),
    };
  }), [roleData]);

  const chartData = useMemo(() => ({
    labels: PHASE_LABELS,
    datasets: summaries.map((role) => ({
      label: role.label,
      data: role.timeline,
      borderColor: role.color,
      backgroundColor: role.softColor,
      borderWidth: 3,
      tension: 0.38,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHitRadius: 18,
      pointHoverBorderWidth: 2,
      pointHoverBackgroundColor: "#ffffff",
      pointHoverBorderColor: role.color,
    })),
  }), [summaries]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    animation: {
      duration: 1400,
      easing: "easeOutQuart",
    },
    layout: {
      padding: {
        top: 8,
        right: 92,
        bottom: 0,
        left: 0,
      },
    },
    plugins: {
      legend: {
        position: "top",
        align: "start",
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 10,
          boxHeight: 10,
          padding: 20,
          color: "#475569",
          font: {
            size: 12,
            weight: 600,
          },
        },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.94)",
        titleColor: "#f8fafc",
        bodyColor: "#e2e8f0",
        padding: 12,
        displayColors: true,
        callbacks: {
          label(context) {
            return `${context.dataset.label}: ${clampPercentage(context.parsed.y)}%`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(148, 163, 184, 0.08)",
          drawBorder: false,
        },
        ticks: {
          color: "#94a3b8",
          font: {
            size: 11,
            weight: 600,
          },
        },
        border: {
          display: false,
        },
      },
      y: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          color: "#94a3b8",
          callback: (value) => `${value}%`,
          font: {
            size: 11,
          },
        },
        grid: {
          color: "rgba(148, 163, 184, 0.16)",
          drawBorder: false,
        },
        border: {
          display: false,
        },
      },
    },
  }), []);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Overall Role Progress</p>
          <h3 className="mt-1 text-xl font-extrabold text-slate-900">Role Progress Worm Graph</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {summaries.map((role) => (
            <div
              key={role.key}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${STATUS_STYLES[role.status.tone]}`}
            >
              <span className="text-slate-700">{role.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="h-[320px] rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-50 p-3">
          <Line data={chartData} options={chartOptions} plugins={[endLabelPlugin]} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {summaries.map((role) => (
            <div key={role.key} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: role.color }} />
                <p className="text-sm font-bold text-slate-800">{role.label}</p>
              </div>
              <p className="mt-3 text-3xl font-extrabold text-slate-900">{role.progress}%</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{role.status.label}</p>
              <p className="mt-3 text-xs text-slate-500">
                {role.totalTasks > 0
                  ? `${role.tasksCompleted}/${role.totalTasks} tasks completed`
                  : "No tasks mapped for this role yet"}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
