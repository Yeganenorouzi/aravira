/** اجزای مشترک رابط کاربری */
import { useEffect, useRef, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../lib/store.jsx';
import { toPersianDigits, formatMoney } from '@shared/jalali.js';

/* ---------- آیکون‌ها ----------
   از SVG استفاده می‌کنیم چون نویسه‌هایی مثل ‹ › در متن راست‌چین
   به‌صورت خودکار وارونه می‌شوند و جهتشان قابل اتکا نیست. */

export function Chevron({ dir = 'right', size = 17 }) {
  const paths = {
    right: 'M9 5l7 7-7 7',
    left: 'M15 5l-7 7 7 7',
    up: 'M5 15l7-7 7 7',
    down: 'M19 9l-7 7-7-7',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <path d={paths[dir]} />
    </svg>
  );
}

/* ---------- سربرگ ---------- */

export function TopBar({ title, sub, onBack, back = true, left = null, white = false }) {
  const nav = useNavigate();
  return (
    <div className={'topbar' + (white ? ' on-white' : '')}>
      {back ? (
        <button className="icon-btn" onClick={onBack || (() => nav(-1))} aria-label="بازگشت">
          <Chevron dir="right" />
        </button>
      ) : (
        <span style={{ width: 40 }} />
      )}
      <h1>
        {title}
        {sub && <span className="sub">{sub}</span>}
      </h1>
      {left || <span style={{ width: 40 }} />}
    </div>
  );
}

/* ---------- حالت‌ها ---------- */

export function Spinner({ className = '' }) {
  return <div className={'spinner ' + className} role="status" aria-label="در حال بارگذاری" />;
}

export function Empty({ icon = '🌸', title, text, action }) {
  return (
    <div className="empty">
      <div className="ico">{icon}</div>
      <div className="ttl">{title}</div>
      {text && <div className="txt">{text}</div>}
      {action}
    </div>
  );
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  const icons = { error: '⚠️', ok: '✓', info: 'ℹ️', warn: '⚠️' };
  return (
    <div className={'alert ' + kind} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{icons[kind]}</span>
      <span>{children}</span>
    </div>
  );
}

export function Skeleton({ h = 70, mb = 11, style }) {
  return <div className="skeleton" style={{ height: h, marginBottom: mb, ...style }} />;
}

/* ---------- پیام‌های شناور ---------- */

export function ToastHost() {
  const { toasts } = useApp();
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={'toast ' + t.kind}>
          <span>{t.kind === 'error' ? '✕' : '✓'}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- پنجره‌ی کشویی ---------- */

export function Sheet({ open, onClose, title, sub, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        {title && <h3>{title}</h3>}
        {sub && <div className="sheet-sub">{sub}</div>}
        {children}
      </div>
    </div>
  );
}

/* ---------- ورودی‌ها ---------- */

export function Field({ label, hint, error, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {error ? <div className="err">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { icon, invalid, ltr, as = 'input', wrapClass = '', className = '', ...props },
  ref
) {
  const Tag = as;
  return (
    <div className={'input-wrap' + (invalid ? ' invalid' : '') + (wrapClass ? ' ' + wrapClass : '')}>
      {icon && <span className="lead">{icon}</span>}
      <Tag ref={ref} className={[ltr ? 'ltr' : '', className].filter(Boolean).join(' ')} {...props} />
    </div>
  );
});

export const Select = forwardRef(function Select({ icon, children, ...props }, ref) {
  return (
    <div className="input-wrap">
      {icon && <span className="lead">{icon}</span>}
      <select ref={ref} {...props}>{children}</select>
    </div>
  );
});

export function Toggle({ on, onChange, label, desc }) {
  return (
    <div className="switch">
      <div>
        <div className="label">{label}</div>
        {desc && <div className="desc">{desc}</div>}
      </div>
      <button
        type="button"
        className={'toggle' + (on ? ' on' : '')}
        onClick={() => onChange(!on)}
        role="switch"
        aria-checked={on}
        aria-label={label}
      />
    </div>
  );
}

/* ---------- نشان وضعیت نوبت ---------- */

export const STATUS_LABELS = {
  pending: 'در انتظار تأیید',
  confirmed: 'تأیید شده',
  done: 'انجام شده',
  canceled: 'لغو شده',
  noshow: 'عدم مراجعه',
};

export function StatusBadge({ status }) {
  return <span className={'badge ' + status}>{STATUS_LABELS[status] || status}</span>;
}

/* ---------- قیمت ---------- */

export function Price({ amount, currency, className = '' }) {
  const { currency: c } = useApp();
  return (
    <span className={className}>
      {formatMoney(amount)} <small>{currency || c}</small>
    </span>
  );
}

/* ---------- آرت‌ورک خدمت (گرادیان + آیکون یا تصویر) ---------- */

export function Art({ item, className = 'row-art', size }) {
  const style = { background: item?.gradient || 'var(--rose-100)' };
  if (size) { style.width = size; style.height = size; }
  if (item?.image) {
    return (
      <div
        className={className}
        style={{ ...style, backgroundImage: `url(${item.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
    );
  }
  return (
    <div className={className} style={style}>
      <span style={{ filter: item?.gradient ? 'drop-shadow(0 1px 2px rgba(0,0,0,.25))' : 'none' }}>
        {item?.icon || '🌸'}
      </span>
    </div>
  );
}

/* ---------- مدت زمان ---------- */

export function Duration({ minutes }) {
  const m = Number(minutes) || 0;
  if (m < 60) return <>{toPersianDigits(m)} دقیقه</>;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return <>{toPersianDigits(h)} ساعت{rest ? ` و ${toPersianDigits(rest)} دقیقه` : ''}</>;
}

/* ---------- تمرکز خودکار روی ورودی ---------- */

export function useAutoFocus(enabled = true) {
  const ref = useRef(null);
  useEffect(() => {
    if (enabled) setTimeout(() => ref.current?.focus(), 120);
  }, [enabled]);
  return ref;
}
