import { getWorkflowProgress } from "../constants/workflowConfig";

const MILESTONE_UI = {
    idea: { id: 1, shortLabel: "Idea", icon: "lightbulb" },
    abstract: { id: 2, shortLabel: "Abstract", icon: "description" },
    zeroth_review: { id: 3, shortLabel: "Zeroth Review", icon: "slideshow" },
    first_review: { id: 4, shortLabel: "1st Review", icon: "slideshow" },
    second_review: { id: 5, shortLabel: "2nd Review", icon: "grading" },
    final_review: { id: 6, shortLabel: "Final Review", icon: "task_alt" },
};

export default function ProjectTracker({ project, documents, deadlines = [] }) {
    const workflowProgress = getWorkflowProgress({ project, documents, deadlines });
    const milestones = workflowProgress.milestones.map((milestone, index) => ({
        ...milestone,
        id: MILESTONE_UI[milestone.key]?.id || (index + 1),
        shortLabel: MILESTONE_UI[milestone.key]?.shortLabel || milestone.label,
        icon: MILESTONE_UI[milestone.key]?.icon || "task",
    }));

    // Find current milestone (first incomplete one)
    const currentMilestoneIndex = milestones.findIndex(m => !m.completed);
    const currentIndex = currentMilestoneIndex === -1 ? milestones.length : currentMilestoneIndex;

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-black text-slate-900">Project Progress</h3>
                    {/*<p className="text-sm text-slate-500 mt-0.5">
                        Design and Implementation of AI-Driven Assessment Tools
                    </p>*/}
                </div>
                <div className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ backgroundColor: '#00D2C4', color: '#000' }}>
                    {currentIndex < milestones.length ? milestones[currentIndex].shortLabel : 'Completed'}
                </div>
            </div>

            {/* Horizontal Timeline */}
            <div className="relative">
                {/* Connection Lines Container */}
                <div className="absolute top-6 left-0 right-0 flex items-center px-8">
                    {milestones.map((milestone, index) => {
                        if (index === milestones.length - 1) return null;
                        const isCurrentCompleted = milestone.completed;
                        return (
                            <div
                                key={`line-${milestone.id}`}
                                className="flex-1 h-1 mx-2 rounded-full transition-all duration-500"
                                style={{
                                    backgroundColor: isCurrentCompleted ? '#00D2C4' : '#e2e8f0',
                                }}
                            />
                        );
                    })}
                </div>

                {/* Milestones */}
                <div className="relative flex justify-between">
                    {milestones.map((milestone) => {
                        const isCompleted = milestone.completed;
                        const isPending = !isCompleted;

                        return (
                            <div key={milestone.id} className="flex flex-col items-center flex-1 relative">
                                {/* Icon Circle */}
                                <div
                                    className="size-12 rounded-full flex items-center justify-center transition-all duration-300 relative z-10"
                                    style={{
                                        backgroundColor: isCompleted ? '#00D2C4' : '#f1f5f9',
                                        color: isCompleted ? '#000' : '#94a3b8',
                                    }}
                                >
                                    <span className="material-symbols-outlined text-xl">
                                        {isCompleted ? 'check' : milestone.icon}
                                    </span>
                                </div>

                                {/* Label */}
                                <div className="mt-3 text-center">
                                    <p
                                        className={`text-xs font-bold ${isCompleted ? 'text-slate-900' : 'text-slate-400'
                                            }`}
                                    >
                                        {milestone.shortLabel}
                                    </p>

                                    {isPending && (
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            {isCompleted ? 'Completed' : 'Pending'}
                                        </p>
                                    )}
                                    {milestone.date && isCompleted && (
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            {new Date(milestone.date).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Progress Percentage */}
            <div className="mt-6 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-600">Overall Progress</span>
                        <div className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
                            <span className="text-xs text-slate-500">
                                {milestones.filter(m => m.completed).length} of {milestones.length} completed
                            </span>
                        </div>
                    </div>
                    <span className="text-sm font-black text-slate-900">
                        {workflowProgress.progressPercent}%
                    </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full transition-all duration-500 rounded-full"
                        style={{
                            width: `${workflowProgress.progressPercent}%`,
                            backgroundColor: '#00D2C4',
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
