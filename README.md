# lrdxg — photo portfolio

Статический сайт на [Astro](https://astro.build). Фотки лежат прямо в репозитории, сайт собирается сам при каждом пуше.

## Как добавить фотки (главное)

**Новая серия:**

```bash
npm run new-series "Tokyo Nights"
```

Создастся `src/series/tokyo-nights/series.yml`. Кидаешь туда же `.jpg` — всё.

**Без терминала:** на GitHub открываешь `src/series/<серия>/` → *Add file → Upload files* → перетаскиваешь фотки → *Commit*. Через ~1 минуту они на сайте.

### Что происходит автоматически
- **Порядок фоток** — по имени файла (`01.jpg`, `02.jpg`, … или как Lightroom назвал).
- **Цвет фона серии** — средний цвет всех её фоток, считается при сборке. Цвет текста (чёрный/белый) подбирается под контраст.
- **Подписи** (название, описание, локация) — берутся из метаданных файла. В Lightroom заполни в панели *Metadata*: **Title**, **Caption**, **Sublocation / City / Country** — и экспортируй с *Include: All Metadata* (или хотя бы *Copyright & Contact Info* + IPTC).
- **Ресайз и WebP** — Astro сам делает несколько размеров. Экспортируй из Lightroom JPEG ~3000px по длинной стороне, качество 85.

### Если хочется руками — `series.yml`

```yaml
title: Tokyo Nights
description: Night walks through wet streets.
year: 2025
order: 1            # порядок в меню
cover: 03.jpg       # обложка на главной (по умолчанию первая)
# color: "#3a1020"  # перебить авто-цвет фона
# hidden: true      # спрятать серию

photos:             # перебивает метаданные из файла
  03.jpg:
    title: Crosswalk
    description: The light turned red just as the rain started.
    location: Shibuya, Tokyo
```

About — в `src/content/about.md`.

Ссылка на конкретную фотку: `/series/tokyo-nights/#3`.

## Локально

```bash
npm install
npm run dev        # http://localhost:4321
```


## Деплой (один раз, ~10 минут)

Рекомендую **Cloudflare Pages**: бесплатно, без лимита трафика (важно для фоток), свой домен с HTTPS.

1. Создай репозиторий на GitHub и запушь проект.
2. Cloudflare dashboard → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → выбери репозиторий.
3. Настройки сборки:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Output directory: `dist`
   - Environment variable: `NODE_VERSION` = `22`
4. *Save and Deploy*. Сайт будет на `<project>.pages.dev`; домен подключается в *Custom domains*.
5. Поменяй `site` в `astro.config.mjs` на итоговый адрес (для превью-ссылок в соцсетях).

Если Cloudflare предлагает **Workers** вместо Pages — тоже ок: Build command `npm run build`, Deploy command `npx wrangler deploy` (конфиг уже лежит в `wrangler.jsonc`).

Дальше каждый пуш в `main` = автодеплой. Откат — *Deployments → Rollback* в Cloudflare или `git revert`.

Альтернативы с тем же сценарием: Netlify, Vercel (у обоих меньше бесплатного трафика).

### Про хранение
Фотки в git — нормально до ~1–2 ГБ (это сотни снимков по 2–3 МБ). Если когда-нибудь упрёшься — оригиналы можно вынести в Cloudflare R2, но сейчас это лишнее.
