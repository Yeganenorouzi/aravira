import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useAsync } from '../lib/store.jsx';
import { Art, Price, Duration, Skeleton, Empty, Input } from '../components/ui.jsx';
import { toPersianDigits } from '@shared/jalali.js';

export default function Explore() {
  const nav = useNavigate();
  const { setBooking } = useApp();
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');

  const { data: catData } = useAsync(() => api.categories(), []);
  const { data, loading } = useAsync(() => api.services(), []);

  const services = useMemo(() => {
    let list = data?.services || [];
    if (cat !== 'all') list = list.filter((s) => s.categoryId === cat);
    if (q.trim()) {
      const needle = q.trim();
      list = list.filter((s) => s.title.includes(needle) || (s.description || '').includes(needle));
    }
    return list;
  }, [data, cat, q]);

  const open = (service) => {
    setBooking({ serviceId: service.id, service, staffId: null, date: null, time: null });
    nav('/service/' + service.id);
  };

  const categories = [{ id: 'all', title: 'همه', icon: '✨' }, ...(catData?.categories || [])];

  return (
    <div className="screen">
      <div className="topbar">
        <span style={{ width: 40 }} />
        <h1>
          خدمات ما
          <span className="sub">{toPersianDigits(services.length)} خدمت موجود</span>
        </h1>
        <span style={{ width: 40 }} />
      </div>

      <div className="screen-body">
        <Input
          icon="🔍"
          placeholder="جستجوی خدمات..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="chips mt-12">
          {categories.map((c) => (
            <button
              key={c.id}
              className={'chip' + (cat === c.id ? ' on' : '')}
              onClick={() => setCat(c.id)}
            >
              {c.icon} {c.title}
            </button>
          ))}
        </div>

        <div className="mt-16">
          {loading ? (
            [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={82} />)
          ) : services.length === 0 ? (
            <Empty
              icon="🔍"
              title="خدمتی پیدا نشد"
              text="عبارت دیگری را جستجو کنید یا دسته‌بندی را تغییر دهید"
              action={
                <button className="btn soft" onClick={() => { setQ(''); setCat('all'); }}>
                  نمایش همه‌ی خدمات
                </button>
              }
            />
          ) : (
            services.map((s) => (
              <div key={s.id} className="service-row" onClick={() => open(s)}>
                <Art item={s} />
                <div className="info">
                  <div className="title">{s.title}</div>
                  <div className="desc">{s.description}</div>
                  <div className="meta">
                    <span className="amount">
                      <Price amount={Math.round(s.price * (1 - (s.discountPercent || 0) / 100))} />
                    </span>
                    {s.discountPercent > 0 && (
                      <span className="badge rose">{toPersianDigits(s.discountPercent)}٪ تخفیف</span>
                    )}
                    <span>⏱ <Duration minutes={s.duration} /></span>
                  </div>
                </div>
                <button
                  className="book-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    open(s);
                  }}
                >
                  رزرو
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
