import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useAsync } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { Sheet, Price, Alert, Chevron } from '../components/ui.jsx';
import { toPersianDigits, formatJalali } from '@shared/jalali.js';

export default function Profile() {
  const nav = useNavigate();
  const { user, logout, settings, salonName, hasModule } = useApp();
  const marketing = hasModule('marketing');
  const [confirmOut, setConfirmOut] = useState(false);
  const [about, setAbout] = useState(false);

  const { data } = useAsync(() => api.myAppointments('all'), []);
  const { data: clubData } = useAsync(
    () => (marketing ? api.club() : Promise.resolve(null)),
    [marketing]
  );
  const club = clubData?.club;
  const all = data?.appointments || [];
  const done = all.filter((a) => a.status === 'done');

  return (
    <div className="screen">
      <div className="topbar">
        <span style={{ width: 40 }} />
        <h1>پروفایل</h1>
        <span style={{ width: 40 }} />
      </div>

      <div className="screen-body">
        <div className="profile-head">
          <div className="avatar lg">{user?.gender === 'male' ? '👨' : '👩'}</div>
          <div className="grow">
            <div className="name">{user?.name || 'کاربر'}</div>
            <div className="contact">{toPersianDigits(user?.phone || '')}</div>
            {user?.email && <div className="contact">{user.email}</div>}
          </div>
          <button className="icon-btn" onClick={() => nav('/profile/edit')} aria-label="ویرایش">
            ✎
          </button>
        </div>

        <div className="stat-row">
          <div className="stat-box">
            <div className="v">{toPersianDigits(done.length)}</div>
            <div className="k">نوبت انجام‌شده</div>
          </div>
          {marketing ? (
            <button className="stat-box" onClick={() => nav('/club')}>
              <div className="v">{toPersianDigits(club?.points ?? user?.points ?? 0)}</div>
              <div className="k">امتیاز باشگاه</div>
            </button>
          ) : (
            <div className="stat-box">
              <div className="v">{toPersianDigits(all.length)}</div>
              <div className="k">کل نوبت‌ها</div>
            </div>
          )}
          {marketing ? (
            <button className="stat-box" onClick={() => nav('/club')}>
              <div className="v" style={{ fontSize: 13 }}>
                <Price amount={club?.credit || 0} />
              </div>
              <div className="k">اعتبار حساب</div>
            </button>
          ) : (
            <div className="stat-box">
              <div className="v" style={{ fontSize: 13 }}>
                <Price amount={user?.totalSpent || 0} />
              </div>
              <div className="k">مجموع خرید</div>
            </div>
          )}
        </div>

        {user?.lastVisit && (
          <p className="small muted center mt-12">
            آخرین مراجعه: {formatJalali(user.lastVisit, { withWeekday: true })}
          </p>
        )}

        <div className="menu-list">
          <button className="menu-item" onClick={() => nav('/profile/edit')}>
            <span className="ico">👤</span>
            <span className="grow">ویرایش اطلاعات</span>
            <span className="arrow"><Chevron dir="left" size={15} /></span>
          </button>
          <button className="menu-item" onClick={() => nav('/appointments')}>
            <span className="ico">📅</span>
            <span className="grow">نوبت‌های من</span>
            <span className="badge rose">{toPersianDigits(all.length)}</span>
            <span className="arrow"><Chevron dir="left" size={15} /></span>
          </button>
          {marketing && (
            <>
              <button className="menu-item" onClick={() => nav('/club')}>
                <span className="ico">🏆</span>
                <span className="grow">باشگاه مشتریان</span>
                {club?.tier && <span className="badge rose">{club.tier.icon} {club.tier.title}</span>}
                <span className="arrow"><Chevron dir="left" size={15} /></span>
              </button>
              <button className="menu-item" onClick={() => nav('/club')}>
                <span className="ico">🎁</span>
                <span className="grow">دعوت از دوستان</span>
                <span className="arrow"><Chevron dir="left" size={15} /></span>
              </button>
            </>
          )}
          <button className="menu-item" onClick={() => nav('/explore')}>
            <span className="ico">💅</span>
            <span className="grow">خدمات سالن</span>
            <span className="arrow"><Chevron dir="left" size={15} /></span>
          </button>
          <button className="menu-item" onClick={() => setAbout(true)}>
            <span className="ico">📍</span>
            <span className="grow">آدرس و تماس</span>
            <span className="arrow"><Chevron dir="left" size={15} /></span>
          </button>
        </div>

        <div className="menu-list">
          <button className="menu-item danger" onClick={() => setConfirmOut(true)}>
            <span className="ico">🚪</span>
            <span className="grow">خروج از حساب</span>
            <span className="arrow"><Chevron dir="left" size={15} /></span>
          </button>
        </div>

        <p className="center small muted mt-20">
          {salonName} • نسخه‌ی ۱٫۰
        </p>
      </div>

      <Sheet open={about} onClose={() => setAbout(false)} title={salonName} sub={settings?.tagline}>
        <div className="detail-line">
          <span className="ico">📍</span>
          <span className="txt">
            <span className="k">آدرس</span>
            <div className="v">{settings?.address}</div>
          </span>
        </div>
        <div className="detail-line">
          <span className="ico">☎️</span>
          <span className="txt">
            <span className="k">تلفن</span>
            <div className="v">{settings?.phone}</div>
          </span>
        </div>
        <div className="detail-line">
          <span className="ico">🕐</span>
          <span className="txt">
            <span className="k">ساعات کاری</span>
            <div className="v" style={{ fontSize: 12.5 }}>
              شنبه تا پنجشنبه <bdi>۹:۰۰</bdi> تا <bdi>۲۰:۰۰</bdi> — جمعه‌ها تعطیل
            </div>
          </span>
        </div>
        <button className="btn soft mt-16" onClick={() => setAbout(false)}>بستن</button>
      </Sheet>

      <Sheet
        open={confirmOut}
        onClose={() => setConfirmOut(false)}
        title="خروج از حساب"
        sub="برای رزرو نوبت دوباره باید وارد شوید"
      >
        <div className="btn-row mt-8">
          <button className="btn soft" onClick={() => setConfirmOut(false)}>انصراف</button>
          <button
            className="btn"
            onClick={async () => {
              await logout();
              nav('/', { replace: true });
            }}
          >
            خروج
          </button>
        </div>
      </Sheet>
    </div>
  );
}
