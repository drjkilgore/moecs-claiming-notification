# #TEACH — MOECS EPP Claiming Notification App

Upload a candidate roster, send each person the MOECS provider-selection notice (with the
step-by-step guide PDF attached) by **email and text**, automatically **follow up every 48 hours**
until they finish, and let candidates **upload proof** of completion through a personal link —
which marks them done and stops the reminders.

Built on your usual stack: a single-file dashboard + Netlify serverless functions, Netlify Blobs
for storage, SendGrid for email, Twilio for SMS.

---

## What's in the box

```
index.html                         Admin console (upload, send, track, edit content)
proof.html                         Candidate-facing proof upload page (opened via personal link)
assets/example_enrollment.png      The "Enrollment Information" example shown to candidates
MOECS_Provider_Selection_Guide.pdf Hosted copy of the guide (for the in-email link)
netlify.toml                       Build/functions config + /api/* redirect
package.json                       Dependency: @netlify/blobs
netlify/functions/
  _shared.mjs        Shared library (store, email, SMS, templates, orchestration)
  import-roster.mjs  Imports parsed roster rows
  send-initial.mjs   Sends the initial email + text to selected candidates
  get-candidates.mjs Dashboard data + system health
  template.mjs       Get/save the editable email + SMS content
  candidate.mjs      Public: look up a candidate by their link token
  proof-upload.mjs   Public: candidate submits proof → status = completed
  proof-view.mjs     Admin: view an uploaded proof
  admin-action.mjs   Resend / mark complete / reopen / delete / purge
  follow-up.mjs      Scheduled (@hourly): sends 48h follow-ups to incomplete candidates
  MDE_MOECS_Guide.pdf  The PDF attached to every email
```

---

## 1. Prerequisites

1. **Netlify account** (free tier is fine to start; see limits below).
2. **SendGrid account** with the sender verified:
   - Verify `micertifications@trainingeducators.com` **or** (recommended) set up **domain
     authentication** for `trainingeducators.com` so 350+ emails don't land in spam.
   - Create an API key with "Mail Send" permission.
3. **Twilio account** (optional, only if you want texts):
   - A phone number **or** a Messaging Service.
   - For US texting at this volume you must register **A2P 10DLC** (brand + campaign) or carriers
     will filter/block the messages. This is a Twilio console step, not an app setting.

---

## 2. Deploy

Easiest path with the Netlify CLI:

```bash
npm install -g netlify-cli
cd moecs-app
netlify deploy --build        # preview
netlify deploy --build --prod # production
```

Or connect the folder to a Git repo and let Netlify build it. Netlify Blobs is enabled
automatically — no separate database to provision.

> Scheduled functions (the 48h follow-up) only run on the **production** deploy, not on
> deploy previews.

---

## 3. Environment variables (Netlify → Site settings → Environment variables)

| Variable | Required | Notes |
|---|---|---|
| `ADMIN_KEY` | **Yes** | Password for the console. If unset, the console is open — always set this. |
| `SENDGRID_API_KEY` | **Yes** | SendGrid Mail Send key. |
| `FROM_EMAIL` | recommended | Default `micertifications@trainingeducators.com`. Must be a verified sender. |
| `FROM_NAME` | optional | Default `#TEACH Certifications Michigan`. |
| `REPLY_TO` | optional | Default same as `FROM_EMAIL`. |
| `TWILIO_ACCOUNT_SID` | for SMS | From the Twilio console. |
| `TWILIO_AUTH_TOKEN` | for SMS | From the Twilio console. |
| `TWILIO_FROM` | for SMS | Your Twilio number, e.g. `+13135551234`. (Or use the messaging service below.) |
| `TWILIO_MESSAGING_SID` | optional | Messaging Service SID — use instead of `TWILIO_FROM` for A2P 10DLC. |
| `GUIDE_URL` | optional | Public link to the guide used in the email body. Defaults to the proof link. Set to `https://YOURSITE/MOECS_Provider_Selection_Guide.pdf` to link the hosted copy. |
| `FOLLOWUP_HOURS` | optional | Default `48`. |
| `MAX_FOLLOWUPS` | optional | Default `6` total contacts per candidate, then it stops. |

`URL` is injected by Netlify automatically and is used to build each candidate's proof link, so
proof links work as soon as the site is live.

---

## 4. Using it

1. Open your site, sign in with the `ADMIN_KEY`.
2. **Upload Roster** → choose the `.xlsx`/`.csv`. Columns auto-map (InternID → Student ID, etc.);
   confirm the mapping and **Import**. Re-importing later updates contact info and **never** resets
   anyone's progress.
3. **Recipients & Status** → toggle Email/Text, then **Send to all pending** (or select rows and
   **Send to selected**). Each email merges the person's Student ID and attaches the guide PDF.
4. From here on, anyone still incomplete gets an automatic follow-up every 48 hours.
5. Candidates click their link, land on the branded proof page, upload a screenshot of their MOECS
   **Enrollment Information** screen, and are instantly marked **Completed** — reminders stop.
6. **Email & Text** tab lets you edit the wording anytime. Merge fields: `{firstName}`,
   `{internId}`, `{proofLink}`, `{guideLink}`.

---

## 5. Limits & deliverability — read before a 352-person blast

- **SendGrid free tier sends ~100 emails/day.** For 352 at once you need a paid plan (e.g. the
  Essentials tier) or you'll hit the cap. The app sends sequentially and reports per-row errors, so
  you can also send in daily batches by selecting subsets.
- **Sender reputation:** without domain authentication, a sudden 352-email send from a new sender
  often lands in spam. Authenticate the domain first.
- **SMS (A2P 10DLC):** unregistered US 10-digit numbers are heavily filtered. Register the brand +
  campaign in Twilio before relying on texts; otherwise expect silent failures (shown as errors in
  the dashboard).
- **Attachment size:** the guide is ~4.6 MB, well under SendGrid's 30 MB message limit. If you'd
  rather keep emails light, drop the attachment and rely on the hosted link — tell me and I'll
  switch it.

---

## 6. Local development

```bash
npm install
netlify dev      # serves the site + functions + Blobs locally at http://localhost:8888
```

Set the same env vars in a `.env` file for local testing.

---

*Not legal advice; deliverability and A2P/CAN-SPAM compliance remain your responsibility as the sender.*
