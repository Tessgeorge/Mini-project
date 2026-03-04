import supabase from "../lib/supabase";

export async function fetchReviewStageDetails() {
  try {
    const { data, error } = await supabase
      .from("review_stages")
      .select(`
        id,
        stage_name,
        deadline,
        is_active,
        is_completed,
        is_locked,
        classes:class_id (
          id,
          class_name,
          department
        ),
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
        class: Array.isArray(stage.classes) ? stage.classes[0] || null : stage.classes || null,
      })),
      error: null,
    };
  } catch (err) {
    return { data: [], error: err.message || "Failed to fetch review stage details." };
  }
}

export default fetchReviewStageDetails;
