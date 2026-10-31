/**
 * موتور محاسبه‌ی زمان‌های آزاد نوبت.
 * ساعات کاری سالن + برنامه‌ی آرایشگر + نوبت‌های رزروشده را در نظر می‌گیرد.
 */
import { getSettings, filter, find } from './db.js';
import { jalaliWeekday, timeToMinutes, minutesToTime, todayISO, diffDays } from '../../shared/jalali.js';

/** آیا این تاریخ تعطیل است؟ */
export function isClosedDay(isoDate, settings = getSettings()) {
  if (settings.holidays?.includes(isoDate)) return true;
  const wd = jalaliWeekday(isoDate);
  return Boolean(settings.workingHours?.[wd]?.closed);
}

/** بازه‌ی کاری سالن در یک روز: { from, to } به دقیقه، یا null */
export function salonWindow(isoDate, settings = getSettings()) {
  if (isClosedDay(isoDate, settings)) return null;
  const wh = settings.workingHours[jalaliWeekday(isoDate)];
  if (!wh) return null;
  return { from: timeToMinutes(wh.open), to: timeToMinutes(wh.close) };
}

/** بازه‌ی کاری آرایشگر در یک روز (اگر برنامه‌ی اختصاصی داشته باشد) */
function staffWindow(staff, isoDate) {
  if (!staff) return null;
  const wd = jalaliWeekday(isoDate);
  if (Array.isArray(staff.offDays) && staff.offDays.includes(wd)) return null;
  if (Array.isArray(staff.vacations) && staff.vacations.includes(isoDate)) return null;
  if (staff.shift?.open && staff.shift?.close) {
    return { from: timeToMinutes(staff.shift.open), to: timeToMinutes(staff.shift.close) };
  }
  return { from: -Infinity, to: Infinity };
}

/** نوبت‌های فعال یک آرایشگر در یک روز */
function busyIntervals(staffId, isoDate) {
  return filter('appointments', (a) =>
    a.staffId === staffId && a.date === isoDate && ['pending', 'confirmed'].includes(a.status)
  ).map((a) => {
    const start = timeToMinutes(a.time);
    return { start, end: start + (Number(a.duration) || 30), id: a.id };
  });
}

/**
 * محاسبه‌ی زمان‌های آزاد
 * @returns {{slots: Array<{time:string, available:boolean, reason?:string}>, closed:boolean, reason?:string}}
 */
export function availableSlots({ isoDate, serviceId, staffId, excludeAppointmentId = null }) {
  const settings = getSettings();
  const service = find('services', (s) => s.id === serviceId);
  const staff = staffId ? find('staff', (s) => s.id === staffId) : null;
  const duration = Number(service?.duration) || 30;
  const step = Number(settings.slotStepMinutes) || 30;

  // اعتبارسنجی بازه‌ی مجاز رزرو
  const today = todayISO();
  const delta = diffDays(isoDate, today);
  if (delta < 0) return { slots: [], closed: true, reason: 'تاریخ گذشته است' };
  if (delta > Number(settings.maxAdvanceDays)) {
    return { slots: [], closed: true, reason: 'این تاریخ هنوز برای رزرو باز نشده است' };
  }

  const salon = salonWindow(isoDate, settings);
  if (!salon) return { slots: [], closed: true, reason: 'سالن در این روز تعطیل است' };

  const sw = staffWindow(staff, isoDate);
  if (staff && !sw) return { slots: [], closed: true, reason: 'این آرایشگر در روز انتخابی در دسترس نیست' };

  const from = Math.max(salon.from, sw ? sw.from : salon.from);
  const to = Math.min(salon.to, sw ? sw.to : salon.to);

  // حداقل فاصله تا زمان حال
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const leadCutoff = delta === 0 ? nowMinutes + (Number(settings.minLeadMinutes) || 0) : -Infinity;

  const busy = staff
    ? busyIntervals(staff.id, isoDate).filter((b) => b.id !== excludeAppointmentId)
    : [];

  const slots = [];
  for (let t = from; t + duration <= to; t += step) {
    const time = minutesToTime(t);
    let available = true;
    let reason;

    if (t < leadCutoff) {
      available = false;
      reason = 'گذشته';
    } else if (busy.some((b) => t < b.end && t + duration > b.start)) {
      available = false;
      reason = 'رزرو شده';
    }
    slots.push({ time, available, reason });
  }
  return { slots, closed: false, duration };
}

/** خلاصه‌ی وضعیت چند روز برای رنگ‌آمیزی تقویم */
export function monthAvailability({ dates, serviceId, staffId }) {
  const out = {};
  for (const iso of dates) {
    const { slots, closed } = availableSlots({ isoDate: iso, serviceId, staffId });
    const free = slots.filter((s) => s.available).length;
    out[iso] = { closed, free, total: slots.length };
  }
  return out;
}

/** آیا این زمان دقیقاً قابل رزرو است؟ (بررسی نهایی پیش از ثبت) */
export function isSlotBookable({ isoDate, time, serviceId, staffId, excludeAppointmentId }) {
  const { slots, closed, reason } = availableSlots({ isoDate, serviceId, staffId, excludeAppointmentId });
  if (closed) return { ok: false, error: reason || 'امکان رزرو در این روز وجود ندارد' };
  const slot = slots.find((s) => s.time === time);
  if (!slot) return { ok: false, error: 'این ساعت جزو ساعات کاری نیست' };
  if (!slot.available) {
    return { ok: false, error: slot.reason === 'رزرو شده' ? 'این ساعت قبلاً رزرو شده است' : 'این ساعت قابل رزرو نیست' };
  }
  return { ok: true };
}
