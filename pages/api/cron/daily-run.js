import { checkAndRunPendingJobs } from "../../../lib/jobs/checkAndRun";

// This is the GitHub Actions entry point - see .github/workflows/auto-run.yml
// in this project. Vercel's own Hobby cron tier only allows once a day,
// so a scheduled GitHub Actions workflow pings this route every 15-30
// minutes instead - that workflow runs on GitHub's infrastructure, not
// Vercel's, so it isn't subject to that limit at all. This route just
// needs the shared secret to prove the request is really from your
// workflow and not anyone else.
export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const result = await checkAndRunPendingJobs("cron");
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
