/** خدمات، آرایشگرها، پیشنهادها و ظرفیت زمانی (عمومی) */
import express from 'express';
import { filter, find, getSettings } from '../lib/db.js';
import { availableSlots, monthAvailability } from '../lib/slots.js';
import { enabledModules } from '../lib/modules.js';
import { buildJalaliMonth, todayISO, addDays, diffDays } from '../../shared/jalali.js';

const router = express.Router();

/** تنظیمات عمومی سالن (بدون اطلاعات حساس) */
router.get('/settings', (req, res) => {
  const s = getSettings();
  res.json({
    salonName: s.salonName,
    tagline: s.tagline,
    address: s.address,
    phone: s.phone,
    currency: s.currency,
    taxPercent: s.taxPercent,
    depositPercent: s.depositPercent,
    workingHours: s.workingHours,
    holidays: s.holidays,
    maxAdvanceDays: s.maxAdvanceDays,
    cancelWindowHours: s.cancelWindowHours,
    modules: enabledModules(),
  });
});

router.get('/categories', (req, res) => {
  res.json({ categories: filter('categories', () => true).sort((a, b) => (a.order || 0) - (b.order || 0)) });
});

router.get('/services', (req, res) => {
  const { category, q, popular } = req.query;
  let list = filter('services', (s) => s.active !== false);
  if (category && category !== 'all') list = list.filter((s) => s.categoryId === category);
  if (popular === '1') list = list.filter((s) => s.popular);
  if (q) {
    const needle = String(q).trim();
    list = list.filter((s) => (s.title + ' ' + (s.description || '')).includes(needle));
  }
  res.json({ services: list.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0)) });
});

router.get('/services/:id', (req, res) => {
  const service = find('services', (s) => s.id === req.params.id);
  if (!service) return res.status(404).json({ error: 'خدمت موردنظر پیدا نشد' });
  const staff = filter('staff', (s) => s.active !== false && (!s.serviceIds?.length || s.serviceIds.includes(service.id)));
  res.json({ service, staff });
});

router.get('/staff', (req, res) => {
  const { serviceId } = req.query;
  let list = filter('staff', (s) => s.active !== false);
  if (serviceId) list = list.filter((s) => !s.serviceIds?.length || s.serviceIds.includes(serviceId));
  res.json({ staff: list });
});

router.get('/offers', (req, res) => {
  const today = todayISO();
  const list = filter('offers', (o) => o.active !== false && (!o.expiresAt || diffDays(o.expiresAt, today) >= 0));
  res.json({ offers: list });
});

/** زمان‌های آزاد یک روز */
router.get('/availability', (req, res) => {
  const { date, serviceId, staffId } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'تاریخ نامعتبر است' });
  }
  if (!serviceId) return res.status(400).json({ error: 'خدمت انتخاب نشده است' });
  res.json(availableSlots({ isoDate: date, serviceId, staffId: staffId || null }));
});

/** وضعیت روزهای یک ماه شمسی برای تقویم */
router.get('/availability/month', (req, res) => {
  const jy = Number(req.query.jy);
  const jm = Number(req.query.jm);
  const { serviceId, staffId } = req.query;
  if (!jy || !jm || jm < 1 || jm > 12) return res.status(400).json({ error: 'ماه نامعتبر است' });
  if (!serviceId) return res.status(400).json({ error: 'خدمت انتخاب نشده است' });

  const dates = buildJalaliMonth(jy, jm).flat().filter(Boolean).map((c) => c.iso);
  res.json({ days: monthAvailability({ dates, serviceId, staffId: staffId || null }) });
});

/** نزدیک‌ترین روزهای دارای ظرفیت (برای میانبر «زودترین زمان») */
router.get('/availability/next', (req, res) => {
  const { serviceId, staffId } = req.query;
  if (!serviceId) return res.status(400).json({ error: 'خدمت انتخاب نشده است' });
  const settings = getSettings();
  const limit = Math.min(Number(req.query.limit) || 3, 10);
  const out = [];
  for (let i = 0; i < Number(settings.maxAdvanceDays) && out.length < limit; i++) {
    const iso = addDays(todayISO(), i);
    const { slots, closed } = availableSlots({ isoDate: iso, serviceId, staffId: staffId || null });
    const free = slots.filter((s) => s.available);
    if (!closed && free.length) out.push({ date: iso, firstTime: free[0].time, free: free.length });
  }
  res.json({ days: out });
});

export default router;
