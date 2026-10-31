/**
 * لایه‌ی ارسال پیامک با پشتیبانی از چند سرویس‌دهنده‌ی ایرانی.
 * اگر provider روی "console" باشد پیامک فقط در ترمینال چاپ می‌شود
 * (حالت توسعه – بدون نیاز به پنل پیامکی).
 */
import { getSettings, insert } from './db.js';

/** نرمال‌سازی شماره موبایل ایران به فرمت 09xxxxxxxxx */
export function normalizePhone(input) {
  if (!input) return '';
  let p = String(input).trim();
  // ارقام فارسی/عربی -> انگلیسی
  p = p.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
       .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  p = p.replace(/[\s\-()]/g, '');
  if (p.startsWith('+98')) p = '0' + p.slice(3);
  else if (p.startsWith('0098')) p = '0' + p.slice(4);
  else if (p.startsWith('98') && p.length === 12) p = '0' + p.slice(2);
  else if (p.startsWith('9') && p.length === 10) p = '0' + p;
  return p;
}

export function isValidIranMobile(phone) {
  return /^09\d{9}$/.test(normalizePhone(phone));
}

/** شماره به فرمت بین‌المللی 989xxxxxxxxx */
function toIntl(phone) {
  const p = normalizePhone(phone);
  return '98' + p.slice(1);
}

async function postJSON(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${typeof data === 'object' ? JSON.stringify(data) : text}`);
  }
  return data;
}

/* ---------- سرویس‌دهنده‌ها ---------- */

const providers = {
  /** حالت توسعه: فقط چاپ در کنسول */
  async console({ to, text }) {
    console.log('\n┌─ پیامک (حالت آزمایشی) ──────────────────');
    console.log('│ گیرنده: ' + to);
    text.split('\n').forEach((l) => console.log('│ ' + l));
    console.log('└──────────────────────────────────────────\n');
    return { providerMessageId: 'console-' + Date.now() };
  },

  /** کاوه‌نگار – https://kavenegar.com */
  async kavenegar({ to, text, cfg }) {
    if (!cfg.apiKey) throw new Error('کلید API کاوه‌نگار تنظیم نشده است');
    const url = `https://api.kavenegar.com/v1/${encodeURIComponent(cfg.apiKey)}/sms/send.json`;
    const params = new URLSearchParams({ receptor: normalizePhone(to), message: text });
    if (cfg.sender) params.set('sender', cfg.sender);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    if (data?.return?.status !== 200) {
      throw new Error(`کاوه‌نگار: ${data?.return?.message || 'خطای نامشخص'}`);
    }
    return { providerMessageId: String(data.entries?.[0]?.messageid || '') };
  },

  /** sms.ir – https://sms.ir */
  async smsir({ to, text, cfg }) {
    if (!cfg.apiKey) throw new Error('کلید API سرویس sms.ir تنظیم نشده است');
    const data = await postJSON(
      'https://api.sms.ir/v1/send/bulk',
      { lineNumber: cfg.sender || undefined, messageText: text, mobiles: [normalizePhone(to)] },
      { 'X-API-KEY': cfg.apiKey }
    );
    if (data.status !== 1) throw new Error(`sms.ir: ${data.message || 'خطای نامشخص'}`);
    return { providerMessageId: String(data.data?.messageIds?.[0] || data.data?.packId || '') };
  },

  /** ملی‌پیامک – https://melipayamak.com */
  async melipayamak({ to, text, cfg }) {
    if (!cfg.apiKey) throw new Error('کلید API ملی‌پیامک تنظیم نشده است');
    // apiKey در اینجا همان کلید وب‌سرویس (uuid) است
    const data = await postJSON(`https://console.melipayamak.com/api/send/simple/${cfg.apiKey}`, {
      from: cfg.sender || '',
      to: normalizePhone(to),
      text,
    });
    if (data.status && String(data.status).toLowerCase() !== 'ok' && !data.recId) {
      throw new Error(`ملی‌پیامک: ${data.status}`);
    }
    return { providerMessageId: String(data.recId || '') };
  },
};

/**
 * ارسال پیامک
 * @returns {Promise<{ok:boolean, id:string, error?:string}>}
 */
export async function sendSMS({ to, text, kind = 'general', meta = {} }) {
  const settings = getSettings();
  const cfg = settings.sms;
  const phone = normalizePhone(to);

  const log = {
    channel: 'sms',
    kind,
    to: phone,
    body: text,
    provider: cfg.provider,
    status: 'pending',
    meta,
  };

  if (!cfg.enabled) {
    const row = insert('messages', { ...log, status: 'skipped', error: 'ارسال پیامک غیرفعال است' });
    return { ok: false, id: row.id, error: 'ارسال پیامک غیرفعال است' };
  }
  if (!isValidIranMobile(phone)) {
    const row = insert('messages', { ...log, status: 'failed', error: 'شماره موبایل نامعتبر است' });
    return { ok: false, id: row.id, error: 'شماره موبایل نامعتبر است' };
  }

  const impl = providers[cfg.provider] || providers.console;
  try {
    const out = await impl({ to: phone, text, cfg, intl: toIntl(phone) });
    const row = insert('messages', {
      ...log,
      status: 'sent',
      sentAt: new Date().toISOString(),
      providerMessageId: out.providerMessageId || '',
    });
    return { ok: true, id: row.id };
  } catch (err) {
    console.error('[sms] خطا در ارسال:', err.message);
    const row = insert('messages', { ...log, status: 'failed', error: err.message });
    return { ok: false, id: row.id, error: err.message };
  }
}

export const SMS_PROVIDERS = [
  { id: 'console', label: 'حالت آزمایشی (چاپ در ترمینال)' },
  { id: 'kavenegar', label: 'کاوه‌نگار' },
  { id: 'smsir', label: 'sms.ir' },
  { id: 'melipayamak', label: 'ملی‌پیامک' },
];
