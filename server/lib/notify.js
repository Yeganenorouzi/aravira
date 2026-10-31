/**
 * موتور اطلاع‌رسانی: ساخت متن پیام‌ها و ارسال از طریق پیامک و ایمیل.
 * متن‌ها با تاریخ شمسی و ارقام فارسی تولید می‌شوند.
 */
import { getSettings, find, filter, update } from './db.js';
import { sendSMS } from './sms.js';
import { sendEmail, wrapEmailHTML, detailsTableHTML, escapeHTML } from './email.js';
import { hasModule } from './modules.js';
import {
  formatJalali, formatTime, formatMoney, toPersianDigits, todayISO, addDays,
} from '../../shared/jalali.js';

/* ---------- قالب‌های پیامک ---------- */

export const SMS_TEMPLATES = {
  otp: ({ code, salonName }) =>
    `${salonName}\nکد ورود شما: ${toPersianDigits(code)}\nاین کد تا ۲ دقیقه معتبر است.`,

  booked: ({ salonName, service, staff, date, time, address }) =>
    `${salonName}\nنوبت شما ثبت شد ✅\nخدمت: ${service}\nآرایشگر: ${staff}\nتاریخ: ${date}\nساعت: ${time}\n${address}`,

  reminder: ({ salonName, service, date, time }) =>
    `${salonName}\nیادآوری نوبت 🔔\n${service}\n${date} ساعت ${time}\nمنتظر حضور شما هستیم.`,

  canceled: ({ salonName, service, date, time }) =>
    `${salonName}\nنوبت شما لغو شد ❌\n${service} – ${date} ساعت ${time}\nبرای رزرو مجدد به برنامه مراجعه کنید.`,

  confirmed: ({ salonName, service, date, time }) =>
    `${salonName}\nنوبت شما تأیید نهایی شد ✅\n${service} – ${date} ساعت ${time}`,

  welcome: ({ salonName, name }) =>
    `${name} عزیز، به باشگاه مشتریان ${salonName} خوش آمدید 🌸\nاز این پس می‌توانید نوبت‌هایتان را آنلاین رزرو کنید.`,

  birthday: ({ salonName, name, percent }) =>
    `${name} عزیز، تولدت مبارک 🎉\n${salonName} به مناسبت تولدت ${toPersianDigits(percent)}٪ تخفیف برای تو در نظر گرفته است.`,

  reviewRequest: ({ salonName, name, service }) =>
    `${name} عزیز،\nاز اینکه ${salonName} را انتخاب کردید سپاسگزاریم 🌸\nنظرتان درباره‌ی «${service}» چطور بود؟ با ثبت نظر ۱۰ امتیاز هدیه بگیرید.`,

  giftCard: ({ salonName, amount, code, from }) =>
    `${salonName}\nیک کارت هدیه برای شما صادر شد 🎁\nمبلغ: ${formatMoney(amount)} تومان\nکد: ${code}` +
    (from ? `\nاز طرف: ${from}` : ''),

  referralReward: ({ salonName, name, amount, friend }) =>
    `${name} عزیز،\n${friend} با کد معرف شما به ${salonName} پیوست 🎉\n${formatMoney(amount)} تومان اعتبار هدیه به حساب شما اضافه شد.`,
};

/* ---------- ساخت داده‌ی نمایشی یک نوبت ---------- */

export function appointmentView(appt) {
  const settings = getSettings();
  const service = find('services', (s) => s.id === appt.serviceId);
  const staff = find('staff', (s) => s.id === appt.staffId);
  const user = find('users', (u) => u.id === appt.userId);
  return {
    appt,
    user,
    salonName: settings.salonName,
    address: settings.address,
    service: service?.title || appt.serviceTitle || 'خدمت',
    staff: staff?.name || 'آرایشگر',
    date: formatJalali(appt.date, { withWeekday: true }),
    time: formatTime(appt.time),
    total: formatMoney(appt.total) + ' ' + settings.currency,
    currency: settings.currency,
  };
}

/* ---------- ارسال‌کننده‌ی عمومی ---------- */

async function dispatch({ user, kind, sms, email, meta }) {
  const settings = getSettings();
  const ch = settings.notify.channels;
  const results = { sms: null, email: null };

  if (ch.sms && sms && user?.phone) {
    results.sms = await sendSMS({ to: user.phone, text: sms, kind, meta });
  }
  if (ch.email && email && user?.email && hasModule('notifications')) {
    results.email = await sendEmail({
      to: user.email,
      subject: email.subject,
      html: email.html,
      kind,
      meta,
    });
  }
  return results;
}

/* ---------- رویدادها ---------- */

export async function notifyOTP(user, code) {
  const settings = getSettings();
  const text = SMS_TEMPLATES.otp({ code, salonName: settings.salonName });
  // کد ورود فقط با پیامک ارسال می‌شود
  return sendSMS({ to: user.phone, text, kind: 'otp', meta: { userId: user.id } });
}

export async function notifyBooked(appt) {
  const settings = getSettings();
  if (!settings.notify.onBooking) return null;
  const v = appointmentView(appt);
  const sms = SMS_TEMPLATES.booked({
    salonName: v.salonName, service: v.service, staff: v.staff,
    date: v.date, time: v.time, address: v.address,
  });
  const html = wrapEmailHTML({
    title: 'تأیید رزرو نوبت',
    salonName: v.salonName,
    footer: `${v.salonName} • ${settings.address} • ${settings.phone}`,
    bodyHTML: `
      <p>${escapeHTML(v.user?.name || 'مشتری')} عزیز،</p>
      <p>نوبت شما با موفقیت ثبت شد. جزئیات رزرو:</p>
      ${detailsTableHTML([
        ['خدمت', v.service],
        ['آرایشگر', v.staff],
        ['تاریخ', v.date],
        ['ساعت', v.time],
        ['کد پیگیری', toPersianDigits(appt.code)],
        ['مبلغ قابل پرداخت', v.total],
      ])}
      <p style="color:#8a8a8e;font-size:13px;">لطفاً ${toPersianDigits(10)} دقیقه پیش از زمان نوبت در سالن حضور داشته باشید. برای لغو نوبت تا ${toPersianDigits(settings.cancelWindowHours)} ساعت قبل اقدام کنید.</p>`,
  });
  return dispatch({
    user: v.user, kind: 'booked', sms,
    email: { subject: `تأیید نوبت – ${v.service} – ${v.date}`, html },
    meta: { appointmentId: appt.id },
  });
}

export async function notifyCanceled(appt) {
  const settings = getSettings();
  if (!settings.notify.onCancel) return null;
  const v = appointmentView(appt);
  const sms = SMS_TEMPLATES.canceled({
    salonName: v.salonName, service: v.service, date: v.date, time: v.time,
  });
  const html = wrapEmailHTML({
    title: 'لغو نوبت',
    salonName: v.salonName,
    footer: `${v.salonName} • ${settings.phone}`,
    bodyHTML: `
      <p>${escapeHTML(v.user?.name || 'مشتری')} عزیز،</p>
      <p>نوبت زیر لغو شد:</p>
      ${detailsTableHTML([['خدمت', v.service], ['تاریخ', v.date], ['ساعت', v.time]])}
      <p>هر زمان خواستید می‌توانید نوبت تازه‌ای رزرو کنید.</p>`,
  });
  return dispatch({
    user: v.user, kind: 'canceled', sms,
    email: { subject: `لغو نوبت – ${v.date}`, html },
    meta: { appointmentId: appt.id },
  });
}

export async function notifyConfirmed(appt) {
  const v = appointmentView(appt);
  const sms = SMS_TEMPLATES.confirmed({
    salonName: v.salonName, service: v.service, date: v.date, time: v.time,
  });
  const html = wrapEmailHTML({
    title: 'تأیید نهایی نوبت',
    salonName: v.salonName,
    footer: v.salonName,
    bodyHTML: `<p>نوبت شما تأیید نهایی شد.</p>${detailsTableHTML([
      ['خدمت', v.service], ['تاریخ', v.date], ['ساعت', v.time],
    ])}`,
  });
  return dispatch({
    user: v.user, kind: 'confirmed', sms,
    email: { subject: 'تأیید نهایی نوبت', html },
    meta: { appointmentId: appt.id },
  });
}

export async function notifyReminder(appt) {
  const v = appointmentView(appt);
  const sms = SMS_TEMPLATES.reminder({
    salonName: v.salonName, service: v.service, date: v.date, time: v.time,
  });
  const html = wrapEmailHTML({
    title: 'یادآوری نوبت',
    salonName: v.salonName,
    footer: v.salonName,
    bodyHTML: `<p>${escapeHTML(v.user?.name || 'مشتری')} عزیز، یادآوری می‌کنیم که نوبت شما نزدیک است:</p>${detailsTableHTML(
      [['خدمت', v.service], ['آرایشگر', v.staff], ['تاریخ', v.date], ['ساعت', v.time]]
    )}`,
  });
  return dispatch({
    user: v.user, kind: 'reminder', sms,
    email: { subject: `یادآوری نوبت – ${v.date}`, html },
    meta: { appointmentId: appt.id },
  });
}

export async function notifyWelcome(user) {
  if (!hasModule('notifications')) return null;
  const settings = getSettings();
  const sms = SMS_TEMPLATES.welcome({ salonName: settings.salonName, name: user.name || 'مشتری' });
  const html = wrapEmailHTML({
    title: 'خوش آمدید',
    salonName: settings.salonName,
    footer: `${settings.salonName} • ${settings.address}`,
    bodyHTML: `<p>${escapeHTML(user.name || 'مشتری')} عزیز، به باشگاه مشتریان ما خوش آمدید 🌸</p>
      <p>از این پس می‌توانید نوبت‌های خود را به‌صورت آنلاین رزرو و مدیریت کنید.</p>`,
  });
  return dispatch({
    user, kind: 'welcome', sms,
    email: { subject: `به ${settings.salonName} خوش آمدید`, html },
    meta: { userId: user.id },
  });
}

export async function notifyBirthday(user, percent = 20) {
  const settings = getSettings();
  const sms = SMS_TEMPLATES.birthday({
    salonName: settings.salonName, name: user.name || 'مشتری', percent,
  });
  const html = wrapEmailHTML({
    title: 'تولدت مبارک',
    salonName: settings.salonName,
    footer: settings.salonName,
    bodyHTML: `<p>${escapeHTML(user.name || 'مشتری')} عزیز، تولدت مبارک 🎉</p>
      <p>به همین مناسبت <b>${toPersianDigits(percent)}٪ تخفیف</b> روی تمام خدمات برای شما فعال شد.</p>`,
  });
  return dispatch({
    user, kind: 'birthday', sms,
    email: { subject: 'تولدت مبارک 🎉', html },
    meta: { userId: user.id },
  });
}

export async function notifyReviewRequest(appt) {
  const settings = getSettings();
  if (!settings.notify?.onReviewRequest) return null;
  const v = appointmentView(appt);
  const sms = SMS_TEMPLATES.reviewRequest({
    salonName: v.salonName, name: v.user?.name || 'مشتری', service: v.service,
  });
  const html = wrapEmailHTML({
    title: 'نظر شما برای ما مهم است',
    salonName: v.salonName,
    footer: v.salonName,
    bodyHTML: `<p>${escapeHTML(v.user?.name || 'مشتری')} عزیز،</p>
      <p>از اینکه ما را انتخاب کردید سپاسگزاریم. خوشحال می‌شویم نظرتان را درباره‌ی
      «${escapeHTML(v.service)}» با ما در میان بگذارید.</p>
      <p>با ثبت نظر، <b>۱۰ امتیاز</b> به باشگاه مشتریان شما اضافه می‌شود.</p>`,
  });
  return dispatch({
    user: v.user, kind: 'reviewRequest', sms,
    email: { subject: 'نظر شما درباره‌ی خدمت اخیر', html },
    meta: { appointmentId: appt.id },
  });
}

export async function notifyGiftCard(card, user = null) {
  const settings = getSettings();
  const sms = SMS_TEMPLATES.giftCard({
    salonName: settings.salonName,
    amount: card.initialAmount,
    code: card.code,
    from: card.buyerName,
  });
  const html = wrapEmailHTML({
    title: 'کارت هدیه',
    salonName: settings.salonName,
    footer: `${settings.salonName} • ${settings.address}`,
    bodyHTML: `<p>${escapeHTML(card.recipientName || 'دوست عزیز')}،</p>
      <p>یک کارت هدیه برای شما صادر شده است 🎁</p>
      ${detailsTableHTML([
        ['مبلغ', formatMoney(card.initialAmount) + ' ' + settings.currency],
        ['کد کارت', card.code],
        ...(card.expiresAt ? [['اعتبار تا', formatJalali(card.expiresAt)]] : []),
      ])}
      ${card.message ? `<p style="background:#fdf5f6;padding:12px;border-radius:12px;">${escapeHTML(card.message)}</p>` : ''}
      <p style="color:#8a8a8e;font-size:13px;">هنگام رزرو نوبت، این کد را در بخش «کارت هدیه» وارد کنید.</p>`,
  });

  const target = user || { phone: card.recipientPhone, email: card.recipientEmail, id: null };
  if (!target.phone && !target.email) return null;
  return dispatch({
    user: target, kind: 'giftCard', sms,
    email: { subject: `کارت هدیه‌ی ${settings.salonName}`, html },
    meta: { giftCardId: card.id },
  });
}

export async function notifyReferralReward(referrer, amount, friendName) {
  const settings = getSettings();
  const sms = SMS_TEMPLATES.referralReward({
    salonName: settings.salonName,
    name: referrer.name || 'مشتری',
    amount,
    friend: friendName || 'یکی از دوستان شما',
  });
  const html = wrapEmailHTML({
    title: 'پاداش دعوت از دوستان',
    salonName: settings.salonName,
    footer: settings.salonName,
    bodyHTML: `<p>${escapeHTML(referrer.name || 'مشتری')} عزیز،</p>
      <p>${escapeHTML(friendName || 'یکی از دوستان شما')} با کد معرف شما به ما پیوست 🎉</p>
      <p><b>${formatMoney(amount)} ${settings.currency}</b> اعتبار هدیه به حساب شما اضافه شد.</p>`,
  });
  return dispatch({
    user: referrer, kind: 'referral', sms,
    email: { subject: 'پاداش دعوت از دوستان', html },
    meta: { userId: referrer.id },
  });
}

/* ---------- زمان‌بند یادآوری و تبریک تولد ---------- */

let timer = null;

/** هر ۱۵ دقیقه نوبت‌های نزدیک را بررسی و یادآوری می‌فرستد */
export function startScheduler() {
  if (timer) return;
  const tick = async () => {
    try {
      await runReminderSweep();
      await runBirthdaySweep();
      await runReviewRequestSweep();
    } catch (err) {
      console.error('[scheduler]', err.message);
    }
  };
  timer = setInterval(tick, 15 * 60 * 1000);
  setTimeout(tick, 10_000);
  console.log('[scheduler] زمان‌بند یادآوری فعال شد (هر ۱۵ دقیقه)');
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function runReminderSweep() {
  const settings = getSettings();
  if (!hasModule('notifications')) return { sent: 0, skipped: 'module' };
  if (!settings.notify.onReminder) return { sent: 0 };
  const hours = Number(settings.reminderHoursBefore) || 24;
  const now = Date.now();
  const horizon = now + hours * 3600 * 1000;

  const due = filter('appointments', (a) =>
    ['pending', 'confirmed'].includes(a.status) && !a.reminderSentAt
  ).filter((a) => {
    const t = apptTimestamp(a);
    return t > now && t <= horizon;
  });

  let sent = 0;
  for (const appt of due) {
    await notifyReminder(appt);
    update('appointments', appt.id, { reminderSentAt: new Date().toISOString() });
    sent++;
  }
  if (sent) console.log(`[scheduler] ${sent} یادآوری ارسال شد`);
  return { sent };
}

export async function runBirthdaySweep() {
  const settings = getSettings();
  if (!hasModule('notifications')) return { sent: 0, skipped: 'module' };
  if (!settings.notify.onBirthday) return { sent: 0 };
  const today = todayISO();
  const [, m, d] = today.split('-');
  const year = today.slice(0, 4);

  const users = filter('users', (u) => {
    if (!u.birthday || u.role === 'admin') return false;
    const [, bm, bd] = u.birthday.split('-');
    return bm === m && bd === d && u.lastBirthdayGreeting !== year;
  });

  let sent = 0;
  for (const u of users) {
    await notifyBirthday(u, 20);
    update('users', u.id, { lastBirthdayGreeting: year });
    sent++;
  }
  if (sent) console.log(`[scheduler] ${sent} پیام تبریک تولد ارسال شد`);
  return { sent };
}

/** درخواست نظر برای نوبت‌های انجام‌شده */
export async function runReviewRequestSweep() {
  const settings = getSettings();
  if (!hasModule('marketing')) return { sent: 0, skipped: 'module' };
  if (!settings.reviews?.enabled || !settings.notify?.onReviewRequest) return { sent: 0 };
  const afterMs = (Number(settings.reviews.requestAfterHours) || 2) * 3600 * 1000;
  const now = Date.now();

  const due = filter('appointments', (a) =>
    a.status === 'done' && !a.reviewed && !a.reviewRequestedAt && a.completedAt &&
    now - new Date(a.completedAt).getTime() >= afterMs
  );

  let sent = 0;
  for (const appt of due) {
    await notifyReviewRequest(appt);
    update('appointments', appt.id, { reviewRequestedAt: new Date().toISOString() });
    sent++;
  }
  if (sent) console.log(`[scheduler] ${sent} درخواست نظر ارسال شد`);
  return { sent };
}

/** زمان نوبت به میلی‌ثانیه */
export function apptTimestamp(appt) {
  const [y, m, d] = appt.date.split('-').map(Number);
  const [hh, mm] = String(appt.time).split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm || 0, 0).getTime();
}

export { addDays };
