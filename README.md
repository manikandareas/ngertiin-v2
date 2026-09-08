# Ngerti.in

Implementasi v1 Ngerti.in: Bun monorepo berisi React/Vite web app, NestJS API,
standalone NestJS worker, serta paket bersama untuk kontrak, database, storage, dan utilitas
infrastruktur.

Schema PostgreSQL awal mengikuti `docs/database-erd.md` dan dikelola sebagai migration SQL
dengan Drizzle Kit. Alur Source, generation, learning, assessment, adaptive intervention, dashboard,
dan lifecycle Module telah diimplementasikan. M9 sudah lolos static readiness gates; sertifikasi
runtime/manual/browser/provider masih tertunda dan dicatat di `docs/release/M9_RELEASE_EVIDENCE.md`.

## Prasyarat

- Bun `1.3.10`
- Docker dengan Docker Compose

## Quickstart

```bash
cp .env.example .env
bun install --frozen-lockfile
bun infra:up
bun db:migrate
bun dev
```

Layanan lokal:

- Landing page: http://localhost:4321 (lihat [apps/www](apps/www/README.md))
- Web: http://localhost:5173/dashboard
- API live: http://localhost:3000/health/live
- API ready: http://localhost:3000/health/ready
- MinIO API: http://localhost:9000
- MinIO console: http://localhost:9001

Nilai Clerk contoh bukan credential nyata. Ganti `VITE_CLERK_PUBLISHABLE_KEY` dan
`CLERK_SECRET_KEY` untuk mengaktifkan sign-in; health checks tidak membutuhkan Clerk.

## Perintah

```bash
bun dev              # landing page, web, API, dan worker
bun dev:www
bun dev:web
bun dev:api
bun dev:worker
bun run build
bun typecheck
bun lint
bun format
bun format:check
bun db:generate      # hasilkan migration setelah mengubah schema
bun db:check         # validasi konsistensi snapshot migration
bun db:migrate       # terapkan migration yang belum dijalankan
bun db:studio        # buka Drizzle Studio
bun infra:config
bun infra:up
bun infra:logs
bun infra:down
bun release:check     # seluruh static release gates, tanpa menjalankan test
bun release:integrity # query read-only terhadap database release candidate
```

Semua aplikasi berjalan native dengan Bun. Docker Compose hanya menjalankan PostgreSQL, Redis,
MinIO, dan initializer bucket `ngertiin`.

## Struktur

```text
apps/
  www/       Astro static landing page, Tailwind v4
  web/       React, Vite, React Router, TanStack Query, Tailwind, shadcn/ui, Motion, Clerk
  api/       NestJS HTTP API dan dependency readiness
  worker/    NestJS application context dan koneksi BullMQ
packages/
  contracts/ Schema Zod lintas proses
  database/  Lifecycle Drizzle/PostgreSQL
  storage/   Kontrak storage dan adapter S3-compatible
  shared/    Konstanta infrastructure-level
```

Web dibuat dengan CLI resmi `create-vite`; API dan worker dibuat dengan Nest CLI resmi. Seluruh
dependency installation dan runtime tetap menggunakan Bun.
