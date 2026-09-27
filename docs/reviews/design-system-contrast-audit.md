# Review kontras design system — 27 September 2026

Status: masih ada penyesuaian sebelum finalisasi. Review ini tidak mengubah implementasi.

## Ruang lingkup dan bukti

- Membaca seluruh 18 primitive di `apps/web/src/components/ui`, token light/dark, dan pemakaian pada quiz node/practice.
- Memeriksa computed styles di browser pada `/design-system`: primary button/badge, checkbox checked/indeterminate, radio, tab aktif, input, progress, feedback salah, destructive dark, dan option Select yang fokus.
- Menghitung luminansi relatif sRGB dari token dan warna efektif, termasuk compositing alpha untuk hover destructive dan feedback. Nilai ditampilkan dengan pembulatan; keputusan lulus menggunakan nilai sebelum pembulatan.
- Halaman referensi tidak overflow horizontal pada viewport 375 px.
- Ini bukan audit WCAG seluruh aplikasi atau pengujian alur authenticated/provider. Tidak menjalankan ulang build karena review tidak mengubah kode aplikasi.

Acuan: [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) dan [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Teks biasa minimal 4.5:1; indikator/batas kontrol yang diperlukan minimal 3:1. Label tombol 13–14 px tidak termasuk large text. Disabled controls dan separator/border dekoratif tidak otomatis wajib memenuhi angka tersebut.

## Temuan yang perlu diselesaikan

### P1 — Primary foreground terlalu terang

Lokasi: `index.css:24`, `ui/button.tsx:12`, `ui/badge.tsx:11`, `ui/checkbox.tsx:12`, `ui/input.tsx:10`.

Putih pada Spark Blue `#1CB0F6` hanya **2.445:1** di kedua mode; hover `#48BFF8` menjadi **2.083:1**. Dampaknya mencakup button, badge, centang checkbox, dan selection teks input. Checked checkbox juga membutuhkan indikator yang kontras.

Rekomendasi: pertahankan Spark Blue dan gunakan Night Ink `#000437` sebagai primary foreground: **8.009:1**, hover **9.401:1**. Audit pemakaian primary foreground pada surface khusus seperti usage banner sebelum menerapkan token global.

### P1 — Destructive solid dan hover belum aman

Lokasi: `index.css:197`, `ui/button.tsx:18`, `ui/badge.tsx:13`.

Dark: teks putih pada coral `#FF526C` hanya **3.146:1**; hover /90 pada background halaman sekitar **3.696:1**. Light: default **4.661:1**, tetapi hover /90 turun ke **4.200:1** karena background menjadi lebih pucat.

Rekomendasi: tetap gunakan teks putih sesuai preferensi pengguna. Gunakan fill raspberry/coral yang lebih dalam untuk aksi solid, serta token hover opaque yang tidak memucatkan fill. Jangan langsung menggelapkan satu token destructive global: token yang sama juga digunakan sebagai teks error pada surface gelap. Pisahkan pasangan solid dan feedback agar keduanya aman.

### P1 — Batas form control terlalu samar

Lokasi: `index.css:47`, `index.css:190`; `ui/input.tsx`, `ui/textarea.tsx`, `ui/checkbox.tsx`, `ui/radio-group.tsx`, `ui/select.tsx`.

Token input light `#AFAFAF` terhadap halaman hanya **2.122:1** dan terhadap card **2.193:1**. Dark `#595959` terhadap halaman **2.407:1**, terhadap popover **2.160:1**. Input/textarea default memiliki background transparan sehingga batas ini penting untuk mengenali area kontrol.

Rekomendasi: sesuaikan `--input`, bukan `--border` global. Kandidat awal: light `#858585` (**3.570:1** terhadap halaman), dark `#7D7D7D` (**3.676:1** terhadap popover). Validasi juga fill campuran `dark:bg-input/30` pada checkbox/select. Separator dan border card yang dekoratif boleh tetap lembut.

### P1 — Warna brand dipakai sebagai teks dan indikator kecil pada light

Lokasi: `ui/tabs.tsx:17`, `ui/radio-group.tsx:13`, `ui/progress.tsx:20`, `ui/field.tsx:137`; pemakaian terkait di `features/sources/source-pdf-toolbar.tsx:38`.

Tab aktif dan titik radio menggunakan primary terhadap halaman: **2.365:1**. Progress fill terhadap muted track: **2.282:1**. FieldDescription mengubah link menjadi primary saat hover. Nomor halaman PDF menggunakan primary pada primary/10, sekitar **2.166:1**.

Rekomendasi: pakai `link` untuk teks/tab dan hover link; pakai warna indikator solid yang memenuhi 3:1 seperti `ring` untuk titik radio dan progress. Biarkan primary sebagai warna fill/dekorasi brand. Dark primary pada background sudah **6.896:1**; koreksi harus memperhatikan peran token, bukan sekadar mengganti semua primary.

### P1 — Feedback salah light belum memenuhi kontras teks

Lokasi: `features/modules/components/assessment-activity.tsx:55`, `features/practice/components/practice-quiz-result-question.tsx:31` dan `:97`.

`bg-destructive/10 text-destructive` pada halaman light menghasilkan sekitar **3.878:1**, walaupun destructive pada background halaman tanpa tint mencapai **4.509:1**. Dampaknya pada label salah, penjelasan, dan teks jawabanmu di review.

Rekomendasi: pasangan semantic untuk surface error lembut dan teks error lebih pekat. Jangan memakai warna fill destructive sebagai teks semua konteks. Label benar/salah dan indikator radio tetap dipertahankan; border quiz yang menyatu dengan fill tidak perlu dikembalikan menjadi terang.

### P1 — Centang Select masih salah warna ketika fokus

Lokasi: `ui/select.tsx:109`.

Diverifikasi di browser: option dark fokus memakai background `rgb(154,223,242)` dan teks `rgb(18,60,74)`, tetapi SVG centang tetap `rgb(163,163,163)`. Kontras ikon hanya **1.707:1**.

Penyebab: selector `[&_svg:not([class*='text-'])]:text-muted-foreground` mengalahkan `focus:[&_svg]:text-current` melalui specificity. Perbaikan hover sebelumnya baru benar untuk teks, belum ikon ini.

Rekomendasi: gunakan inheritance untuk ikon option atau override fokus dengan specificity yang tepat. Verifikasi computed color SVG, bukan hanya class string.

### P2 — Checkbox indeterminate belum punya presentasi khusus

Lokasi: `ui/checkbox.tsx:12` dan `:22`.

Indicator selalu menggunakan Tick02Icon, termasuk ketika `data-state=indeterminate`; fill hanya mengakomodasi `checked`. ARIA mixed sudah tersedia dari Radix, tetapi visual mixed belum jelas.

Rekomendasi: ikon minus untuk mixed dengan pasangan fill/ink yang sama amannya dengan checked.

### P2 — Halaman design system belum cukup sebagai regression checklist

Lokasi: `pages/design-system.tsx`, `features/design-system/quiz-examples.tsx`.

Badge tampil sebagai span, sehingga hover link badge tidak terwakili. Belum ada preview keyboard focus per keluarga kontrol dan catatan pasangan warna/rasio. Dropdown demo tidak memakai ikon sehingga kegagalan ikon berpotensi lolos inspeksi.

Rekomendasi: tambah linked badge, menu dengan ikon, state mixed, preview invalid/selected/focus, serta tabel pasangan token beserta kontrasnya. Gunakan komponen asli; jangan membuat duplikat CSS state.

## Cakupan primitive

| Primitive | Hasil review warna |
| --- | --- |
| Button | Primary dan destructive perlu koreksi; outline/ghost cyan sudah sesuai |
| Badge | Primary dan destructive perlu koreksi; secondary/outline/ghost/link punya pasangan yang benar |
| Checkbox | Kontras checked/border dan presentasi mixed perlu koreksi |
| Radio group | Border dan dot light perlu koreksi |
| Input | Border dan text selection perlu koreksi; teks/placeholder default sesuai |
| Textarea | Border perlu koreksi; teks/placeholder default sesuai |
| Select | Border dan centang fokus perlu koreksi; teks option sesuai |
| Tabs | Teks dan underline aktif light perlu koreksi |
| Progress | Fill terhadap track light perlu koreksi |
| Field | Hover link description perlu koreksi; label/error pada background default sesuai |
| Label | Warna mengikuti konteks; tidak ditemukan konflik token pada pemakaian default |
| Card | Pasangan card/card-foreground dan deskripsi default sesuai |
| Dialog frame | Surface, judul/deskripsi, dan close memakai token sesuai; mewarisi perbaikan Button |
| Drawer | Judul/deskripsi sesuai; konten body mewarisi warna dari konteks portal |
| Dropdown menu | Teks state highlighted/open memakai accent-foreground; ikon perlu terus dicakup verifikasi state |
| Collapsible | Headless; warna ditentukan trigger/content pemanggil, demo memakai Button |
| Separator | Border dekoratif; tidak perlu diperkeras global untuk memenuhi rasio kontrol |
| Sonner | Palet sendiri: title default/status light sekitar 5.05–8.14:1, dark 11.00–11.66:1. Belum memvalidasi seluruh kombinasi action/icon secara live |

## Yang dipertahankan

- Accent/secondary cyan dan ink: light **6.461:1**, dark **8.025:1**.
- Body: light **8.441:1**, dark **15.058:1**.
- Muted text pada muted surface: light **4.623:1**, dark **5.999:1**. Nilai ini bukan jaminan untuk semua colored surfaces.
- Link dan ring terhadap background: light **4.790:1**, dark **10.296:1**.
- Success pada subtle surface: light **9.573:1**, dark **8.449:1**.
- Adaptive pada subtle surface: light **6.728:1**, dark **9.434:1**.
- Warna dan komposisi quiz yang telah disetujui; indikator radio dan teks tetap dipakai selain warna.

## Urutan finalisasi

1. Primary foreground dan token/hover destructive, sambil mempertahankan teks destructive putih.
2. Token input dan pemakaian link/ring pada teks/indikator light.
3. Pasangan feedback error, selector ikon Select, dan mixed checkbox.
4. Lengkapi contoh state di design system, lalu ukur ulang pasangan aktual dalam browser di light/dark sebelum commit.
