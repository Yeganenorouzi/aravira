import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../../lib/store.jsx';

import Dashboard from './Dashboard.jsx';
import ManageAppointments from './ManageAppointments.jsx';
import ManageServices from './ManageServices.jsx';
import ManageStaff from './ManageStaff.jsx';
import Customers from './Customers.jsx';
import Messaging from './Messaging.jsx';
import Marketing from './Marketing.jsx';
import SettingsPage from './SettingsPage.jsx';
import Modules from './Modules.jsx';

const TABS = [
  { to: '/admin', end: true, label: 'داشبورد', ico: '📊' },
  { to: '/admin/appointments', label: 'نوبت‌ها', ico: '📅' },
  { to: '/admin/services', label: 'خدمات', ico: '💅' },
  { to: '/admin/staff', label: 'پرسنل', ico: '👩‍🎨' },
  { to: '/admin/customers', label: 'مشتریان', ico: '👥' },
  { to: '/admin/marketing', label: 'تخفیف و باشگاه', ico: '🏷️', module: 'marketing' },
  { to: '/admin/messaging', label: 'پیامک و ایمیل', ico: '✉️' },
  { to: '/admin/settings', label: 'تنظیمات', ico: '⚙️' },
  { to: '/admin/modules', label: 'ماژول‌ها', ico: '🧩' },
];

export default function AdminPanel() {
  const { user, logout, salonName, hasModule } = useApp();
  const nav = useNavigate();

  // تب ماژول‌هایی که خریداری نشده‌اند اصلاً نمایش داده نمی‌شود
  const tabs = TABS.filter((t) => !t.module || hasModule(t.module));

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <div className="brand">
          🌸 {salonName}
          <small>پنل مدیریت</small>
        </div>
        <span className="grow" />
        <span className="small muted nowrap">{user?.name}</span>
        <button className="btn soft sm" onClick={() => nav('/home')}>نمای مشتری</button>
        <button
          className="btn outline sm"
          onClick={async () => {
            await logout();
            nav('/admin/login', { replace: true });
          }}
        >
          خروج
        </button>
      </header>

      <nav className="admin-tabs">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => 'admin-tab' + (isActive ? ' on' : '')}
          >
            {t.ico} {t.label}
          </NavLink>
        ))}
      </nav>

      <main className="admin-body">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="appointments" element={<ManageAppointments />} />
          <Route path="services" element={<ManageServices />} />
          <Route path="staff" element={<ManageStaff />} />
          <Route path="customers" element={<Customers />} />
          <Route
            path="marketing"
            element={hasModule('marketing') ? <Marketing /> : <Navigate to="/admin/modules" replace />}
          />
          <Route path="messaging" element={<Messaging />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="modules" element={<Modules />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}
