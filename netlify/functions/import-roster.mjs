import { json, requireAdmin, getCandidate, saveCandidate, tokenStore, newToken, cleanInternId } from "./_shared.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!requireAdmin(req)) return json({ error: "unauthorized" }, 401);

  let rows;
  try { ({ rows } = await req.json()); } catch { return json({ error: "bad json" }, 400); }
  if (!Array.isArray(rows)) return json({ error: "rows[] required" }, 400);

  const tStore = tokenStore();
  let added = 0, updated = 0, skipped = 0;

  for (const r of rows) {
    const internId = cleanInternId(r.internId);
    if (!internId) { skipped++; continue; }

    const existing = await getCandidate(internId);
    if (existing) {
      // update contact fields, keep status/token/history
      existing.stateLicenseId = r.stateLicenseId ?? existing.stateLicenseId ?? "";
      existing.firstName = r.firstName || existing.firstName;
      existing.lastName = r.lastName || existing.lastName;
      existing.email = r.email || existing.email;
      existing.phone = r.phone || existing.phone;
      await saveCandidate(existing);
      updated++;
    } else {
      const token = newToken();
      const c = {
        internId,
        stateLicenseId: r.stateLicenseId || "",
        firstName: (r.firstName || "").trim(),
        lastName: (r.lastName || "").trim(),
        email: (r.email || "").trim(),
        phone: (r.phone || "").trim(),
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
      added++;
    }
  }
  return json({ ok: true, added, updated, skipped });
};
