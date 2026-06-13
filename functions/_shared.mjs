// ---------------------------------------------------------------------------
// #TEACH MOECS Claiming Notification App  —  shared backend library
// ---------------------------------------------------------------------------
import { getStore } from "@netlify/blobs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---- Config (env) ---------------------------------------------------------
export const CFG = {
  ADMIN_KEY: process.env.ADMIN_KEY || "",
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || "",
  FROM_EMAIL: process.env.FROM_EMAIL || "micertifications@trainingeducators.com",
  FROM_NAME: process.env.FROM_NAME || "#TEACH Certifications Michigan",
  REPLY_TO: process.env.REPLY_TO || "teachmoecs@gmail.com", // replies land here; From stays on the authenticated domain
  GUIDE_URL: process.env.GUIDE_URL || "",              // public link to the PDF (used in email body)
  SITE_URL: process.env.URL || process.env.SITE_URL || "", // Netlify auto-injects URL
  FOLLOWUP_HOURS: Number(process.env.FOLLOWUP_HOURS || 48),
  MAX_FOLLOWUPS: Number(process.env.MAX_FOLLOWUPS || 6),
};

// ---- Stores ---------------------------------------------------------------
export const candStore = () => getStore({ name: "candidates", consistency: "strong" });
export const tokenStore = () => getStore({ name: "tokens", consistency: "strong" });
export const proofStore = () => getStore({ name: "proofs" });
export const cfgStore = () => getStore({ name: "config", consistency: "strong" });

// ---- HTTP helpers ---------------------------------------------------------
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const requireAdmin = (req) => {
  if (!CFG.ADMIN_KEY) return true; // if unset, allow (dev mode) — set ADMIN_KEY in prod!
  const key = req.headers.get("x-admin-key") || "";
  return key && key === CFG.ADMIN_KEY;
};

// ---- Utilities ------------------------------------------------------------
export const newToken = () => crypto.randomBytes(16).toString("hex");

export const cleanInternId = (v) => String(v ?? "").trim();

export function normalizePhone(raw) {
  if (!raw) return "";
  let d = String(raw).replace(/[^\d]/g, "");
  if (d.length === 10) d = "1" + d;
  if (d.length === 11 && d.startsWith("1")) return "+" + d;
  if (String(raw).trim().startsWith("+")) return String(raw).trim();
  return d ? "+" + d : "";
}

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ---- Candidate record helpers --------------------------------------------
export async function getCandidate(internId) {
  return await candStore().get(cleanInternId(internId), { type: "json" });
}
export async function saveCandidate(c) {
  await candStore().setJSON(c.internId, c);
  return c;
}
export async function listCandidates() {
  const store = candStore();
  const { blobs } = await store.list();
  const out = [];
  for (const b of blobs) {
    const c = await store.get(b.key, { type: "json" });
    if (c) out.push(c);
  }
  out.sort((a, b) => (a.lastName || "").localeCompare(b.lastName || ""));
  return out;
}

// ---- Email template -------------------------------------------------------
const DEFAULT_SUBJECT = "URGENT ACTION REQUIRED – MOECS EPP Claiming";
const DEFAULT_SUBJECT_FOLLOWUP = "REMINDER: Action Required – MOECS EPP Claiming";

// {firstName} {internId} {proofLink} {guideLink} are the merge fields
const DEFAULT_BODY =
`Dear {firstName},

The Michigan Department of Education (MDE) is requiring all candidates to select their education preparation provider (EPP) in MOECS. This directive from MDE applies to all candidates, whether or not you are yet on your Initial Teaching Certificate (ITC).

Please follow the attached step-by-step guide on how to select #TEACH in your MOECS account.

Here is your Student ID: {internId}

You will use this Student ID to complete the form. It is IMPERATIVE that you complete this process.

After you have selected #TEACH in MOECS, please upload proof here so we can verify and stop reminders:
{proofLink}

Your proof is simply a screenshot of your MOECS "Enrollment Information" screen showing #TEACH listed as your provider — this is the final screen pictured in the attached guide.

Important Tip: It is recommended to use a computer to complete the form for the best experience.

Best regards,
Dr. Jessie Kilgore
#TEACH Founder / President`;

export async function getTemplate() {
  const stored = await cfgStore().get("template", { type: "json" });
  return {
    subject: stored?.subject || DEFAULT_SUBJECT,
    subjectFollowup: stored?.subjectFollowup || DEFAULT_SUBJECT_FOLLOWUP,
    body: stored?.body || DEFAULT_BODY,
  };
}
export async function saveTemplate(t) {
  await cfgStore().setJSON("template", t);
}

function fill(str, c, proofLink) {
  return String(str)
    .replaceAll("{firstName}", c.firstName || "Educator")
    .replaceAll("{lastName}", c.lastName || "")
    .replaceAll("{internId}", c.internId || "")
    .replaceAll("{proofLink}", proofLink)
    .replaceAll("{guideLink}", CFG.GUIDE_URL || proofLink);
}

export function proofLinkFor(c) {
  const base = CFG.SITE_URL || "";
  return `${base}/proof.html?t=${c.token}`;
}

// NOTE: This app sends plain-text email only (no HTML part). A message with no
// HTML body reads as a personal note, which keeps it in Gmail's Primary inbox
// instead of the Promotions tab. There is intentionally no HTML wrapper here.

// ---- PDF attachment (bundled with the function) ---------------------------
let _pdfCache = null;
async function guidePdfBase64() {
  if (_pdfCache !== null) return _pdfCache || null;
  const candidates = [
    path.join(HERE, "MDE_MOECS_Guide.pdf"),
    path.join(process.cwd(), "netlify/functions/MDE_MOECS_Guide.pdf"),
    path.join(process.cwd(), "MDE_MOECS_Guide.pdf"),
    "netlify/functions/MDE_MOECS_Guide.pdf",
  ];
  for (const p of candidates) {
    try {
      const buf = await readFile(p);
      _pdfCache = buf.toString("base64");
      return _pdfCache;
    } catch { /* try next */ }
  }
  console.warn("[shared] guide PDF not found; sending email without attachment");
  _pdfCache = "";
  return null;
}

// ---- SendGrid email -------------------------------------------------------
export async function sendEmail(c, { followup = false } = {}) {
  if (!CFG.SENDGRID_API_KEY) throw new Error("SENDGRID_API_KEY not set");
  if (!c.email) throw new Error("no email address");
  const tpl = await getTemplate();
  const proofLink = proofLinkFor(c);
  const subject = followup ? tpl.subjectFollowup : tpl.subject;
  const text = fill(tpl.body, c, proofLink);

  const attachments = [];
  const pdf = await guidePdfBase64();
  if (pdf) {
    attachments.push({
      content: pdf,
      filename: "MOECS_Provider_Selection_Guide.pdf",
      type: "application/pdf",
      disposition: "attachment",
    });
  }

  const payload = {
    personalizations: [{
      to: [{ email: c.email, name: `${c.firstName} ${c.lastName}`.trim() }],
    }],
    from: { email: CFG.FROM_EMAIL, name: CFG.FROM_NAME },
    reply_to: { email: CFG.REPLY_TO },
    subject,
    // Plain-text only: a message with no HTML part reads as a personal note,
    // which Gmail keeps in Primary instead of filing under Promotions.
    content: [
      { type: "text/plain", value: text },
    ],
    // Disable SendGrid's open-tracking pixel, link rewriting, and unsubscribe
    // footer — those are the classic bulk/marketing fingerprints that trigger
    // the Promotions tab. Turning them off makes the send look transactional.
    tracking_settings: {
      click_tracking: { enable: false, enable_text: false },
      open_tracking: { enable: false },
      subscription_tracking: { enable: false },
    },
    ...(attachments.length ? { attachments } : {}),
  };

  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CFG.SENDGRID_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`SendGrid ${r.status}: ${body.slice(0, 300)}`);
  }
  return true;
}

// ---- Send orchestration (used by initial + follow-up) ---------------------
export async function contactCandidate(c, { followup = false } = {}) {
  const now = new Date().toISOString();
  const result = { internId: c.internId, email: null };

  try { await sendEmail(c, { followup }); result.email = "sent"; }
  catch (e) { result.email = "error: " + e.message; }

  c.status = c.status === "completed" ? "completed" : "contacted";
  c.attempts = (c.attempts || 0) + 1;
  c.lastContactedAt = now;
  if (!c.firstContactedAt) c.firstContactedAt = now;
  c.lastResult = result;
  c.lastError = (result.email && result.email.startsWith("error")) ? result.email : null;
  await saveCandidate(c);
  return result;
}




