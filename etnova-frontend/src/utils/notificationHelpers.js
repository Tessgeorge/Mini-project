import supabase from "../config/supabaseClient";

export function uniqueNotificationUserIds(values = []) {
  return [...new Set((values || []).filter(Boolean))];
}

export async function createNotifications(rows = []) {
  const preparedRows = (rows || [])
    .filter((row) => row?.user_id && row?.title && row?.message)
    .map((row) => ({
      read: false,
      created_at: new Date().toISOString(),
      ...row,
    }));

  if (preparedRows.length === 0) return;

  const { error } = await supabase.from("notifications").insert(preparedRows);
  if (error) {
    console.error("Notification insert skipped:", error.message || error);
  }
}

export function formatProjectNotificationLabel(project) {
  return project?.team_name || project?.title || "your team";
}

export function formatClassNotificationLabel(classRow) {
  return classRow?.class_section || classRow?.class_name || "your class";
}
