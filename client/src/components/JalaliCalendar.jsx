/** تقویم شمسی با نمایش وضعیت ظرفیت هر روز */
import { useState, useMemo } from 'react';
import { Chevron } from './ui.jsx';
import {
  buildJalaliMonth, shiftJalaliMonth, toJalali, todayISO, diffDays,
  MONTHS_FA, WEEKDAYS_SHORT_FA, toPersianDigits,
} from '@shared/jalali.js';

export default function JalaliCalendar({
  value,            // "YYYY-MM-DD" انتخاب‌شده
  onChange,
  availability = {}, // { iso: { closed, free, total } }
  maxAdvanceDays = 45,
  onMonthChange,
  loading = false,
  allowPast = false,   // در پنل مدیریت برای فیلتر روی روزهای گذشته
}) {
  const today = todayISO();
  const initial = toJalali(value || today);
  const [view, setView] = useState({ jy: initial.jy, jm: initial.jm });

  const weeks = useMemo(() => buildJalaliMonth(view.jy, view.jm), [view.jy, view.jm]);

  const go = (delta) => {
    const next = shiftJalaliMonth(view.jy, view.jm, delta);
    setView(next);
    onMonthChange?.(next);
  };

  // اگر همه‌ی روزهای ماه قبل گذشته باشند، دکمه‌ی قبل غیرفعال است
  const monthCells = weeks.flat().filter(Boolean);
  const lastOfMonth = monthCells[monthCells.length - 1]?.iso;
  const firstOfMonth = monthCells[0]?.iso;
  const canPrev = allowPast || diffDays(firstOfMonth, today) > 0;
  const canNext = diffDays(lastOfMonth, today) < maxAdvanceDays;

  return (
    <div className="calendar">
      <div className="cal-head">
        <button className="cal-nav" onClick={() => go(-1)} disabled={!canPrev} aria-label="ماه قبل">
          <Chevron dir="right" size={15} />
        </button>
        <div className="month">
          {MONTHS_FA[view.jm - 1]} {toPersianDigits(view.jy)}
          {loading && <span className="spinner sm" style={{ display: 'inline-block', marginInlineStart: 8, verticalAlign: -3 }} />}
        </div>
        <button className="cal-nav" onClick={() => go(1)} disabled={!canNext} aria-label="ماه بعد">
          <Chevron dir="left" size={15} />
        </button>
      </div>

      <div className="cal-grid">
        {WEEKDAYS_SHORT_FA.map((d, i) => (
          <div key={d} className={'cal-dow' + (i === 6 ? ' fri' : '')}>
            {d}
          </div>
        ))}

        {weeks.flat().map((cell, i) => {
          if (!cell) return <div key={'e' + i} className="cal-cell empty" />;

          const delta = diffDays(cell.iso, today);
          const info = availability[cell.iso];
          const tooEarly = !allowPast && delta < 0;
          const tooLate = delta > maxAdvanceDays;
          const noInfo = allowPast && !info;
          const closed = info && !noInfo ? info.closed || info.free === 0 : false;
          const disabled = tooEarly || tooLate || closed;

          const cls = [
            'cal-cell',
            disabled ? 'off' : '',
            !disabled && info?.free ? 'free' : '',
            cell.iso === today ? 'today' : '',
            cell.iso === value ? 'on' : '',
          ].filter(Boolean).join(' ');

          const label = `${cell.jd} ${MONTHS_FA[cell.jm - 1]}` +
            (closed ? ' – تعطیل' : info?.free ? ` – ${info.free} زمان آزاد` : '');

          return (
            <button
              key={cell.iso}
              className={cls}
              disabled={disabled}
              onClick={() => onChange?.(cell.iso)}
              title={label}
              aria-label={label}
              aria-pressed={cell.iso === value}
            >
              {toPersianDigits(cell.jd)}
            </button>
          );
        })}
      </div>

      <div className="cal-legend">
        <span><i className="legend-dot" /> ظرفیت آزاد</span>
        <span><i className="legend-dot sel" /> انتخاب‌شده</span>
        <span><i className="legend-dot closed" /> تعطیل / تکمیل</span>
      </div>
    </div>
  );
}
