import { json, requireAdmin, getCandidate, saveCandidate, tokenStore, newToken, cleanInternId } from "./_shared.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!requireAdmin(req)) return json({ error: "unauthorized" }, 401);

  let rows;
  try { ({ rows } = await req.json()); } catch { return json({ error: "bad json" }, 400); }
  if (!Array.isArray(rows)) return json({ error: "rows[] required" }, 400);

  const tStore = tokenStore();

  // Process rows concurrently so a batch finishes well within the function
  // time limit. The client sends the roster in small batches; each batch's
  // rows are independent (unique Student IDs), so parallel writes are safe.
  const results = await Promise.all(rows.map(async (r) => {
    const internId = cleanInternId(r.internId);
    if (!internId) return "skipped";

    const existing = await getCandidate(internId);
    if (existing) {
      // update contact fields, keep status/token/history
      existing.stateLicenseId = r.stateLicenseId ?? existing.stateLicenseId ?? "";
      existing.firstName = r.firstName || existing.firstName;
      existing.lastName = r.lastName || existing.lastName;
      existing.email = r.email || existing.email;
      await saveCandidate(existing);
      return "updated";
    }

    const token = newToken();
    const c = {
      internId,
      stateLicenseId: r.stateLicenseId || "",
      firstName: (r.firstName || "").trim(),
      lastName: (r.lastName || "").trim(),
      email: (r.email || "").trim(),
      token,
      status: "pending",
      attempts: 0,
      firstContactedAt: null,
      lastContactedAt: null,
      completedAt: null,
      proofKey: null,
      createdAt: new Date().toISOString(),
    };
    await saveCandidate(c);
    await tStore.set(token, internId);
    return "added";
  }));

  let added = 0, updated = 0, skipped = 0;
  for (const s of results) {
    if (s === "added") added++;
    else if (s === "updated") updated++;
    else skipped++;
  }
  return json({ ok: true, added, updated, skipped });
};
