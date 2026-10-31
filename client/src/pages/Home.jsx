import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useAsync } from '../lib/store.jsx';
import { Art, Price, StatusBadge, Skeleton, Empty } from '../components/ui.jsx';
import { formatJalali, formatTime, toPersianDigits } from '@shared/jalali.js';

export default function Home() {
  const nav = useNavigate();
  const { user, setBooking, salonName } = useApp();

  const { data: popular, loading: loadingServices } = useAsync(
    () => api.services({ popular: 1 }),
    []
  );
  const { data: offersData } = useAsync(() => api.offers(), []);
  const { data: next, loading: loadingNext } = useAsync(() => api.upcoming(), []);

  const startBooking = (service) => {
    setBooking({ serviceId: service.id, service, staffId: null, date: null, time: null });
    nav('/service/' + service.id);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'صبح بخیر';
    if (h < 18) return 'ظهر بخیر';
    return 'عصر بخیر';
  })();

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav('/profile')} aria-label="پروفایل">
          ☰
        </button>
        <span className="grow" />
        <button className="icon-btn has-dot" onClick={() => nav('/appointments')} aria-label="نوبت‌ها">
          🔔
          {next?.appointment && <span className="dot" />}
        </button>
      </div>

      <div className="greeting-head">
        <div className="hi">
          {greeting}، {user?.name?.split(' ')[0] || 'مهمان'} 👋
        </div>
        <div className="welcome">به {salonName} خوش آمدید</div>
      </div>

      <div className="screen-body">
        {/* جستجو */}
        <div className="search-bar">
          <div className="input-wrap" onClick={() => nav('/explore')}>
            <span className="lead">🔍</span>
            <input readOnly placeholder="جستجوی خدمات..." style={{ cursor: 'pointer' }} />
          </div>
          <button className="search-btn" onClick={() => nav('/explore')} aria-label="جستجو">
            ⌕
          </button>
        </div>

        {/* خدمات پرطرفدار */}
        <div className="section">
          <div className="section-head">
            <h2>خدمات پرطرفدار</h2>
            <button className="see-all" onClick={() => nav('/explore')}>
              مشاهده‌ی همه
            </button>
          </div>

          {loadingServices ? (
            <div className="service-grid">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} h={132} mb={0} />
              ))}
            </div>
          ) : (
            <div className="service-grid">
              {(popular?.services || []).slice(0, 6).map((s) => (
                <button key={s.id} className="service-tile" onClick={() => startBooking(s)}>
                  <Art item={s} className="tile-art" />
                  <span className="name">{s.title}</span>
                  <span className="price">
                    <Price amount={s.price} />
                  </span>
                  <span className="book">رزرو</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* پیشنهادهای ویژه */}
        {offersData?.offers?.length > 0 && (
          <div className="section">
            <div className="section-head">
              <h2>پیشنهادهای ویژه</h2>
              <button className="see-all" onClick={() => nav('/explore')}>
                مشاهده‌ی همه
              </button>
            </div>
            <div className="offer-scroll">
              {offersData.offers.map((o) => (
                <div
                  key={o.id}
                  className="offer-card"
                  style={{ background: o.gradient || 'linear-gradient(135deg,#e0828c,#b8566a)' }}
                >
                  <div className="percent">{toPersianDigits(o.percent)}٪ تخفیف</div>
                  <div className="label">{o.title}</div>
                  <div className="sub">{o.subtitle}</div>
                  <button
                    className="cta"
                    onClick={async () => {
                      if (!o.serviceId) return nav('/explore');
                      try {
                        const { service } = await api.service(o.serviceId);
                        startBooking(service);
                      } catch {
                        nav('/explore');
                      }
                    }}
                  >
                    رزرو کنید
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* نوبت پیش رو */}
        <div className="section">
          <div className="section-head">
            <h2>نوبت پیش رو</h2>
            {next?.appointment && (
              <button className="see-all" onClick={() => nav('/appointments')}>
                همه‌ی نوبت‌ها
              </button>
            )}
          </div>

          {loadingNext ? (
            <Skeleton h={92} />
          ) : next?.appointment ? (
            <button
              className="appt-card"
              style={{ width: '100%', textAlign: 'start' }}
              onClick={() => nav('/appointments')}
            >
              <div className="appt-top">
                <Art item={next.appointment.service} className="row-art" />
                <div className="grow">
                  <div className="title">{next.appointment.service?.title}</div>
                  <div className="who">با {next.appointment.staff?.name}</div>
                  <div style={{ marginTop: 6 }}>
                    <StatusBadge status={next.appointment.status} />
                  </div>
                </div>
                <div className="appt-when">
                  <span className="d">{formatJalali(next.appointment.date, { short: true })}</span>
                  <span className="t">{formatTime(next.appointment.time)}</span>
                </div>
              </div>
            </button>
          ) : (
            <Empty
              icon="📅"
              title="نوبتی ثبت نکرده‌اید"
              text="برای رزرو، یکی از خدمات بالا را انتخاب کنید"
              action={
                <button className="btn" onClick={() => nav('/explore')}>
                  رزرو نوبت
                </button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
