/**
 * احراز هویت: توکن JWT + کد یک‌بارمصرف پیامکی (OTP)
 */
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { db, find, insert, save, getSettings } from './db.js';

const SECRET =
  process.env.JWT_SECRET ||
  (() => {
    // در حالت توسعه یک کلید پایدار در فایل داده نگه می‌داریم
    const s = db.settings || {};
    if (!s.__jwtSecret) {
      s.__jwtSecret = crypto.randomBytes(32).toString('hex');
      db.settings = s;
      save();
    }
    return s.__jwtSecret;
  })();

const TOKEN_TTL = '30d';
const OTP_TTL_MS = 2 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role || 'customer' }, SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

/** استخراج کاربر از هدر Authorization یا کوکی */
export function currentUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return find('users', (u) => u.id === payload.sub);
}

/** میان‌افزار: ورود الزامی */
export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'برای این کار باید وارد حساب خود شوید' });
  if (user.blocked) return res.status(403).json({ error: 'حساب شما مسدود شده است' });
  req.user = user;
  next();
}

/** میان‌افزار: فقط مدیر */
export function requireAdmin(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'برای این کار باید وارد حساب خود شوید' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'دسترسی مدیریتی لازم است' });
  req.user = user;
  next();
}

/* ---------- OTP ---------- */

function hashCode(code, phone) {
  return crypto.createHash('sha256').update(`${code}:${phone}:${SECRET}`).digest('hex');
}

/** ساخت کد ۵ رقمی و ذخیره‌ی هش آن */
export function createOTP(phone) {
  const list = db.otps;
  const existing = list.find((o) => o.phone === phone && !o.usedAt && Date.now() < o.expiresAt);
  if (existing && Date.now() - existing.createdAtMs < OTP_RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - existing.createdAtMs)) / 1000);
    return { error: `تا ${wait} ثانیه‌ی دیگر امکان ارسال مجدد کد وجود ندارد`, retryAfter: wait };
  }

  // کدهای قبلی همان شماره باطل می‌شوند
  for (const o of list) if (o.phone === phone && !o.usedAt) o.usedAt = Date.now();

  const code = String(crypto.randomInt(10000, 99999));
  const row = {
    id: crypto.randomBytes(8).toString('hex'),
    phone,
    codeHash: hashCode(code, phone),
    createdAtMs: Date.now(),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    usedAt: null,
  };
  list.push(row);
  // پاکسازی کدهای قدیمی
  db.otps = list.filter((o) => Date.now() - o.createdAtMs < 24 * 3600 * 1000);
  save();
  return { code, expiresInSeconds: OTP_TTL_MS / 1000 };
}

export function verifyOTP(phone, code) {
  const list = db.otps;
  const row = [...list].reverse().find((o) => o.phone === phone && !o.usedAt);
  if (!row) return { ok: false, error: 'کدی برای این شماره ارسال نشده است' };
  if (Date.now() > row.expiresAt) return { ok: false, error: 'کد منقضی شده است، دوباره درخواست دهید' };
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: 'تعداد تلاش‌های مجاز تمام شد، کد تازه بگیرید' };
  }
  row.attempts += 1;
  if (row.codeHash !== hashCode(String(code).trim(), phone)) {
    save();
    return { ok: false, error: 'کد وارد شده صحیح نیست' };
  }
  row.usedAt = Date.now();
  save();
  return { ok: true };
}

/** خروجی امن کاربر برای ارسال به کلاینت */
export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}
