/**
 * کدهای تخفیف و کارت‌های هدیه.
 */
import { db, find, filter, insert, update, getSettings } from './db.js';
import { generateCode } from './loyalty.js';
import { todayISO, diffDays } from '../../shared/jalali.js';

export const normalizeCode = (code) => String(code || '').trim().toUpperCase().replace(/\s+/g, '');

/* ============================================================
   کد تخفیف
   ============================================================ */

/**
 * اعتبارسنجی کد تخفیف برای یک کاربر و خدمت مشخص
 * @returns {{ok:boolean, error?:string, promo?:object, discount?:number}}
 */
export function validatePromo({ code, user, serviceId, amount }) {
  const clean = normalizeCode(code);
  if (!clean) return { ok: false, error: 'کد تخفیف وارد نشده است' };

  const promo = find('promos', (p) => p.code === clean);
  if (!promo) return { ok: false, error: 'کد تخفیف معتبر نیست' };
  if (promo.active === false) return { ok: false, error: 'این کد تخفیف غیرفعال شده است' };

  const today = todayISO();
  if (promo.startsAt && diffDays(today, promo.startsAt) < 0) {
    return { ok: false, error: 'این کد هنوز فعال نشده است' };
  }
  if (promo.expiresAt && diffDays(today, promo.expiresAt) > 0) {
    return { ok: false, error: 'مهلت استفاده از این کد به پایان رسیده است' };
  }
  if (promo.usageLimit > 0 && (promo.usedCount || 0) >= promo.usageLimit) {
    return { ok: false, error: 'ظرفیت استفاده از این کد تکمیل شده است' };
  }
  if (promo.serviceIds?.length && serviceId && !promo.serviceIds.includes(serviceId)) {
    return { ok: false, error: 'این کد برای خدمت انتخابی قابل استفاده نیست' };
  }
  if (promo.minAmount > 0 && Number(amount) < promo.minAmount) {
    return { ok: false, error: `این کد برای خرید بالای ${promo.minAmount.toLocaleString('fa-IR')} تومان است` };
  }

  if (user) {
    if (promo.firstVisitOnly) {
      const done = filter('appointments', (a) => a.userId === user.id && a.status === 'done');
      if (done.length) return { ok: false, error: 'این کد فقط برای اولین نوبت قابل استفاده است' };
    }
    if (promo.perUserLimit > 0) {
      const used = filter('appointments', (a) =>
        a.userId === user.id && a.promoCode === clean && a.status !== 'canceled'
      );
      if (used.length >= promo.perUserLimit) {
        return { ok: false, error: 'شما قبلاً از این کد استفاده کرده‌اید' };
      }
    }
  }

  return { ok: true, promo, discount: promoDiscount(promo, amount) };
}

/** مبلغ تخفیف یک کد روی مبلغ داده‌شده */
export function promoDiscount(promo, amount) {
  const base = Number(amount) || 0;
  let value =
    promo.type === 'amount'
      ? Number(promo.value) || 0
      : Math.round((base * (Number(promo.value) || 0)) / 100);
  if (promo.maxDiscount > 0) value = Math.min(value, Number(promo.maxDiscount));
  return Math.max(0, Math.min(value, base));
}

/** ثبت مصرف کد پس از رزرو موفق */
export function consumePromo(code) {
  const promo = find('promos', (p) => p.code === normalizeCode(code));
  if (!promo) return null;
  return update('promos', promo.id, { usedCount: (Number(promo.usedCount) || 0) + 1 });
}

/** بازگرداندن مصرف کد هنگام لغو نوبت */
export function releasePromo(code) {
  const promo = find('promos', (p) => p.code === normalizeCode(code));
  if (!promo) return null;
  return update('promos', promo.id, { usedCount: Math.max(0, (Number(promo.usedCount) || 0) - 1) });
}

export function createPromo(data) {
  const code = normalizeCode(data.code) || generateCode(7);
  if (find('promos', (p) => p.code === code)) {
    throw new Error('این کد تخفیف قبلاً ثبت شده است');
  }
  return insert('promos', {
    code,
    title: String(data.title || '').trim(),
    type: data.type === 'amount' ? 'amount' : 'percent',
    value: Number(data.value) || 0,
    minAmount: Number(data.minAmount) || 0,
    maxDiscount: Number(data.maxDiscount) || 0,
    usageLimit: Number(data.usageLimit) || 0,     // ۰ = نامحدود
    perUserLimit: Number(data.perUserLimit) || 1, // ۰ = نامحدود
    usedCount: 0,
    serviceIds: Array.isArray(data.serviceIds) ? data.serviceIds : [],
    startsAt: data.startsAt || '',
    expiresAt: data.expiresAt || '',
    firstVisitOnly: Boolean(data.firstVisitOnly),
    active: data.active !== false,
  });
}

/* ============================================================
   کارت هدیه
   ============================================================ */

/**
 * بررسی کارت هدیه
 * @returns {{ok:boolean, error?:string, card?:object, usable?:number}}
 */
export function validateGiftCard({ code, amount }) {
  const clean = normalizeCode(code);
  if (!clean) return { ok: false, error: 'کد کارت هدیه وارد نشده است' };

  const card = find('giftcards', (g) => g.code === clean);
  if (!card) return { ok: false, error: 'کارت هدیه با این کد پیدا نشد' };
  if (card.active === false) return { ok: false, error: 'این کارت هدیه غیرفعال شده است' };
  if (card.expiresAt && diffDays(todayISO(), card.expiresAt) > 0) {
    return { ok: false, error: 'اعتبار این کارت هدیه به پایان رسیده است' };
  }
  if ((Number(card.balance) || 0) <= 0) {
    return { ok: false, error: 'موجودی این کارت هدیه صفر است' };
  }

  return {
    ok: true,
    card,
    usable: Math.min(Number(card.balance), Number(amount) || Number(card.balance)),
  };
}

/** کسر از موجودی کارت هدیه */
export function chargeGiftCard(code, amount) {
  const card = find('giftcards', (g) => g.code === normalizeCode(code));
  if (!card) return null;
  const used = Math.min(Number(card.balance) || 0, Number(amount) || 0);
  return update('giftcards', card.id, {
    balance: (Number(card.balance) || 0) - used,
    usedCount: (Number(card.usedCount) || 0) + 1,
    lastUsedAt: new Date().toISOString(),
  });
}

/** برگرداندن مبلغ به کارت هدیه هنگام لغو */
export function refundGiftCard(code, amount) {
  const card = find('giftcards', (g) => g.code === normalizeCode(code));
  if (!card) return null;
  const back = Math.min(Number(amount) || 0, (Number(card.initialAmount) || 0) - (Number(card.balance) || 0));
  return update('giftcards', card.id, { balance: (Number(card.balance) || 0) + back });
}

export function createGiftCard(data) {
  const amount = Number(data.amount) || 0;
  if (amount <= 0) throw new Error('مبلغ کارت هدیه باید بیشتر از صفر باشد');
  let code = normalizeCode(data.code);
  if (code && find('giftcards', (g) => g.code === code)) {
    throw new Error('این کد کارت هدیه قبلاً ثبت شده است');
  }
  if (!code) {
    do { code = generateCode(4) + '-' + generateCode(4); }
    while (find('giftcards', (g) => g.code === code));
  }
  return insert('giftcards', {
    code,
    initialAmount: amount,
    balance: amount,
    usedCount: 0,
    recipientName: String(data.recipientName || ''),
    recipientPhone: String(data.recipientPhone || ''),
    buyerName: String(data.buyerName || ''),
    message: String(data.message || ''),
    expiresAt: data.expiresAt || '',
    active: data.active !== false,
  });
}
