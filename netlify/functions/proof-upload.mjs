import { json, tokenStore, getCandidate, saveCandidate, proofStore } from "./_shared.mjs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB after decode

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const { token, filename, contentType, dataBase64 } = body;
  if (!token || !dataBase64) return json({ error: "token and image required" }, 400);

  const internId = await tokenStore().get(token);
  if (!internId) return json({ error: "invalid link" }, 404);
  const c = await getCandidate(internId);
  if (!c) return json({ error: "not found" }, 404);

  // basic validation
  const approxBytes = Math.floor((dataBase64.length * 3) / 4);
  if (approxBytes > MAX_BYTES) return json({ error: "image too large (max 5MB)" }, 413);
  const ct = (contentType || "").toLowerCase();
  if (!/^image\//.test(ct) && !/pdf$/.test(ct)) {
    return json({ error: "must be an image or PDF screenshot" }, 415);
  }

  const key = `proof_${internId}_${Date.now()}`;
  const buf = Buffer.from(dataBase64, "base64");
  await proofStore().set(key, buf, {
    metadata: { internId, filename: filename || "proof", contentType: ct, uploadedAt: new Date().toISOString() },
  });

  c.status = "completed";
  c.completedAt = new Date().toISOString();
  c.proofKey = key;
  c.proofContentType = ct;
  c.proofFilename = filename || "proof";
  c.lastError = null;
  await saveCandidate(c);

  return json({ ok: true, message: "Proof received. Thank you — you're all set." });
};
