import { useMemo, useState } from "react";
import ProgressFilters from "./ProgressFilters";
import ClassProgressCard from "./ClassProgressCard";

function buildClassProgress({ classFilter, stageFilter, statusFilter, classes, teams, activeStage }) {
  const visibleClasses =
    classFilter === "All Classes"
      ? classes
      : classes.filter((item) => item.id === classFilter);

  const stageScopedTeams = teams.filter((team) => {
    if (stageFilter === "All Stages") return true;
    if (stageFilter === "Final Review") return team.stage === "Final Review";
    return team.stage === stageFilter;
  });

  const statusScopedTeams = stageScopedTeams.filter((team) =>
    statusFilter === "All"
      ? true
      : statusFilter === "Completed"
        ? team.submissionStatus === "Submitted"
        : statusFilter === "Pending"
          ? team.submissionStatus === "Pending" || team.submissionStatus === "Late"
          : team.stage === activeStage
  );

  return visibleClasses.map((classItem) => {
    const classTeams = statusScopedTeams.filter((team) => team.class === classItem.id);
    const totalTeams = classTeams.length;
    const completedTeams = classTeams.filter((team) => team.submissionStatus === "Submitted").length;
    const activeTeams = classTeams.filter((team) => team.stage === activeStage).length;
    const pendingTeams = totalTeams - completedTeams - activeTeams;
    const completion = totalTeams > 0 ? Math.round((completedTeams / totalTeams) * 100) : 0;

    return {
      className: classItem.name,
      totalTeams,
      completedTeams,
      activeTeams,
      pendingTeams,
      completion,
    };
  });
}

export default function ClassProgressAnalyzer({ classes, teams, activeStage }) {
  const [classFilter, setClassFilter] = useState("All Classes");
  const [stageFilter, setStageFilter] = useState("All Stages");
  const [statusFilter, setStatusFilter] = useState("All");

  const progressData = useMemo(
    () => buildClassProgress({ classFilter, stageFilter, statusFilter, classes, teams, activeStage }),
    [activeStage, classFilter, classes, stageFilter, statusFilter, teams]
  );

  return (
    <section className="bg-white rounded-xl shadow-md p-6 border border-gray-100 space-y-5">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-gray-800">Class-wise Progress Analyzer</h2>
        <ProgressFilters
          classes={classes}
          classFilter={classFilter}
          stageFilter={stageFilter}
          statusFilter={statusFilter}
          onClassChange={setClassFilter}
          onStageChange={setStageFilter}
          onStatusChange={setStatusFilter}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {progressData.map((item) => (
          <ClassProgressCard key={item.className} item={item} />
        ))}
      </div>
    </section>
  );
}
