# Verifikasi M2 — Ketahanan run

Tanggal: 11 September 2026. Baseline: `a6b6f44`; bukti diambil dari working tree implementasi M2. Environment: macOS, Bun 1.3.10, PostgreSQL 17, Redis lokal, dan dua proses NestJS API pada port fixture 4311/4312.

M2 diimplementasikan dan diverifikasi lokal. Database fixture `ngertiin_chat_m2` terpisah dari database aplikasi. HTTP/browser memakai identitas fixture pada harness loopback yang memanggil service produksi; auth guard aplikasi tidak diubah. **Login Clerk nyata dan deployment/proxy production NOT RUN.** Tidak menambahkan unit/integration test suite.

## Perubahan

- Migrasi additive `0018_stale_havok.sql` membuat dan mengisi singleton `chat_admission_slots`. Migrasi diterapkan pada PostgreSQL lokal sebelum API menulis schema baru, juga pada database fixture.
- Admission memakai transaksi idempotency existing, lalu lock global → user → thread. Lock user `FOR NO KEY UPDATE` tetap menserialisasi admission tanpa deadlock dengan FK key-share idempotency. Partial unique aktif per thread dari M1 dipertahankan. Penghitungan run aktif mencakup queued/running/cancelling.
- Rolling window Redis hanya dipakai pada send baru; replay tidak memesan slot baru. Redis admission gagal menghasilkan `503` tanpa run/message baru. Slot rate dilepas jika transaksi gagal; kegagalan melepas reservation bersifat konservatif sampai TTL satu menit.
- Scheduler menjalankan sweep saat startup, termasuk saat model tidak dikonfigurasi. Claim memakai `SKIP LOCKED`; write memakai executor/epoch/status/lease dengan waktu database. Run running tidak dieksekusi ulang otomatis setelah crash.
- Cancel queued langsung terminal; cancel running tidak mereset waktu grace saat diulang. Abort lokal, polling lintas instance, batas tunggu provider, dan sweep menyelesaikan cancellation. Status terminal tidak dapat diubah executor terlambat.
- Snapshot disimpan periodik termasuk saat provider berhenti mengirim delta. Write snapshot executor diserialisasi; status, teks, dan usage final di-commit bersama. History serta snapshot SSE membaca teks/status dalam satu SQL statement agar teks parsial tidak ditandai completed oleh race baca.
- Redis menerbitkan batch UI frame tervalidasi setelah commit. Subscriber subscribe dahulu, memuat snapshot/sequence, membuang overlap, lalu meneruskan delta baru. Gap, Redis disconnect, buffer startup penuh, dan slow writable menutup subscriber. Pemeriksaan status berkala juga mendeteksi publikasi final yang hilang. Run tidak bergantung pada subscriber.
- Middleware agent menerapkan batas model/tool call, prompt per call, sisa output, dan timeout tersisa. Usage disimpan dengan ID call stabil; unknown tidak diperlakukan sebagai nol atau estimasi aktual. Error timeout provider dinormalisasi menjadi `RUN_TIMEOUT`.
- Frontend mendeteksi EOF sebelum finish, beralih ke history/polling, menghentikan indikator streaming saat run terminal, dan membersihkan error koneksi setelah history final tersedia. Draft dan idempotency key untuk request yang belum acknowledged dipertahankan.

## Bukti lokal

| Pemeriksaan | Hasil | Bukti / batas |
| --- | --- | --- |
| Replay serentak dengan key sama, payload berbeda, replay setelah terminal | PASS | [admission-stream.json](./evidence/m2/admission-stream.json); ID sama dan acknowledgment awal `queued` |
| Dua send berbeda pada thread yang sama | PASS | Dua proses; tepat satu `202`, satu `409 CHAT_RUN_ACTIVE` |
| Batas aktif user dan global | PASS | Lintas thread/user/proses; request berlebih `429` |
| Redis rolling window dan admission fail closed | PASS | [policy.json](./evidence/m2/policy.json), [redis-unavailable.json](./evidence/m2/redis-unavailable.json) |
| Cancel queued, cancel lintas instance, completion lebih dahulu | PASS | [admission-stream.json](./evidence/m2/admission-stream.json) |
| Race cancel/completion dan teks terminal immutable | PASS | [budget-race.json](./evidence/m2/budget-race.json); delapan race |
| Provider error, output limit, deadline antrean/run | PASS fixture | [admission-stream.json](./evidence/m2/admission-stream.json) |
| Provider menggantung dan timeout provider | PASS fixture | [cancel-grace.json](./evidence/m2/cancel-grace.json); partial usage saat cancelled. Helper batas grace diperiksa dengan promise yang tidak pernah selesai |
| Step limit | PASS fault injection | [budget-race.json](./evidence/m2/budget-race.json); budget runtime sengaja dihabiskan setelah validasi untuk memeriksa terminal `STEP_LIMIT`, kemudian satu call dengan limit 1 berhasil. Loop multi-call dengan tool nyata NOT RUN; tools M2 tetap kosong |
| Kill executor saat output parsial | PASS | [executor-crash.json](./evidence/m2/executor-crash.json); running → interrupted, teks parsial tetap ada, stale fenced SQL memperbarui nol row |
| Seluruh API mati lalu startup recovery | PASS | [restart.json](./evidence/m2/restart.json); running → interrupted, queued melewati deadline → timed_out, nol run aktif tersisa |
| Subscriber terlambat serta overlap snapshot/delta | PASS | [admission-stream.json](./evidence/m2/admission-stream.json), [stream-faults.json](./evidence/m2/stream-faults.json); teks tidak digandakan |
| Gap sequence, Redis disconnect, startup buffer dan slow writable | PASS Redis/helper | [stream-faults.json](./evidence/m2/stream-faults.json); slow writable memakai response fixture, bukan throttling jaringan production |
| Satu user dan maksimum satu assistant per run | PASS SQL | [policy.json](./evidence/m2/policy.json); run/message counts fixture |
| OpenAI Responses API dan usage aktual | PASS provider | [provider.json](./evidence/m2/provider.json); usage metadata provider dibandingkan dengan aggregate tersimpan, nol tool call |
| Disconnect/remount/reconnect tanpa send otomatis | PASS browser fixture | [browser.json](./evidence/m2/browser.json), [reconnect.png](./evidence/m2/reconnect.png); satu POST, hasil lengkap tanpa duplikasi |
| Cancel dan teks parsial di UI | PASS browser fixture | [browser.json](./evidence/m2/browser.json), [cancel.png](./evidence/m2/cancel.png) |
| Gap Redis → history di UI | PASS browser fixture | [browser-gap.json](./evidence/m2/browser-gap.json); jumlah send tidak bertambah, busy hilang, hasil final tampil |
| Typecheck/build/format/schema | PASS | `bun run typecheck` seluruh workspace; build API/web; `db:check`; `infra:config`; Biome kode dan JSON tersentuh; `git diff --check`. Build web masih memberi warning chunk >500 kB |
| Clerk sungguhan, staging, proxy SSE, deploy/drain/rollback | NOT RUN | Tetap gate rilis M5; tidak ada push/deploy |

Harness dan skrip fault injection sementara tidak menjadi bagian aplikasi. Database fixture dan proses pemeriksaan dibersihkan setelah evidence disalin; percakapan lokal existing tidak dihapus.

Ringkasan database sebelum cleanup berada di [final-database.json](./evidence/m2/final-database.json): nol run aktif; usage tersimpan sama dengan metadata provider.

## Konfigurasi dan batas

Default baru: aktif per user 2, global 20, send 10/menit, model call 6, tool call 8, cancel polling 1000 ms, grace 5000 ms, buffer stream 262144 byte. `.env.example`, schema environment, dan Compose production memakai nilai yang sama. Pengujian fault memakai interval lebih pendek (lease 3000 ms, heartbeat 500 ms, sweep 200 ms, cancel polling 100 ms, grace 500 ms) untuk mengamati transisi tanpa menunggu default production.

Subscriber slow/gap pulih melalui history; tidak ada replay token Redis. Keberhasilan cancel lokal tidak mengklaim upstream berhenti menagih; usage tetap partial jika hasil provider tidak diketahui. M3/M4 belum diimplementasikan.

Integrasi middleware mengikuti [dokumentasi LangChain](https://docs.langchain.com/oss/javascript/langchain/middleware/built-in) dan type/source package terpasang. Protokol stream mengikuti adapter AI SDK terpasang dan kontrak repo.

## Review dan cleanup sebelum commit

Budget per run dipisahkan ke `chat.budget.ts`: batas model/tool call, reservasi usage, dan sisa output memiliki satu pemilik. Executor tetap memiliki transaksi, fencing, timer, dan persistence. Pemetaan error terminal dibuat eksplisit; frontend memakai satu hasil pencarian assistant tersimpan untuk rekonsiliasi stream dan pembersihan error.

Pemeriksaan ulang setelah cleanup: typecheck seluruh workspace, build API/web, `db:check`, `infra:config`, Biome seluruh file TypeScript/JSON yang berubah, dan `git diff --check` **PASS**. Lint repo keluar dengan kode 0 tetapi masih melaporkan 106 warning dan 38 info pada prototype existing; build web masih memberi warning chunk >500 kB.

Smoke check sementara **PASS** untuk reservasi usage sebelum call, sisa output, batas model/tool, callback setelah cancel, pemetaan terminal, abort grace, overlap snapshot/delta, dan gap sequence. Tidak ada test suite baru. Provider, browser, Clerk, race database lintas proses, dan deployment **NOT RUN ulang setelah cleanup**; bukti M2 di atas berasal dari verifikasi sebelum cleanup.
