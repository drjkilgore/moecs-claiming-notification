import { json, requireAdmin, getCandidate, saveCandidate, contactCandidate, candStore, tokenStore } from "./_shared.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!requireAdmin(req)) return json({ error: "unauthorized" }, 401);
  let body;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const { action, internId } = body;
  const c = await getCandidate(internId);
  if (!c && action !== "purge_all") return json({ error: "not found" }, 404);

  switch (action) {
    case "resend": {
      const r = await contactCandidate(c, { followup: true });
      return json({ ok: true, result: r });
    }
    case "mark_complete": {
      c.status = "completed";
      c.completedAt = new Date().toISOString();
      c.lastError = null;
      await saveCandidate(c);
      return json({ ok: true });
    }
    case "reset": {
      c.status = "pending";
      c.attempts = 0;
      c.firstContactedAt = null;
      c.lastContactedAt = null;
      c.completedAt = null;
      c.lastError = null;
      await saveCandidate(c);
      return json({ ok: true });
    }
    case "delete": {
      if (c.token) await tokenStore().delete(c.token);
      await candStore().delete(c.internId);
      return json({ ok: true });
    }
    case "purge_all": {
      const cs = candStore(), ts = tokenStore();
      const { blobs } = await cs.list();
      for (const b of blobs) {
        const cc = await cs.get(b.key, { type: "json" });
        if (cc?.token) await ts.delete(cc.token);
        await cs.delete(b.key);
      }
      return json({ ok: true, purged: blobs.length });
    }
    default:
      return json({ error: "unknown action" }, 400);
  }
};
