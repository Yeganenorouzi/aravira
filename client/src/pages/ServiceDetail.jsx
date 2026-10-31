import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useAsync } from '../lib/store.jsx';
import { Price, Duration, Spinner, Alert, Art, Chevron } from '../components/ui.jsx';
import { toPersianDigits } from '@shared/jalali.js';

export default function ServiceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { setBooking } = useApp();

  const { data, loading, error } = useAsync(() => api.service(id), [id]);
  const service = data?.service;
  const staff = data?.staff || [];

  const next = () => {
    setBooking({ serviceId: service.id, service, staffId: null, date: null, time: null });
    nav('/book/staff');
  };

  if (loading) return <div className="screen"><Spinner /></div>;
  if (error || !service) {
    return (
      <div className="screen">
        <div className="screen-body mt-20">
          <Alert kind="error">{error || 'خدمت موردنظر پیدا نشد'}</Alert>
          <button className="btn soft" onClick={() => nav('/explore')}>بازگشت به خدمات</button>
        </div>
      </div>
    );
  }

  const finalPrice = Math.round(service.price * (1 - (service.discountPercent || 0) / 100));

  return (
    <div className="screen has-cta">
      <div className="hero" style={{ background: service.gradient || 'var(--rose-200)' }}>
        <div className="hero-bar">
          <button className="icon-btn" onClick={() => nav(-1)} aria-label="بازگشت"><Chevron dir="right" /></button>
          <button className="icon-btn" onClick={() => nav('/explore')} aria-label="خدمات">⌕</button>
        </div>
        <span style={{ position: 'relative', zIndex: 1 }}>{service.icon}</span>
      </div>

      <div className="detail-sheet">
        <div className="detail-title">
          <div>
            <h2>{service.title}</h2>
            <div className="detail-sub">
              {service.discountPercent > 0 && (
                <span className="badge rose" style={{ marginInlineEnd: 6 }}>
                  {toPersianDigits(service.discountPercent)}٪ تخفیف
                </span>
              )}
              خدمات حرفه‌ای با محصولات اصل
            </div>
          </div>
          <div className="price">
            <Price amount={finalPrice} />
            {service.discountPercent > 0 && (
              <div style={{ textDecoration: 'line-through', color: 'var(--muted-2)', fontSize: 12, fontWeight: 500 }}>
                <Price amount={service.price} />
              </div>
            )}
          </div>
        </div>

        <div className="spec-row">
          <div className="spec">
            <div className="ico">⏱</div>
            <div className="val"><Duration minutes={service.duration} /></div>
            <div className="key">مدت زمان</div>
          </div>
          <div className="spec">
            <div className="ico">👩‍🎨</div>
            <div className="val">{toPersianDigits(staff.length)} نفر</div>
            <div className="key">آرایشگر</div>
          </div>
          <div className="spec">
            <div className="ico">💎</div>
            <div className="val">اصل</div>
            <div className="key">محصولات</div>
          </div>
        </div>

        <div className="about">
          <h3>درباره‌ی این خدمت</h3>
          <p>{service.description}</p>
        </div>

        {staff.length > 0 && (
          <div className="section">
            <div className="section-head">
              <h2>آرایشگران این خدمت</h2>
            </div>
            <div className="row wrap" style={{ gap: 14 }}>
              {staff.map((s) => (
                <div key={s.id} style={{ textAlign: 'center', width: 72 }}>
                  <div className="avatar" style={{ margin: '0 auto' }}>{s.avatar || '👩'}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 5 }}>{s.name.split(' ')[0]}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>
                    ⭐ {toPersianDigits(s.rating)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="cta-bar">
        <button className="btn" onClick={next} disabled={staff.length === 0}>
          {staff.length === 0 ? 'در حال حاضر آرایشگری در دسترس نیست' : 'رزرو این خدمت'}
        </button>
      </div>
    </div>
  );
}
