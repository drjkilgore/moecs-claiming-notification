import { json, requireAdmin, getCandidate, contactCandidate, CFG } from "./_shared.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!requireAdmin(req)) return json({ error: "unauthorized" }, 401);

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const ids = Array.isArray(body.internIds) ? body.internIds : [];
  if (!ids.length) return json({ error: "internIds[] required" }, 400);

  if (!CFG.SENDGRID_API_KEY) return json({ error: "SENDGRID_API_KEY not set" }, 400);

  const results = [];
  for (const id of ids) {
    const c = await getCandidate(id);
    if (!c) { results.push({ internId: id, skipped: "not found" }); continue; }
    // Only completed candidates are skipped. Everyone else selected gets emailed:
    //   - already contacted -> reminder (follow-up subject)
    //   - still pending      -> initial email
    if (c.status === "completed") { results.push({ internId: id, skipped: "already completed" }); continue; }
    const isFollowup = c.status === "contacted";
    const r = await contactCandidate(c, { followup: isFollowup });
    results.push(r);
  }
  const sentEmail = results.filter(r => r.email === "sent").length;
  return json({ ok: true, sentEmail, results });
};
