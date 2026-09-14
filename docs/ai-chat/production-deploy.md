# Deploy AI Chat ke production

Panduan ini mengikuti workflow dan Compose pada branch fitur, diperiksa 14 September 2026. Konfigurasi Dokploy live belum diaudit ulang. Lihat [runbook M5](m5-runbook.md) untuk rehearsal, observabilitas, dan batas verifikasi. Perubahan ini mencakup M1–M5, chat mandiri, mention, attachment/OCR, Wikimedia, dan UI terbaru.

## 1. Merge dan build image

Merge PR ke `main`, kemudian jalankan dari checkout yang memiliki akses GitHub:

```sh
gh workflow run backend-images.yml --ref main
gh run list --workflow backend-images.yml --limit 5 --json databaseId,headSha,status,conclusion
```

Tunggu job validate dan ketiga image selesai sukses. Catat `headSha` run sukses sebagai full SHA kandidat. Backend build **manual**, tidak otomatis karena merge. Image yang harus tersedia:

- `ghcr.io/manikandareas/ngertiin-v2-api:<SHA>`
- `ghcr.io/manikandareas/ngertiin-v2-worker:<SHA>`
- `ghcr.io/manikandareas/ngertiin-v2-migrate:<SHA>`

Pastikan Compose yang dibaca Dokploy cocok dengan kandidat; source `main` dapat bergerak setelah image dibuild. Catat SHA dan tag deployment sebelumnya.

## 2. Backup dan pgvector

Buat backup baru database melalui Dokploy dan verifikasi restore ke database disposable. Pertahankan database, volume, serta objek R2 aplikasi.

Migrasi `0019` membutuhkan extension `vector`. Pada SQL console database target, periksa:

```sql
SELECT version();
SELECT name, default_version, installed_version
FROM pg_available_extensions WHERE name = 'vector';
```

Jika tidak ada baris `vector`, image PostgreSQL belum menyediakan extension. Dokumentasi deployment lama mencatat `postgres:17-alpine`; jangan mengasumsikan image itu sudah memiliki pgvector.

Repo menyediakan `infra/postgres/Dockerfile`, berbasis PostgreSQL 17 Alpine dan pgvector 0.8.2. Pada **host Docker database**, dari checkout kandidat, build image dengan tag lokal unik:

```sh
docker build -f infra/postgres/Dockerfile -t ngertiin-postgres-vector:chat-m5 .
```

Untuk database yang masih memakai PostgreSQL 17 Alpine, jadwalkan maintenance, drain/stop API dan worker, lalu gunakan image tersebut pada resource PostgreSQL Dokploy dengan volume, mount, database/user, dan network yang sama. Pastikan mekanisme deploy Dokploy bisa memakai image lokal; bila selalu pull atau memakai host lain, publish image ke registry yang dapat diakses lebih dahulu. Jangan mengganti major version atau varian OS database secara sembarang.

Tunggu database sehat dan ulangi query extension. Migrasi akan menjalankan `CREATE EXTENSION IF NOT EXISTS vector`; role migrasi harus memiliki izin yang diperlukan. Jika extension sudah tersedia dan kompatibel, langkah penggantian image tidak diperlukan.

## 3. Environment backend

Di `ngertiin-backend`, pertahankan credential production yang sudah ada. Cocokkan `.env.production.example` dan `compose.production.yml`; placeholder template bukan credential atau model valid.

Pastikan API menerima `OPENAI_API_KEY`, `MISTRAL_API_KEY`, dan `OPENAI_CHAT_MODEL` berisi model yang sudah divalidasi untuk tool call, streaming, serta file native. `OPENAI_MODEL` worker tetap terpisah. Storage chat tetap private.

Nilai chat yang harus diselaraskan jika env lama sudah diisi eksplisit:

```dotenv
CHAT_OUTPUT_MAX_TOKENS=8192
CHAT_RUN_TIMEOUT_MS=240000
CHAT_PROVIDER_TIMEOUT_MS=180000
CHAT_UPLOAD_RATE_LIMIT_PER_MINUTE=10
CHAT_CANCEL_RATE_LIMIT_PER_MINUTE=60
CHAT_SHUTDOWN_DRAIN_MS=30000
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536
KNOWLEDGE_INDEX_VERSION=1
```

Versi indeks `1` adalah konfigurasi awal; pertahankan versi aktif yang benar jika production sudah memiliki indeks. Jangan mengubah model/dimensi/chunker tanpa versi baru dan backfill. API dan worker harus memakai konfigurasi indeks yang sama. Tidak ada flag untuk mengaktifkan chat.

## 4. Migrasi, lalu backend

Pada resource one-shot `ngertiin-migrate`, ganti image ke `ghcr.io/manikandareas/ngertiin-v2-migrate:<SHA-kandidat>` dan jalankan satu kali dengan `DATABASE_URL` production. Tunggu proses **exit 0**, bukan hanya status container berhasil dimulai. Migrasi sampai `0021` harus selesai sebelum API baru. Resource migrasi terpisah tidak otomatis mengikuti `RELEASE_TAG` backend.

Setelah migrasi sukses, set `RELEASE_TAG=<SHA-kandidat>` pada `ngertiin-backend`, lalu deploy API dan worker. Pertahankan stop grace 120 detik. Periksa log startup, worker/reconciler indeks, lalu:

```sh
curl -fsS https://api-ngertiin.whoismanik.dev/health/live
curl -fsS https://api-ngertiin.whoismanik.dev/health/ready
```

Keduanya harus 200. Readiness tidak membuktikan provider/retrieval bekerja: pantau backfill sampai materi eligible terindeks dan uji pertanyaan dengan citation.

## 5. Deploy frontend

Setelah backend siap, jalankan:

```sh
gh workflow run frontend-deploy.yml --ref main -f app=web
gh run list --workflow frontend-deploy.yml --limit 5 --json databaseId,headSha,status,conclusion
```

Pastikan SHA frontend cocok dengan release yang dimaksud. Jika `main` sudah bergerak, gunakan ref release yang dipin. Workflow memakai variable Clerk dan secrets Cloudflare dari GitHub environment `production`. Landing `www` tidak perlu dideploy untuk perubahan chat ini.

## 6. Smoke check dan pemantauan

Login ke web production dan uji chat tanpa modul, mention materi/citation, attachment native, ilustrasi Wikimedia beserta attribution, stop, reload/reconnect, serta akses dengan akun kedua. Pastikan send mendapat 202 dan SSE terlihat bertahap melalui hostname production; cache/proxy tidak boleh menahan stream. Verifikasi jalur proxy mendukung durasi run 240 detik plus margin dan upload 10 MiB per file. Jangan menganggap nilai timeout aplikasi otomatis mengubah batas proxy.

Pantau failed/timed_out/interrupted runs, queue, penggunaan provider, OCR, dan coverage indeks melalui [SQL operasi](m5-operations.sql) dan [dashboard](../../scripts/chat-operations.mjs). Rehearsal drain dua proses, proxy, dan rollback yang belum diuji tetap tercatat sebagai belum diverifikasi.

Jika perlu rollback, drain backend dan pilih image yang kompatibel dengan schema, scope, attachment, dan image parts terbaru; rollback frontend ke artifact yang cocok. Versi sebelum chat bukan otomatis target rollback aman. Jangan menjalankan down migration, restore database, atau menghapus volume sebagai rollback rutin.
