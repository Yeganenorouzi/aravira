import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { TopBar, Spinner, Alert, Empty } from '../components/ui.jsx';
import JalaliCalendar from '../components/JalaliCalendar.jsx';
import { toJalali, todayISO, formatJalali, formatTime, toPersianDigits } from '@shared/jalali.js';

export default function SelectTime() {
  const nav = useNavigate();
  const { booking, setBooking, clearBooking, settings, toast } = useApp();

  const [date, setDate] = useState(booking.date || null);
  const [time, setTime] = useState(booking.time || null);
  const [monthDays, setMonthDays] = useState({});
  const [monthLoading, setMonthLoading] = useState(true);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [closedReason, setClosedReason] = useState('');
  const [error, setError] = useState('');
  const [quickDays, setQuickDays] = useState([]);
  const [busy, setBusy] = useState(false);

  const maxAdvanceDays = settings?.maxAdvanceDays || 45;

  useEffect(() => {
    if (!booking.serviceId || !booking.staffId) nav('/explore', { replace: true });
  }, [booking.serviceId, booking.staffId, nav]);

  /* ظرفیت ماه جاری */
  const loadMonth = useCallback(
    async ({ jy, jm }) => {
      setMonthLoading(true);
      try {
        const res = await api.monthAvailability({
          jy, jm, serviceId: booking.serviceId, staffId: booking.staffId,
        });
        setMonthDays((prev) => ({ ...prev, ...res.days }));
      } catch (err) {
        setError(err.message);
      } finally {
        setMonthLoading(false);
      }
    },
    [booking.serviceId, booking.staffId]
  );

  useEffect(() => {
    if (!booking.serviceId || !booking.staffId) return;
    const j = toJalali(date || todayISO());
    loadMonth({ jy: j.jy, jm: j.jm });

    api
      .nextAvailable({ serviceId: booking.serviceId, staffId: booking.staffId, limit: 3 })
      .then((res) => {
        setQuickDays(res.days || []);
        if (!date && res.days?.length) setDate(res.days[0].date);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.serviceId, booking.staffId]);

  /* زمان‌های روز انتخابی */
  useEffect(() => {
    if (!date) return;
    let alive = true;
    setSlotsLoading(true);
    setClosedReason('');
    api
      .availability({ date, serviceId: booking.serviceId, staffId: booking.staffId })
      .then((res) => {
        if (!alive) return;
        setSlots(res.slots || []);
        if (res.closed) setClosedReason(res.reason || 'این روز قابل رزرو نیست');
      })
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setSlotsLoading(false));
    return () => { alive = false; };
  }, [date, booking.serviceId, booking.staffId]);

  const pickDate = (iso) => {
    setDate(iso);
    setTime(null);
  };

  const confirm = async () => {
    // حالت جابه‌جایی: نوبت موجود مستقیماً به‌روز می‌شود
    if (booking.rescheduleId) {
      setError('');
      setBusy(true);
      try {
        await api.reschedule(booking.rescheduleId, { date, time, staffId: booking.staffId });
        toast('نوبت شما جابه‌جا شد');
        clearBooking();
        nav('/appointments', { replace: true });
      } catch (err) {
        setError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    setBooking({ date, time });
    nav('/book/summary');
  };

  const freeSlots = slots.filter((s) => s.available);

  return (
    <div className="screen has-cta">
      <TopBar
        title={booking.rescheduleId ? 'جابه‌جایی نوبت' : 'انتخاب تاریخ و ساعت'}
        sub={`${booking.service?.title || ''} • ${booking.staff?.name || ''}`}
      />

      <div className="screen-body">
        <Alert kind="error">{error}</Alert>

        {/* میانبر زودترین زمان‌ها */}
        {quickDays.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="small muted" style={{ marginBottom: 8 }}>زودترین زمان‌های آزاد</div>
            <div className="chips">
              {quickDays.map((d) => (
                <button
                  key={d.date}
                  className={'chip' + (date === d.date ? ' on' : '')}
                  onClick={() => pickDate(d.date)}
                >
                  <bdi>{formatJalali(d.date, { withWeekday: true, short: true })}</bdi> • <bdi>{formatTime(d.firstTime)}</bdi>
                </button>
              ))}
            </div>
          </div>
        )}

        <JalaliCalendar
          value={date}
          onChange={pickDate}
          availability={monthDays}
          maxAdvanceDays={maxAdvanceDays}
          onMonthChange={loadMonth}
          loading={monthLoading}
        />

        <div className="section">
          <div className="section-head">
            <h2>ساعت نوبت</h2>
            {date && (
              <span className="small muted">{formatJalali(date, { withWeekday: true })}</span>
            )}
          </div>

          {!date ? (
            <p className="muted small center" style={{ padding: '20px 0' }}>
              ابتدا یک روز را از تقویم انتخاب کنید
            </p>
          ) : slotsLoading ? (
            <Spinner />
          ) : closedReason ? (
            <Alert kind="warn">{closedReason}</Alert>
          ) : freeSlots.length === 0 ? (
            <Empty icon="⏰" title="ظرفیت این روز تکمیل است" text="لطفاً روز دیگری را انتخاب کنید" />
          ) : (
            <>
              <div className="slot-grid">
                {slots.map((s) => (
                  <button
                    key={s.time}
                    className={'slot' + (time === s.time ? ' on' : '')}
                    disabled={!s.available}
                    onClick={() => setTime(s.time)}
                    title={s.available ? 'آزاد' : s.reason}
                  >
                    {formatTime(s.time)}
                  </button>
                ))}
              </div>
              <p className="small muted center mt-12">
                {toPersianDigits(freeSlots.length)} زمان آزاد از {toPersianDigits(slots.length)} زمان
              </p>
            </>
          )}
        </div>
      </div>

      <div className="cta-bar">
        <button className="btn" disabled={!date || !time || busy} onClick={confirm}>
          {busy ? (
            <span className="spinner sm on-dark" />
          ) : date && time ? (
            <><bdi>{booking.rescheduleId ? 'ثبت جابه‌جایی' : 'ادامه'}</bdi> – <bdi>{formatJalali(date, { short: true })}</bdi> ساعت <bdi>{formatTime(time)}</bdi></>
          ) : (
            'تاریخ و ساعت را انتخاب کنید'
          )}
        </button>
      </div>
    </div>
  );
}
