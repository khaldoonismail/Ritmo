# Ritmo

مشروع Next.js لمنصة "ريتمو"، ويحتوي على ثلاثة أقسام رئيسية:

- `academy/` — قسم الأكاديمية
- `games/` — قسم الألعاب
- `accounts/` — قسم الحسابات

## التشغيل محليًا

```bash
npm install
npm run dev
```

ثم افتح [http://localhost:3000](http://localhost:3000) في المتصفح.

## وضع "قيد التطوير" (Maintenance Mode)

عن طريق `middleware.ts`، تظهر صفحة `app/maintenance` لكل الزوار بدل محتوى الموقع، وكل مسارات `/api` ترجع 503.

| متغير البيئة | الوظيفة |
|---|---|
| `MAINTENANCE_MODE=true` | يفعّل صفحة "Coming Soon" |
| `MAINTENANCE_BYPASS_SECRET=<قيمة سرية>` | يسمح لك تتجاوز الصفحة |

- **للتجاوز:** افتح أي رابط بالموقع مع `?preview=<القيمة السرية>` مرة وحدة، ويتحفظ cookie في متصفحك لمدة 90 يوم.
- **لإلغاء التجاوز من متصفحك:** `?preview=off`
- **للإطلاق الرسمي:** خلّ `MAINTENANCE_MODE=false` (أو احذفه) وسوّ redeploy. ما يحتاج تحذف أي ملف.
