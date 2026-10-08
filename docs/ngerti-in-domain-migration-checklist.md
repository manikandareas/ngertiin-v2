# Checklist migrasi production ke ngerti.in

Tanggal: 8 Oktober 2026.

Status: backend, Web, WWW, Clerk, OAuth callback, R2 dan konfigurasi coordinator sudah cutover. deploy.ngerti.in HTTPS/proxy aktif; login panel baru dan otorisasi GitHub masih menunggu pengguna. Redirect dan pemeriksaan Journey/audio selesai. Cleanup transisi serta audit integrasi eksternal tetap terpisah.

Branch migrasi: `release/ngerti-in-domain-2026-10-08`. Worktree: `/tmp/ngertiin-domain-2026-10-08`. Perubahan source berada di worktree tersebut; workspace utama menyimpan checklist dan mempertahankan perubahan pengguna.
Centang hanya setelah ada bukti keberhasilan. Jangan menaruh secret, token, signed URL, atau environment dump di dokumen ini.

## Domain tujuan

| Hostname | Layanan | Pengelola |
| --- | --- | --- |
| ngerti.in | Landing | Cloudflare Worker ngertiin-www |
| www.ngerti.in | Redirect ke landing | Cloudflare Redirect Rule |
| app.ngerti.in | Aplikasi belajar | Cloudflare Worker ngertiin-web |
| api.ngerti.in | Backend | Cloudflare DNS dan Dokploy |
| assets.ngerti.in | Aset publik | Bucket R2 ngertiin-assets |
| clerk.app.ngerti.in | Clerk Frontend API | Clerk, Secondary application |
| accounts.app.ngerti.in | Account Portal | Clerk |
| deploy.ngerti.in | Semaphore | Cloudflare DNS dan Dokploy |

PostgreSQL, Redis, dan background worker tetap memakai jaringan internal. Signed URL file privat tetap menggunakan endpoint S3 R2; custom domain assets hanya untuk aset publik.

## 1. Baseline dan akses

- [x] Buat file checklist migrasi.
- [x] Periksa Git workspace: main memiliki 49 commit lokal; perubahan lain harus dipertahankan.
- [x] Identifikasi branch WWW terpisah: release/www-only-2026-10-08, commit 76727c7 (sudah dipush pada langkah sebelumnya).
- [x] Pastikan tool Computer Use tersedia dan dapat membaca/mengoperasikan dashboard.
- [x] Periksa sesi login Cloudflare, Dokploy, Clerk, GitHub, Google Cloud, dan Semaphore.
- [x] Catat SHA/image backend yang aktif serta versi Worker WWW/Web tanpa secret.
- [ ] Catat domain dan konfigurasi lama untuk rollback secara privat.
- [x] Verifikasi backup database terbaru berhasil.
- [x] Pastikan tidak ada release aktif/gagal yang belum direkonsiliasi di Semaphore.

## 2. Branch dan perubahan source

- [x] Fetch origin, lalu buat worktree/branch migrasi dari origin/main.
- [x] Sertakan commit WWW 76727c7 jika halaman landing/kebijakan ikut dirilis.
- [x] Tambahkan domain baru pada apps/www/wrangler.jsonc; pertahankan domain lama selama transisi.
- [x] Tambahkan app.ngerti.in pada apps/web/wrangler.jsonc; pertahankan domain lama selama transisi.
- [x] Ubah URL build di .github/workflows/frontend-deploy.yml: VITE_API_URL=https://api.ngerti.in, PUBLIC_SITE_URL=https://ngerti.in, PUBLIC_APP_URL=https://app.ngerti.in, PUBLIC_ASSETS_URL=https://assets.ngerti.in.
- [x] Perbarui template env production WWW dan Web. VITE_API_URL tidak memakai /api/v1.
- [x] Sertakan parser WEB_ORIGIN multi-origin yang saat ini masih berupa perubahan lokal; pastikan Nest menerima array origin.
- [x] Ubah Compose supaya WEB_ORIGIN mengambil environment Dokploy, bukan nilai hardcoded.
- [x] Perbarui identitas URL Wikimedia di Compose jika masih menggunakan hostname lama.
- [x] Perbarui docs/deployment.md dengan peta domain baru.
- [x] Jalankan pemeriksaan terfokus, typecheck/build frontend, backend terkait, Wrangler dry-run, dan git diff --check.
- [x] Review daftar file dan pastikan 49 commit fitur lokal tidak ikut.
- [x] Commit/push branch migrasi.
- [x] Merge perubahan migrasi setelah baseline dashboard dan kesiapan cutover terverifikasi.

## 3. Cloudflare

- [ ] Zone ngerti.in berstatus Active dan berada di akun Worker/R2 production.
- [x] Periksa record root/app/api/assets yang bisa bertabrakan.
- [x] Periksa cakupan token deployment CI untuk zone ngerti.in dan zone lama.
- [x] Jika perlu mengubah permission token atau membuat kredensial baru melalui UI, siapkan perubahan konkret dan minta konfirmasi sesuai skill Computer Use sebelum menyimpan.
- [x] Siapkan custom domain Worker untuk ngerti.in dan app.ngerti.in melalui konfigurasi Wrangler/source yang akan dideploy.

## 4. API baru dan TLS

- [x] Verifikasi IP VPS aktual; dokumentasi lama mencatat 145.79.12.17.
- [x] Tambahkan A record api ke VPS, awalnya DNS only.
- [x] Tambahkan api.ngerti.in pada Dokploy: service api, port 3000, path /, HTTPS/Let's Encrypt.
- [x] Terapkan konfigurasi domain dengan image production yang dimaksud; pertahankan domain API lama.
- [x] Sertifikat origin valid dan GET https://api.ngerti.in/health/ready memberi 200.
- [x] Aktifkan Cloudflare proxy setelah origin HTTPS valid.
- [x] Terapkan Full (strict) untuk API dan bypass cache hostname api.ngerti.in.
- [ ] Pastikan WAF/challenge tidak menghalangi API dan streaming.
- [x] Verifikasi readiness kembali setelah proxy aktif.

## 5. CORS API dan release backend

- [x] Deploy backend yang mendukung daftar origin sebelum mengisi nilai comma-separated.
- [x] Isi WEB_ORIGIN=https://app-ngertiin.whoismanik.dev,https://app.ngerti.in pada Dokploy setelah Compose meneruskannya.
- [x] Pastikan image backend aktif berasal dari SHA release migrasi, bukan main lokal yang berisi fitur lain.
- [x] Uji preflight origin lama dan baru dengan Authorization/Content-Type.
- [x] Uji origin lain tidak memperoleh izin CORS.
- [x] Pastikan API sehat dan background worker tidak restart berulang.

## 6. R2

- [x] Tambahkan assets.ngerti.in melalui R2 > ngertiin-assets > Settings > Custom Domains.
- [x] Tunggu domain aktif dan uji objek video yang ada.
- [x] Pertahankan custom domain aset lama selama transisi.
- [x] Tambahkan https://app.ngerti.in ke AllowedOrigins bucket privat ngertiin-production; pertahankan origin lama sementara.
- [x] Pertahankan methods/headers yang diperlukan alur live. Baseline terdokumentasi: GET/HEAD, Range, exposed ETag/Content-Length/Content-Range/Accept-Ranges.
- [x] Bucket file pengguna tetap privat; endpoint S3, kredensial dan bucket tidak diganti hanya karena migrasi domain.

## 7. Clerk dan OAuth saat cutover

- [ ] Siapkan frontend/API/assets sebelum mengganti domain Clerk; jadwalkan perubahan autentikasi karena dapat menyebabkan downtime dan login ulang.
- [x] Gunakan instance Clerk production yang sama agar identitas akun tetap cocok dengan data aplikasi.
- [x] Ubah domain aplikasi menjadi app.ngerti.in, pilih Secondary application untuk pola clerk.app.ngerti.in.
- [x] Salin DNS Clerk/DKIM/mail persis dari dashboard; pasang DNS only dan tunggu verifikasi/HTTPS.
- [x] Perbarui URL aplikasi, Account Portal, dan redirect yang memakai domain lama.
- [x] Ambil publishable key baru; simpan pada GitHub environment production > Variables > VITE_CLERK_PUBLISHABLE_KEY tanpa mencatat nilainya di checklist.
- [x] Pastikan backend memakai secret dari instance production yang sama.
- [x] Google OAuth: origin https://app.ngerti.in, callback persis dari Clerk, dan authorized domain/homepage/privacy/terms bila relevan.
- [x] GitHub OAuth: homepage dan callback sesuai domain Clerk baru.
- [x] Pastikan Client ID/Secret provider yang sudah ada cocok dengan konfigurasi Clerk; pembuatan kredensial baru lewat UI memerlukan konfirmasi skill.

## 8. Deploy frontend

- [x] Deploy Web dari ref remote yang memuat migrasi dengan API URL dan publishable key baru.
- [x] Periksa workflow sukses, SHA yang dipakai, custom domain, HTTPS, dan login.
- [x] Deploy WWW dengan URL site/app/assets baru.
- [x] Periksa canonical/Open Graph, CTA, halaman informasi, dan video.
- [x] Catat SHA/run deployment dan hasil, tanpa secret.

Workflow saat ini manual: pilih app=web kemudian app=www pada frontend-deploy.yml. Push Git saja tidak melakukan deployment.

## 9. Coordinator dan integrasi

- [x] Ubah api_url konfigurasi privat Semaphore menjadi https://api.ngerti.in.
- [x] Periksa release_ref/workflow_ref menunjuk ref remote yang benar; jangan hapus journal/lock release secara sembarang.
- [ ] Perbarui uptime monitor, healthcheck eksternal, webhook/payment callback/email/link absolut jika digunakan.
- [x] Setelah aplikasi stabil, tambahkan DNS/Dokploy deploy.ngerti.in untuk Semaphore.
- [x] Ubah SEMAPHORE_WEB_ROOT=https://deploy.ngerti.in dan terapkan konfigurasi.
- [ ] Uji login panel dan task deployment; pertahankan akses panel lama sampai berhasil.

## 10. Penerimaan production

- [x] Landing, contact, privacy, terms, refund terbuka dengan HTTPS valid.
- [x] CTA menuju app.ngerti.in; aset publik menggunakan assets.ngerti.in.
- [ ] Google login dan GitHub login (jika aktif) berhasil.
- [x] Logout/login ulang berhasil dan akun lama masih memiliki data yang benar.
- [x] Refresh route aplikasi dalam tidak menghasilkan 404.
- [x] Upload dan pemrosesan materi berhasil.
- [x] PDF/file lama dapat dibuka, termasuk kebutuhan range request.
- [x] Chat dan streaming berjalan.
- [x] Journey/proses background selesai; progres tersimpan.
- [x] Gambar/video/audio yang tersedia berhasil dimuat.
- [ ] Tidak ada error CORS, mixed content, atau redirect loop.
- [x] API sehat; worker/database/Redis stabil.

## 11. Redirect dan penyelesaian

- [x] Setelah penerimaan lolos, buat redirect www.ngerti.in ke ngerti.in; hostname sumber memiliki proxied DNS dan HTTPS valid.
- [x] Buat redirect landing lama ke ngerti.in dengan path/query dipertahankan.
- [x] Buat redirect aplikasi lama ke app.ngerti.in dengan path/query dipertahankan.
- [x] Uji redirect sementara sebelum menetapkannya permanen.
- [x] API lama tetap melayani selama client lama masih digunakan; jangan mengandalkan redirect API untuk request berautentikasi/streaming.
- [x] Aset lama tetap tersedia sampai referensi lama tidak digunakan.
- [ ] Setelah transisi selesai, hapus origin CORS lama dan rapikan callback/domain lama dengan konfirmasi action-time bila menghapus data lewat UI.

## Rollback

- [ ] Jika acceptance gagal, hentikan cleanup domain lama dan pertahankan API/aset lama.
- [ ] Pulihkan versi Worker dan konfigurasi runtime yang sesuai baseline.
- [ ] Jika Clerk sudah berpindah, selaraskan kembali domain Clerk, publishable key, OAuth callback, dan build frontend; rollback frontend saja tidak cukup.
- [ ] Tidak ada migrasi schema/data yang dibutuhkan oleh perubahan domain itu sendiri.

## Catatan eksekusi

| Waktu | Langkah | Hasil/bukti |
| --- | --- | --- |
| 2026-10-08 | Persiapan lokal | Checklist dibuat; Git utama tetap main dengan 49 commit lokal dan perubahan user yang belum committed. |
| 2026-10-08 | Source migrasi | Worktree dari origin/main; commit WWW diterapkan; URL workflow/Wrangler/env, Compose CORS, parser origin, dan dokumentasi diperbarui. |
| 2026-10-08 | Validasi lokal | Typecheck seluruh workspace, build API/Web/WWW, kedua Wrangler dry-run, format WWW, focused Biome, parser origin, Compose dengan nilai dummy, dan git diff --check lolos. Web build memiliki warning CSS highlight dan ukuran chunk. Publishable key Clerk baru belum tersedia; build lokal bukan bukti login production. |
| 2026-10-08 | Git remote | Branch release/ngerti-in-domain-2026-10-08 sudah dipush; commit source 1ac97cc, dengan commit WWW e683353. Belum merge/deploy production. |
| 2026-10-08 | Computer Use | Plugin terpasang; MCP initialize/tools-list merespons. list_apps dan get_app_state Brave tidak merespons; pengguna mengonfirmasi tidak ada dialog. Dashboard, backup, domain, OAuth, dan acceptance belum diperiksa/dijalankan. |

| 2026-10-08 12:15 WITA | Computer Use / baseline | Dokploy API healthy, worker running (uptime 9 hari). Backend environment RELEASE_TAG=a703b256b4785facbf751106225eb24785157282, image prefix ghcr.io/manikandareas/ngertiin-v2; Compose masih hardcode origin lama. Domain API lama port 3000 HTTPS letsencrypt. PostgreSQL daily backup terakhir Done sekitar 9 jam sebelumnya (13 detik). IP server 145.79.12.17 terverifikasi lewat Web Server. |
| 2026-10-08 12:15 WITA | Cloudflare DNS | A api.ngerti.in -> 145.79.12.17 disimpan DNS only, TTL Auto. Refresh tabel juga menampilkan Worker app.ngerti.in -> ngertiin-web dan ngerti.in -> ngertiin-www; kepemilikan route ini belum berarti build frontend telah cutover. Form domain API Dokploy disubmit; hasil masih menunggu verifikasi. |

## Referensi

Remote main di-fast-forward dari `a703b25` ke `76cbd7b` pada 8 Oktober 2026 sekitar 13:08 WITA: hanya tiga commit migrasi/WWW/dokumentasi dari worktree terisolasi. 49 commit fitur lokal tidak ikut. Workflow frontend controller kini memakai URL domain baru; push bukan deployment frontend.

Task Semaphore #14 gagal 13:00:49 WITA dengan `Remote request failed (URLError)` saat polling GitHub. Run `37729241383` kemudian terverifikasi completed/success dengan tepat empat job (validate, images api/worker/migrate) sukses. Journal hanya memiliki operasi github-backend, tanpa backup/migrasi/mutasi Dokploy. Dengan production lock, journal disimpan sebagai arsip `reconciled-no-backend-change`; bukan dihapus dan bukan dianggap backend sukses. Task #15 SUCCESS: backup, migration dan backend deployment selesai; SHA 76cbd7b82610a797ca61080fb62f80a4f0b29e64. GitHub run 37730795232 sukses.

Preflight OAuth: Google Cloud project ngertiin login tersedia, client production sesuai Client ID Clerk. Authorized JavaScript origin https://app.ngerti.in ditambahkan bersama origin lama, UI OAuth client saved. Callback Google masih lama sampai callback baru dikonfirmasi Clerk. GitHub OAuth application 3848692 homepage diganti https://ngerti.in, UI Application updated successfully; callback lama tetap tersedia. GitHub UI mendukung penambahan redirect URI sehingga callback baru dapat ditambahkan tanpa menghapus callback lama. Tidak ada kredensial baru dibuat.

Semaphore sesi login tersedia. Audit container 40e14dda9a17: workflow_ref=main, activation_verified=true, api_url masih https://api-ngertiin.whoismanik.dev; active.json tidak ada sebelum release. Riwayat task terbaru #13 Deploy All Success. Task #14 Deploy Backend dimulai dengan release ref `release/ngerti-in-domain-2026-10-08`, pesan domain migration. Kandidat worktree `76cbd7b82610a797ca61080fb62f80a4f0b29e64`; hasil resolusi live akan dicatat dari log task. Belum dianggap deployment berhasil.

Baseline Worker: Web versi singkat `505b2256`, WWW `bfcda2ce`; keduanya 100% traffic, manually deployed melalui Wrangler, sekitar 9 hari sebelumnya. ID singkat berasal dari UI Active deployment. SHA migration worktree terbaru `76cbd7b` (dokumentasi), setelah source `1ac97cc` dan WWW `e683353`. GET API readiness melalui pemeriksaan HTTP tambahan mengembalikan 200 dengan validasi TLS normal.

Benturan Clerk terselesaikan: Change domain ke `app.ngerti.in` sebelumnya ditolak karena dipakai aplikasi lama `app_33aFAVEXs77xs0pUrUbhbQdZtSX`, instance `ins_3478pijpoKCGA8XJPpl9jJpKzbp` (grafik Total sign-ups 162). Sesuai instruksi pengguna untuk menghapus penggunaan domain pada aplikasi lama, domain instance lama diganti ke `legacy-app.ngerti.in` (Secondary), terverifikasi di dashboard sebagai Unverified. Akun tidak dihapus/dipindahkan dan DNS legacy tidak diaktifkan. Instance production aktif tetap `ins_3J7iLUZsItgp4ExxnA8KF4Yu5I4` pada domain lama, menunggu kesiapan backend/frontend sebelum cutover.

Catatan lanjutan: domain API Dokploy baru tersimpan bersama domain lama. Deploy image baseline `a703b256b4785facbf751106225eb24785157282` Done (3 detik). Origin HTTPS valid; readiness browser status ok dengan postgres/redis/storage up, termasuk setelah proxy aktif. Full(strict) dan rule Bypass API cache aktif. CORS API dan streaming belum diuji. Domain R2 `assets.ngerti.in` kini Active/Enabled; video `/videos/adaptive-v1.mp4` berhasil dimuat dan diputar di browser lewat HTTPS. Domain lama Active/Enabled. CORS bucket privat tersimpan dengan origin lama dan baru; GET/HEAD, Range, serta exposed headers tetap sama. Bucket privat tidak memiliki custom domain dan public development URL disabled. Semaphore masih meminta login, sehingga pemeriksaan journal/release menunggu sesi pengguna.

- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/r2/buckets/public-buckets/
- https://developers.cloudflare.com/r2/buckets/cors/
- https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- https://clerk.com/docs/guides/development/deployment/changing-domains
- https://docs.dokploy.com/docs/core/docker-compose/domains

## Hasil cutover terverifikasi

- Token CI ngertiin-github-actions-production: penambahan scope zone ngerti.in disetujui pengguna, diterapkan; UI 1 account / 2 zones Active.
- Backend task #15 SUCCESS; API container 37bddc5b2df7 healthy, worker d57eff5bda23. CORS origin lama dan baru 204 dengan allow-origin sesuai; origin asing tanpa allow-origin. WEB_ORIGIN eksplisit tersimpan pada Dokploy.
- Clerk tetap instance ins_3J7iLUZsItgp4ExxnA8KF4Yu5I4; app.ngerti.in Secondary. Kelima DNS Verified dan SSL Certificates Issued. Publishable key GitHub production diperbarui tanpa rotasi secret backend/provider.
- Google callback https://clerk.app.ngerti.in/v1/oauth_callback ditambahkan; login Google berhasil dan data akun lama terlihat. GitHub callback sama ditambahkan bersama callback lama; UI Application updated successfully. Login GitHub mencapai otorisasi profil/email, menunggu izin pengguna.
- Web task #16 SUCCESS / GitHub run 37732238011. WWW task #17 SUCCESS / run 37732543128. Keduanya SHA 76cbd7b82610a797ca61080fb62f80a4f0b29e64.
- Landing dan empat halaman informasi HTTPS 200; canonical/OG domain baru, CTA app.ngerti.in, video/poster assets.ngerti.in.
- Google login dan logout berhasil. Data PDF lama 82 halaman terbaca; refresh route PDF berhasil. Chat fotosintesis menghasilkan jawaban lengkap. PDF sintetis baru 748 byte diunggah, worker selesai dengan status Siap dipakai, PDF 1 halaman terbaca. Data uji ditinggalkan untuk bukti acceptance.
- Coordinator persisten Dokploy: api_url=https://api.ngerti.in, web_url=https://app.ngerti.in, www_url=https://ngerti.in, workflow_ref=main, activation_verified=true. Setelah redeploy container 69e3aa11ac6a, active_journal=False. Ketiga release.url_ready memberi True dengan client NgertiinRelease/1.0. Probe Python urllib generik mendapat 403; client coordinator normal berhasil sehingga proteksi Cloudflare tidak dikurangi.
- deploy.ngerti.in A ke 145.79.12.17; Dokploy semaphore port 3000 HTTPS letsencrypt, SEMAPHORE_WEB_ROOT domain baru. Deployment Done 1 detik. TLS normal /api/ping 200 sebelum proxy; proxy kini aktif, halaman login browser tampil normal. Login panel baru menunggu pengguna, domain panel lama dipertahankan.

Belum selesai: otorisasi/login GitHub, login/task panel baru, serta audit integrasi eksternal bila digunakan. Cleanup origin/callback/API/aset lama ditunda selama transisi.

Pemeriksaan akhir tambahan:
- Branding Google: authorized domain ngerti.in sudah ada. Homepage https://ngerti.in/, privacy https://ngerti.in/privacy/, terms https://ngerti.in/terms/ tersimpan (Branding changes saved). Login ulang Google menampilkan link privacy/terms baru dan kembali ke akun lama.
- Redirect www rule 034e5391e0a64cfcb0440824b9b697eb, landing lama 2d83b1aeb00e44fa84cafa4b052a9758, aplikasi lama 9e7d69486e9746c69418678ad611103e. Kondisi exact hostname; target concat HTTPS domain baru dengan http.request.uri.path, preserve query. Setelah uji 307, kini 301. Enam probe HTTP/HTTPS memberi 301 dan Location sesuai dengan path/query utuh.
- Journey IoT lama membuka materi dan hasil assessment tersimpan; 1 dari 10 node selesai, progres 10 persen. Audio berhasil disiapkan dan diputar: browser Audio playing, posisi 0:14 dari durasi 5:04; pemutar kemudian dijeda. Refresh route node berhasil.

Batas acceptance: materi/progres Journey lama, pemrosesan PDF baru dan generasi audio lolos; tidak membuat Journey baru atau mengulang assessment. Pemeriksaan readiness akhir API: status ok, postgres/redis/storage up. Pengujian UI tidak mencakup audit semua request jaringan; klaim tidak ada error CORS/mixed content berlaku pada alur yang dijalankan, bukan audit seluruh fitur.
