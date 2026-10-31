import { Routes, Route, Navigate, useLocation, NavLink } from 'react-router-dom';
import { useApp } from './lib/store.jsx';
import { Spinner, ToastHost } from './components/ui.jsx';

import Splash from './pages/Splash.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Explore from './pages/Explore.jsx';
import ServiceDetail from './pages/ServiceDetail.jsx';
import SelectStaff from './pages/SelectStaff.jsx';
import SelectTime from './pages/SelectTime.jsx';
import Summary from './pages/Summary.jsx';
import Success from './pages/Success.jsx';
import Appointments from './pages/Appointments.jsx';
import Profile from './pages/Profile.jsx';
import EditProfile from './pages/EditProfile.jsx';
import Club from './pages/Club.jsx';
import ReviewForm from './pages/ReviewForm.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import AdminPanel from './pages/admin/AdminPanel.jsx';

const NAV = [
  { to: '/home', ico: '🏠', label: 'خانه' },
  { to: '/appointments', ico: '📅', label: 'نوبت‌های من' },
  { to: '/explore', ico: '🔍', label: 'خدمات' },
  { to: '/profile', ico: '👤', label: 'پروفایل' },
];

function BottomNav() {
  return (
    <nav className="bottom-nav">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'on' : '')}>
          <span className="ico">{n.ico}</span>
          <span>{n.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

/** مسیرهایی که نیاز به ورود دارند */
function Protected({ children }) {
  const { user, ready } = useApp();
  const loc = useLocation();
  if (!ready) return <div className="app-frame"><Spinner /></div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}

/** مسیرهایی که به یک ماژول خریداری‌شده نیاز دارند */
function ModuleRoute({ module, children }) {
  const { hasModule } = useApp();
  if (!hasModule(module)) return <Navigate to="/home" replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user, ready } = useApp();
  if (!ready) return <div className="app-frame"><Spinner /></div>;
  if (!user || user.role !== 'admin') return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  const { ready } = useApp();
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith('/admin');
  const showNav = NAV.some((n) => loc.pathname === n.to);

  if (!ready) {
    return (
      <div className="app-frame">
        <Spinner />
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="admin">
        <ToastHost />
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/*" element={<AdminOnly><AdminPanel /></AdminOnly>} />
        </Routes>
      </div>
    );
  }

  return (
    <div className={'app-frame' + (showNav ? ' has-nav' : '')}>
      <ToastHost />
      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/login" element={<Login />} />

        <Route path="/home" element={<Protected><Home /></Protected>} />
        <Route path="/explore" element={<Protected><Explore /></Protected>} />
        <Route path="/service/:id" element={<Protected><ServiceDetail /></Protected>} />
        <Route path="/book/staff" element={<Protected><SelectStaff /></Protected>} />
        <Route path="/book/time" element={<Protected><SelectTime /></Protected>} />
        <Route path="/book/summary" element={<Protected><Summary /></Protected>} />
        <Route path="/book/success/:id" element={<Protected><Success /></Protected>} />
        <Route path="/appointments" element={<Protected><Appointments /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/profile/edit" element={<Protected><EditProfile /></Protected>} />
        <Route path="/club" element={<Protected><ModuleRoute module="marketing"><Club /></ModuleRoute></Protected>} />
        <Route path="/review" element={<Protected><ModuleRoute module="marketing"><ReviewForm /></ModuleRoute></Protected>} />
        <Route path="/review/:id" element={<Protected><ModuleRoute module="marketing"><ReviewForm /></ModuleRoute></Protected>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showNav && <BottomNav />}
    </div>
  );
}
