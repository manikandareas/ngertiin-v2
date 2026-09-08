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

Keduanya dibaca saat build; build ulang setelah mengganti URL. Gunakan URL HTTP(S)
landing page pada root domain/subdomain. Isi URL deployment sebelum build produksi.
Landing page meneruskan pengunjung ke route aplikasi; autentikasi tetap ditangani `apps/web`.

## Sumber visual dan pemeliharaan

- Token light, font, dan primitive tombol bersumber dari `apps/web/src/index.css`
  dan `apps/web/src/components/ui/button.tsx`; salin perubahan relevan secara eksplisit.
- Bentuk node mengikuti `journey-node-item.tsx`; kartu mengikuti `flashcard-activity.tsx`.
- Favicon, identitas sosial, dan maskot disalin dari `apps/web/public`.
- Seluruh preview memakai contoh Ekosistem dan ditandai **Contoh**. Tidak interaktif.
- Spark Blue/teks putih pada CTA dipertahankan sesuai design system, termasuk kompromi
  kontrasnya. Halaman ini tidak mengklaim kepatuhan WCAG penuh.
- Motion hanya entrance hero dan feedback tombol. Entrance/transisi dinonaktifkan
  mengikuti `prefers-reduced-motion`.

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
