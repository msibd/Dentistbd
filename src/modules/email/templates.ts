// E-mail templates: responsive HTML (tables and inline styles, which every mail app understands)
// plus a plain-text twin for apps that do not show HTML. Nothing here carries patient information.

export type EmailContent = { subject: string; html: string; text: string };

const CLINIC = "Dr Ovi's Dental Care";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function layout({ preheader, title, body }: { preheader: string; title: string; body: string }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f0ee;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1f2c40;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ee;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(60 33 15,0.10);">
<tr><td style="background-color:#c2410c;background-image:linear-gradient(135deg,#c2410c,#f97316);padding:22px 28px;">
<div style="font-size:19px;font-weight:700;color:#ffffff;">${escapeHtml(CLINIC)}</div>
<div style="font-size:13px;color:#f5e3d7;margin-top:2px;">&amp; Endodontics</div>
</td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:#12324a;">${escapeHtml(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #ece7e3;font-size:12px;line-height:1.6;color:#6b7a8c;">
This is an automated message from ${escapeHtml(CLINIC)}. Please do not reply to it.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const paragraph = (text: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#2b394b;">${text}</p>`;

export function passwordResetOtpEmail({ name, code, expiresInMinutes }: { name?: string | null; code: string; expiresInMinutes: number }): EmailContent {
  const greeting = name ? `Hello ${escapeHtml(name)},` : "Hello,";
  const body = `
${paragraph(`${greeting}<br>Use this code to reset your password for the ${escapeHtml(CLINIC)} staff portal.`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:6px 0 18px;">
<div style="display:inline-block;padding:16px 26px;background:#faf3ef;border:2px dashed #f97316;border-radius:12px;font-family:Consolas,Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#572c0f;">${escapeHtml(code)}</div>
</td></tr></table>
${paragraph(`This code expires in <strong>${expiresInMinutes} minutes</strong> and can be used once.`)}
<div style="margin-top:6px;padding:12px 14px;background:#fff6e5;border:1px solid #f3dfb0;border-radius:10px;font-size:13.5px;line-height:1.6;color:#6b4a07;">
<strong>Keep this code private.</strong> Nobody from the clinic will ever ask you for it. If you did not ask to reset your password, ignore this e-mail: your password has not changed.
</div>`;
  return {
    subject: `${code} is your password reset code`,
    html: layout({ preheader: `Your code is ${code}. It expires in ${expiresInMinutes} minutes.`, title: "Reset your password", body }),
    text: `${name ? `Hello ${name},` : "Hello,"}\n\nYour ${CLINIC} password reset code is: ${code}\n\nIt expires in ${expiresInMinutes} minutes and can be used once.\n\nKeep this code private. Nobody from the clinic will ever ask you for it. If you did not ask to reset your password, ignore this e-mail: your password has not changed.\n`,
  };
}

export function emailTestEmail({ senderName, host, port }: { senderName: string; host: string; port: number }): EmailContent {
  const body = `
${paragraph("This is a test message. If you can read it, the e-mail settings of your clinic system work.")}
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;color:#2b394b;margin-bottom:14px;">
<tr><td style="padding:3px 14px 3px 0;color:#6b7a8c;">Sender</td><td>${escapeHtml(senderName)}</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#6b7a8c;">Mail server</td><td>${escapeHtml(host)}:${port}</td></tr>
<tr><td style="padding:3px 14px 3px 0;color:#6b7a8c;">Sent at</td><td>${escapeHtml(new Date().toISOString().replace("T", " ").slice(0, 16))} UTC</td></tr>
</table>
${paragraph("You do not need to do anything else.")}`;
  return {
    subject: `Test e-mail from ${CLINIC}`,
    html: layout({ preheader: "Your clinic e-mail settings work.", title: "E-mail settings test", body }),
    text: `This is a test message from ${CLINIC}.\nIf you can read it, the e-mail settings work.\n\nSender: ${senderName}\nMail server: ${host}:${port}\n`,
  };
}

export function passwordChangedEmail({ name }: { name?: string | null }): EmailContent {
  const body = `
${paragraph(`${name ? `Hello ${escapeHtml(name)},<br>` : ""}The password of your ${escapeHtml(CLINIC)} staff account was just changed. For your safety you were signed out on all devices.`)}
<div style="margin-top:6px;padding:12px 14px;background:#fff1f0;border:1px solid #f5c6c2;border-radius:10px;font-size:13.5px;line-height:1.6;color:#7a2a24;">
<strong>Was this not you?</strong> Contact the clinic administrator straight away so your account can be secured.
</div>`;
  return {
    subject: "Your password was changed",
    html: layout({ preheader: "Your staff account password was changed.", title: "Password changed", body }),
    text: `${name ? `Hello ${name},\n\n` : ""}The password of your ${CLINIC} staff account was just changed. You were signed out on all devices.\n\nWas this not you? Contact the clinic administrator straight away.\n`,
  };
}

/** The same code mail as the password reset, worded for someone who is already signed in and changing their password. */
export function passwordChangeOtpEmail(args: { name?: string | null; code: string; expiresInMinutes: number }): EmailContent {
  const base = passwordResetOtpEmail(args);
  const swap = (value: string) => value
    .replace("to reset your password", "to confirm that you are changing your password")
    .replace("password reset code", "password change code")
    .replace("Reset your password", "Confirm your password change")
    .replace("ask to reset your password", "try to change your password");
  return { ...base, subject: swap(base.subject), html: swap(base.html), text: swap(base.text) };
}
