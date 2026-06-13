import { requireAdmin, getCandidate, proofStore } from "./_shared.mjs";

export default async (req) => {
  if (!requireAdmin(req)) return new Response("unauthorized", { status: 401 });
  const url = new URL(req.url);
  const internId = url.searchParams.get("id") || "";
  if (!internId) return new Response("missing id", { status: 400 });
  const c = await getCandidate(internId);
  if (!c || !c.proofKey) return new Response("no proof", { status: 404 });
  const buf = await proofStore().get(c.proofKey, { type: "arrayBuffer" });
  if (!buf) return new Response("missing", { status: 404 });
  return new Response(buf, {
    status: 200,
    headers: {
      "content-type": c.proofContentType || "application/octet-stream",
      "content-disposition": `inline; filename="${(c.proofFilename || "proof").replace(/"/g, "")}"`,
      "cache-control": "no-store",
    },
  });
};
