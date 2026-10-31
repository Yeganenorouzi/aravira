/**
 * باشگاه مشتریان: سطح‌بندی، امتیاز، اعتبار هدیه و دعوت از دوستان.
 * هر تغییر در امتیاز یا اعتبار در دفتر `ledger` ثبت می‌شود تا قابل پیگیری باشد.
 */
import crypto from 'node:crypto';
import { db, find, filter, insert, update, getSettings } from './db.js';

/* ---------- سطح مشتری ---------- */

/** سطح مشتری بر اساس مجموع خرید */
export function tierOf(user, settings = getSettings()) {
  const tiers = [...(settings.loyalty?.tiers || [])].sort((a, b) => a.minSpent - b.minSpent);
  const spent = Number(user?.totalSpent) || 0;
  let current = tiers[0] || null;
  for (const t of tiers) if (spent >= Number(t.minSpent)) current = t;
  return current;
}

/** سطح بعدی و فاصله تا آن (برای نمایش نوار پیشرفت) */
export function tierProgress(user, settings = getSettings()) {
  const tiers = [...(settings.loyalty?.tiers || [])].sort((a, b) => a.minSpent - b.minSpent);
  const spent = Number(user?.totalSpent) || 0;
  const current = tierOf(user, settings);
  const next = tiers.find((t) => Number(t.minSpent) > spent) || null;
  const base = Number(current?.minSpent) || 0;
  const target = next ? Number(next.minSpent) : base;
  const percent = next ? Math.min(100, Math.round(((spent - base) / (target - base)) * 100)) : 100;
  return { current, next, spent, remaining: next ? target - spent : 0, percent };
}

/* ---------- دفتر گردش ---------- */

export function addLedger({ userId, kind, points = 0, credit = 0, note = '', ref = '' }) {
  return insert('ledger', { userId, kind, points, credit, note, ref });
}

export function ledgerOf(userId, limit = 50) {
  return filter('ledger', (l) => l.userId === userId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

/* ---------- امتیاز ---------- */

/** امتیاز حاصل از یک خرید، با ضریب سطح مشتری */
export function pointsForSpend(amount, user, settings = getSettings()) {
  const cfg = settings.loyalty;
  if (!cfg?.enabled) return 0;
  const unit = Number(cfg.pointsPerUnit) || 10000;
  const mult = Number(tierOf(user, settings)?.pointsMultiplier) || 1;
  return Math.floor((Number(amount) || 0) / unit * mult);
}

export function grantPoints(user, points, note, ref) {
  if (!points) return user;
  addLedger({ userId: user.id, kind: 'points', points, note, ref });
  return update('users', user.id, { points: (Number(user.points) || 0) + points });
}

/** ارزش ریالی امتیازهایی که مشتری می‌تواند خرج کند */
export function pointsRedeemValue(user, settings = getSettings()) {
  const cfg = settings.loyalty;
  if (!cfg?.enabled) return { usablePoints: 0, value: 0 };
  const points = Number(user?.points) || 0;
  if (points < Number(cfg.minPointsToRedeem || 0)) return { usablePoints: 0, value: 0 };
  return { usablePoints: points, value: points * (Number(cfg.pointValue) || 0) };
}

/* ---------- اعتبار ---------- */

export function grantCredit(user, amount, note, ref) {
  if (!amount) return user;
  addLedger({ userId: user.id, kind: 'credit', credit: amount, note, ref });
  return update('users', user.id, { credit: (Number(user.credit) || 0) + amount });
}

export function spendCredit(user, amount, note, ref) {
  if (!amount) return user;
  addLedger({ userId: user.id, kind: 'credit', credit: -amount, note, ref });
  return update('users', user.id, { credit: Math.max(0, (Number(user.credit) || 0) - amount) });
}

export function spendPoints(user, points, note, ref) {
  if (!points) return user;
  addLedger({ userId: user.id, kind: 'points', points: -points, note, ref });
  return update('users', user.id, { points: Math.max(0, (Number(user.points) || 0) - points) });
}

/* ---------- کد معرف ---------- */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بدون نویسه‌های گیج‌کننده

export function generateCode(length = 6, prefix = '') {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return prefix + out;
}

/** کد معرف اختصاصی کاربر را می‌سازد (یا کد موجود را برمی‌گرداند) */
export function ensureReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  let code;
  do {
    code = generateCode(6);
  } while (db.users.some((u) => u.referralCode === code));
  update('users', user.id, { referralCode: code });
  return code;
}

/** ثبت معرف برای کاربر تازه */
export function applyReferral(newUser, code) {
  const settings = getSettings();
  if (!settings.referral?.enabled) return { ok: false, error: 'برنامه‌ی دعوت از دوستان غیرفعال است' };
  if (newUser.referredBy) return { ok: false, error: 'برای حساب شما قبلاً کد معرف ثبت شده است' };

  const clean = String(code || '').trim().toUpperCase();
  const referrer = find('users', (u) => u.referralCode === clean && u.role !== 'admin');
  if (!referrer) return { ok: false, error: 'کد معرف معتبر نیست' };
  if (referrer.id === newUser.id) return { ok: false, error: 'نمی‌توانید کد خودتان را وارد کنید' };

  update('users', newUser.id, { referredBy: referrer.id, referredAt: new Date().toISOString() });

  // اگر پاداش منوط به اولین نوبت نباشد، همین حالا پرداخت می‌شود
  if (!settings.referral.rewardOnFirstDone) {
    payReferralRewards(newUser.id);
  }
  return { ok: true, referrerName: referrer.name || 'معرف شما' };
}

/**
 * پرداخت پاداش دعوت (یک بار برای هر کاربر).
 * @returns {{paid:boolean, referrer?:object, refereeReward?:number}}
 */
export function payReferralRewards(userId) {
  const settings = getSettings();
  const user = find('users', (u) => u.id === userId);
  if (!user?.referredBy || user.referralRewarded) return { paid: false };

  const referrer = find('users', (u) => u.id === user.referredBy);
  if (!referrer) return { paid: false };

  const refereeReward = Number(settings.referral.refereeReward) || 0;
  const referrerReward = Number(settings.referral.referrerReward) || 0;

  if (refereeReward) grantCredit(user, refereeReward, 'هدیه‌ی ثبت‌نام با کد معرف', 'referral');
  if (referrerReward) {
    grantCredit(referrer, referrerReward, `پاداش معرفی ${user.name || 'مشتری تازه'}`, 'referral');
  }
  update('users', user.id, { referralRewarded: true });
  update('users', referrer.id, { referralCount: (Number(referrer.referralCount) || 0) + 1 });

  return { paid: true, referrer, referrerReward, refereeReward };
}

/** خلاصه‌ی وضعیت باشگاه برای نمایش در پروفایل */
export function clubSummary(user) {
  const settings = getSettings();
  const progress = tierProgress(user, settings);
  const redeem = pointsRedeemValue(user, settings);
  const invited = filter('users', (u) => u.referredBy === user.id);
  return {
    enabled: Boolean(settings.loyalty?.enabled),
    tier: progress.current,
    nextTier: progress.next,
    tierPercent: progress.percent,
    remainingToNext: progress.remaining,
    points: Number(user.points) || 0,
    pointValue: Number(settings.loyalty?.pointValue) || 0,
    minPointsToRedeem: Number(settings.loyalty?.minPointsToRedeem) || 0,
    redeemableValue: redeem.value,
    credit: Number(user.credit) || 0,
    referral: {
      enabled: Boolean(settings.referral?.enabled),
      code: ensureReferralCode(user),
      invitedCount: invited.length,
      rewardedCount: invited.filter((u) => u.referralRewarded).length,
      referrerReward: Number(settings.referral?.referrerReward) || 0,
      refereeReward: Number(settings.referral?.refereeReward) || 0,
    },
  };
}
