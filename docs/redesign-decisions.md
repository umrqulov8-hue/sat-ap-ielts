# Orbi redesign: qarorlar (`redesign-orbi-v2`)

- Stack: loyiha React + Vite + oddiy CSS (TypeScript va Tailwind yo'q). Stack o'zgartirilmadi; dizayn tokenlari `src/styles/orbi.css` da CSS o'zgaruvchilari (`--ob-*`) sifatida, eski dashboard CSS bilan to'qnashmasligi uchun prefiks bilan.
- `motion` va `lenis` qo'shilmadi: barcha animatsiya CSS + IntersectionObserver bilan, silliq aylantirish brauzerning o'z `scroll-behavior`i bilan (reduced-motion'da o'chadi). Yangi dependency faqat `sharp` (devDependency, rasm tayyorlash uchun).
- Landing `Home.jsx` noldan yozildi; eski `useScrollReveal`/`useHeroParallax` hooklari Home'da ishlatilmaydi (boshqa sahifalar uchun qoldi).
- Shriftlar: Baloo 2 (sarlavha/raqam) va Nunito (matn). Ikkalasida ham `ʻ` (U+02BB) o'z glifi bor (brauzerda o'lchab tekshirildi). Nunito'dagi `ʻ` kengroq chiqadi; shrift almashtirilmadi.
- Yangi matnlarda `oʻ`/`gʻ` uchun U+02BB ishlatildi; apostrof `'` faqat "Ma'lumotlar", "Algebra'da" kabi tutuq belgisida qoldi.
- "ekzotik tayyorlov platformamiz" → "zamonaviy tayyorlov platformamiz".
- Faqat `orbi-idle` va `orbi-score` mavjud: boshqa pozalar `orbi-idle`ga qaytadi (manifest orqali aniqlanadi, kod o'zgarishi shart emas). Fonlar o'rniga gradient; ro'yxat `MISSING_ASSETS.md` da.
- Companion `data-orbi` bo'limini ekran o'rtasidagi bo'lim bo'yicha tanlaydi (IntersectionObserver emas): telefonda baland bo'limlarda ratio hech qachon 0.4 ga yetmaydi.
- Companion hero va oxirgi chaqiriq bo'limida yashirinadi (u yerda katta Orbi bor); oxirgi chaqiriqdagi "Qani, boshladik!" katta Orbi yonida statik pufak sifatida turadi.
- Companion tugma/havolaga to'g'ri kelsa 96px yuqoriga ko'tariladi.
- NARX: eski saytda alohida bo'lim yo'q edi (PRO kartasi "Empower" ichida). Yangi bo'lim ochildi, narx ko'rsatilmadi (eski saytda ham yo'q).
- Eski "unitap-*" stillari qoldi: `/auth` oynasi va boshqa sahifalar hali ularni ishlatadi. `/auth` ularning ustidan `ob-auth` qatlami bilan qayta bezatildi.
- Fan sahifalarida tepaga fan rangidagi band qo'shildi (o'zbekcha + inglizcha nom); sahifaning qolgan mantiqi o'zgarmadi.
- Auth logikasi, ma'lumot yuklash, formalar, testlar o'zgarmadi.
