import { useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../lib/store.jsx';

export default function Splash() {
  const nav = useNavigate();
  const { user, settings } = useApp();

  if (user) return <Navigate to="/home" replace />;

  return (
    <div className="screen splash">
      <div className="splash-inner">
        <div className="splash-mark">
          <span>🌸</span>
          <span>{settings?.salonName || 'سالن زیبایی رُز'}</span>
        </div>

        <h1>
          زیبا باش،
          <br />
          <em>احساس خوب</em> داشته باش
        </h1>
        <p className="lead">{settings?.tagline || 'زیبایی و اصالت، طراحی‌شده برای شما'}</p>

        <div className="splash-points">
          <span>رزرو آنلاین ۲۴ ساعته</span>
          <span>یادآوری پیامکی</span>
          <span>تقویم شمسی</span>
        </div>

        <button className="btn" onClick={() => nav('/login')}>
          رزرو نوبت
        </button>

        <button className="secondary" onClick={() => nav('/login', { state: { from: '/explore' } })}>
          مشاهده‌ی خدمات ⌄
        </button>
      </div>
    </div>
  );
}
