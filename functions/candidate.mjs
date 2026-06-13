import { json, tokenStore, getCandidate } from "./_shared.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("t") || "";
  if (!token) return json({ error: "missing token" }, 400);
  const internId = await tokenStore().get(token);
  if (!internId) return json({ error: "invalid link" }, 404);
  const c = await getCandidate(internId);
  if (!c) return json({ error: "not found" }, 404);
  return json({
    ok: true,
    firstName: c.firstName,
    lastName: c.lastName,
    internId: c.internId,
    status: c.status,
    completedAt: c.completedAt,
  });
};
