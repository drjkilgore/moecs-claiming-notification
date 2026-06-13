import { json, requireAdmin, getTemplate, saveTemplate } from "./_shared.mjs";

export default async (req) => {
  if (!requireAdmin(req)) return json({ error: "unauthorized" }, 401);

  if (req.method === "GET") {
    return json({ ok: true, template: await getTemplate() });
  }
  if (req.method === "POST") {
    let t;
    try { t = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    const cur = await getTemplate();
    await saveTemplate({
      subject: t.subject ?? cur.subject,
      subjectFollowup: t.subjectFollowup ?? cur.subjectFollowup,
      body: t.body ?? cur.body,
      sms: t.sms ?? cur.sms,
    });
    return json({ ok: true });
  }
  return json({ error: "GET or POST" }, 405);
};
