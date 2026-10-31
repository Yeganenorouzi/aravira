import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useAsync } from '../lib/store.jsx';
import { TopBar, Spinner, Empty, Alert } from '../components/ui.jsx';
import { toPersianDigits, WEEKDAYS_FA } from '@shared/jalali.js';

export default function SelectStaff() {
  const nav = useNavigate();
  const { booking, setBooking } = useApp();

  useEffect(() => {
    if (!booking.serviceId) nav('/explore', { replace: true });
  }, [booking.serviceId, nav]);

  const { data, loading, error } = useAsync(
    () => api.staffList({ serviceId: booking.serviceId }),
    [booking.serviceId]
  );

  const staff = data?.staff || [];

  const pick = (s) => {
    setBooking({ staffId: s.id, staff: s, date: null, time: null });
    nav('/book/time');
  };

  return (
    <div className="screen">
      <TopBar title="انتخاب آرایشگر" sub={booking.service?.title} />

      <div className="screen-body">
        <Alert kind="error">{error}</Alert>

        {loading ? (
          <Spinner />
        ) : staff.length === 0 ? (
          <Empty
            icon="👩‍🎨"
            title="آرایشگری برای این خدمت ثبت نشده"
            text="لطفاً خدمت دیگری انتخاب کنید یا با سالن تماس بگیرید"
            action={<button className="btn soft" onClick={() => nav('/explore')}>بازگشت به خدمات</button>}
          />
        ) : (
          <>
            <p className="muted small" style={{ marginBottom: 14 }}>
              آرایشگر موردنظر خود را انتخاب کنید
            </p>

            {staff.map((s) => (
              <button
                key={s.id}
                className={'staff-card' + (booking.staffId === s.id ? ' on' : '')}
                onClick={() => pick(s)}
              >
                <div className="avatar">{s.avatar || '👩'}</div>
                <div className="info">
                  <div className="name">{s.name}</div>
                  <div className="role">{s.title}</div>
                  <div className="rating">
                    ⭐ {toPersianDigits(s.rating)}
                    <span className="count">({toPersianDigits(s.reviews)} نظر)</span>
                  </div>
                  {s.offDays?.length > 0 && (
                    <div style={{ fontSize: 10.5, color: 'var(--muted-2)', marginTop: 3 }}>
                      تعطیل: {s.offDays.map((d) => WEEKDAYS_FA[d]).join('، ')}
                    </div>
                  )}
                </div>
                <div className="radio-mark">✓</div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
