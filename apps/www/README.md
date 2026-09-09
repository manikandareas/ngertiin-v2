# Ngerti.in — landing page

Workspace `@ngertiin/www`: Astro static output, TypeScript, Tailwind v4, light theme,
dan font Nunito/Nunito Sans lokal. Tidak membutuhkan API, database, Clerk, atau React.

Dari root repository:

```sh
bun install --frozen-lockfile
bun dev:www
```

Buka http://localhost:4321. `bun dev` juga menjalankan landing page.
Dari direktori `apps/www`:

```sh
bun run typecheck
bun run build
bun run preview
bun run format:check
```

`build` menghasilkan `dist/`. `preview` menyajikan hasil build pada port 4321.
Root `build` dan `typecheck` mencakup workspace ini secara otomatis.

## Konfigurasi

Salin `.env.example` ke `.env` di direktori ini bila ingin mengganti default.

| Variabel | Default lokal | Kegunaan |
| --- | --- | --- |
| `PUBLIC_APP_URL` | `http://localhost:5173` | Origin aplikasi; CTA menuju `/dashboard`, Masuk menuju `/sign-in` |
| `PUBLIC_SITE_URL` | `http://localhost:4321` | URL deployment landing page untuk canonical dan metadata sosial |
| `PUBLIC_ASSETS_URL` | `https://ngertiin-assets.whoismanik.dev` | Origin aset video dan poster pada bucket R2 `ngertiin-assets` |

Variabel ini dibaca saat build; build ulang setelah mengganti URL. Gunakan URL HTTP(S)
landing page pada root domain/subdomain. Isi URL deployment sebelum build produksi.
Landing page meneruskan pengunjung ke route aplikasi; autentikasi tetap ditangani `apps/web`.

## Sumber visual dan pemeliharaan

- Token light, font, dan primitive tombol bersumber dari `apps/web/src/index.css`
  dan `apps/web/src/components/ui/button.tsx`; salin perubahan relevan secara eksplisit.
- Bentuk node mengikuti `journey-node-item.tsx`; kartu mengikuti `flashcard-activity.tsx`.
- Favicon, identitas sosial, dan maskot disalin dari `apps/web/public`.
- Empat card fitur memakai rekaman produk dari R2 melalui `FeatureVideo.astro`.
  `FeatureVideoDialog.astro` menangani markup dialog dan kontrol;
  `src/scripts/feature-videos.ts` mengatur playback dan interaksi.
  Styling memakai utility Tailwind; aturan rasio, fullscreen, dan perangkat sentuh
  dipusatkan di `src/styles/global.css`. Warna card luar tetap memakai token tema;
  video mempertahankan rasio rekaman.
- Spark Blue/teks putih pada CTA dipertahankan sesuai design system, termasuk kompromi
  kontrasnya. Halaman ini tidak mengklaim kepatuhan WCAG penuh.
- Video memakai poster dan `preload="none"`, diputar tanpa suara saat terlihat,
  lalu dijeda saat hover, keluar viewport, tab tidak aktif, atau popup terbuka.
  Hover menampilkan overlay blur dan tombol “Lihat demo”; pada perangkat sentuh
  tombol selalu terlihat. Klik membuka dialog dengan backdrop blur, rasio asli,
  dan kontrol play/pause, seek, serta fullscreen. Semua video selalu muted.
  Dialog dapat ditutup lewat tombol tutup, backdrop, atau Escape; fokus kembali
  ke preview.
  `prefers-reduced-motion` mematikan autoplay serta entrance/transisi; kontrol
  video tetap dapat digunakan untuk play, seek, dan fullscreen.

### Aset video

Bucket R2 `ngertiin-assets` (APAC, Standard) melayani custom domain
`ngertiin-assets.whoismanik.dev`; public development URL tetap nonaktif.
Cache menggunakan konfigurasi standar Cloudflare (browser TTL 4 jam).
Nama objek berversi; gunakan versi baru saat mengganti konten agar cache lama
tidak menampilkan rekaman sebelumnya.

| Card | Video pada prefix `videos/` | Resolusi |
| --- | --- | --- |
| Alur terstruktur | `create-module-v1.mp4` | 1920 × 1080 |
| Metode belajar aktif | `learning-session-v1.mp4` | 1884 × 1080 |
| Penguatan adaptif | `adaptive-v1.mp4` | 1920 × 1080 |
| Hasil belajar | `attempt-result-v1.mp4` | 1884 × 1080 |

Poster menggunakan nama yang sama dengan ekstensi `.jpg`. Semua video tetap
30 fps dengan durasi utuh. File sumber di `public/videos/` tidak ditimpa;
landing menggunakan URL R2, bukan file sumber tersebut. Astro tetap menyalin
file apa pun di `public/` ke hasil build lokal.

Persiapan aset dari MP4 sumber (ganti `input.mp4` dan `output-v1`):

```sh
# Sumber HEVC: H.264 berkualitas tinggi, tanpa menurunkan resolusi/fps.
ffmpeg -i input.mp4 -map 0:v:0 -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -an -map_metadata -1 -movflags +faststart output-v1.mp4
# Sumber H.264: pertahankan stream video tanpa encode ulang.
ffmpeg -i input.mp4 -map 0:v:0 -c:v copy -an -map_metadata -1 -movflags +faststart output-v1.mp4
# Poster pada resolusi asli.
ffmpeg -ss 0.5 -i output-v1.mp4 -frames:v 1 -q:v 2 output-v1.jpg
```

Catatan verifikasi integrasi sebelum cleanup, 9 September 2026: empat video berhasil dimainkan di Chromium;
viewport 375px tanpa overflow; pause manual dan reduced motion berfungsi.
Endpoint R2 mengembalikan `video/mp4`, byte-range `206`, dan cache `HIT`.
Ukuran total MP4 turun dari 49.02 MB menjadi 28.06 MB. SSIM dua konversi HEVC
sekitar 0.997; dua sumber H.264 memakai stream copy. Safari/iOS belum diuji.

Validasi cleanup: Astro check, build, Prettier, dan Biome lulus. Pengujian browser
setelah cleanup belum dijalankan karena koneksi alat browser gagal.

Biome memeriksa JS/TS, JSON, dan CSS. File `.astro` serta `.astro/` hasil generate
dikecualikan dari Biome karena dukungan template parsial menghasilkan false positive
unused imports/variables; gunakan Astro check dan Prettier dengan plugin Astro.
Root `format` dan `format:check` turut menjalankan formatter Astro.

Konfigurasi mengikuti [dokumentasi styling Astro](https://docs.astro.build/en/guides/styling/)
dan [configuration reference](https://docs.astro.build/en/reference/configuration-reference/).

## Verifikasi review — 8 September 2026

- PASS: typecheck dan build seluruh workspace; Astro check tanpa error/warning/hint.
- PASS: `bun format:check`, lint Biome pada file perubahan,
  `bun install --frozen-lockfile`, dan `git diff --check`.
- PASS: build dengan `.env` untuk mode khusus menghasilkan CTA, canonical, dan image
  sosial sesuai konfigurasi. Build default lokal sudah dikembalikan.
- PASS: Chromium lokal pada 375/768/1440px tanpa overflow; hamburger buka/tutup,
  Escape mengembalikan focus, tautan menutup menu dan memindahkan focus ke section,
  tujuan CTA sesuai, reduced motion mematikan animasi, tanpa page error.
- Root `bun lint` masih gagal pada dua error title SVG lama di
  `apps/web/public/favicon.svg` (serta warning/info file lama).
- NOT RUN: autentikasi Clerk end-to-end, browser lain, deployment, unit/integration test.

## Struktur

`Navigation` menyusun header desktop dan `MobileNavigation` memiliki disclosure,
style, dan perilaku keyboard mobile. `Footer` memakai daftar tautan yang sama dari
`lib/links.ts`. Setiap preview, Brand, dan Button memiliki scoped CSS sendiri.
`styles/theme.css` menyimpan token yang dipakai, `styles/previews.css` hanya style
bersama preview, dan `styles/global.css` menyimpan fondasi serta layout halaman.
Section konten tetap berada di `pages/index.astro` agar mudah diedit.
