/** پنل مدیریت: داشبورد، نوبت‌ها، خدمات، پرسنل، مشتریان، پیام‌ها و تنظیمات */
import express from 'express';
import bcrypt from 'bcryptjs';
import {
  db, find, filter, insert, update, remove, getSettings, saveSettings,
} from '../lib/db.js';
import { requireAdmin, publicUser } from '../lib/auth.js';
import { sendSMS, normalizePhone, isValidIranMobile, SMS_PROVIDERS } from '../lib/sms.js';
import { sendEmail, verifyEmail, wrapEmailHTML, isValidEmail } from '../lib/email.js';
import {
  notifyConfirmed, notifyCanceled, apptTimestamp, runReminderSweep, runBirthdaySweep,
  runReviewRequestSweep, notifyGiftCard, notifyReferralReward,
} from '../lib/notify.js';
import { enrich, refundRedemptions } from './appointments.js';
import {
  pointsForSpend, grantPoints, grantCredit, payReferralRewards, tierOf, ledgerOf,
} from '../lib/loyalty.js';
import { createPromo, createGiftCard } from '../lib/promos.js';
import { recomputeStaffRating, recomputeServiceRating, ratingSummary } from '../lib/reviews.js';
import { requireModule, hasModule } from '../lib/modules.js';
import { todayISO, addDays, diffDays, toJalali, formatJalali } from '../../shared/jalali.js';

const router = express.Router();
router.use(requireAdmin);

/* ---------- داشبورد ---------- */

router.get('/stats', (req, res) => {
  const today = todayISO();
  const appts = filter('appointments', () => true);
  const active = appts.filter((a) => ['pending', 'confirmed'].includes(a.status));
  const monthAgo = addDays(today, -30);

  const revenue = appts
    .filter((a) => a.status === 'done')
    .reduce((sum, a) => sum + (Number(a.total) || 0), 0);
  const revenue30 = appts
    .filter((a) => a.status === 'done' && diffDays(a.date, monthAgo) >= 0)
    .reduce((sum, a) => sum + (Number(a.total) || 0), 0);

  // درآمد ۷ روز اخیر برای نمودار
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const iso = addDays(today, -i);
    const rows = appts.filter((a) => a.date === iso && a.status !== 'canceled');
    daily.push({
      date: iso,
      label: formatJalali(iso, { short: true }),
      count: rows.length,
      revenue: rows.filter((a) => a.status === 'done').reduce((s, a) => s + (Number(a.total) || 0), 0),
    });
  }

  // پرطرفدارترین خدمات
  const byService = {};
  for (const a of appts) {
    if (a.status === 'canceled') continue;
    byService[a.serviceId] = (byService[a.serviceId] || 0) + 1;
  }
  const topServices = Object.entries(byService)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, title: find('services', (s) => s.id === id)?.title || '—', count }));

  res.json({
    todayCount: appts.filter((a) => a.date === today && a.status !== 'canceled').length,
    upcomingCount: active.filter((a) => diffDays(a.date, today) >= 0).length,
    pendingCount: appts.filter((a) => a.status === 'pending').length,
    customersCount: filter('users', (u) => u.role !== 'admin').length,
    servicesCount: filter('services', (s) => s.active !== false).length,
    staffCount: filter('staff', (s) => s.active !== false).length,
    canceledCount: appts.filter((a) => a.status === 'canceled').length,
    revenue,
    revenue30,
    daily,
    topServices,
    messagesSent: filter('messages', (m) => m.status === 'sent').length,
  });
});

/* ---------- نوبت‌ها ---------- */

router.get('/appointments', (req, res) => {
  const { status, date, from, to, q, staffId } = req.query;
  let list = filter('appointments', () => true);

  if (status && status !== 'all') list = list.filter((a) => a.status === status);
  if (date) list = list.filter((a) => a.date === date);
  if (from) list = list.filter((a) => diffDays(a.date, from) >= 0);
  if (to) list = list.filter((a) => diffDays(a.date, to) <= 0);
  if (staffId) list = list.filter((a) => a.staffId === staffId);
  if (q) {
    const needle = String(q).trim();
    list = list.filter((a) => {
      const u = find('users', (x) => x.id === a.userId);
      return (
        a.code?.includes(needle) ||
        u?.name?.includes(needle) ||
        u?.phone?.includes(normalizePhone(needle)) ||
        a.serviceTitle?.includes(needle)
      );
    });
  }

  list.sort((a, b) => apptTimestamp(a) - apptTimestamp(b));
  res.json({
    appointments: list.map((a) => ({
      ...enrich(a),
      customer: publicUser(find('users', (u) => u.id === a.userId)),
    })),
  });
});

/** تغییر وضعیت نوبت */
router.put('/appointments/:id/status', async (req, res) => {
  const { status } = req.body || {};
  const allowed = ['pending', 'confirmed', 'done', 'canceled', 'noshow'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'وضعیت نامعتبر است' });

  const appt = find('appointments', (a) => a.id === req.params.id);
  if (!appt) return res.status(404).json({ error: 'نوبت پیدا نشد' });

  const patch = { status };
  if (status === 'done') patch.completedAt = new Date().toISOString();
  if (status === 'canceled') patch.canceledAt = new Date().toISOString();
  const updated = update('appointments', appt.id, patch);

  // تکمیل نوبت: آمار مشتری، امتیاز باشگاه و پاداش معرف
  if (status === 'done' && appt.status !== 'done') {
    const u = find('users', (x) => x.id === appt.userId);
    if (u) {
      const spent = Number(appt.payable ?? appt.total) || 0;
      update('users', u.id, {
        visits: (u.visits || 0) + 1,
        totalSpent: (u.totalSpent || 0) + spent,
        lastVisit: appt.date,
      });
      const fresh = find('users', (x) => x.id === u.id);
      const earned = pointsForSpend(spent, fresh);
      if (earned) grantPoints(fresh, earned, `خرید نوبت ${appt.code}`, appt.id);

      // پاداش دعوت از دوستان پس از اولین نوبت انجام‌شده
      const payout = payReferralRewards(u.id);
      if (payout.paid && payout.referrerReward) {
        notifyReferralReward(payout.referrer, payout.referrerReward, fresh.name)
          .catch((e) => console.error('[notify:referral]', e.message));
      }
    }
  }

  // لغو توسط مدیر: کد تخفیف، کارت هدیه، امتیاز و اعتبار برمی‌گردد
  if (status === 'canceled' && appt.status !== 'canceled') refundRedemptions(appt);

  if (status === 'confirmed' && appt.status !== 'confirmed') {
    notifyConfirmed(updated).catch((e) => console.error('[notify:confirmed]', e.message));
  }
  if (status === 'canceled' && appt.status !== 'canceled') {
    notifyCanceled(updated).catch((e) => console.error('[notify:canceled]', e.message));
  }

  res.json({ appointment: enrich(updated) });
});

/* ---------- خدمات ---------- */

router.get('/services', (req, res) => {
  res.json({ services: filter('services', () => true) });
});

router.post('/services', (req, res) => {
  const b = req.body || {};
  if (!String(b.title || '').trim()) return res.status(400).json({ error: 'عنوان خدمت الزامی است' });
  const service = insert('services', {
    title: String(b.title).trim(),
    description: String(b.description || ''),
    price: Number(b.price) || 0,
    duration: Number(b.duration) || 30,
    categoryId: b.categoryId || '',
    image: b.image || '',
    icon: b.icon || '✂️',
    discountPercent: Number(b.discountPercent) || 0,
    popular: Boolean(b.popular),
    active: b.active !== false,
  });
  res.status(201).json({ service });
});

router.put('/services/:id', (req, res) => {
  const b = req.body || {};
  const patch = {};
  for (const k of ['title', 'description', 'categoryId', 'image', 'icon']) {
    if (b[k] !== undefined) patch[k] = String(b[k]);
  }
  for (const k of ['price', 'duration', 'discountPercent']) {
    if (b[k] !== undefined) patch[k] = Number(b[k]) || 0;
  }
  for (const k of ['popular', 'active']) if (b[k] !== undefined) patch[k] = Boolean(b[k]);
  const service = update('services', req.params.id, patch);
  if (!service) return res.status(404).json({ error: 'خدمت پیدا نشد' });
  res.json({ service });
});

router.delete('/services/:id', (req, res) => {
  const inUse = filter('appointments', (a) => a.serviceId === req.params.id && ['pending', 'confirmed'].includes(a.status));
  if (inUse.length) {
    update('services', req.params.id, { active: false });
    return res.json({ ok: true, softDeleted: true, message: 'این خدمت نوبت فعال دارد، بنابراین غیرفعال شد' });
  }
  if (!remove('services', req.params.id)) return res.status(404).json({ error: 'خدمت پیدا نشد' });
  res.json({ ok: true });
});

/* ---------- پرسنل ---------- */

router.get('/staff', (req, res) => {
  res.json({ staff: filter('staff', () => true) });
});

router.post('/staff', (req, res) => {
  const b = req.body || {};
  if (!String(b.name || '').trim()) return res.status(400).json({ error: 'نام آرایشگر الزامی است' });
  const row = insert('staff', {
    name: String(b.name).trim(),
    title: String(b.title || 'آرایشگر'),
    avatar: b.avatar || '',
    bio: String(b.bio || ''),
    rating: Number(b.rating) || 5,
    reviews: Number(b.reviews) || 0,
    serviceIds: Array.isArray(b.serviceIds) ? b.serviceIds : [],
    offDays: Array.isArray(b.offDays) ? b.offDays.map(Number) : [],
    vacations: Array.isArray(b.vacations) ? b.vacations : [],
    shift: b.shift || null,
    active: b.active !== false,
  });
  res.status(201).json({ staff: row });
});

router.put('/staff/:id', (req, res) => {
  const b = req.body || {};
  const patch = {};
  for (const k of ['name', 'title', 'avatar', 'bio']) if (b[k] !== undefined) patch[k] = String(b[k]);
  for (const k of ['rating', 'reviews']) if (b[k] !== undefined) patch[k] = Number(b[k]) || 0;
  if (b.serviceIds !== undefined) patch.serviceIds = Array.isArray(b.serviceIds) ? b.serviceIds : [];
  if (b.offDays !== undefined) patch.offDays = (b.offDays || []).map(Number);
  if (b.vacations !== undefined) patch.vacations = b.vacations || [];
  if (b.shift !== undefined) patch.shift = b.shift;
  if (b.active !== undefined) patch.active = Boolean(b.active);
  const row = update('staff', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'آرایشگر پیدا نشد' });
  res.json({ staff: row });
});

router.delete('/staff/:id', (req, res) => {
  const inUse = filter('appointments', (a) => a.staffId === req.params.id && ['pending', 'confirmed'].includes(a.status));
  if (inUse.length) {
    update('staff', req.params.id, { active: false });
    return res.json({ ok: true, softDeleted: true, message: 'این آرایشگر نوبت فعال دارد، بنابراین غیرفعال شد' });
  }
  if (!remove('staff', req.params.id)) return res.status(404).json({ error: 'آرایشگر پیدا نشد' });
  res.json({ ok: true });
});

/* ---------- مشتریان (CRM) ---------- */

router.get('/customers', (req, res) => {
  const { q } = req.query;
  let list = filter('users', (u) => u.role !== 'admin');
  if (q) {
    const needle = String(q).trim();
    list = list.filter((u) => u.name?.includes(needle) || u.phone?.includes(normalizePhone(needle)) || u.email?.includes(needle));
  }
  const withStats = list.map((u) => {
    const appts = filter('appointments', (a) => a.userId === u.id);
    const tier = tierOf(u);
    return {
      ...publicUser(u),
      appointmentsCount: appts.length,
      doneCount: appts.filter((a) => a.status === 'done').length,
      canceledCount: appts.filter((a) => a.status === 'canceled').length,
      tierId: tier?.id || null,
      tierTitle: tier?.title || null,
      tierIcon: tier?.icon || '',
      credit: Number(u.credit) || 0,
      referralCount: Number(u.referralCount) || 0,
    };
  });
  withStats.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
  res.json({ customers: withStats });
});

router.put('/customers/:id', (req, res) => {
  const b = req.body || {};
  const patch = {};
  for (const k of ['name', 'email', 'birthday', 'notes', 'address']) if (b[k] !== undefined) patch[k] = String(b[k] || '');
  if (b.blocked !== undefined) patch.blocked = Boolean(b.blocked);
  if (b.points !== undefined) patch.points = Number(b.points) || 0;
  const u = update('users', req.params.id, patch);
  if (!u) return res.status(404).json({ error: 'مشتری پیدا نشد' });
  res.json({ customer: publicUser(u) });
});

/* ---------- دسته‌بندی و پیشنهادها ---------- */

router.post('/categories', (req, res) => {
  const row = insert('categories', {
    title: String(req.body?.title || '').trim(),
    icon: req.body?.icon || '💅',
    order: Number(req.body?.order) || 0,
  });
  res.status(201).json({ category: row });
});

router.delete('/categories/:id', (req, res) => {
  remove('categories', req.params.id);
  res.json({ ok: true });
});

router.post('/offers', (req, res) => {
  const b = req.body || {};
  const row = insert('offers', {
    title: String(b.title || ''),
    subtitle: String(b.subtitle || ''),
    percent: Number(b.percent) || 0,
    image: b.image || '',
    expiresAt: b.expiresAt || '',
    active: b.active !== false,
  });
  res.status(201).json({ offer: row });
});

router.delete('/offers/:id', (req, res) => {
  remove('offers', req.params.id);
  res.json({ ok: true });
});

/* ---------- پیام‌رسانی ---------- */

router.get('/messages', (req, res) => {
  const { channel, status } = req.query;
  let list = filter('messages', () => true);
  if (channel && channel !== 'all') list = list.filter((m) => m.channel === channel);
  if (status && status !== 'all') list = list.filter((m) => m.status === status);
  list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ messages: list.slice(0, 300) });
});

/** ارسال پیام تکی یا گروهی */
router.post('/messages/send', requireModule('notifications'), async (req, res) => {
  const { channel = 'sms', audience = 'selected', userIds = [], text = '', subject = '' } = req.body || {};
  if (!text.trim()) return res.status(400).json({ error: 'متن پیام نمی‌تواند خالی باشد' });
  if (channel === 'email' && !subject.trim()) {
    return res.status(400).json({ error: 'موضوع ایمیل الزامی است' });
  }

  let targets = [];
  const customers = filter('users', (u) => u.role !== 'admin' && !u.blocked);
  const today = todayISO();

  if (audience === 'all') targets = customers;
  else if (audience === 'active') {
    targets = customers.filter((u) =>
      filter('appointments', (a) => a.userId === u.id && ['pending', 'confirmed'].includes(a.status) && diffDays(a.date, today) >= 0).length
    );
  } else if (audience === 'inactive') {
    targets = customers.filter((u) => !u.lastVisit || diffDays(today, u.lastVisit) > 60);
  } else {
    targets = customers.filter((u) => userIds.includes(u.id));
  }

  if (!targets.length) return res.status(400).json({ error: 'هیچ گیرنده‌ای انتخاب نشده است' });

  const settings = getSettings();
  const results = { sent: 0, failed: 0, skipped: 0, errors: [] };

  for (const u of targets) {
    const body = text
      .replace(/\{نام\}/g, u.name || 'مشتری')
      .replace(/\{سالن\}/g, settings.salonName)
      .replace(/\{امتیاز\}/g, String(u.points || 0));

    let out;
    if (channel === 'sms') {
      if (!isValidIranMobile(u.phone)) { results.skipped++; continue; }
      out = await sendSMS({ to: u.phone, text: body, kind: 'campaign', meta: { userId: u.id } });
    } else {
      if (!isValidEmail(u.email)) { results.skipped++; continue; }
      out = await sendEmail({
        to: u.email,
        subject,
        kind: 'campaign',
        meta: { userId: u.id },
        html: wrapEmailHTML({
          title: subject,
          salonName: settings.salonName,
          footer: `${settings.salonName} • ${settings.phone}`,
          bodyHTML: body.split('\n').map((l) => `<p>${l.replace(/[<>&]/g, '')}</p>`).join(''),
        }),
      });
    }
    if (out.ok) results.sent++;
    else { results.failed++; if (results.errors.length < 5) results.errors.push(out.error); }
  }

  res.json({ ...results, total: targets.length });
});

/** ارسال آزمایشی */
router.post('/messages/test', async (req, res) => {
  const { channel = 'sms', to, text = 'این یک پیام آزمایشی است.', subject = 'پیام آزمایشی' } = req.body || {};
  if (channel === 'sms') {
    if (!isValidIranMobile(to)) return res.status(400).json({ error: 'شماره موبایل معتبر نیست' });
    const out = await sendSMS({ to, text, kind: 'test' });
    return res.status(out.ok ? 200 : 400).json(out);
  }
  if (!isValidEmail(to)) return res.status(400).json({ error: 'آدرس ایمیل معتبر نیست' });
  const settings = getSettings();
  const out = await sendEmail({
    to, subject, kind: 'test',
    html: wrapEmailHTML({
      title: subject, salonName: settings.salonName, footer: settings.salonName,
      bodyHTML: `<p>${text}</p>`,
    }),
  });
  res.status(out.ok ? 200 : 400).json(out);
});

router.post('/messages/verify-email', async (req, res) => {
  res.json(await verifyEmail());
});

router.post('/scheduler/run', async (req, res) => {
  const reminders = await runReminderSweep();
  const birthdays = await runBirthdaySweep();
  const reviewRequests = await runReviewRequestSweep();
  res.json({ reminders, birthdays, reviewRequests });
});

/* ============================================================
   کدهای تخفیف
   ============================================================ */

router.get('/promos', requireModule('marketing'), (req, res) => {
  const list = filter('promos', () => true)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ promos: list });
});

router.post('/promos', requireModule('marketing'), (req, res) => {
  try {
    res.status(201).json({ promo: createPromo(req.body || {}) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/promos/:id', requireModule('marketing'), (req, res) => {
  const b = req.body || {};
  const patch = {};
  for (const k of ['title', 'startsAt', 'expiresAt']) if (b[k] !== undefined) patch[k] = String(b[k] || '');
  for (const k of ['value', 'minAmount', 'maxDiscount', 'usageLimit', 'perUserLimit']) {
    if (b[k] !== undefined) patch[k] = Number(b[k]) || 0;
  }
  if (b.type !== undefined) patch.type = b.type === 'amount' ? 'amount' : 'percent';
  if (b.serviceIds !== undefined) patch.serviceIds = Array.isArray(b.serviceIds) ? b.serviceIds : [];
  for (const k of ['firstVisitOnly', 'active']) if (b[k] !== undefined) patch[k] = Boolean(b[k]);

  const promo = update('promos', req.params.id, patch);
  if (!promo) return res.status(404).json({ error: 'کد تخفیف پیدا نشد' });
  res.json({ promo });
});

router.delete('/promos/:id', requireModule('marketing'), (req, res) => {
  if (!remove('promos', req.params.id)) return res.status(404).json({ error: 'کد تخفیف پیدا نشد' });
  res.json({ ok: true });
});

/* ============================================================
   کارت‌های هدیه
   ============================================================ */

router.get('/giftcards', requireModule('marketing'), (req, res) => {
  const list = filter('giftcards', () => true)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ giftcards: list });
});

router.post('/giftcards', requireModule('marketing'), (req, res) => {
  try {
    const card = createGiftCard(req.body || {});
    if (req.body?.notify !== false && card.recipientPhone) {
      notifyGiftCard(card).catch((e) => console.error('[notify:giftCard]', e.message));
    }
    res.status(201).json({ giftcard: card });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/giftcards/:id', requireModule('marketing'), (req, res) => {
  const b = req.body || {};
  const patch = {};
  for (const k of ['recipientName', 'recipientPhone', 'buyerName', 'message', 'expiresAt']) {
    if (b[k] !== undefined) patch[k] = String(b[k] || '');
  }
  if (b.balance !== undefined) patch.balance = Math.max(0, Number(b.balance) || 0);
  if (b.active !== undefined) patch.active = Boolean(b.active);
  const card = update('giftcards', req.params.id, patch);
  if (!card) return res.status(404).json({ error: 'کارت هدیه پیدا نشد' });
  res.json({ giftcard: card });
});

router.delete('/giftcards/:id', requireModule('marketing'), (req, res) => {
  if (!remove('giftcards', req.params.id)) return res.status(404).json({ error: 'کارت هدیه پیدا نشد' });
  res.json({ ok: true });
});

router.post('/giftcards/:id/resend', requireModule('marketing'), async (req, res) => {
  const card = find('giftcards', (g) => g.id === req.params.id);
  if (!card) return res.status(404).json({ error: 'کارت هدیه پیدا نشد' });
  const result = await notifyGiftCard(card);
  res.json({ ok: true, result });
});

/* ============================================================
   نظرها
   ============================================================ */

router.get('/reviews', requireModule('marketing'), (req, res) => {
  const { published } = req.query;
  let list = filter('reviews', () => true);
  if (published === '1') list = list.filter((r) => r.published);
  if (published === '0') list = list.filter((r) => !r.published);
  list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({
    reviews: list.map((r) => ({
      ...r,
      staffName: find('staff', (s) => s.id === r.staffId)?.name || '—',
    })),
    summary: ratingSummary(),
  });
});

router.put('/reviews/:id', requireModule('marketing'), (req, res) => {
  const b = req.body || {};
  const patch = {};
  if (b.published !== undefined) patch.published = Boolean(b.published);
  if (b.reply !== undefined) patch.reply = String(b.reply).slice(0, 500);
  const review = update('reviews', req.params.id, patch);
  if (!review) return res.status(404).json({ error: 'نظر پیدا نشد' });
  recomputeStaffRating(review.staffId);
  recomputeServiceRating(review.serviceId);
  res.json({ review });
});

router.delete('/reviews/:id', requireModule('marketing'), (req, res) => {
  const review = find('reviews', (r) => r.id === req.params.id);
  if (!review) return res.status(404).json({ error: 'نظر پیدا نشد' });
  remove('reviews', req.params.id);
  update('appointments', review.appointmentId, { reviewed: false, reviewId: '' });
  recomputeStaffRating(review.staffId);
  recomputeServiceRating(review.serviceId);
  res.json({ ok: true });
});

/* ============================================================
   اعتبار و امتیاز دستی
   ============================================================ */

router.post('/customers/:id/credit', requireModule('marketing'), (req, res) => {
  const user = find('users', (u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'مشتری پیدا نشد' });
  const amount = Number(req.body?.amount) || 0;
  const points = Number(req.body?.points) || 0;
  const note = String(req.body?.note || 'تنظیم دستی توسط مدیر');
  if (!amount && !points) return res.status(400).json({ error: 'مبلغ یا امتیاز را وارد کنید' });

  if (amount) grantCredit(user, amount, note, 'admin');
  if (points) grantPoints(find('users', (u) => u.id === user.id), points, note, 'admin');
  res.json({ customer: publicUser(find('users', (u) => u.id === user.id)) });
});

router.get('/customers/:id/ledger', requireModule('marketing'), (req, res) => {
  res.json({ entries: ledgerOf(req.params.id, 100) });
});

/* ---------- تنظیمات ---------- */

router.get('/settings', (req, res) => {
  const s = getSettings();
  // کلیدهای حساس به صورت ماسک‌شده برگردانده می‌شوند
  res.json({
    settings: {
      ...s,
      __jwtSecret: undefined,
      sms: { ...s.sms, apiKey: s.sms.apiKey ? '••••••••' + s.sms.apiKey.slice(-4) : '' },
      email: { ...s.email, pass: s.email.pass ? '••••••••' : '' },
    },
    smsProviders: SMS_PROVIDERS,
  });
});

router.put('/settings', (req, res) => {
  const patch = { ...(req.body || {}) };
  delete patch.__jwtSecret;
  // مقادیر ماسک‌شده نباید جایگزین کلید واقعی شوند
  if (patch.sms?.apiKey?.startsWith('••')) delete patch.sms.apiKey;
  if (patch.email?.pass?.startsWith('••')) delete patch.email.pass;
  const s = saveSettings(patch);
  res.json({ ok: true, settings: { ...s, __jwtSecret: undefined } });
});

/** تغییر رمز مدیر */
router.put('/password', (req, res) => {
  const { current, next } = req.body || {};
  if (!bcrypt.compareSync(String(current || ''), req.user.passwordHash || '')) {
    return res.status(400).json({ error: 'رمز عبور فعلی نادرست است' });
  }
  if (String(next || '').length < 6) return res.status(400).json({ error: 'رمز تازه باید حداقل ۶ نویسه باشد' });
  update('users', req.user.id, { passwordHash: bcrypt.hashSync(String(next), 10) });
  res.json({ ok: true });
});

export default router;
