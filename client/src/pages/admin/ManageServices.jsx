import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useAsync, useApp } from '../../lib/store.jsx';
import { Spinner, Alert, Price, Empty, Input, Select, Sheet, Field, Toggle, Art, Duration } from '../../components/ui.jsx';
import { toPersianDigits } from '@shared/jalali.js';

const BLANK = {
  title: '', description: '', price: 0, duration: 60, categoryId: '',
  icon: '✂️', discountPercent: 0, popular: false, active: true, image: '',
};

const ICONS = ['✂️', '🎨', '✨', '🧴', '🧖‍♀️', '👁️', '💅', '🦶', '💄', '👰', '🌿', '💆‍♀️', '💇‍♀️', '🪮'];

export default function ManageServices() {
  const { toast } = useApp();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const { data, loading, error, reload } = useAsync(() => api.admin.services(), []);
  const { data: catData } = useAsync(() => api.categories(), []);
  const services = data?.services || [];
  const categories = catData?.categories || [];

  const open = (s) => {
    setEditing(s || 'new');
    setForm(s ? { ...BLANK, ...s } : BLANK);
    setErr('');
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.title.trim()) return setErr('عنوان خدمت الزامی است');
    setBusy(true);
    setErr('');
    try {
      if (editing === 'new') {
        await api.admin.createService(form);
        toast('خدمت تازه اضافه شد');
      } else {
        await api.admin.updateService(editing.id, form);
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
    if (!confirm(`خدمت «${s.title}» حذف شود؟`)) return;
    try {
      const res = await api.admin.deleteService(s.id);
      toast(res.message || 'خدمت حذف شد');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h3>خدمات سالن ({toPersianDigits(services.length)})</h3>
          <button className="btn sm" onClick={() => open(null)}>+ افزودن خدمت</button>
        </div>

        <div className="panel-body tight">
          <Alert kind="error">{error}</Alert>
          {loading ? (
            <Spinner />
          ) : services.length === 0 ? (
            <Empty icon="💅" title="هنوز خدمتی ثبت نشده" text="اولین خدمت سالن را اضافه کنید" />
          ) : (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>خدمت</th>
                    <th>دسته</th>
                    <th>قیمت</th>
                    <th>مدت</th>
                    <th>تخفیف</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="row" style={{ gap: 10 }}>
                          <Art item={s} className="row-art" size={38} />
                          <div>
                            <div className="cell-main">
                              {s.title} {s.popular && <span className="badge rose">پرطرفدار</span>}
                            </div>
                            <div className="cell-sub">{(s.description || '').slice(0, 44)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="cell-sub">
                        {categories.find((c) => c.id === s.categoryId)?.title || '—'}
                      </td>
                      <td className="nowrap"><Price amount={s.price} /></td>
                      <td className="nowrap"><Duration minutes={s.duration} /></td>
                      <td>{s.discountPercent ? toPersianDigits(s.discountPercent) + '٪' : '—'}</td>
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
        title={editing === 'new' ? 'افزودن خدمت' : 'ویرایش خدمت'}
        sub="اطلاعات خدمت را کامل کنید"
      >
        <Alert kind="error">{err}</Alert>

        <div className="form-grid">
          <Field label="عنوان خدمت">
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="مثلاً رنگ مو" />
          </Field>

          <Field label="دسته‌بندی">
            <Select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              <option value="">بدون دسته</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.title}</option>
              ))}
            </Select>
          </Field>

          <Field label="قیمت (تومان)">
            <Input
              type="number"
              ltr
              value={form.price}
              onChange={(e) => set('price', Number(e.target.value))}
            />
          </Field>

          <Field label="مدت زمان (دقیقه)" hint="بازه‌های نوبت بر اساس این عدد محاسبه می‌شود">
            <Input
              type="number"
              ltr
              step="15"
              value={form.duration}
              onChange={(e) => set('duration', Number(e.target.value))}
            />
          </Field>

          <Field label="درصد تخفیف">
            <Input
              type="number"
              ltr
              min="0"
              max="100"
              value={form.discountPercent}
              onChange={(e) => set('discountPercent', Number(e.target.value))}
            />
          </Field>

          <Field label="آدرس تصویر (اختیاری)" hint="در صورت خالی بودن، آیکون نمایش داده می‌شود">
            <Input ltr value={form.image} onChange={(e) => set('image', e.target.value)} placeholder="https://..." />
          </Field>

          <div className="full">
            <Field label="توضیحات">
              <Input
                as="textarea"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="توضیح کوتاهی درباره‌ی این خدمت..."
              />
            </Field>
          </div>

          <div className="full">
            <Field label="آیکون">
              <div className="row wrap" style={{ gap: 7 }}>
                {ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => set('icon', i)}
                    style={{
                      width: 42, height: 42, borderRadius: 12, fontSize: 19,
                      background: form.icon === i ? 'var(--rose)' : 'var(--rose-50)',
                      border: '1.5px solid ' + (form.icon === i ? 'var(--rose)' : 'transparent'),
                    }}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>

        <Toggle
          on={form.popular}
          onChange={(v) => set('popular', v)}
          label="نمایش در خدمات پرطرفدار"
          desc="در صفحه‌ی اصلی برنامه‌ی مشتریان نشان داده می‌شود"
        />
        <Toggle
          on={form.active !== false}
          onChange={(v) => set('active', v)}
          label="فعال"
          desc="خدمات غیرفعال قابل رزرو نیستند"
        />

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
