/** باشگاه مشتریان، کد تخفیف، کارت هدیه، دعوت از دوستان و نظرها (سمت مشتری) */
import express from 'express';
import { find, getSettings } from '../lib/db.js';
import { requireAuth, publicUser } from '../lib/auth.js';
import { clubSummary, applyReferral, ledgerOf, ensureReferralCode } from '../lib/loyalty.js';
import { validatePromo, validateGiftCard, normalizeCode } from '../lib/promos.js';
import { publicReviews, ratingSummary, REVIEW_TAGS } from '../lib/reviews.js';
import { requireModule } from '../lib/modules.js';

const router = express.Router();

// این روتر روی /api سوار می‌شود، پس گیت باید روی تک‌تک مسیرها باشد نه router.use
const marketingOnly = requireModule('marketing');

/* ---------- نظرها (عمومی) ---------- */

router.get('/reviews', marketingOnly, (req, res) => {
  const { serviceId, staffId, limit } = req.query;
  res.json({
    reviews: publicReviews({ serviceId, staffId, limit: Number(limit) || 20 }),
    summary: ratingSummary({ serviceId, staffId }),
    tags: REVIEW_TAGS,
  });
});

/* ---------- باشگاه مشتریان ---------- */

router.get('/club', requireAuth, marketingOnly, (req, res) => {
  res.json({ club: clubSummary(req.user), currency: getSettings().currency });
});

/** گردش امتیاز و اعتبار */
router.get('/club/ledger', requireAuth, marketingOnly, (req, res) => {
  res.json({ entries: ledgerOf(req.user.id, 60) });
});

/* ---------- کد معرف ---------- */

router.get('/referral', requireAuth, marketingOnly, (req, res) => {
  const settings = getSettings();
  res.json({
    code: ensureReferralCode(req.user),
    enabled: Boolean(settings.referral?.enabled),
    referrerReward: settings.referral?.referrerReward || 0,
    refereeReward: settings.referral?.refereeReward || 0,
  });
});

router.post('/referral/apply', requireAuth, marketingOnly, (req, res) => {
  const result = applyReferral(req.user, req.body?.code);
  if (!result.ok) return res.status(400).json({ error: result.error });
  const user = find('users', (u) => u.id === req.user.id);
  res.json({ ok: true, referrerName: result.referrerName, user: publicUser(user) });
});

/* ---------- بررسی کد تخفیف ---------- */

router.post('/promo/check', requireAuth, marketingOnly, (req, res) => {
  const { code, serviceId } = req.body || {};
  const service = find('services', (s) => s.id === serviceId);
  if (!service) return res.status(404).json({ error: 'ابتدا یک خدمت انتخاب کنید' });

  const base = Math.round(service.price * (1 - (Number(service.discountPercent) || 0) / 100));
  const result = validatePromo({ code, user: req.user, serviceId, amount: base });
  if (!result.ok) return res.status(400).json({ error: result.error });

  res.json({
    ok: true,
    code: result.promo.code,
    title: result.promo.title,
    discount: result.discount,
    type: result.promo.type,
    value: result.promo.value,
  });
});

/* ---------- بررسی کارت هدیه ---------- */

router.post('/giftcard/check', requireAuth, marketingOnly, (req, res) => {
  const result = validateGiftCard({ code: req.body?.code });
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({
    ok: true,
    code: result.card.code,
    balance: result.card.balance,
    expiresAt: result.card.expiresAt,
  });
});

export default router;
