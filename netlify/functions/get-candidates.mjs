import { json, requireAdmin, listCandidates, CFG } from "./_shared.mjs";

export default async (req) => {
  if (!requireAdmin(req)) return json({ error: "unauthorized" }, 401);
  const all = await listCandidates();
  const summary = {
    total: all.length,
    pending: all.filter(c => c.status === "pending").length,
    contacted: all.filter(c => c.status === "contacted").length,
    completed: all.filter(c => c.status === "completed").length,
    errors: all.filter(c => c.lastError).length,
  };
  const env = {
    sendgrid: !!CFG.SENDGRID_API_KEY,
    siteUrl: CFG.SITE_URL,
    followupHours: CFG.FOLLOWUP_HOURS,
    maxFollowups: CFG.MAX_FOLLOWUPS,
  };
  // strip token from list payload for safety; keep proof link prebuilt
  const candidates = all.map(c => ({
    ...c,
    proofLink: CFG.SITE_URL ? `${CFG.SITE_URL}/proof.html?t=${c.token}` : `/proof.html?t=${c.token}`,
  }));
  return json({ ok: true, summary, env, candidates });
};
