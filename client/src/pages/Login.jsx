import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Alert, Field, Input, TopBar, useAutoFocus } from '../components/ui.jsx';
import { toEnglishDigits, toPersianDigits } from '@shared/jalali.js';

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const { login, toast, salonName, user } = useApp();

  const [step, setStep] = useState('phone'); // phone | code | name
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  const phoneRef = useAutoFocus(step === 'phone');
  const codeRef = useRef(null);
  const nameRef = useRef(null);

  const target = loc.state?.from || '/home';

  useEffect(() => {
    if (user && step !== 'name') nav(target, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (step === 'code') setTimeout(() => codeRef.current?.focus(), 150);
    if (step === 'name') setTimeout(() => nameRef.current?.focus(), 150);
  }, [step]);

  const normalizedPhone = toEnglishDigits(phone).replace(/\D/g, '');

  async function requestCode(e) {
    e?.preventDefault();
    setError('');
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setError('شماره موبایل را درست وارد کنید (مثال: ۰۹۱۲۱۲۳۴۵۶۷)');
      return;
    }
    setBusy(true);
    try {
      const res = await api.requestOtp(normalizedPhone);
      setDevCode(res.devCode || '');
      setCountdown(60);
      setStep('code');
      toast('کد ورود پیامک شد');
      if (res.warning) setError(res.warning);
    } catch (err) {
      setError(err.message);
      if (err.data?.retryAfter) setCountdown(err.data.retryAfter);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e?.preventDefault();
    setError('');
    const c = toEnglishDigits(code).replace(/\D/g, '');
    if (c.length !== 5) {
      setError('کد ۵ رقمی را کامل وارد کنید');
      return;
    }
    setBusy(true);
    try {
      const res = await api.verifyOtp(normalizedPhone, c);
      login(res.token, res.user);
      if (res.needsProfile) {
        setStep('name');
      } else {
        toast(`خوش آمدید ${res.user.name || ''}`);
        nav(target, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveName(e) {
    e?.preventDefault();
    setError('');
    if (name.trim().length < 2) {
      setError('نام خود را وارد کنید');
      return;
    }
    setBusy(true);
    try {
      const res = await api.updateProfile({ name: name.trim(), email: email.trim() });
      login(undefined, res.user);
      toast('حساب شما ساخته شد 🌸');
      nav(target, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <TopBar
        title={step === 'name' ? 'تکمیل حساب' : 'ورود به حساب'}
        sub={step === 'code' ? 'کد پیامک‌شده را وارد کنید' : salonName}
        onBack={() => (step === 'code' ? setStep('phone') : nav('/'))}
        back={step !== 'name'}
      />

      <div className="screen-body">
        <div style={{ marginTop: 10, marginBottom: 22 }}>
          <h2 style={{ fontSize: 23 }}>
            {step === 'phone' && 'خوش آمدید'}
            {step === 'code' && 'تأیید شماره'}
            {step === 'name' && 'آشنا شویم'}
          </h2>
          <p className="muted small" style={{ marginTop: 5 }}>
            {step === 'phone' && 'برای رزرو نوبت، شماره موبایل خود را وارد کنید'}
            {step === 'code' && (
              <>
                کد ۵ رقمی به شماره‌ی <b className="ltr" style={{ display: 'inline-block' }}>{toPersianDigits(normalizedPhone)}</b> ارسال شد
              </>
            )}
            {step === 'name' && 'نام شما روی نوبت‌ها و پیام‌ها نمایش داده می‌شود'}
          </p>
        </div>

        <Alert kind="error">{error}</Alert>

        {devCode && step === 'code' && (
          <Alert kind="info">
            حالت آزمایشی – کد ورود: <b style={{ letterSpacing: 2 }}>{toPersianDigits(devCode)}</b>
          </Alert>
        )}

        {step === 'phone' && (
          <form onSubmit={requestCode}>
            <Field label="شماره موبایل" hint="کد ورود از طریق پیامک برای شما ارسال می‌شود">
              <Input
                ref={phoneRef}
                icon="📱"
                ltr
                inputMode="numeric"
                autoComplete="tel"
                placeholder="09121234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={14}
              />
            </Field>
            <button className="btn" disabled={busy}>
              {busy ? <span className="spinner sm on-dark" /> : 'دریافت کد ورود'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verify}>
            <Field label="کد ورود">
              <Input
                ref={codeRef}
                icon="🔑"
                ltr
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="— — — — —"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                style={{ letterSpacing: 7, fontSize: 18, fontWeight: 700, textAlign: 'center' }}
              />
            </Field>
            <button className="btn" disabled={busy}>
              {busy ? <span className="spinner sm on-dark" /> : 'ورود'}
            </button>
            <button
              type="button"
              className="btn outline mt-12"
              disabled={countdown > 0 || busy}
              onClick={requestCode}
            >
              {countdown > 0 ? `ارسال مجدد کد تا ${toPersianDigits(countdown)} ثانیه‌ی دیگر` : 'ارسال مجدد کد'}
            </button>
            <button type="button" className="btn soft mt-12" onClick={() => setStep('phone')}>
              ویرایش شماره
            </button>
          </form>
        )}

        {step === 'name' && (
          <form onSubmit={saveName}>
            <Field label="نام و نام خانوادگی">
              <Input ref={nameRef} icon="👤" placeholder="مثلاً مهسا احمدی" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="ایمیل (اختیاری)" hint="برای دریافت تأییدیه و یادآوری نوبت از طریق ایمیل">
              <Input icon="✉️" ltr type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <button className="btn" disabled={busy}>
              {busy ? <span className="spinner sm on-dark" /> : 'ورود به برنامه'}
            </button>
          </form>
        )}

        <div className="center mt-24">
          <Link to="/admin/login" className="small muted">
            ورود مدیر سالن
          </Link>
        </div>
      </div>
    </div>
  );
}
