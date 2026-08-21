import { checkAndRunPendingJobs } from "../../lib/jobs/checkAndRun";

// No auth on this one deliberately - it's meant to be called by any
// visitor's browser as a background side effect of loading the site.
// It's still safe to expose: the jobs it runs are idempotent (upserts,
// not something that can be corrupted by running twice), and the
// cooldown inside checkAndRunPendingJobs means it can't be hammered into
// spamming FPL's API even if many people load the page at once.
export default async function handler(req, res) {
  try {
    const result = await checkAndRunPendingJobs("visit");
    res.status(200).json(result);
  } catch (err) {
    // Deliberately quiet on failure - this runs silently in the
    // background and must never surface an error to whoever happened to
    // trigger it just by opening the site.
    res.status(200).json({ status: "error", message: err.message });
  }
}
