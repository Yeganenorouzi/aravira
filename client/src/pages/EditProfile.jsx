import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { TopBar, Field, Input, Select, Alert } from '../components/ui.jsx';
import {
  toJalali, toGregorianISO, jalaliMonthLength, MONTHS_FA, toPersianDigits, todayISO,
} from '@shared/jalali.js';

/** انتخاب تاریخ تولد به شمسی (سال / ماه / روز) */
function BirthdayPicker({ value, onChange }) {
  const parsed = value ? toJalali(value) : null;
  const [jy, setJy] = useState(parsed?.jy || '');
  const [jm, setJm] = useState(parsed?.jm || '');
  const [jd, setJd] = useState(parsed?.jd || '');

  const thisYear = toJalali(todayISO()).jy;
  const years = Array.from({ length: 80 }, (_, i) => thisYear - 10 - i);
  const maxDay = jy && jm ? jalaliMonthLength(Number(jy), Number(jm)) : 31;

  const push = (y, m, d) => {
    if (y && m && d) {
      const day = Math.min(Number(d), jalaliMonthLength(Number(y), Number(m)));
      onChange(toGregorianISO(Number(y), Number(m), day));
    } else {
      onChange('');
    }
  };

  return (
    <div className="row" style={{ gap: 8 }}>
      <Select
        value={jy}
        onChange={(e) => { setJy(e.target.value); push(e.target.value, jm, jd); }}
      >
        <option value="">سال</option>
        {years.map((y) => (
          <option key={y} value={y}>{toPersianDigits(y)}</option>
        ))}
      </Select>
      <Select
        value={jm}
        onChange={(e) => { setJm(e.target.value); push(jy, e.target.value, jd); }}
      >
        <option value="">ماه</option>
        {MONTHS_FA.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </Select>
      <Select
        value={jd}
        onChange={(e) => { setJd(e.target.value); push(jy, jm, e.target.value); }}
      >
        <option value="">روز</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>{toPersianDigits(d)}</option>
        ))}
      </Select>
    </div>
  );
}

export default function EditProfile() {
  const nav = useNavigate();
  const { user, setUser, toast } = useApp();

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    birthday: user?.birthday || '',
    gender: user?.gender || '',
    address: user?.address || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.updateProfile(form);
      setUser(res.user);
      toast('اطلاعات شما ذخیره شد');
      nav('/profile');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <TopBar title="ویرایش اطلاعات" />

      <form className="screen-body" onSubmit={save}>
        <Alert kind="error">{error}</Alert>

        <Field label="نام و نام خانوادگی">
          <Input icon="👤" value={form.name} onChange={set('name')} placeholder="نام شما" />
        </Field>

        <Field label="شماره موبایل" hint="برای تغییر شماره با پشتیبانی سالن تماس بگیرید">
          <Input icon="📱" ltr value={toPersianDigits(user?.phone || '')} disabled />
        </Field>

        <Field label="ایمیل" hint="برای دریافت تأییدیه و یادآوری نوبت از طریق ایمیل">
          <Input icon="✉️" ltr type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
        </Field>

        <Field label="تاریخ تولد" hint="برای دریافت هدیه و تخفیف تولد 🎂">
          <BirthdayPicker
            value={form.birthday}
            onChange={(iso) => setForm((f) => ({ ...f, birthday: iso }))}
          />
        </Field>

        <Field label="جنسیت">
          <Select icon="⚧" value={form.gender} onChange={set('gender')}>
            <option value="">انتخاب نشده</option>
            <option value="female">خانم</option>
            <option value="male">آقا</option>
          </Select>
        </Field>

        <Field label="آدرس (اختیاری)">
          <Input as="textarea" icon="📍" value={form.address} onChange={set('address')} placeholder="آدرس شما" />
        </Field>

        <button className="btn mt-8" disabled={busy}>
          {busy ? <span className="spinner sm on-dark" /> : 'ذخیره‌ی تغییرات'}
        </button>
      </form>
    </div>
  );
}
