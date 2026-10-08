# Checklist migrasi production ke ngerti.in

Tanggal: 8 Oktober 2026.

Status: source migrasi disiapkan dan pemeriksaan lokal lolos; dashboard dan cutover terhambat koneksi Computer Use.

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
- [ ] Pastikan tool Computer Use tersedia dan dapat membaca/mengoperasikan dashboard.
- [ ] Periksa sesi login Cloudflare, Dokploy, Clerk, GitHub, Google Cloud, dan Semaphore.
- [ ] Catat SHA/image backend yang aktif serta versi Worker WWW/Web tanpa secret.
- [ ] Catat domain dan konfigurasi lama untuk rollback secara privat.
- [ ] Verifikasi backup database terbaru berhasil.
- [ ] Pastikan tidak ada release aktif/gagal yang belum direkonsiliasi di Semaphore.

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
- [ ] Merge perubahan migrasi setelah baseline dashboard dan kesiapan cutover terverifikasi.

## 3. Cloudflare

- [ ] Zone ngerti.in berstatus Active dan berada di akun Worker/R2 production.
- [ ] Periksa record root/app/api/assets yang bisa bertabrakan.
- [ ] Periksa cakupan token deployment CI untuk zone ngerti.in dan zone lama.
- [ ] Jika perlu mengubah permission token atau membuat kredensial baru melalui UI, siapkan perubahan konkret dan minta konfirmasi sesuai skill Computer Use sebelum menyimpan.
- [ ] Siapkan custom domain Worker untuk ngerti.in dan app.ngerti.in melalui konfigurasi Wrangler/source yang akan dideploy.

## 4. API baru dan TLS

- [ ] Verifikasi IP VPS aktual; dokumentasi lama mencatat 145.79.12.17.
- [ ] Tambahkan A record api ke VPS, awalnya DNS only.
- [ ] Tambahkan api.ngerti.in pada Dokploy: service api, port 3000, path /, HTTPS/Let's Encrypt.
- [ ] Terapkan konfigurasi domain dengan image production yang dimaksud; pertahankan domain API lama.
- [ ] Sertifikat origin valid dan GET https://api.ngerti.in/health/ready memberi 200.
- [ ] Aktifkan Cloudflare proxy setelah origin HTTPS valid.
- [ ] Terapkan Full (strict) untuk API dan bypass cache hostname api.ngerti.in.
- [ ] Pastikan WAF/challenge tidak menghalangi API dan streaming.
- [ ] Verifikasi readiness kembali setelah proxy aktif.

## 5. CORS API dan release backend

- [ ] Deploy backend yang mendukung daftar origin sebelum mengisi nilai comma-separated.
- [ ] Isi WEB_ORIGIN=https://app-ngertiin.whoismanik.dev,https://app.ngerti.in pada Dokploy setelah Compose meneruskannya.
- [ ] Pastikan image backend aktif berasal dari SHA release migrasi, bukan main lokal yang berisi fitur lain.
- [ ] Uji preflight origin lama dan baru dengan Authorization/Content-Type.
- [ ] Uji origin lain tidak memperoleh izin CORS.
- [ ] Pastikan API sehat dan background worker tidak restart berulang.

## 6. R2

- [ ] Tambahkan assets.ngerti.in melalui R2 > ngertiin-assets > Settings > Custom Domains.
- [ ] Tunggu domain aktif dan uji objek video yang ada.
- [ ] Pertahankan custom domain aset lama selama transisi.
- [ ] Tambahkan https://app.ngerti.in ke AllowedOrigins bucket privat ngertiin-production; pertahankan origin lama sementara.
- [ ] Pertahankan methods/headers yang diperlukan alur live. Baseline terdokumentasi: GET/HEAD, Range, exposed ETag/Content-Length/Content-Range/Accept-Ranges.
- [ ] Bucket file pengguna tetap privat; endpoint S3, kredensial dan bucket tidak diganti hanya karena migrasi domain.

## 7. Clerk dan OAuth saat cutover

- [ ] Siapkan frontend/API/assets sebelum mengganti domain Clerk; jadwalkan perubahan autentikasi karena dapat menyebabkan downtime dan login ulang.
- [ ] Gunakan instance Clerk production yang sama agar identitas akun tetap cocok dengan data aplikasi.
- [ ] Ubah domain aplikasi menjadi app.ngerti.in, pilih Secondary application untuk pola clerk.app.ngerti.in.
- [ ] Salin DNS Clerk/DKIM/mail persis dari dashboard; pasang DNS only dan tunggu verifikasi/HTTPS.
- [ ] Perbarui URL aplikasi, Account Portal, dan redirect yang memakai domain lama.
- [ ] Ambil publishable key baru; simpan pada GitHub environment production > Variables > VITE_CLERK_PUBLISHABLE_KEY tanpa mencatat nilainya di checklist.
- [ ] Pastikan backend memakai secret dari instance production yang sama.
- [ ] Google OAuth: origin https://app.ngerti.in, callback persis dari Clerk, dan authorized domain/homepage/privacy/terms bila relevan.
- [ ] GitHub OAuth: homepage dan callback sesuai domain Clerk baru.
- [ ] Pastikan Client ID/Secret provider yang sudah ada cocok dengan konfigurasi Clerk; pembuatan kredensial baru lewat UI memerlukan konfirmasi skill.

## 8. Deploy frontend

- [ ] Deploy Web dari ref remote yang memuat migrasi dengan API URL dan publishable key baru.
- [ ] Periksa workflow sukses, SHA yang dipakai, custom domain, HTTPS, dan login.
- [ ] Deploy WWW dengan URL site/app/assets baru.
- [ ] Periksa canonical/Open Graph, CTA, halaman informasi, dan video.
- [ ] Catat SHA/run deployment dan hasil, tanpa secret.

Workflow saat ini manual: pilih app=web kemudian app=www pada frontend-deploy.yml. Push Git saja tidak melakukan deployment.

## 9. Coordinator dan integrasi

- [ ] Ubah api_url konfigurasi privat Semaphore menjadi https://api.ngerti.in.
- [ ] Periksa release_ref/workflow_ref menunjuk ref remote yang benar; jangan hapus journal/lock release secara sembarang.
- [ ] Perbarui uptime monitor, healthcheck eksternal, webhook/payment callback/email/link absolut jika digunakan.
- [ ] Setelah aplikasi stabil, tambahkan DNS/Dokploy deploy.ngerti.in untuk Semaphore.
- [ ] Ubah SEMAPHORE_WEB_ROOT=https://deploy.ngerti.in dan terapkan konfigurasi.
- [ ] Uji login panel dan task deployment; pertahankan akses panel lama sampai berhasil.

## 10. Penerimaan production

- [ ] Landing, contact, privacy, terms, refund terbuka dengan HTTPS valid.
- [ ] CTA menuju app.ngerti.in; aset publik menggunakan assets.ngerti.in.
- [ ] Google login dan GitHub login (jika aktif) berhasil.
- [ ] Logout/login ulang berhasil dan akun lama masih memiliki data yang benar.
- [ ] Refresh route aplikasi dalam tidak menghasilkan 404.
- [ ] Upload dan pemrosesan materi berhasil.
- [ ] PDF/file lama dapat dibuka, termasuk kebutuhan range request.
- [ ] Chat dan streaming berjalan.
- [ ] Journey/proses background selesai; progres tersimpan.
- [ ] Gambar/video/audio yang tersedia berhasil dimuat.
- [ ] Tidak ada error CORS, mixed content, atau redirect loop.
- [ ] API sehat; worker/database/Redis stabil.

## 11. Redirect dan penyelesaian

- [ ] Setelah penerimaan lolos, buat redirect www.ngerti.in ke ngerti.in; hostname sumber memiliki proxied DNS dan HTTPS valid.
- [ ] Buat redirect landing lama ke ngerti.in dengan path/query dipertahankan.
- [ ] Buat redirect aplikasi lama ke app.ngerti.in dengan path/query dipertahankan.
- [ ] Uji redirect sementara sebelum menetapkannya permanen.
- [ ] API lama tetap melayani selama client lama masih digunakan; jangan mengandalkan redirect API untuk request berautentikasi/streaming.
- [ ] Aset lama tetap tersedia sampai referensi lama tidak digunakan.
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

## Referensi

- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/r2/buckets/public-buckets/
- https://developers.cloudflare.com/r2/buckets/cors/
- https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- https://clerk.com/docs/guides/development/deployment/changing-domains
- https://docs.dokploy.com/docs/core/docker-compose/domains
