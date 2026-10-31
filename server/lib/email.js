/**
 * ارسال ایمیل از طریق SMTP (nodemailer).
 * اگر تنظیمات SMTP کامل نباشد، ایمیل فقط در ترمینال چاپ می‌شود.
 */
import nodemailer from 'nodemailer';
import { getSettings, insert } from './db.js';

let transporter = null;
let transporterKey = '';

function getTransporter(cfg) {
  const key = JSON.stringify([cfg.host, cfg.port, cfg.secure, cfg.user]);
  if (transporter && transporterKey === key) return transporter;
  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: Number(cfg.port) || 587,
    secure: Boolean(cfg.secure),
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    tls: { rejectUnauthorized: false },
  });
  transporterKey = key;
  return transporter;
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

/** پوسته‌ی HTML راست‌چین برای همه‌ی ایمیل‌ها */
export function wrapEmailHTML({ title, bodyHTML, salonName, footer }) {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title></head>
<body style="margin:0;padding:24px 12px;background:#faf0f1;font-family:Tahoma,'Segoe UI',Arial,sans-serif;direction:rtl;text-align:right;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(190,120,130,.14);">
    <tr><td style="background:linear-gradient(135deg,#e0828c,#ef9aa3);padding:26px 24px;text-align:center;">
      <div style="color:#fff;font-size:19px;font-weight:bold;">${escapeHTML(salonName)}</div>
      <div style="color:#ffe7ea;font-size:13px;margin-top:6px;">${escapeHTML(title)}</div>
    </td></tr>
    <tr><td style="padding:26px 24px;color:#2c2c2e;font-size:14px;line-height:2;">
      ${bodyHTML}
    </td></tr>
    <tr><td style="padding:16px 24px;background:#fdf5f6;color:#8a8a8e;font-size:12px;text-align:center;">
      ${escapeHTML(footer || '')}
    </td></tr>
  </table>
</body></html>`;
}

/** جدول کلید/مقدار برای جزئیات نوبت در ایمیل */
export function detailsTableHTML(rows) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;border-collapse:collapse;">
    ${rows
      .map(
        ([k, v]) => `<tr>
      <td style="padding:9px 0;color:#8a8a8e;font-size:13px;border-bottom:1px solid #f2e6e8;width:40%;">${escapeHTML(k)}</td>
      <td style="padding:9px 0;color:#2c2c2e;font-size:13px;font-weight:bold;border-bottom:1px solid #f2e6e8;">${escapeHTML(v)}</td>
    </tr>`
      )
      .join('')}
  </table>`;
}

export function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * ارسال ایمیل
 * @returns {Promise<{ok:boolean,id:string,error?:string}>}
 */
export async function sendEmail({ to, subject, html, text, kind = 'general', meta = {} }) {
  const settings = getSettings();
  const cfg = settings.email;

  const log = {
    channel: 'email',
    kind,
    to: String(to || '').trim(),
    subject,
    body: text || stripHTML(html),
    provider: cfg.host || 'console',
    status: 'pending',
    meta,
  };

  if (!cfg.enabled) {
    const row = insert('messages', { ...log, status: 'skipped', error: 'ارسال ایمیل غیرفعال است' });
    return { ok: false, id: row.id, error: 'ارسال ایمیل غیرفعال است' };
  }
  if (!isValidEmail(to)) {
    const row = insert('messages', { ...log, status: 'failed', error: 'آدرس ایمیل نامعتبر است' });
    return { ok: false, id: row.id, error: 'آدرس ایمیل نامعتبر است' };
  }

  // بدون تنظیمات SMTP → حالت آزمایشی
  if (!cfg.host) {
    console.log('\n┌─ ایمیل (حالت آزمایشی) ──────────────────');
    console.log('│ گیرنده: ' + to);
    console.log('│ موضوع: ' + subject);
    console.log('└──────────────────────────────────────────\n');
    const row = insert('messages', { ...log, status: 'sent', sentAt: new Date().toISOString() });
    return { ok: true, id: row.id };
  }

  try {
    const info = await getTransporter(cfg).sendMail({
      from: cfg.from || cfg.user,
      to,
      subject,
      html,
      text: text || stripHTML(html),
    });
    const row = insert('messages', {
      ...log,
      status: 'sent',
      sentAt: new Date().toISOString(),
      providerMessageId: info.messageId || '',
    });
    return { ok: true, id: row.id };
  } catch (err) {
    console.error('[email] خطا در ارسال:', err.message);
    const row = insert('messages', { ...log, status: 'failed', error: err.message });
    return { ok: false, id: row.id, error: err.message };
  }
}

/** بررسی اتصال SMTP */
export async function verifyEmail() {
  const cfg = getSettings().email;
  if (!cfg.host) return { ok: false, error: 'آدرس سرور SMTP تنظیم نشده است' };
  try {
    await getTransporter(cfg).verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function stripHTML(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
