import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useApp } from '../../lib/store.jsx';
import { Field, Input, Alert, useAutoFocus } from '../../components/ui.jsx';

export default function AdminLogin() {
  const nav = useNavigate();
  const { login, user, toast } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const ref = useAutoFocus();

  // اگر کیبورد روی فارسی باشد رمز با نویسه‌های فارسی تایپ می‌شود و کاربر متوجه نمی‌شود
  const hasPersian = /[؀-ۿ]/.test(username + password);

  useEffect(() => {
    if (user?.role === 'admin') nav('/admin', { replace: true });
  }, [user, nav]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.adminLogin(username, password);
      login(res.token, res.user);
      toast('خوش آمدید');
      nav('/admin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <form
        onSubmit={submit}
        className="card"
        style={{ width: '100%', maxWidth: 400, padding: 28, borderRadius: 24 }}
      >
        <div className="center" style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 40 }}>🌸</div>
          <h2 style={{ fontSize: 19, marginTop: 8 }}>پنل مدیریت سالن</h2>
          <p className="small muted">برای ورود، نام کاربری و رمز خود را وارد کنید</p>
        </div>

        <Alert kind="error">{error}</Alert>

        <Field label="نام کاربری">
          <Input ref={ref} icon="👤" ltr value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </Field>

        <Field
          label="رمز عبور"
          hint={hasPersian ? 'زبان کیبورد روی فارسی است؛ رمز را با کیبورد انگلیسی وارد کنید' : ''}
        >
          <Input
            icon="🔒"
            ltr
            invalid={hasPersian}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>

        <button
          type="button"
          className="btn outline sm"
          style={{ width: '100%', marginBottom: 14 }}
          onClick={() => setShowPassword((v) => !v)}
        >
          {showPassword ? '🙈 پنهان کردن رمز' : '👁 نمایش رمز'}
        </button>

        <button className="btn" disabled={busy}>
          {busy ? <span className="spinner sm on-dark" /> : 'ورود به پنل'}
        </button>

        <p className="small muted center mt-16" style={{ lineHeight: 2 }}>
          حساب پیش‌فرض: <b className="ltr">admin</b> / <b className="ltr">admin123</b>
          <br />
          پس از اولین ورود، از بخش تنظیمات رمز را عوض کنید.
        </p>

        <div className="center mt-16">
          <Link to="/" className="small muted">بازگشت به برنامه‌ی مشتریان</Link>
        </div>
      </form>
    </div>
  );
}
