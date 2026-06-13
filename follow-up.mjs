import { listCandidates, contactCandidate, CFG } from "./_shared.mjs";

// Netlify Scheduled Function — runs hourly; sends a follow-up to any candidate
// who is "contacted" (not completed), whose last contact was >= FOLLOWUP_HOURS ago,
// and who is under the MAX_FOLLOWUPS cap.
export default async () => {
  const all = await listCandidates();
  const now = Date.now();
  const windowMs = CFG.FOLLOWUP_HOURS * 60 * 60 * 1000;
  let sent = 0, considered = 0;

  for (const c of all) {
    if (c.status === "completed" || c.status === "pending") continue;
    if ((c.attempts || 0) >= CFG.MAX_FOLLOWUPS) continue;
    if (!c.lastContactedAt) continue;
    considered++;
    if (now - new Date(c.lastContactedAt).getTime() >= windowMs) {
      await contactCandidate(c, { followup: true });
      sent++;
    }
  }
  console.log(`[follow-up] considered=${considered} sent=${sent}`);
  return new Response(JSON.stringify({ ok: true, considered, sent }), {
    headers: { "content-type": "application/json" },
  });
};

export const config = { schedule: "@hourly" };
