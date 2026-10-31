/** لایه‌ی ارتباط با سرور */

const BASE = '/api';
const TOKEN_KEY = 'salon_token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* حالت ناشناس مرورگر */ }
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.', 0, null);
  }

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!res.ok) {
    if (res.status === 401) setToken('');
    throw new ApiError(data.error || 'خطایی رخ داد، دوباره تلاش کنید', res.status, data);
  }
  return data;
}

const qs = (params) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  }
  const s = sp.toString();
  return s ? '?' + s : '';
};

export const api = {
  get: (path, params) => request('GET', path + qs(params)),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),

  /* احراز هویت */
  requestOtp: (phone) => request('POST', '/auth/otp/request', { phone }),
  verifyOtp: (phone, code) => request('POST', '/auth/otp/verify', { phone, code }),
  adminLogin: (username, password) => request('POST', '/auth/admin/login', { username, password }),
  me: () => request('GET', '/auth/me'),
  updateProfile: (patch) => request('PUT', '/auth/profile', patch),
  logout: () => request('POST', '/auth/logout'),

  /* کاتالوگ */
  settings: () => request('GET', '/settings'),
  categories: () => request('GET', '/categories'),
  services: (params) => request('GET', '/services' + qs(params)),
  service: (id) => request('GET', '/services/' + id),
  staffList: (params) => request('GET', '/staff' + qs(params)),
  offers: () => request('GET', '/offers'),
  availability: (params) => request('GET', '/availability' + qs(params)),
  monthAvailability: (params) => request('GET', '/availability/month' + qs(params)),
  nextAvailable: (params) => request('GET', '/availability/next' + qs(params)),

  /* باشگاه مشتریان و بازاریابی */
  club: () => request('GET', '/club'),
  clubLedger: () => request('GET', '/club/ledger'),
  referral: () => request('GET', '/referral'),
  applyReferral: (code) => request('POST', '/referral/apply', { code }),
  checkPromo: (code, serviceId) => request('POST', '/promo/check', { code, serviceId }),
  checkGiftCard: (code) => request('POST', '/giftcard/check', { code }),
  reviews: (params) => request('GET', '/reviews' + qs(params)),

  /* نوبت‌ها */
  quote: (payload) =>
    request('POST', '/appointments/quote', typeof payload === 'string' ? { serviceId: payload } : payload),
  book: (payload) => request('POST', '/appointments', payload),
  awaitingReview: () => request('GET', '/appointments/awaiting-review'),
  submitReview: (id, body) => request('POST', `/appointments/${id}/review`, body),
  myAppointments: (scope) => request('GET', '/appointments' + qs({ scope })),
  upcoming: () => request('GET', '/appointments/upcoming'),
  appointment: (id) => request('GET', '/appointments/' + id),
  cancel: (id, reason) => request('POST', `/appointments/${id}/cancel`, { reason }),
  reschedule: (id, payload) => request('POST', `/appointments/${id}/reschedule`, payload),

  /* مدیریت */
  admin: {
    stats: () => request('GET', '/admin/stats'),
    appointments: (params) => request('GET', '/admin/appointments' + qs(params)),
    setStatus: (id, status) => request('PUT', `/admin/appointments/${id}/status`, { status }),
    services: () => request('GET', '/admin/services'),
    createService: (b) => request('POST', '/admin/services', b),
    updateService: (id, b) => request('PUT', '/admin/services/' + id, b),
    deleteService: (id) => request('DELETE', '/admin/services/' + id),
    staff: () => request('GET', '/admin/staff'),
    createStaff: (b) => request('POST', '/admin/staff', b),
    updateStaff: (id, b) => request('PUT', '/admin/staff/' + id, b),
    deleteStaff: (id) => request('DELETE', '/admin/staff/' + id),
    customers: (params) => request('GET', '/admin/customers' + qs(params)),
    updateCustomer: (id, b) => request('PUT', '/admin/customers/' + id, b),
    messages: (params) => request('GET', '/admin/messages' + qs(params)),
    sendMessage: (b) => request('POST', '/admin/messages/send', b),
    testMessage: (b) => request('POST', '/admin/messages/test', b),
    verifyEmail: () => request('POST', '/admin/messages/verify-email'),
    runScheduler: () => request('POST', '/admin/scheduler/run'),
    settings: () => request('GET', '/admin/settings'),
    saveSettings: (b) => request('PUT', '/admin/settings', b),
    changePassword: (b) => request('PUT', '/admin/password', b),

    /* بازاریابی */
    promos: () => request('GET', '/admin/promos'),
    createPromo: (b) => request('POST', '/admin/promos', b),
    updatePromo: (id, b) => request('PUT', '/admin/promos/' + id, b),
    deletePromo: (id) => request('DELETE', '/admin/promos/' + id),

    giftcards: () => request('GET', '/admin/giftcards'),
    createGiftCard: (b) => request('POST', '/admin/giftcards', b),
    updateGiftCard: (id, b) => request('PUT', '/admin/giftcards/' + id, b),
    deleteGiftCard: (id) => request('DELETE', '/admin/giftcards/' + id),
    resendGiftCard: (id) => request('POST', `/admin/giftcards/${id}/resend`),

    reviews: (params) => request('GET', '/admin/reviews' + qs(params)),
    updateReview: (id, b) => request('PUT', '/admin/reviews/' + id, b),
    deleteReview: (id) => request('DELETE', '/admin/reviews/' + id),

    grantCredit: (id, b) => request('POST', `/admin/customers/${id}/credit`, b),

    /* ماژول‌ها و لایسنس */
    modules: () => request('GET', '/admin/modules'),
    previewLicense: (token) => request('POST', '/admin/modules/license/preview', { token }),
    applyLicense: (token) => request('POST', '/admin/modules/license', { token }),
    removeLicense: () => request('DELETE', '/admin/modules/license'),
    customerLedger: (id) => request('GET', `/admin/customers/${id}/ledger`),
  },
};
