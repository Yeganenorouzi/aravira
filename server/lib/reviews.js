/**
 * نظر و امتیاز مشتریان پس از انجام نوبت.
 * میانگین امتیاز هر آرایشگر و خدمت پس از هر نظر دوباره محاسبه می‌شود.
 */
import { find, filter, insert, update, getSettings } from './db.js';

/** آیا این نوبت قابل نظر دادن است؟ */
export function canReview(appt, userId) {
  if (!appt) return { ok: false, error: 'نوبت پیدا نشد' };
  if (appt.userId !== userId) return { ok: false, error: 'این نوبت متعلق به شما نیست' };
  if (appt.status !== 'done') return { ok: false, error: 'فقط برای نوبت‌های انجام‌شده می‌توانید نظر ثبت کنید' };
  if (find('reviews', (r) => r.appointmentId === appt.id)) {
    return { ok: false, error: 'برای این نوبت قبلاً نظر ثبت کرده‌اید' };
  }
  return { ok: true };
}

export function submitReview({ appt, user, rating, comment = '', staffRating = 0, tags = [] }) {
  const settings = getSettings();
  const r = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));

  const review = insert('reviews', {
    appointmentId: appt.id,
    userId: user.id,
    userName: user.name || 'مشتری',
    serviceId: appt.serviceId,
    serviceTitle: appt.serviceTitle,
    staffId: appt.staffId,
    rating: r,
    staffRating: Math.max(0, Math.min(5, Math.round(Number(staffRating) || 0))) || r,
    comment: String(comment).slice(0, 500),
    tags: Array.isArray(tags) ? tags.slice(0, 6) : [],
    published: settings.reviews?.autoPublish !== false,
    reply: '',
  });

  update('appointments', appt.id, { reviewed: true, reviewId: review.id });
  recomputeStaffRating(appt.staffId);
  recomputeServiceRating(appt.serviceId);
  return review;
}

/** میانگین امتیاز آرایشگر */
export function recomputeStaffRating(staffId) {
  const staff = find('staff', (s) => s.id === staffId);
  if (!staff) return null;
  const list = filter('reviews', (r) => r.staffId === staffId && r.published);
  if (!list.length) return staff;
  const avg = list.reduce((sum, r) => sum + (Number(r.staffRating) || Number(r.rating)), 0) / list.length;
  return update('staff', staffId, {
    rating: Math.round(avg * 10) / 10,
    reviews: list.length,
  });
}

/** میانگین امتیاز خدمت */
export function recomputeServiceRating(serviceId) {
  const service = find('services', (s) => s.id === serviceId);
  if (!service) return null;
  const list = filter('reviews', (r) => r.serviceId === serviceId && r.published);
  if (!list.length) return service;
  const avg = list.reduce((sum, r) => sum + Number(r.rating), 0) / list.length;
  return update('services', serviceId, {
    rating: Math.round(avg * 10) / 10,
    reviewCount: list.length,
  });
}

/** نظرهای منتشرشده برای نمایش عمومی */
export function publicReviews({ serviceId, staffId, limit = 20 }) {
  let list = filter('reviews', (r) => r.published);
  if (serviceId) list = list.filter((r) => r.serviceId === serviceId);
  if (staffId) list = list.filter((r) => r.staffId === staffId);
  return list
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      userName: maskName(r.userName),
      rating: r.rating,
      comment: r.comment,
      tags: r.tags,
      reply: r.reply,
      createdAt: r.createdAt,
      serviceTitle: r.serviceTitle,
    }));
}

/** خلاصه‌ی امتیازها برای نمایش نمودار */
export function ratingSummary({ serviceId, staffId } = {}) {
  let list = filter('reviews', (r) => r.published);
  if (serviceId) list = list.filter((r) => r.serviceId === serviceId);
  if (staffId) list = list.filter((r) => r.staffId === staffId);

  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of list) breakdown[r.rating] = (breakdown[r.rating] || 0) + 1;
  const count = list.length;
  const average = count ? list.reduce((s, r) => s + r.rating, 0) / count : 0;
  return { count, average: Math.round(average * 10) / 10, breakdown };
}

/** «مهسا احمدی» -> «مهسا ا.» */
function maskName(name) {
  const parts = String(name || 'مشتری').trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

export const REVIEW_TAGS = [
  'برخورد عالی',
  'نتیجه‌ی عالی',
  'محیط تمیز',
  'خوش‌قول',
  'قیمت مناسب',
  'حرفه‌ای',
];
