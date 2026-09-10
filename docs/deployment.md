# Deployment Ngerti.in: Cloudflare + Dokploy

## Topologi

| Komponen | Lokasi/domain |
| --- | --- |
| Astro landing | Workers Static Assets: `ngertiin.whoismanik.dev` |
| React SPA | Workers Static Assets: `app-ngertiin.whoismanik.dev` |
| API Bun/NestJS | Dokploy: `api-ngertiin.whoismanik.dev`, container port 3000 |
| BullMQ worker | Dokploy, tanpa domain/port publik |
| PostgreSQL 17 / Redis 7 | Resource Dokploy terpisah, persistent volume, jaringan internal |
| File pengguna | R2 private: `ngertiin-production` |
| Video landing | R2 public: `ngertiin-assets.whoismanik.dev` |
| Backup | R2 private terpisah: `ngertiin-backups` |

Frontend dibangun statis; tidak membutuhkan adapter SSR. Domain Worker dikelola lewat `wrangler.jsonc`. Background worker aplikasi berbeda dari Cloudflare Workers.

## Persiapan satu kali

1. Periksa kapasitas VPS dan beban service lain sebelum menetapkan limit resource. Mulai dengan satu API dan satu worker. Worker saat ini memiliki empat antrean dengan concurrency 2/2/1/1, bukan satu job total.
2. Di Dokploy, buat project `ngertiin`, environment `production`, PostgreSQL 17 dan Redis 7. Gunakan password unik, volume persisten, dan jangan publish port database ke host. Redis: `appendonly yes`, `maxmemory-policy noeviction`. Sisakan ruang RAM untuk persistence Redis, database, OS, dan Dokploy.
3. Siapkan jaringan Docker eksternal yang bisa menjangkau kedua database. Isi `BACKEND_NETWORK` dengan nama jaringan aktual, serta URL dengan hostname internal Dokploy. Jika memakai jaringan bersama Dokploy, periksa isolasi terhadap project lain. Mengisi nama jaringan tidak otomatis menyambungkan database ke jaringan baru.
4. Buat bucket R2 aplikasi private, bucket aset public `ngertiin-assets` yang sudah tersedia, dan bucket backup private. Token aplikasi hanya mengakses bucket aplikasi; token backup terpisah. Region S3 `auto`; endpoint `https://<account-id>.r2.cloudflarestorage.com`.
5. Hubungkan bucket aset ke `ngertiin-assets.whoismanik.dev` dan upload file video yang direferensikan `apps/www/src/components/FeatureVideo.astro`. Jangan jadikan bucket pengguna public. Konfigurasi CORS bucket aplikasi untuk origin `https://app-ngertiin.whoismanik.dev`, metode GET/HEAD, header Range, serta exposed headers ETag/Content-Length/Content-Range/Accept-Ranges. Upload saat ini melalui API; tidak perlu signed PUT baru.
6. Buat Clerk production, gunakan domain aplikasi, DNS records persis dari dashboard (DNS-only), OAuth credentials production dan redirect aplikasi. Verifikasi pembatasan origin/authorized parties untuk root domain yang dipakai bersama aplikasi lain.
7. Buat GitHub environment `production`. Variable: `VITE_CLERK_PUBLISHABLE_KEY` production. Secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` dengan izin deploy Worker dan custom domain pada zone ini. Backend image workflow memakai `GITHUB_TOKEN` untuk GHCR; tambahkan registry credential read-packages di Dokploy bila image private.

## Build dan validasi lokal

Jalankan dari root:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run format:check
bun run db:check
docker compose --env-file .env.production.example -f compose.production.yml --profile release config --quiet
docker build --target api -t ngertiin-local-api .
docker build --target worker -t ngertiin-local-worker .
docker build --target migrate -t ngertiin-local-migrate .
```

Docker context selalu root. Runtime membawa source package workspace karena package internal mengekspor TypeScript. Image API/worker memasang dependency production; image migrasi juga membawa Drizzle Kit. `.dockerignore` mengecualikan seluruh `.env*`, build lokal, dan node_modules.

Untuk frontend, copy template masing-masing menjadi `.env.production` dalam direktori app lalu isi key production. File secret tersebut di-ignore Git. Environment publik dibaca saat build, sehingga perubahan memerlukan rebuild. Shell environment mengalahkan nilai dari file dotenv.

Dari `apps/web` dan `apps/www`, masing-masing:

```sh
bun run build
bun run deploy:check
```

`deploy:check` adalah Wrangler dry-run, tidak mempublikasikan frontend. `VITE_API_URL` hanya origin API, tanpa `/api/v1`: client menambahkan prefix sendiri. Jangan jalankan `bun run deploy` sampai tahap release frontend.

## Release pertama melalui Dokploy

1. Jalankan workflow **Build backend release images** pada commit release. Workflow memvalidasi kode dan mempublikasikan tiga image multi-architecture. Tunggu seluruh target berhasil. Prefix image adalah `ghcr.io/<lowercase-owner>/<lowercase-repo>` dan tag adalah full commit SHA; tidak ada tag `latest`.
2. Buat resource Docker Compose `ngertiin-backend`, source repo ini, path `compose.production.yml`. Pilih commit yang sama dengan image. Nonaktifkan auto-deploy agar migrasi dan deployment dapat diurutkan.
3. Copy isi `.env.production.example` ke Dokploy Environment, ganti semua placeholder. `BACKEND_IMAGE` tidak menyertakan suffix `-api`, `-worker`, atau `-migrate`. Dokploy menghasilkan `.env` untuk interpolasi Compose; secret hanya diteruskan ke service yang memerlukannya. Jangan mencetak hasil `docker compose config` tanpa `--quiet` ke log karena bisa berisi secret.
4. Sebelum deploy, jalankan migrasi dari terminal server pada checkout release yang dapat diakses Docker, dengan environment backend tersimpan dalam file mode 600. Gunakan file itu sebagai `--env-file` pada perintah berikut (contoh `.env.production`). Ini langkah server, bukan dari laptop yang tidak menjangkau database internal.

```sh
docker compose --env-file .env.production -f compose.production.yml --profile release pull migrate
docker compose --env-file .env.production -f compose.production.yml --profile release run --rm --no-deps migrate
```

5. Hanya lanjut jika migrasi exit 0. Service migrasi memakai profile `release`, sehingga deploy/restart biasa tidak menjalankannya. Jangan aktifkan profile release pada deployment rutin Dokploy. Jangan menjalankan dua migrasi bersamaan.
6. Buat A record `api-ngertiin` ke IP VPS, mulai DNS-only untuk verifikasi sertifikat origin. Di Dokploy Domains, arahkan `api-ngertiin.whoismanik.dev` ke service `api`, container port 3000, path `/`, tanpa strip prefix. Aktifkan HTTPS/Let's Encrypt. Deploy Compose; Dokploy menambahkan routing Traefik dan koneksi network proxy. Tidak perlu reverse proxy baru atau host port 3000.
7. Verifikasi origin HTTPS lalu aktifkan Cloudflare proxy dan SSL Full (strict). Pastikan perubahan SSL tidak merusak subdomain lain. Bypass cache hostname API dan verifikasi streaming tidak tertahan proxy.
8. Periksa `https://api-ngertiin.whoismanik.dev/health/live` dan `/health/ready`. Pastikan log `worker.ready` muncul. Healthcheck API bukan bukti provider/worker berhasil.
9. Jalankan workflow **Deploy Cloudflare frontend**, pilih `web` pada commit release. Setelah login/API lolos, jalankan lagi untuk `www`. Workflow membangun artifact dengan environment production, dry-run, menyimpan artifact 30 hari, lalu deploy. Deployment custom domain dilakukan Wrangler; jangan buat A record frontend ke VPS.

## Release berikutnya dan rollback

Sebelum migrasi, backup database dan periksa kompatibilitas migration dengan versi API/worker lama. Untuk schema yang tidak backward compatible, jadwalkan maintenance: hentikan penerimaan pekerjaan baru, drain job aktif, stop worker/API, migrasi, lalu deploy versi baru. Grace period 120 detik bukan jaminan semua job AI selesai; periksa antrean dan retry/idempotensi saat shutdown.

Urutan: build semua image → backup → migrasi → update `RELEASE_TAG` dan deploy backend → readiness + smoke test → deploy frontend. Jangan jalankan workflow frontend paralel dengan migrasi backend. Environment GitHub dan Dokploy diatur terpisah.

Rollback backend: kembalikan `RELEASE_TAG` ke SHA sebelumnya lalu redeploy, hanya jika schema dan payload antrean masih kompatibel. Rollback frontend: gunakan artifact `dist` release sebelumnya bersama konfigurasi Wrangler dari commit yang sama, lalu `bun run deploy` dari app terkait. Jangan rebuild commit lama dengan environment baru tanpa memeriksa perubahan tersebut.

Jangan otomatis rollback schema atau menjalankan `down -v`. Restore database adalah prosedur pemulihan terpisah, dengan downtime dan potensi kehilangan write setelah backup. Uji restore ke database sementara dahulu.

## Bukti sebelum membuka akses pengguna

- Landing/CTA/video benar, tidak ada localhost; refresh deep link SPA dan route Clerk berhasil.
- Sign-up, login, logout, token expired/unauthenticated, serta isolasi data antarpengguna benar.
- PDF valid berhasil di-upload dan dibaca; file invalid/lebih dari 25 MiB ditolak sesuai konfigurasi.
- R2 put/get/delete, signed URL, CORS dan PDF range request berhasil.
- Satu alur source → OCR → modul → attempt → evaluasi selesai; periksa retry/failed jobs.
- Streaming melalui hostname public berhasil; quota/rate limit tetap bekerja.
- Restart API/worker tidak menghilangkan data; job yang terinterupsi pulih tanpa efek ganda.
- Backup berhasil dan dapat di-restore.

## Operasional

Jadwalkan backup PostgreSQL ke bucket R2 backup melalui Dokploy (uji kompatibilitas destination S3), retensi awal 7 harian/4 mingguan; backup tambahan sebelum perubahan schema. Backup harian memiliki potensi kehilangan write hingga interval backup terakhir. Uji restore berkala dan monitor kegagalan backup. Database backup tidak mencakup objek R2; tetapkan retensi/pemulihan objek sesuai kebutuhan pengguna.

Pantau uptime, 5xx, resource VPS, restart container, umur job tertua, failed jobs, storage, dan biaya provider. Worker tidak memiliki endpoint health HTTP; proses hidup/log startup saja tidak membuktikan antrean bergerak. Compose mengatur rotasi log dan restart policy; alerting eksternal tetap harus dikonfigurasi.

## Referensi

- [Dokploy Compose](https://docs.dokploy.com/docs/core/docker-compose)
- [Dokploy Domains](https://docs.dokploy.com/docs/core/docker-compose/domains)
- [Dokploy backup](https://docs.dokploy.com/docs/core/databases/backups)
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Cloudflare Full strict](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/)
- [Clerk production](https://clerk.com/docs/guides/development/deployment/production)
- [BullMQ production](https://docs.bullmq.io/guide/going-to-production)

## Validasi codebase (10 September 2026)

Typecheck, build seluruh workspace, lint (masih ada warning/info), format, pemeriksaan Drizzle, parsing workflow YAML, Compose production, dan Wrangler dry-run kedua frontend berhasil. Ketiga image (API, worker, migrasi) Linux ARM64 berhasil dibangun; pemeriksaan Drizzle dalam image migrasi berhasil; impor modul workspace pada kedua image dan pemrosesan gambar native sharp pada image API berhasil tanpa koneksi jaringan. File dotenv lokal tidak terbawa ke image API.

## Status provisioning (10 September 2026)

Release backend `8c80e1e7ff519f36f1d01daae8bb469fcb9d5990` berhasil melalui [workflow backend](https://github.com/manikandareas/ngertiin-v2/actions/runs/34441717266). Ketiga image API, worker, dan migrasi untuk AMD64/ARM64 sudah dipublikasikan. Manifest image API dapat diambil tanpa autentikasi registry. Gunakan SHA release ini sebagai `RELEASE_TAG`, bukan commit dokumentasi berikutnya.

Project Dokploy `ngertiin` / `production` menjalankan PostgreSQL 17, Redis 7, dan Compose `ngertiin-backend`. Database terhubung lewat `dokploy-network`, tanpa publish port database. Compose memakai repository HTTPS, branch `main`, path `./compose.production.yml`, dan auto-deploy nonaktif. Environment produksi sudah terpasang. Migrasi dijalankan melalui resource one-shot `ngertiin-migrate` dengan image migrasi release yang sama dan hanya `DATABASE_URL`; proses keluar dengan kode 0 dan log `migrations applied successfully`. Resource migrasi tidak auto-deploy dan tidak perlu dinyalakan pada restart rutin.

API sudah healthy. Endpoint publik `/health/live` dan `/health/ready` mengembalikan HTTP 200, dengan PostgreSQL, Redis, dan storage `up`. `/api/v1/me` tanpa token mengembalikan 401. CORS preflight mengizinkan origin aplikasi dan header Authorization. Worker mencatat `worker.ready` untuk empat antrean; snapshot awal seluruh antrean kosong. Ini belum membuktikan pemrosesan job AI.

Clerk production menggunakan `app-ngertiin.whoismanik.dev` sebagai secondary application. Lima CNAME dan domain sudah verified; endpoint HTTPS `/v1/environment` mengembalikan HTTP 200. Secret lengkap sudah divalidasi lewat Clerk Backend API dan dipasang di Dokploy. Client OAuth Google dan GitHub `Ngertiin whoismanik production` sudah dibuat dan kredensialnya dipasang di Clerk setelah persetujuan. Client Google lama untuk domain `ngerti.in` tetap utuh. Callback keduanya: `https://clerk.app-ngertiin.whoismanik.dev/v1/oauth_callback`. Halaman login tampil di Brave; tombol Google kini mencapai pemilih akun Google tanpa error OAuth. Penyelesaian login menunggu pengguna memilih akun dan memberikan persetujuan provider.

Kedua frontend sudah dipublikasikan dari CLI Wrangler dengan environment production. Web version `2cdedad6-e900-480d-8310-c5802464a130`; landing version `4a519bd9-6718-4d81-9ad8-f43100769d04`. Landing, deep link SPA, dan aset pendukung PDF mengembalikan 200. Perbaikan `78b7d2b` meratakan lokasi aset PDF ke `/pdfjs/cmaps`, `/pdfjs/standard_fonts`, dan `/pdfjs/wasm`; file `.DS_Store` dikecualikan dari upload Worker. GitHub environment `production` dan variable publishable key sudah dibuat; secret token Cloudflare untuk workflow frontend belum dipasang. Deployment CLI tersedia lewat OAuth Wrangler yang telah disetujui.

Bucket R2 `ngertiin-production` tetap private. Uji put, signed GET dengan Range (206), CORS origin aplikasi, dan delete objek sementara berhasil. Video landing pada bucket public yang sudah ada juga mengembalikan 206. Kredensial OpenAI dan Mistral diterima endpoint daftar model (200); belum menjalankan generasi berbayar atau OCR. Tidak ada secret disimpan di repository.

Record A API sudah diproxy Cloudflare setelah origin Let's Encrypt terverifikasi. Configuration Rule `Ngertiin API strict TLS` menerapkan SSL Strict hanya pada `http.host eq "api-ngertiin.whoismanik.dev"`; mode TLS domain lain tidak diubah. Cache Rule `Ngertiin API bypass cache` aktif pada hostname yang sama. Readiness tetap 200 melalui Cloudflare setelah kedua aturan aktif.

Bucket private `ngertiin-backups` memakai token Object Read & Write terpisah yang dibatasi ke bucket ini. Destination Dokploy `ngertiin-production-backups` sudah terhubung. Backup harian aktif pada cron `0 19 * * *`, prefix `postgres/daily`, retensi tujuh backup; backup mingguan aktif pada `0 20 * * 0`, prefix `postgres/weekly`, retensi empat backup. Cron mengikuti timezone scheduler Dokploy; log server yang diamati menggunakan UTC.

Backup manual pertama pada 10 September 2026 berhasil diekspor dan diunggah ke R2 (status deployment `done`). Objek `.sql.gz` berisi PostgreSQL custom-format dump, sehingga restore menggunakan `gzip -dc backup.sql.gz | pg_restore --exit-on-error`, bukan `psql`. Salinan backup berhasil direstore ke container PostgreSQL 17 lokal dengan jaringan nonaktif dan storage tmpfs: 24 tabel public dan 17 catatan migrasi terbaca. Container uji sudah dihapus. Database live tidak disentuh selama uji restore. Keberhasilan jadwal otomatis berikutnya tetap perlu dipantau.

Login pengguna hingga alur source → modul → evaluasi, pemrosesan job provider/Firecrawl, streaming authenticated, dan restart recovery: **NOT RUN**. Infrastruktur, frontend, konfigurasi OAuth, serta backup sudah terpasang; pengujian aplikasi authenticated menunggu login pengguna.
