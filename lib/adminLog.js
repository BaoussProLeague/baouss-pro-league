import { supabaseAdmin } from "./supabase";

export async function logAdminActivity(action, summary, detail, success = true) {
  try {
    await supabaseAdmin.from("admin_activity_log").insert({ action, summary, detail, success });
  } catch (e) {
    // Logging failure should never break the actual admin action - just
    // note it in the server console so you can spot it in Vercel's logs.
    console.error("Failed to write admin activity log:", e.message);
  }
}
