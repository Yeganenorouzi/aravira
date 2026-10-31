/** وضعیت سراسری برنامه: کاربر، تنظیمات سالن، پیام‌های شناور و جریان رزرو */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api, getToken, setToken } from './api.js';

const AppContext = createContext(null);
const BOOKING_KEY = 'salon_booking_draft';

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState([]);

  // پیش‌نویس رزرو بین صفحه‌ها حفظ می‌شود
  const [booking, setBookingState] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(BOOKING_KEY) || '{}'); } catch { return {}; }
  });

  const setBooking = useCallback((patch) => {
    setBookingState((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      try { sessionStorage.setItem(BOOKING_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const clearBooking = useCallback(() => {
    setBookingState({});
    try { sessionStorage.removeItem(BOOKING_KEY); } catch { /* ignore */ }
  }, []);

  const toastId = useRef(0);
  const toast = useCallback((text, kind = 'ok') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  /* بارگذاری اولیه */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await api.settings();
        if (alive) setSettings(s);
      } catch { /* سرور در دسترس نیست */ }

      if (getToken()) {
        try {
          const { user: u } = await api.me();
          if (alive) setUser(u);
        } catch {
          setToken('');
        }
      }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  // token اختیاری است: هنگام به‌روزرسانی پروفایل فقط کاربر تازه می‌شود
  const login = useCallback((token, u) => {
    if (token) setToken(token);
    if (u !== undefined) setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setToken('');
    setUser(null);
    clearBooking();
  }, [clearBooking]);

  const refreshUser = useCallback(async () => {
    try {
      const { user: u } = await api.me();
      setUser(u);
      return u;
    } catch { return null; }
  }, []);

  const modules = settings?.modules || ['core'];
  const hasModule = useCallback((id) => modules.includes(id), [modules]);

  const value = useMemo(
    () => ({
      user, setUser, settings, ready, login, logout, refreshUser,
      modules, hasModule,
      booking, setBooking, clearBooking,
      toast, toasts,
      currency: settings?.currency || 'تومان',
      salonName: settings?.salonName || 'سالن زیبایی',
    }),
    [user, settings, ready, login, logout, refreshUser, booking, setBooking, clearBooking,
     toast, toasts, modules, hasModule]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp باید درون AppProvider استفاده شود');
  return ctx;
}

/** هوک کمکی برای فراخوانی‌های async با مدیریت بارگذاری و خطا */
export function useAsync(fn, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState('');
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fnRef.current();
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || 'خطایی رخ داد');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload: run, setData };
}
