/** رزرو، مشاهده، لغو و نظر دادن به نوبت توسط مشتری */
import express from 'express';
import crypto from 'node:crypto';
import { find, filter, insert, update, getSettings } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { isSlotBookable } from '../lib/slots.js';
import { notifyBooked, notifyCanceled, apptTimestamp } from '../lib/notify.js';
import { quote } from '../lib/pricing.js';
import { consumePromo, releasePromo, chargeGiftCard, refundGiftCard } from '../lib/promos.js';
import { spendPoints, spendCredit, grantCredit, grantPoints } from '../lib/loyalty.js';
import { canReview, submitReview, REVIEW_TAGS } from '../lib/reviews.js';
import { requireModule, hasModule } from '../lib/modules.js';
import { todayISO, diffDays, toPersianDigits } from '../../shared/jalali.js';

const router = express.Router();

function generateCode() {
  return String(crypto.randomInt(100000, 999999));
}

/** افزودن اطلاعات خدمت/آرایشگر به نوبت برای نمایش */
function enrich(appt) {
  const service = find('services', (s) => s.id === appt.serviceId);
  const staff = find('staff', (s) => s.id === appt.staffId);
  return {
    ...appt,
    service: service
      ? { id: service.id, title: service.title, image: service.image, icon: service.icon, gradient: service.gradient, duration: service.duration }
      : null,
    staff: staff ? { id: staff.id, name: staff.name, title: staff.title, avatar: staff.avatar } : null,
  };
}

/** پیش‌نمایش فاکتور با همه‌ی تخفیف‌ها */
router.post('/quote', requireAuth, (req, res) => {
  const { serviceId, promoCode = '', giftCardCode = '', usePoints = false, useCredit = false } = req.body || {};
  const service = find('services', (s) => s.id === serviceId);
  if (!service) return res.status(404).json({ error: 'خدمت موردنظر پیدا نشد' });

  const result = quote({ service, user: req.user, promoCode, giftCardCode, usePoints, useCredit });
  res.json({ ...result, currency: getSettings().currency });
});

/** ثبت نوبت */
router.post('/', requireAuth, async (req, res) => {
  const {
    serviceId, staffId, date, time, paymentMethod = 'cash', note = '',
    promoCode = '', giftCardCode = '', usePoints = false, useCredit = false,
  } = req.body || {};

  const service = find('services', (s) => s.id === serviceId);
  if (!service || service.active === false) return res.status(404).json({ error: 'خدمت موردنظر پیدا نشد' });

  const staff = find('staff', (s) => s.id === staffId);
  if (!staff || staff.active === false) return res.status(404).json({ error: 'آرایشگر موردنظر پیدا نشد' });
  if (staff.serviceIds?.length && !staff.serviceIds.includes(service.id)) {
    return res.status(400).json({ error: 'این آرایشگر این خدمت را ارائه نمی‌دهد' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return res.status(400).json({ error: 'تاریخ نامعتبر است' });
  if (!/^\d{2}:\d{2}$/.test(String(time))) return res.status(400).json({ error: 'ساعت نامعتبر است' });

  const clash = filter('appointments', (a) =>
    a.userId === req.user.id && a.date === date && a.time === time && ['pending', 'confirmed'].includes(a.status)
  );
  if (clash.length) return res.status(409).json({ error: 'شما در این ساعت نوبت دیگری دارید' });

  const check = isSlotBookable({ isoDate: date, time, serviceId, staffId });
  if (!check.ok) return res.status(409).json({ error: check.error });

  // محاسبه‌ی نهایی قیمت؛ اگر کد تخفیف/کارت هدیه ایراد داشته باشد رزرو انجام نمی‌شود
  const { price, errors } = quote({
    service, user: req.user, promoCode, giftCardCode, usePoints, useCredit,
  });
  if (errors.length) return res.status(400).json({ error: errors[0], errors });

  const appt = insert('appointments', {
    code: generateCode(),
    userId: req.user.id,
    serviceId,
    serviceTitle: service.title,
    staffId,
    date,
    time,
    duration: Number(service.duration) || 30,
    status: 'pending',
    paymentMethod,
    paymentStatus: price.payable === 0 ? 'paid' : 'unpaid',
    note: String(note).slice(0, 300),
    reviewed: false,
    ...price,
  });

  // مصرف کدها و موجودی‌ها پس از ثبت موفق نوبت
  if (price.promoCode) consumePromo(price.promoCode);
  if (price.giftCardUsed > 0) chargeGiftCard(price.giftCardCode, price.giftCardUsed);
  if (price.pointsUsed > 0) {
    spendPoints(req.user, price.pointsUsed, `استفاده در نوبت ${appt.code}`, appt.id);
  }
  if (price.creditUsed > 0) {
    spendCredit(req.user, price.creditUsed, `استفاده در نوبت ${appt.code}`, appt.id);
  }

  notifyBooked(appt).catch((e) => console.error('[notify]', e.message));
  res.status(201).json({ appointment: enrich(appt) });
});

/** نوبت‌های من */
router.get('/', requireAuth, (req, res) => {
  const { scope = 'all' } = req.query;
  const today = todayISO();
  let list = filter('appointments', (a) => a.userId === req.user.id);

  if (scope === 'upcoming') {
    list = list.filter((a) => ['pending', 'confirmed'].includes(a.status) && diffDays(a.date, today) >= 0);
  } else if (scope === 'past') {
    list = list.filter((a) => a.status === 'done' || a.status === 'canceled' || diffDays(a.date, today) < 0);
  }

  list.sort((a, b) => apptTimestamp(b) - apptTimestamp(a));
  res.json({ appointments: list.map(enrich) });
});

/** نزدیک‌ترین نوبت پیش رو */
router.get('/upcoming', requireAuth, (req, res) => {
  const now = Date.now();
  const next = filter('appointments', (a) =>
    a.userId === req.user.id && ['pending', 'confirmed'].includes(a.status) && apptTimestamp(a) > now
  ).sort((a, b) => apptTimestamp(a) - apptTimestamp(b))[0];
  res.json({ appointment: next ? enrich(next) : null });
});

/** نوبت‌های انجام‌شده‌ای که هنوز نظر ندارند */
router.get('/awaiting-review', requireAuth, requireModule('marketing'), (req, res) => {
  const list = filter('appointments', (a) =>
    a.userId === req.user.id && a.status === 'done' && !a.reviewed
  ).sort((a, b) => apptTimestamp(b) - apptTimestamp(a));
  res.json({ appointments: list.map(enrich), tags: REVIEW_TAGS });
});

router.get('/:id', requireAuth, (req, res) => {
  const appt = find('appointments', (a) => a.id === req.params.id);
  if (!appt || (appt.userId !== req.user.id && req.user.role !== 'admin')) {
    return res.status(404).json({ error: 'نوبت موردنظر پیدا نشد' });
  }
  res.json({ appointment: enrich(appt) });
});

/** ثبت نظر و امتیاز */
router.post('/:id/review', requireAuth, requireModule('marketing'), (req, res) => {
  const settings = getSettings();
  if (!settings.reviews?.enabled) return res.status(400).json({ error: 'نظرسنجی غیرفعال است' });

  const appt = find('appointments', (a) => a.id === req.params.id);
  const allowed = canReview(appt, req.user.id);
  if (!allowed.ok) return res.status(400).json({ error: allowed.error });

  const { rating, comment, staffRating, tags } = req.body || {};
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'امتیاز باید بین ۱ تا ۵ باشد' });

  const review = submitReview({ appt, user: req.user, rating, comment, staffRating, tags });

  // پاداش امتیاز برای ثبت نظر
  const bonus = 10;
  grantPoints(req.user, bonus, 'پاداش ثبت نظر', appt.id);

  res.status(201).json({ review, bonusPoints: bonus });
});

/** لغو نوبت */
router.post('/:id/cancel', requireAuth, async (req, res) => {
  const appt = find('appointments', (a) => a.id === req.params.id);
  if (!appt || (appt.userId !== req.user.id && req.user.role !== 'admin')) {
    return res.status(404).json({ error: 'نوبت موردنظر پیدا نشد' });
  }
  if (!['pending', 'confirmed'].includes(appt.status)) {
    return res.status(400).json({ error: 'این نوبت قابل لغو نیست' });
  }

  const settings = getSettings();
  const hoursLeft = (apptTimestamp(appt) - Date.now()) / 3600000;
  if (req.user.role !== 'admin' && hoursLeft < Number(settings.cancelWindowHours)) {
    return res.status(400).json({
      error: `لغو نوبت فقط تا ${toPersianDigits(settings.cancelWindowHours)} ساعت پیش از زمان آن ممکن است. لطفاً با سالن تماس بگیرید.`,
    });
  }

  const updated = update('appointments', appt.id, {
    status: 'canceled',
    canceledAt: new Date().toISOString(),
    canceledBy: req.user.role === 'admin' ? 'admin' : 'customer',
    cancelReason: String(req.body?.reason || '').slice(0, 200),
  });

  refundRedemptions(appt);

  notifyCanceled(updated).catch((e) => console.error('[notify]', e.message));
  res.json({ appointment: enrich(updated) });
});

/** بازگرداندن کد تخفیف، کارت هدیه، امتیاز و اعتبار هنگام لغو */
export function refundRedemptions(appt) {
  if (appt.refunded) return;
  const owner = find('users', (u) => u.id === appt.userId);

  if (appt.promoCode) releasePromo(appt.promoCode);
  if (appt.giftCardUsed > 0) refundGiftCard(appt.giftCardCode, appt.giftCardUsed);
  if (owner && appt.pointsUsed > 0) {
    grantPoints(owner, appt.pointsUsed, `بازگشت امتیاز نوبت لغوشده ${appt.code}`, appt.id);
  }
  if (owner && appt.creditUsed > 0) {
    grantCredit(owner, appt.creditUsed, `بازگشت اعتبار نوبت لغوشده ${appt.code}`, appt.id);
  }
  update('appointments', appt.id, { refunded: true });
}

/** جابه‌جایی نوبت */
router.post('/:id/reschedule', requireAuth, async (req, res) => {
  const appt = find('appointments', (a) => a.id === req.params.id);
  if (!appt || (appt.userId !== req.user.id && req.user.role !== 'admin')) {
    return res.status(404).json({ error: 'نوبت موردنظر پیدا نشد' });
  }
  if (!['pending', 'confirmed'].includes(appt.status)) {
    return res.status(400).json({ error: 'این نوبت قابل جابه‌جایی نیست' });
  }
  const { date, time, staffId } = req.body || {};
  const targetStaff = staffId || appt.staffId;

  const check = isSlotBookable({
    isoDate: date, time, serviceId: appt.serviceId,
    staffId: targetStaff, excludeAppointmentId: appt.id,
  });
  if (!check.ok) return res.status(409).json({ error: check.error });

  const updated = update('appointments', appt.id, {
    date, time, staffId: targetStaff, reminderSentAt: null, rescheduledAt: new Date().toISOString(),
  });
  notifyBooked(updated).catch((e) => console.error('[notify:booked]', e.message));
  res.json({ appointment: enrich(updated) });
});

export { enrich };
export default router;
