/** مسیرهای ورود/ثبت‌نام */
import express from 'express';
import bcrypt from 'bcryptjs';
import { db, find, insert, update, save, getSettings } from '../lib/db.js';
import { normalizePhone, isValidIranMobile } from '../lib/sms.js';
import { isValidEmail } from '../lib/email.js';
import { createOTP, verifyOTP, signToken, requireAuth, publicUser } from '../lib/auth.js';
import { notifyOTP, notifyWelcome } from '../lib/notify.js';
import { applyReferral, ensureReferralCode } from '../lib/loyalty.js';

const router = express.Router();
const isDev = process.env.NODE_ENV !== 'production';

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 3600 * 1000,
  });
}

/** درخواست کد ورود */
router.post('/otp/request', async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!isValidIranMobile(phone)) {
    return res.status(400).json({ error: 'شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷)' });
  }

  const result = createOTP(phone);
  if (result.error) return res.status(429).json({ error: result.error, retryAfter: result.retryAfter });

  let user = find('users', (u) => u.phone === phone);
  if (!user) {
    user = insert('users', {
      phone, name: '', email: '', role: 'customer',
      points: 0, visits: 0, totalSpent: 0, birthday: '', notes: '', blocked: false,
    });
  }

  const sent = await notifyOTP(user, result.code);
  const payload = {
    ok: true,
    isNew: !user.name,
    expiresInSeconds: result.expiresInSeconds,
    message: 'کد ورود پیامک شد',
  };
  // در حالت آزمایشی (بدون پنل پیامکی) کد را برمی‌گردانیم تا تست ممکن باشد
  if (isDev && getSettings().sms.provider === 'console') payload.devCode = result.code;
  if (!sent.ok && getSettings().sms.provider !== 'console') payload.warning = sent.error;
  res.json(payload);
});

/** تأیید کد و ورود */
router.post('/otp/verify', async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code || '').trim();
  if (!isValidIranMobile(phone)) return res.status(400).json({ error: 'شماره موبایل معتبر نیست' });

  const check = verifyOTP(phone, code);
  if (!check.ok) return res.status(400).json({ error: check.error });

  let user = find('users', (u) => u.phone === phone);
  if (!user) user = insert('users', { phone, name: '', role: 'customer', points: 0, visits: 0, totalSpent: 0 });

  const isFirstLogin = !user.lastLoginAt;
  update('users', user.id, { lastLoginAt: new Date().toISOString(), phoneVerified: true });
  user = find('users', (u) => u.id === user.id);

  const token = signToken(user);
  setAuthCookie(res, token);

  if (isFirstLogin && user.name) {
    notifyWelcome(user).catch((e) => console.error('[notify:welcome]', e.message));
  }

  res.json({ token, user: publicUser(user), needsProfile: !user.name });
});

/** ورود مدیر با نام کاربری و رمز عبور */
router.post('/admin/login', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = find('users', (u) => u.role === 'admin' && u.username === username);
  if (!user || !user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'نام کاربری یا رمز عبور نادرست است' });
  }
  update('users', user.id, { lastLoginAt: new Date().toISOString() });
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ token, user: publicUser(user) });
});

/** تکمیل یا ویرایش پروفایل */
router.put('/profile', requireAuth, async (req, res) => {
  const { name, email, birthday, gender, address, referralCode } = req.body || {};
  const patch = {};
  let referralResult = null;

  if (name !== undefined) {
    const n = String(name).trim();
    if (n.length < 2) return res.status(400).json({ error: 'نام باید حداقل ۲ حرف باشد' });
    patch.name = n;
  }
  if (email !== undefined) {
    const e = String(email).trim();
    if (e && !isValidEmail(e)) return res.status(400).json({ error: 'آدرس ایمیل معتبر نیست' });
    patch.email = e;
  }
  if (birthday !== undefined) patch.birthday = String(birthday || '');
  if (gender !== undefined) patch.gender = String(gender || '');
  if (address !== undefined) patch.address = String(address || '');

  // کد معرف فقط یک بار و هنگام تکمیل حساب قابل ثبت است
  if (referralCode) {
    referralResult = applyReferral(req.user, referralCode);
  }

  const wasIncomplete = !req.user.name;
  const user = update('users', req.user.id, patch);
  if (wasIncomplete && user.name) {
    notifyWelcome(user).catch((e) => console.error('[notify:welcome]', e.message));
  }

  res.json({
    user: publicUser(find('users', (u) => u.id === user.id)),
    referral: referralResult,
  });
});

/** کاربر جاری */
router.get('/me', requireAuth, (req, res) => {
  ensureReferralCode(req.user);
  res.json({ user: publicUser(find('users', (u) => u.id === req.user.id)) });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

export default router;
