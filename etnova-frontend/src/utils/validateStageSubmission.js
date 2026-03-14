import supabase from "../lib/supabase";

export async function validateStageSubmission(stageId) {
  if (!stageId) return false;

  try {
    const { data, error } = await supabase
      .from("review_stages")
      .select("is_active, is_completed, is_locked")
      .eq("id", stageId)
      .single();

    if (error || !data) return false;
    if (!data.is_active || data.is_completed || data.is_locked) return false;
    return true;
  } catch {
    return false;
  }
}

export default validateStageSubmission;
