# Redesign chat — Kumo primary

12 September 2026. Arah prototype disetujui pengguna: sidebar kanan, floating, dan Kumo dengan warna primary. Hasil integrasi aplikasi masih menunggu review UI/UX pengguna; ini tidak menutup acceptance M5.

## Perubahan

- FAB fixed kanan bawah menjadi pintu masuk default. Kumo menggunakan `--primary`, dengan gerakan idle, kedip/lirik, dan ekspresi hover/focus. Animasi dinonaktifkan pada preferensi reduced motion.
- Header menggabungkan riwayat, percakapan baru, pilihan Sidebar/Floating, dan minimize. Ikon chat memakai Hugeicons yang sudah tersedia di aplikasi.
- Panel desktop memakai ruang di sebelah materi; floating menjadi overlay. Pada layar kecil panel menyesuaikan viewport. Pilihan layout disimpan dalam cache sesi per pengguna/modul.
- Satu tree percakapan dipertahankan saat mengganti layout. React Activity menjaga state saat minimize dan menghentikan efek tersembunyi; durable run tetap milik server.
- Composer memuat nama modul/node aktif, kutipan, kirim, dan hentikan. Pesan pertama membuat thread lalu dikirim sekali melalui transport existing; kembali ke thread lewat riwayat tidak mengirimnya ulang.
- Header, panel, composer, welcome, dan maskot dipisahkan dari pengelolaan thread/run. Backend, kontrak API, dan snapshot citation tidak berubah.

## Verifikasi

Browser fixture sementara mengimpor ChatSidebar produksi beserta hook, transport, composer, dan reader. Auth dan HTTP/SSE menggunakan respons simulasi di browser; tidak ada data pengguna yang dimutasi. React StrictMode aktif. Fixture dan server sementara dibersihkan setelah pemeriksaan; tidak menambah test suite.

| Pemeriksaan | Hasil |
| --- | --- |
| FAB default tertutup; membuka chat tidak membuat thread | PASS fixture |
| Sidebar desktop 1440 × 960 berbagi ruang dengan materi | PASS; batas kanan main dan kiri panel sama-sama 1020 px |
| Floating desktop serta mobile 390 × 844 | PASS; tidak ada horizontal overflow |
| Tema terang/gelap dan warna Kumo | PASS; fill primary `rgb(28, 176, 246)` |
| Draft sebelum thread dibuat dan draft percakapan aktif setelah ganti layout/minimize | PASS |
| Pesan pertama, lalu buka ulang lewat riwayat | PASS; 1 send, tidak ada kirim ulang |
| Fokus setelah minimize dan buka kembali | PASS; kembali ke FAB lalu composer |
| Kutip materi serta citation reader | PASS buka/tutup fixture; Escape mengembalikan fokus ke pemicu |
| Hentikan run | PASS fixture; 1 cancellation, status dihentikan ditampilkan |
| Browser errors | Tidak ada pada sesi fixture |
| Web typecheck/build, Biome file tersentuh, whitespace | PASS; build tetap memberi warning chunk >500 kB |

Clerk authenticated E2E, provider nyata, database runtime, proxy SSE, dan deployment: **NOT RUN** untuk redesign ini. Keyboard virtual perangkat fisik dan navigasi Journey/Node authenticated: **NOT RUN**. Draft dipertahankan saat mengganti layout/minimize pada halaman yang sama; tidak menambahkan persistence draft lintas halaman/reload.

## Follow-up: renderer Markdown

Jawaban assistant sekarang dirender oleh Streamdown dengan plugin code/math existing. Citation ditransformasi sebagai node Markdown sehingga tetap bekerja di paragraf, emphasis, dan list. HTML mentah dan URL dengan protokol yang tidak didukung tidak diaktifkan. Marker parsial/unknown tidak ditampilkan. Cache renderer disegarkan saat data citation datang terpisah dari teks.

Browser fixture 390 px: bold, list, tabel, code block, rumus, citation dalam emphasis/list, reader/Escape/focus return, Markdown parsial saat streaming, citation muncul/hilang tanpa perubahan teks, dan tidak ada horizontal overflow: PASS. Tidak ada browser error. Fixture sementara dibersihkan. Typecheck, build web, Biome file tersentuh, dan diff whitespace PASS; build tetap memberi warning ukuran chunk. Provider/Clerk nyata: NOT RUN.

## Follow-up: sidebar resize

Sidebar desktop memiliki splitter kiri dengan pointer capture, kontrol ArrowLeft/ArrowRight, Home/End, dan double-click reset ke 420 px. Rentang 320–720 px dibatasi lagi untuk menyisakan minimal 320 px bagi materi. ResizeObserver mengikuti perubahan container. Lebar dipertahankan selama komponen masih terpasang, termasuk pergantian layout/minimize; tidak disimpan lintas reload. Handle tidak ditampilkan pada floating/mobile.

Browser fixture komponen produksi: drag 420 → 640 px, batas keyboard 320/720 px, viewport 1024 px menghasilkan panel 704 px dan materi 320 px, draft tetap ada saat ganti layout, lebar tetap setelah minimize, mobile 390 px tanpa overflow: PASS. Tidak ada browser error; fixture dibersihkan. Typecheck dan Biome file panel PASS.

## Follow-up: cleanup Tailwind

Styling maskot memakai utility Tailwind untuk transform origin, animasi, hover/focus, dan reduced motion. Empat keyframes berada di `apps/web/src/index.css`; stylesheet khusus maskot dihapus. Props komponen baru diberi tipe bernama, tipe layout digunakan bersama, ref composer yang tidak dipakai dihapus, dan kontrol keyboard resize menggunakan switch. Composer memakai satu kondisi kirim untuk submit, Enter, dan tombol agar draft kosong tidak membuat thread.

Verifikasi setelah cleanup: web typecheck, production build, Biome pada 14 file tersentuh, dan `git diff --check` PASS. Build masih memberi warning chunk >500 kB. Browser/visual, Clerk, provider, database runtime, dan proxy SSE: **NOT RUN ulang**; hasil fixture di atas berasal dari pemeriksaan sebelum cleanup.
