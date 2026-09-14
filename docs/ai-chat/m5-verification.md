# Verifikasi M5 — kesiapan rilis AI Chat

14 September 2026. Base commit `0df1883f169b6934147cee2e19d173c87c8efd5d` + working-tree M5. **Implementasi lokal tersedia; acceptance rilis belum lengkap.** Tidak ada commit/push/deployment. Tidak menambahkan unit/integration test suite; harness disposable dipakai untuk bukti runtime.

## Cakupan produk

Keputusan pengguna terbaru menjadi acuan: standalone chat, module asal opsional, scope per pesan/mention lintas modul, attachment native/OCR, Wikimedia proaktif, budget output 8192 dan deadline 240 detik. README, kontrak dan checklist diselaraskan; aturan lama tidak dipakai untuk menghapus fitur.

## Perubahan

- Rate policy upload/cancel terpisah dan configurable. Send tetap memakai rolling Redis + admission PostgreSQL. Upload fail-closed ketika Redis gagal; cancel mempertahankan fail-open baseline. Redis command/connect timeout dibatasi satu detik. Route parameter hanya dilog sebagai resource ID jika berbentuk UUID.
- Parser multipart kini menerima tepat 10 MiB. Busboy mengirim limit event pada equality; parser diberi MAX+1 dan validator tetap menolak >MAX sebelum storage. HTTP membuktikan 10 MiB → 201, 10 MiB+1 → 413.
- Readiness menjadi 503 saat drain; claim/admission lokal berhenti. Run aktif mendapat drain default 30 detik, lalu PROCESS_INTERRUPTED dengan cancellation grace + 5 detik finalisasi. Claim terlambat tidak memulai provider. Batas konfigurasi di bawah stop grace Compose 120 detik.
- Hook HTTP menutup koneksi setelah module drain sebelum disposal Nest. Pada Bun lokal, socket tracking/forceCloseConnections saja masih membuat close menunggu; closeAllConnections pada hook akhir menyelesaikannya. Default main juga mengaktifkan socket tracking.
- Log acknowledgment menghubungkan requestId/runId/threadId/messageId. Terminal log memuat token/coverage, queue wait, model/tool count, image status dan konfigurasi indexVersion. Sweep recovery dan drain tercatat. Query Wikimedia/alasan bebas model dihapus dari diagnostik; outcome kategoris tetap tersedia.
- Evaluasi menemukan false positive assessment pada label “verifikasi”; prompt membedakan permintaan konsep dari soal aktif. Regresi provider tetap menolak memilih jawaban ujian dan mengungkap rahasia.
- Browser nyata menemukan gambar tersimpan dengan Markdown UUID tanpa prefix. Renderer menormalisasi bare UUID hanya jika terdaftar di pesan; URL/ID asing tetap ditolak. Perbaikan juga berlaku untuk history lama tanpa mengubah data tersimpan.
- [SQL operasional](./m5-operations.sql), [generator dashboard](../../scripts/chat-operations.mjs), [dashboard lokal](./evidence/m5/dashboard.html) dan [runbook](./m5-runbook.md) tersedia. Dashboard berupa snapshot offline; tidak memasang monitoring service baru.

## Bukti lokal

| Pemeriksaan | Hasil / batas bukti |
| --- | --- |
| Rate categories, Redis failure, rolling window, idempotency, concurrent send, owner, user limit, input/DTO bounds, attachment, sweep | PASS, [runtime.json](./evidence/m5/runtime.json). Dua instance service/koneksi, bukan dua proses deployment. |
| Global limit, total attachment tepat 25 MiB vs +1 byte, mention lintas modul/warisan scope/foreign owner | PASS, [additional-runtime.json](./evidence/m5/additional-runtime.json). Batas total memakai metadata fixture dalam transaksi; bukan tiga upload browser. |
| Provider selesai selama drain; admission baru ditolak; readiness 503 | PASS, runtime.json. |
| Deadline drain menginterupsi provider; late completion tidak menimpa; cancel instance lain tetap cancelled | PASS, additional-runtime.json. |
| Disconnect SSE tidak membatalkan run; subscriber terminal menerima gambar sekali; URL gambar owner 200 / foreign owner ditolak | PASS, additional-runtime.json. Response stream fixture + Redis/database/provider nyata; bukan proxy. |
| HTTP controllers, multipart 10 MiB/+1, attachment-only 202, cancel 200, foreign owner 404, rate 429 + Retry-After, app.close | PASS, [http-runtime.json](./evidence/m5/http-runtime.json). Identitas guard disubstitusi **hanya pada harness**; bukan Clerk. |
| Model step/tool/output/context budget dan validasi konfigurasi drain | PASS, [boundaries.json](./evidence/m5/boundaries.json). Budget aktual tanpa call provider. |
| Native PDF + follow-up dari durable history | PASS, runtime.json, provider/database/storage nyata. |
| Snapshot status/usage/queue/index/OCR tanpa konten pribadi | PASS SQL read-only pada database aplikasi lokal; [local-operations.json](./evidence/m5/local-operations.json). Snapshot historis 24 jam, bukan benchmark M5. |

| Renderer registered-only dan cold Redis concurrency / health DTO saat drain | PASS, [renderer.json](./evidence/m5/renderer.json), [final-runtime.json](./evidence/m5/final-runtime.json). Concurrent upload pertama berbagi koneksi Redis; readiness 503 mempertahankan bentuk DTO health existing. |

## Static, konfigurasi dan cleanup

Typecheck dan build seluruh workspace **PASS**; setelah perbaikan akhir Redis/readiness, typecheck/build API diulang. Scoped Biome pada kode perubahan, `bun run db:check`, local Compose, production Compose dengan placeholder nonsecret, local documentation links dan `git diff --check` **PASS**. Build web tetap memberi warning `::highlight` dan chunk besar existing. Global lint masih **FAIL baseline: 53 errors, 118 warnings, 60 infos**; tidak dianggap release gate yang lulus.

Database disposable `ngertiin_m5_verify`, objek storage milik fixture, proses harness dan file harness telah dibersihkan; lihat [cleanup.json](./evidence/m5/cleanup.json). Database/volume aplikasi asli dipertahankan. Dashboard juga dibuka lewat browser dan menampilkan semua kelompok metrik; [events.jsonl](./evidence/m5/events.jsonl) hanya berisi event tersanitasi dari fixture. Tidak ada prompt/key/signed URL di log tersebut.

## Evaluasi kualitas

Enam sampel awal memakai executor durable, PostgreSQL terisolasi, Redis, provider yang dikonfigurasi dan Commons/storage nyata. Jawaban hanya berisi pertanyaan sintetis; lihat `runtime.json`. Sapaan dan hitungan: satu model call, nol tool. Fotosintesis: satu Wikimedia invocation, tiga model calls termasuk review, diagram `Photosynthesis en.svg`. Tanpa gambar: nol tool. Assessment tidak memberikan pilihan benar; prompt injection ditolak. PDF mengingat kode sintetis BIRU-42 pada follow-up.

Setelah klarifikasi prompt, [quality-regression.json](./evidence/m5/quality-regression.json) merekam permintaan konsep dengan label verifikasi, soal ujian eksplisit dan permintaan rahasia. Ketiganya selesai; konsep mendapatkan diagram, ujian/rahasia tetap ditolak. Ini sampel manual berlabel, bukan jaminan probabilistik seluruh prompt. Token aktual dan latensi tersedia di evidence/log terpilih. Biaya invoice/tarif aktual dan target kapasitas staging **belum ditetapkan**.

## Browser authenticated

Browser bawaan gagal karena runtime sandbox metadata. Agent-browser terisolasi menampilkan login; sesi Brave existing kemudian dapat digunakan melalui Computer Use. Chat mandiri nyata dibuat, jawaban tersimpan dan history dibuka ulang. Setelah reload, diagram, caption dan atribusi Wikimedia tampil pada thread `e85c54a9-d116-4856-b4db-76beb1d6e0a1`. [browser.json](./evidence/m5/browser.json) mencatat alur ini. Thread pengujian browser tetap tersedia untuk review; percakapan lama pengguna tidak dihapus.

## Gate yang masih terbuka

- Dua akun Clerk untuk matriks akses HTTP/browser lengkap, termasuk scope tercabut, node locked, citation lintas modul dan assessment leakage end-to-end. Service/HTTP fixture tidak menggantikan gate ini.
- Matriks seluruh format melalui browser authenticated, drag/drop/paste/retry/mobile dan kombinasi mention+attachment; cancellation saat remote OCR benar-benar berjalan serta storage outage cleanup retry belum diulang pada M5.
- Evaluasi retrieval/ranking/citation lintas sumber pada dataset staging representatif, query plans/load, biaya aktual dan target p95/throughput.
- Staging/proxy SSE, dua proses API di jalur deployment, SIGTERM/kill/restart, drain/rollback image kompatibel, serta backup/restore rehearsal. Target staging/akun kedua belum diberikan pada sesi ini.

Semua gate tersebut tetap **NOT RUN**. Runbook sudah menyiapkan langkah konkret; hasil lokal tidak dianggap production-ready.

## Persiapan PR — 14 September 2026

Pemeriksaan lint yang sebelumnya gagal pada tiga prototype chat diperbaiki (button type, SVG dekoratif, fallback font, heading dan callback), tanpa mengubah alur produk. Evidence JSON dan metadata migrasi dirapikan formatnya tanpa mengubah nilai. Template production diselaraskan dengan budget/timeout terbaru dan placeholder model nonkosong agar validasi Compose CI berjalan; operator tetap wajib memasang model valid. Workspace typecheck, lint, format:check, db:check, dan Compose production kini PASS; warning lint lama tetap ada. Ini memperbarui hasil static persiapan PR, tidak mengubah hasil historis dalam evidence atau menyatakan production sudah diuji.
