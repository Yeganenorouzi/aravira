/**
 * موتور قیمت‌گذاری.
 *
 * ترتیب محاسبه (مهم است و نباید جابه‌جا شود):
 *   مبلغ خدمت
 *   − تخفیف خود خدمت
 *   − تخفیف سطح باشگاه
 *   − کد تخفیف
 *   = مبلغ مشمول مالیات
 *   + مالیات
 *   = جمع کل
 *   − امتیاز باشگاه
 *   − کارت هدیه
 *   − اعتبار حساب
 *   = مبلغ قابل پرداخت
 */
import { getSettings } from './db.js';
import { tierOf, pointsRedeemValue } from './loyalty.js';
import { validatePromo, validateGiftCard } from './promos.js';
import { hasModule } from './modules.js';

/**
 * @returns {{price:object, notices:string[], errors:string[]}}
 */
export function quote({
  service,
  user = null,
  promoCode = '',
  giftCardCode = '',
  usePoints = false,
  useCredit = false,
}) {
  const settings = getSettings();
  const notices = [];
  const errors = [];

  // بدون ماژول بازاریابی، تخفیف‌های باشگاه/کد/هدیه اصلاً اعمال نمی‌شوند
  const marketing = hasModule('marketing');
  if (!marketing) {
    promoCode = '';
    giftCardCode = '';
    usePoints = false;
    useCredit = false;
  }

  const subtotal = Number(service.price) || 0;

  /* ۱ – تخفیف خود خدمت */
  const serviceDiscountPercent = Number(service.discountPercent) || 0;
  const serviceDiscount = Math.round((subtotal * serviceDiscountPercent) / 100);

  /* ۲ – تخفیف سطح باشگاه */
  let tier = null;
  let tierDiscount = 0;
  let tierDiscountPercent = 0;
  if (marketing && user && settings.loyalty?.enabled) {
    tier = tierOf(user, settings);
    tierDiscountPercent = Number(tier?.discountPercent) || 0;
    tierDiscount = Math.round(((subtotal - serviceDiscount) * tierDiscountPercent) / 100);
  }

  /* ۳ – کد تخفیف */
  let promo = null;
  let promoDiscount = 0;
  if (promoCode) {
    const base = subtotal - serviceDiscount - tierDiscount;
    const res = validatePromo({ code: promoCode, user, serviceId: service.id, amount: base });
    if (res.ok) {
      promo = res.promo;
      promoDiscount = res.discount;
      notices.push(`کد تخفیف «${promo.code}» اعمال شد`);
    } else {
      errors.push(res.error);
    }
  }

  const taxable = Math.max(0, subtotal - serviceDiscount - tierDiscount - promoDiscount);
  const taxPercent = Number(settings.taxPercent) || 0;
  const tax = Math.round((taxable * taxPercent) / 100);
  const total = taxable + tax;

  /* ۴ – امتیاز باشگاه */
  let pointsUsed = 0;
  let pointsValue = 0;
  if (usePoints && marketing && user && settings.loyalty?.enabled) {
    const redeem = pointsRedeemValue(user, settings);
    if (redeem.value <= 0) {
      errors.push(
        `برای استفاده از امتیاز، حداقل ${settings.loyalty.minPointsToRedeem} امتیاز لازم است`
      );
    } else {
      pointsValue = Math.min(redeem.value, total);
      const unit = Number(settings.loyalty.pointValue) || 1;
      pointsUsed = Math.ceil(pointsValue / unit);
      notices.push('امتیاز باشگاه اعمال شد');
    }
  }

  /* ۵ – کارت هدیه */
  let giftCard = null;
  let giftCardUsed = 0;
  if (giftCardCode) {
    const remaining = total - pointsValue;
    const res = validateGiftCard({ code: giftCardCode, amount: remaining });
    if (res.ok) {
      giftCard = res.card;
      giftCardUsed = res.usable;
      notices.push('کارت هدیه اعمال شد');
    } else {
      errors.push(res.error);
    }
  }

  /* ۶ – اعتبار حساب */
  let creditUsed = 0;
  if (useCredit && user) {
    const remaining = total - pointsValue - giftCardUsed;
    creditUsed = Math.max(0, Math.min(Number(user.credit) || 0, remaining));
    if (creditUsed > 0) notices.push('اعتبار حساب اعمال شد');
  }

  const payable = Math.max(0, total - pointsValue - giftCardUsed - creditUsed);
  const deposit = Math.round((payable * (Number(settings.depositPercent) || 0)) / 100);
  const totalSaved = serviceDiscount + tierDiscount + promoDiscount;

  return {
    notices,
    errors,
    marketing,
    price: {
      subtotal,
      serviceDiscount,
      serviceDiscountPercent,
      tierId: tier?.id || null,
      tierTitle: tier?.title || null,
      tierDiscount,
      tierDiscountPercent,
      promoCode: promo?.code || '',
      promoTitle: promo?.title || '',
      promoDiscount,
      taxable,
      tax,
      taxPercent,
      total,
      pointsUsed,
      pointsValue,
      giftCardCode: giftCard?.code || '',
      giftCardUsed,
      creditUsed,
      payable,
      deposit,
      totalSaved,
      currency: settings.currency,
    },
  };
}
