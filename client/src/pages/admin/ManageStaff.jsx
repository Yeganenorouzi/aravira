import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useAsync, useApp } from '../../lib/store.jsx';
import { Spinner, Alert, Empty, Input, Sheet, Field, Toggle } from '../../components/ui.jsx';
import { toPersianDigits, WEEKDAYS_FA } from '@shared/jalali.js';

const BLANK = {
  name: '', title: 'آرایشگر', avatar: '👩', bio: '', rating: 5, reviews: 0,
  serviceIds: [], offDays: [6], shift: { open: '09:00', close: '20:00' }, active: true,
};

const AVATARS = ['👩', '👩‍🦰', '👱‍♀️', '🧕', '💃', '👩‍🦱', '👨', '🧑'];

export default function ManageStaff() {
  const { toast } = useApp();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const { data, loading, error, reload } = useAsync(() => api.admin.staff(), []);
  const { data: srvData } = useAsync(() => api.admin.services(), []);
  const staff = data?.staff || [];
  const services = (srvData?.services || []).filter((s) => s.active !== false);

  const open = (s) => {
    setEditing(s || 'new');
    setForm(s ? { ...BLANK, ...s, shift: s.shift || BLANK.shift } : BLANK);
    setErr('');
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleIn = (key, value) =>
    setForm((f) => {
      const list = f[key] || [];
      return { ...f, [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] };
    });

  async function save() {
    if (!form.name.trim()) return setErr('نام آرایشگر الزامی است');
    setBusy(true);
    setErr('');
    try {
      if (editing === 'new') {
        await api.admin.createStaff(form);
        toast('آرایشگر تازه اضافه شد');
      } else {
        await api.admin.updateStaff(editing.id, form);
        toast('تغییرات ذخیره شد');
      }
      setEditing(null);
      reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(s) {
    if (!confirm(`«${s.name}» حذف شود؟`)) return;
    try {
      const res = await api.admin.deleteStaff(s.id);
      toast(res.message || 'آرایشگر حذف شد');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h3>پرسنل سالن ({toPersianDigits(staff.length)})</h3>
          <button className="btn sm" onClick={() => open(null)}>+ افزودن آرایشگر</button>
        </div>

        <div className="panel-body tight">
          <Alert kind="error">{error}</Alert>
          {loading ? (
            <Spinner />
          ) : staff.length === 0 ? (
            <Empty icon="👩‍🎨" title="هنوز پرسنلی ثبت نشده" text="برای فعال شدن رزرو، حداقل یک آرایشگر اضافه کنید" />
          ) : (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>آرایشگر</th>
                    <th>خدمات</th>
                    <th>شیفت</th>
                    <th>روزهای تعطیل</th>
                    <th>امتیاز</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="row" style={{ gap: 10 }}>
                          <div className="avatar sm">{s.avatar || '👩'}</div>
                          <div>
                            <div className="cell-main">{s.name}</div>
                            <div className="cell-sub">{s.title}</div>
                          </div>
                        </div>
                      </td>
                      <td className="cell-sub">
                        {s.serviceIds?.length
                          ? `${toPersianDigits(s.serviceIds.length)} خدمت`
                          : 'همه‌ی خدمات'}
                      </td>
                      <td className="nowrap cell-sub">
                        {s.shift ? `${toPersianDigits(s.shift.open)} – ${toPersianDigits(s.shift.close)}` : 'ساعات سالن'}
                      </td>
                      <td className="cell-sub">
                        {s.offDays?.length ? s.offDays.map((d) => WEEKDAYS_FA[d]).join('، ') : '—'}
                      </td>
                      <td className="nowrap">⭐ {toPersianDigits(s.rating)}</td>
                      <td>
                        <span className={'badge ' + (s.active !== false ? 'confirmed' : 'canceled')}>
                          {s.active !== false ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="nowrap">
                        <div className="row" style={{ gap: 6 }}>
                          <button className="btn xs soft" onClick={() => open(s)}>ویرایش</button>
                          <button className="btn xs danger" onClick={() => remove(s)}>حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Sheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'افزودن آرایشگر' : 'ویرایش آرایشگر'}
        sub="برنامه‌ی کاری و خدمات قابل ارائه را مشخص کنید"
      >
        <Alert kind="error">{err}</Alert>

        <div className="form-grid">
          <Field label="نام و نام خانوادگی">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="مثلاً سارا جوادی" />
          </Field>
          <Field label="تخصص">
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="مثلاً متخصص رنگ و مو" />
          </Field>
          <Field label="شروع شیفت">
            <Input
              ltr
              type="time"
              value={form.shift?.open || '09:00'}
              onChange={(e) => set('shift', { ...form.shift, open: e.target.value })}
            />
          </Field>
          <Field label="پایان شیفت">
            <Input
              ltr
              type="time"
              value={form.shift?.close || '20:00'}
              onChange={(e) => set('shift', { ...form.shift, close: e.target.value })}
            />
          </Field>
          <Field label="امتیاز">
            <Input
              ltr
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={form.rating}
              onChange={(e) => set('rating', Number(e.target.value))}
            />
          </Field>
          <Field label="تعداد نظرات">
            <Input ltr type="number" value={form.reviews} onChange={(e) => set('reviews', Number(e.target.value))} />
          </Field>

          <div className="full">
            <Field label="معرفی کوتاه">
              <Input as="textarea" value={form.bio} onChange={(e) => set('bio', e.target.value)} />
            </Field>
          </div>
        </div>

        <Field label="آواتار">
          <div className="row wrap" style={{ gap: 7 }}>
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => set('avatar', a)}
                style={{
                  width: 42, height: 42, borderRadius: '50%', fontSize: 19,
                  background: form.avatar === a ? 'var(--rose)' : 'var(--rose-50)',
                  border: '1.5px solid ' + (form.avatar === a ? 'var(--rose)' : 'transparent'),
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </Field>

        <Field label="روزهای تعطیل" hint="در این روزها نوبتی برای این آرایشگر باز نمی‌شود">
          <div className="row wrap" style={{ gap: 6 }}>
            {WEEKDAYS_FA.map((d, i) => (
              <button
                key={d}
                type="button"
                className={'chip' + (form.offDays?.includes(i) ? ' on' : '')}
                onClick={() => toggleIn('offDays', i)}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>

        <Field label="خدمات قابل ارائه" hint="اگر هیچ‌کدام انتخاب نشود، همه‌ی خدمات در نظر گرفته می‌شود">
          <div className="row wrap" style={{ gap: 6 }}>
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                className={'chip' + (form.serviceIds?.includes(s.id) ? ' on' : '')}
                onClick={() => toggleIn('serviceIds', s.id)}
              >
                {s.icon} {s.title}
              </button>
            ))}
          </div>
        </Field>

        <Toggle on={form.active !== false} onChange={(v) => set('active', v)} label="فعال" desc="آرایشگر غیرفعال در فهرست رزرو نمایش داده نمی‌شود" />

        <div className="btn-row mt-16">
          <button className="btn soft" onClick={() => setEditing(null)}>انصراف</button>
          <button className="btn" onClick={save} disabled={busy}>
            {busy ? <span className="spinner sm on-dark" /> : 'ذخیره'}
          </button>
        </div>
      </Sheet>
    </>
  );
}
