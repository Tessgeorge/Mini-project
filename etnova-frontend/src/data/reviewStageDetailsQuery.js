import supabase from "../lib/supabase";

export async function fetchReviewStageDetails() {
  try {
    const { data: classRows, error: classError } = await supabase
      .from("classes")
      .select("id, class_section, department");
    if (classError) throw classError;

    const classById = new Map((classRows || []).map((row) => [row.id, row]));

    const { data, error } = await supabase
      .from("review_stages")
      .select(`
        id,
        stage_name,
        deadline,
        is_active,
        is_completed,
        is_locked,
        class_id,
        projects (
          id,
          title,
          guide_allocations (
            id,
            guide_id,
            status,
            profiles:guide_id (
              id,
              full_name
            )
          )
        )
      `)
      .order("deadline", { ascending: true });

    if (error) throw error;

    return {
      data: (data || []).map((stage) => ({
        ...stage,
        class: classById.get(stage.class_id) || null,
      })),
      error: null,
    };
  } catch (err) {
    return { data: [], error: err.message || "Failed to fetch review stage details." };
  }
}

export default fetchReviewStageDetails;
