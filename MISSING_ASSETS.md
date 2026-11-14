# Yetishmayotgan rasmlar (Orbi dizayni)

Hozircha faqat `orbi-idle` va `orbi-score` bor. Qolganlari yo'q, shuning uchun:
- yetishmayotgan **pozalar** o'rniga `orbi-idle` ko'rsatiladi;
- yetishmayotgan **fonlar** o'rniga CSS gradient turadi.

Rasm qo'shish uchun kodni o'zgartirish shart emas:
1. Manba PNG'larni `public/companion/` (pozalar) yoki `public/bg/` (fonlar) ichiga qo'ying.
2. `node scripts/prepare-assets.mjs` ni ishga tushiring (WebP/AVIF va `manifest.json` yaratiladi).
3. Hosil bo'lgan fayllarni commit qiling (manba PNG'lar `.gitignore` da).

## Pozalar → `public/companion/`
| Fayl | Qayerda ishlatiladi | Hozir |
|---|---|---|
| `orbi-wave.png` | Hero, `/auth`, uyg'onganda | `orbi-idle` |
| `orbi-think.png` | USLUB bo'limi, 404 sahifa | `orbi-idle` |
| `orbi-study.png` | FANLAR bo'limi, fan sahifalari | `orbi-idle` |
| `orbi-celebrate.png` | NATIJALAR, FIKRLAR | `orbi-idle` |
| `orbi-point.png` | NEGA UFQ, NARX, oxirgi chaqiriq | `orbi-idle` |
| `orbi-tea.png` | Footer | `orbi-idle` |
| `orbi-sleep.png` | 45 soniya harakatsizlikdan keyin | `orbi-idle` |

## Fonlar → `public/bg/`
| Fayl | Qayerda ishlatiladi | Hozir |
|---|---|---|
| `bg-hero.png` (+ `bg-hero-mobile.png`) | Hero | iliq gradient |
| `bg-study.png` (+ mobile) | USLUB | qum rangli gradient |
| `bg-sky.png` (+ mobile) | FANLAR | osmon gradienti |
| `bg-results.png` (+ mobile) | FIKRLAR | shafaq gradienti |
| `bg-night.png` (+ mobile) | Oxirgi chaqiriq | lapis → qora gradient + yulduzlar |
| `bg-auth.png` (+ mobile) | `/auth` | lapis gradient |
| `podium.png` | Hero'dagi Orbi tagida | CSS bilan chizilgan podium |
| `pattern-tile.png` | (ixtiyoriy) girih naqshi | o'zim chizgan SVG naqsh |

`bg-auth` va `pattern-tile` hozircha kodda ulanmagan: `/auth` oynasi gradient bilan ishlaydi, naqsh esa ichki SVG.
