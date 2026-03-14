import supabase from "../lib/supabase";

const MAX_PROJECTS_PER_MENTOR = 2;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function pickMentorForProject(mentors, workloadMap) {
  const available = mentors.filter((mentor) => (workloadMap.get(mentor.id) || 0) < MAX_PROJECTS_PER_MENTOR);
  if (available.length === 0) return null;
  const minLoad = Math.min(...available.map((mentor) => workloadMap.get(mentor.id) || 0));
  const leastLoaded = available.filter((mentor) => (workloadMap.get(mentor.id) || 0) === minLoad);
  return leastLoaded[Math.floor(Math.random() * leastLoaded.length)];
}

export async function runRandomAllocation() {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const adminId = authData?.user?.id;
    if (!isUuid(adminId)) throw new Error("Authenticated admin user not found.");

    const [mentorResult, projectResult, allocationResult] = await Promise.all([
      supabase.from("profiles").select("id, full_name").eq("role", "mentor").order("id", { ascending: true }),
      supabase.from("projects").select("id").order("id", { ascending: true }),
      supabase.from("guide_allocations").select("id, project_id, status, assigned_at").order("assigned_at", { ascending: false }),
    ]);
    if (mentorResult.error) throw mentorResult.error;
    if (projectResult.error) throw projectResult.error;
    if (allocationResult.error) throw allocationResult.error;

    const mentors = (mentorResult.data || []).filter((mentor) => isUuid(mentor.id));
    const projects = (projectResult.data || []).filter((project) => isUuid(project.id));
    const existingAllocations = (allocationResult.data || []).filter((row) => isUuid(row.id) && isUuid(row.project_id));

    if (mentors.length === 0) {
      return {
        success: false,
        message: "No mentors found with role = mentor.",
        warning: "Allocation was not performed.",
        allocations: [],
        mentorWorkload: [],
      };
    }

    const rowsByProject = new Map();
    existingAllocations.forEach((row) => {
      const list = rowsByProject.get(row.project_id) || [];
      list.push(row);
      rowsByProject.set(row.project_id, list);
    });

    const randomizedMentors = shuffle(mentors);
    const workloadMap = new Map(randomizedMentors.map((mentor) => [mentor.id, 0]));
    const targetAssignments = [];

    for (const project of projects) {
      const selectedMentor = pickMentorForProject(randomizedMentors, workloadMap);
      if (!selectedMentor) break;
      workloadMap.set(selectedMentor.id, (workloadMap.get(selectedMentor.id) || 0) + 1);
      targetAssignments.push({
        project_id: project.id,
        guide_id: selectedMentor.id,
        assigned_by: adminId,
        status: "active",
        assigned_at: new Date().toISOString(),
      });
    }

    const idsToDeactivate = [];
    const updates = [];
    const inserts = [];

    for (const assignment of targetAssignments) {
      const projectRows = rowsByProject.get(assignment.project_id) || [];
      if (projectRows.length > 0) {
        const [primary, ...rest] = projectRows;
        updates.push({
          id: primary.id,
          project_id: assignment.project_id,
          guide_id: assignment.guide_id,
          assigned_by: adminId,
          status: "active",
          assigned_at: assignment.assigned_at,
          comment: "Assigned by random allocation",
        });
        rest.forEach((row) => {
          if (String(row.status || "").toLowerCase() === "active") idsToDeactivate.push(row.id);
        });
      } else {
        inserts.push({
          project_id: assignment.project_id,
          guide_id: assignment.guide_id,
          assigned_by: adminId,
          status: "active",
          assigned_at: assignment.assigned_at,
          comment: "Assigned by random allocation",
        });
      }
    }

    const assignedProjectIds = new Set(targetAssignments.map((row) => row.project_id));
    existingAllocations.forEach((row) => {
      if (!assignedProjectIds.has(row.project_id) && String(row.status || "").toLowerCase() === "active") {
        idsToDeactivate.push(row.id);
      }
    });

    if (idsToDeactivate.length > 0) {
      const { error: deactivateError } = await supabase
        .from("guide_allocations")
        .update({ status: "inactive", comment: "Replaced by random allocation" })
        .in("id", Array.from(new Set(idsToDeactivate)));
      if (deactivateError) throw deactivateError;
    }

    if (updates.length > 0) {
      const { error: updateError } = await supabase
        .from("guide_allocations")
        .upsert(updates, { onConflict: "id" });
      if (updateError) throw updateError;
    }

    const { data: inserted, error: insertError } = inserts.length > 0
      ? await supabase.from("guide_allocations").insert(inserts).select("id, project_id, guide_id, status, assigned_by")
      : { data: [], error: null };

    if (insertError) throw insertError;

    const mentorWorkload = randomizedMentors.map((mentor) => ({
      guide_id: mentor.id,
      mentor_name: mentor.full_name || "Unnamed Mentor",
      active_projects: workloadMap.get(mentor.id) || 0,
      max_projects: MAX_PROJECTS_PER_MENTOR,
    }));

    const unallocatedProjects = Math.max(0, projects.length - targetAssignments.length);
    const warning = unallocatedProjects > 0
      ? `Capacity exceeded: ${unallocatedProjects} project(s) could not be allocated.`
      : null;

    return {
      success: true,
      message: warning ? "Random allocation completed with capacity warning." : "Random allocation completed successfully.",
      warning,
      allocations: inserted || [],
      mentorWorkload,
    };
  } catch (error) {
    return {
      success: false,
      message: "Random mentor allocation failed.",
      warning: null,
      allocations: [],
      mentorWorkload: [],
      error: error?.message || "Unexpected error during mentor allocation.",
    };
  }
}

export const runRandomMentorAllocation = runRandomAllocation;

export default runRandomAllocation;
