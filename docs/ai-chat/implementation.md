# Implementasi AI Chat

Status: **M1–M4 diimplementasikan; bukti lokal: [M1](./m1-verification.md), [M2](./m2-verification.md), [M3](./m3-verification.md), dan [M4](./m4-verification.md). M5 belum dimulai.**

UI/UX: arah prototype sidebar/floating dan maskot **Kumo primary** dipilih pengguna. Redesign diterapkan pada web; review hasil integrasi masih pending. Lihat [verifikasi UI](./ui-redesign-verification.md).

Dedicated Chat menambahkan `/chat`, detail thread, scope module opsional, dan perpindahan Full Screen. Lihat [verifikasi dedicated chat](./dedicated-chat-verification.md) untuk file, migrasi, dan bukti implementasi.

Dokumen ini otoritatif untuk delivery dan verifikasi. Keputusan produk/domain berada di [README](./README.md); payload, schema dan angka operasional berada di [contracts](./contracts.md). Status tiap milestone mengikuti bukti delivery di bawah. Penyusunan blueprint tidak menambahkan test suite.

## Dependency dan kesiapan awal

Checkout memiliki Bun workspaces, NestJS/Express, Drizzle/PostgreSQL, Redis, BullMQ pada worker, React/Vite, serta LangGraph dan `@langchain/openai` pada worker. M1 memasang `langchain@1.5.11`, `@langchain/core@1.2.10`, `@langchain/langgraph@1.4.14`, `@langchain/openai@1.5.12`, `@ai-sdk/langchain@2.0.288`, `ai@6.0.280`, dan `@ai-sdk/react@3.0.283`. Versi API/web dipin; worker tidak diubah.

| Area | Perubahan saat implementasi |
| --- | --- |
| API | Tambahkan `langchain`, `@langchain/core`, `@langchain/langgraph`, `@langchain/openai`, `@ai-sdk/langchain`, `ai`; register chat/knowledge/ai module dan lifecycle scheduler |
| Web | Tambahkan `ai`, `@ai-sdk/react`; custom transport, history mapper, status/cancel dan citation renderer |
| Worker | Gunakan BullMQ existing untuk indexing; perluas AiService untuk embeddings dan register knowledge module |
| Contracts | Tambahkan Zod DTO chat, custom UI data parts, environment API/worker, dan job indexing; export mengikuti pola package existing |
| Database | Tambah schema dan migrasi additive sesuai model persistence kontrak; siapkan extension pgvector sebelum migrasi vector |
| Infrastruktur | Redis untuk pub/sub dan rate limit; PostgreSQL untuk antrean/lease/status; proxy mendukung SSE tanpa buffering |

M1 telah memverifikasi peer dependency adapter serta `createAgent` + Responses API + UI stream melalui provider lokal. AI SDK 6 dipilih untuk format `data-*` dalam kontrak; peningkatan major berikutnya memerlukan review protokol. Nomor versi library baru tidak dikarang dalam blueprint. Validasi melalui [adapter resmi](https://ai-sdk.dev/providers/adapters/langchain) dan [ChatTransport AI SDK](https://ai-sdk.dev/docs/ai-sdk-ui/transport). Tidak memakai LangSmith Deployment/Agent Server; deployment library OSS dan tanggung jawab aplikasi dijelaskan di [README](./README.md#dasar-repo-dan-sumber-resmi).

## M1 — Fondasi percakapan

**Delivery:** kode selesai, migrasi `0017_broken_venom` diterapkan di PostgreSQL lokal. Sidebar kedua di kanan mengikuti [prototype pilihan](../prototype/ai-chat-m1-prototype.html); Journey dan Node memakai komponen yang sama. [Catatan verifikasi](./m1-verification.md) memisahkan bukti browser fixture, provider, database, dan autentikasi nyata.

**Batas M1:** hanya teks dan metadata halaman; referensi materi ditolak sampai M3. Executor mengonsumsi adapter lalu menyimpan snapshot teks; SSE menyintesis frame dari snapshot database yang sudah committed. Redis Pub/Sub, admission user/global, cancellation grace, dan verifikasi fault/race lintas instance tetap M2. Claim/lease/sweep dasar sudah tersedia untuk menghindari thread terkunci selamanya setelah restart lokal, tetapi bukan bukti acceptance M2.

**Prasyarat:** autentikasi dan modul existing tersedia; dependency kompatibel; `OPENAI_CHAT_MODEL` dipilih eksplisit; secret API tersedia di environment pengujian.

**Deliverable:** migrasi thread/message/context/run dasar; CRUD dan pagination; akses server; agent dengan tools kosong; konsumsi stream API independen socket, snapshot final durable; web custom transport dan shared thread selection Journey/Node. Endpoint send mengembalikan acknowledgment dan stream dibaca terpisah sesuai kontrak sejak awal.

**Acceptance:** membuat dua thread dalam modul yang sama, mengganti judul dan membaca ulang; thread yang sama tersedia setelah navigasi Journey→Node; sapaan dijawab singkat dengan nol tool call; pertanyaan lanjutan menggunakan history; akses thread pengguna lain ditolak; pagination tidak menggandakan pesan. Hasil tersimpan tersedia meski halaman ditutup. Visual yang dipilih: sidebar kedua di kanan, composer di bawah, scroll terpisah; pada mobile memakai dialog samping.

**Bukti yang harus dicatat:** typecheck paket tersentuh dan schema DTO; log call/tool count provider tersanitasi; rekaman browser navigasi dan streaming; query read-only pasangan user/assistant dan ID run. Bukti provider/database dan browser fixture: **PASS lokal**, lihat [bukti M1](./m1-verification.md). Browser Clerk/authenticated lintas pengguna dan deployment: **NOT RUN**.

## M2 — Ketahanan run

**Delivery:** kode selesai; migrasi `0018_stale_havok` diterapkan lokal. Verifikasi dua proses API, Redis/database terisolasi, provider, dan browser fixture tercatat di [bukti M2](./m2-verification.md). Clerk nyata dan deployment/proxy production **NOT RUN**.

**Prasyarat:** M1; PostgreSQL/Redis pengujian; dua instance API untuk race lintas instance.

**Deliverable:** transaksi idempotency/admission, partial unique aktif, global/user limits, claim/fencing/heartbeat/sweep, cancellation, snapshot dan pub/sub lintas instance, rekonsiliasi setelah restart, usage aktual per call. Tuntaskan detail [lifecycle](./contracts.md#lifecycle-run) dan [streaming](./contracts.md#streaming-dan-frontend), termasuk subscriber yang bergabung setelah output dimulai.

**Acceptance:** retry request sama menghasilkan ID sama; payload berbeda ditolak; dua pesan bersamaan memiliki tepat satu pemenang; cancellation versus completion konsisten; disconnect tidak menghentikan provider; reconnect membaca hasil tanpa send otomatis. Matikan executor saat streaming lalu nyalakan kembali: run menjadi interrupted setelah lease/sweep, output lama tidak bisa menimpa hasil. Matikan seluruh API dan pulihkan: queued diklaim atau timed_out, running menjadi interrupted, tidak ada run aktif selamanya. Error provider, batas langkah/output, timeout dan cancellation menghasilkan status terminal sesuai kontrak.

**Bukti yang harus dicatat:** request/response tersanitasi dengan key/ID; row count run/message; status sebelum/sesudah fault; lease epoch dan finalisasi race; browser disconnect/reconnect; penggunaan token dibanding respons provider; pub/sub gap dan slow subscriber beralih ke history. Status: **PASS lokal sesuai [bukti M2](./m2-verification.md)**; step limit memakai fault injection budget, tools nyata belum tersedia.

## M3 — Konteks belajar

**Delivery:** implementasi context, tools read-only, pemilih kutipan, citation card, dan reader snapshot selesai. Snapshot immutable menggunakan tabel konteks M1, tanpa migrasi baru. Update/arsip tidak mengubah reader lama; kehilangan akses menyembunyikan pesan dan dependensinya. [Verifikasi M3](./m3-verification.md) memisahkan bukti provider/database/browser fixture dari Clerk dan deployment.

**Prasyarat:** M2; aturan akses/progres existing; DTO proyeksi materi aman.

**Deliverable:** runtime context, direct excerpt hydration, `read_excerpt`, `read_progress`, message references/dependencies, citation reader, kebijakan prompt assessment. Search tool belum diaktifkan hingga M4. Penambahan read method ModulesService mengikuti batas tanggung jawab README, tanpa callback ke ChatService.

**Acceptance:** selected excerpt dijelaskan tanpa vector search; mengganti halaman tidak mengubah konteks pesan lama; scope lintas user/module, revision stale pada referensi baru, node locked dan referensi assessment ditolak. Citation lama tetap membuka snapshot yang sama setelah update/arsip. Prompt/tool/history tidak memuat evaluation config atau kunci jawaban. Hak akses yang dicabut menyembunyikan pesan bergantung materi tersebut. Pertanyaan assessment mendapat petunjuk konsep; chat tidak menulis attempt, progres, mastery, atau XP.

**Bukti yang harus dicatat:** inspeksi proyeksi allowlist; request negatif lintas user; snapshot prompt/tool yang disunting rahasianya; tampilan citation menuju rentang asal; pembandingan tabel progression/XP sebelum/sesudah. Status: **PASS lokal sesuai [bukti M3](./m3-verification.md)**; Clerk nyata dan deployment **NOT RUN**.

## M4 — Knowledge retrieval

**Delivery:** schema/migrasi `0019_slim_nextwave`, worker indexing/reconciliation, hybrid search, tool dan citation selesai. Migrasi serta runtime diverifikasi pada database pgvector terisolasi. Chat, retrieval, dan indexing selalu aktif tanpa feature flag. Target staging dan deployment production **NOT RUN**; detail di [verifikasi M4](./m4-verification.md).

**Prasyarat:** M3; extension pgvector pada target staging; model/dimensi embedding kontrak tersedia; migrasi dan indexing worker terpasang.

**Deliverable:** schema indeks, lexical + vector + fusion, tool `search_module_materials`, job dedup/reconciliation, initial indexing dan backfill, invalidation/revision cutover, citation origin/location, degradasi saat indeks pending/failed. Materi existing ditelusuri lewat relasi schema yang disebut README.

**Acceptance:** pertanyaan lintas materi menemukan bukti dengan origin dan rujukan benar; sumber asli boleh menjelaskan konsep ketika node hasil generasinya locked; isi node locked tetap tidak muncul. Material assessment/kunci tidak masuk embedding request. Duplicate job tidak membuat row ganda; perubahan konten meniadakan revision lama dari hasil segera; index version baru tidak bercampur dengan embedding query lama. Indeks belum siap menghasilkan keterangan terbatas tanpa citation rekaan. Kegagalan embedding query dapat memakai lexical search dengan label degradasi.

**Bukti yang harus dicatat:** extension/version database, dimensi vector, hasil query dan rencana query pada data representatif, coverage backfill, row count per revision, log embedding tersanitasi, contoh rujukan browser dan uji stale/deleted content. Latency query/provider lokal tercatat; biaya aktual belum diukur. Status: **PASS lokal sesuai [verifikasi M4](./m4-verification.md)**; staging/Clerk/deployment NOT RUN.

## M5 — Kesiapan rilis

**Prasyarat:** M1–M4 memenuhi acceptance; staging menyerupai deployment; seluruh default dapat dikonfigurasi.

**Deliverable:** rate policy route chat, metrik/log, evaluasi kualitas, rehearsal deploy/drain/rollback, dokumentasi operator dan bukti release. Tidak menambahkan kuota harian atau subscription.

**Acceptance:** semua batas kontrak diuji pada boundary; limit lintas instance bekerja; logs tidak membocorkan prompt/kunci/konten pribadi; cancellation dan disconnect tidak disalahklasifikasikan; graceful shutdown menolak admission baru pada instance yang berhenti dan run aktif tetap difinalisasi. Semua skenario wajib di tabel berikut memiliki bukti sebelum perluasan rollout; kegagalan akses/assessment leakage menghalangi rilis.

**Bukti yang harus dicatat:** konfigurasi nonsecret, build/typecheck, hasil evaluasi manual berlabel, dashboard status/latency/tool count/usage/queue age/lease expired/index coverage, browser authenticated, provider dan database staging, serta deployment rollback rehearsal. Status: **NOT RUN**.

## Migrasi dan backfill

1. Tambah migrasi conversation secara additive sesuai kontrak, termasuk FK/unique/index. Terapkan dan verifikasi pada target **sebelum** API baru menulis kolom tersebut. Tidak mengubah tabel assessment atau progression demi chat.
2. Verifikasi build/image PostgreSQL target menyediakan pgvector; backup dan rehearsal restore. Jalankan `CREATE EXTENSION IF NOT EXISTS vector` dengan role migrasi berwenang, kemudian migrasi index version/revision/chunk. Extension pgvector 0.8.2 diverifikasi pada container fixture PostgreSQL 17. Compose lokal membangun `ngertiin-postgres:17-vector` dari PostgreSQL 17 Alpine dengan pgvector; host staging/production belum diverifikasi.
3. Setelah migrasi, jalankan API dan worker; startup worker mendaftarkan versi pertama secara otomatis; enumerasi modul dan sumber siap beserta materi belajar eligible, paginasi keyset dan job key deterministik. Persist status/revision sehingga backfill dapat dilanjutkan; reconcile menutup gap event selama scan.
4. Catat coverage eligible/ready/failed serta error tersanitasi. Jangan aktifkan versi sampai semua dokumen eligible pada cutover ready; bila konten berubah saat scan, ulangi rekonsiliasi hingga cutover konsisten. Dokumen baru setelah aktivasi tetap dapat pending tanpa menghalangi chat langsung.
5. Worker mengaktifkan pointer versi secara atomik setelah coverage lengkap; retrieval otomatis memakai versi tersebut. Reindex berikutnya membangun versi baru terpisah; perubahan model/dimensi mengikuti kontrak. Cleanup obsolete sesudah grace period; snapshot citation pesan tidak memerlukan chunk lama untuk ditampilkan, tetapi akses/revision tetap divalidasi.

## Rollout, observability, dan rollback

Chat, retrieval, dan indexing tersedia untuk seluruh pengguna yang berhak mengakses modul, tanpa allowlist/cohort atau feature flag. Pada deployment periksa correctness akses/citation, status terminal, queue age, error provider, timeout, dan feedback kualitas. Target throughput/biaya mengikuti hasil pengukuran staging.

Log terstruktur menggunakan requestId, runId, threadId, status, duration, jumlah model/tool call, usage coverage, errorCode dan indexVersion. Konten pesan, tool body, token Clerk, API key, dan chain-of-thought tidak dicatat secara default. Penggunaan token untuk observability, bukan penagihan atau kuota pengguna. Rate limiter existing perlu klasifikasi khusus chat; cancellation tetap tersedia ketika send admission ditutup.

API di-deploy dengan scheduler in-process dan graceful shutdown: berhenti claim/admission lokal, drain hingga deadline; run yang tidak selesai dipulihkan lewat lease/sweep. Proxy SSE dan Redis harus diuji pada jalur production. Frontend memakai workflow manual [frontend-deploy.yml](../../.github/workflows/frontend-deploy.yml), bukan asumsi push otomatis deploy; API/worker mengikuti [compose production](../../compose.production.yml). Dokumen ini tidak menjalankan deployment.

Rollback dilakukan melalui deploy versi aplikasi yang kompatibel setelah drain; tidak ada toggle fitur. Untuk gangguan indeks, respons `INDEX_NOT_READY` atau lexical fallback tetap membatasi bukti yang belum tersedia. Pertahankan migrasi additive, data, dan snapshot citation. Jangan mengembalikan pointer indeks ke versi yang revision/model-nya tidak lagi cocok; perbaiki atau rebuild indeks. Rehearsal restore merupakan bukti tersendiri.

## Acceptance checklist dan status bukti

Tabel berikut mempertahankan gate rilis lintas milestone; bukti lokal parsial M1 dirinci di [catatan verifikasi](./m1-verification.md). Pemeriksaan tanpa bukti tetap **NOT RUN**. Implementasi kelak mencatat tanggal, commit, environment, langkah, hasil aktual, dan lokasi bukti per baris. Static pass tidak mengubah status browser/provider/database/deployment.

| Skenario wajib | Jenis bukti | Milestone | Status |
| --- | --- | --- | --- |
| “Hi” singkat, nol tool call | Provider + browser + log | M1 | PASS lokal; browser fixture |
| Follow-up memakai riwayat tanpa retrieval tidak perlu | Provider + browser | M1/M3 | PASS provider lokal; browser full conversation NOT RUN |
| Thread bersama Journey/Node, CRUD, pagination | Browser + database | M1 | PASS service/layout fixture; Clerk NOT RUN |
| Dua pengguna/scope silang ditolak | HTTP authenticated + database | M1/M3 | NOT RUN |
| Node locked, assessment config/kunci tidak tersedia | Static proyeksi + provider + database | M3/M4 | PASS proyeksi M3 dan embedding fixture M4 |
| Konteks pilihan, stale revision, akses history dicabut | HTTP + browser + database | M3 | PASS service/database/provider dan browser komponen; HTTP Clerk NOT RUN |
| Tidak ada perubahan progres atau XP | Database sebelum/sesudah | M3 | PASS database fixture |
| Lintas materi dengan citation/origin/lokasi benar | Provider + browser + database | M4 | PASS lokal; browser komponen fixture |
| Idempotency dan dua pesan bersamaan lintas instance | HTTP race + database | M2 | PASS lokal; lihat bukti M2 |
| Disconnect tetap berjalan; reconnect mendapat hasil | Browser + provider + database | M2 | PASS lokal; lihat bukti M2 |
| Provider error, step/output limit, timeout, cancel terminal | Fault injection + provider + database | M2 | PASS lokal; lihat bukti M2 |
| Restart/fencing tidak meninggalkan run aktif | Deployment fault + database | M2 | PASS lokal; lihat bukti M2 |
| Subscriber terlambat/gap/slow client tidak menggandakan teks | Browser + Redis fault + database | M2 | PASS lokal; lihat bukti M2 |
| Reindex tidak membaca chunk lama/duplikasi embedding row | Worker + provider + database | M4 | PASS lokal; race dan BullMQ fixture |
| Indeks belum siap dan lexical fallback | Provider fault + browser | M4 | PASS tool/service; browser pesan degradasi NOT RUN |
| Batas rate/context/token/konkurensi dan graceful shutdown | HTTP + provider + database | M5 | NOT RUN |
| Build/typecheck dependency chat implementasi | Static | M1–M5 | PASS M1–M4; M5 NOT RUN |
| SSE proxy, graceful drain, rollout dan rollback | Deployment | M5 | NOT RUN |

Evaluasi kualitas memakai kumpulan contoh Bahasa Indonesia yang mencakup sapaan, follow-up, kutipan, lintas sumber, bukti kurang, prompt injection dalam materi, assessment aktif, dan akses tercabut. Reviewer mencatat apakah tool diperlukan, bukti mendukung klaim, lokasi citation benar, dan jawaban membantu belajar. Larangan akses merupakan gate tanpa toleransi kebocoran; skor kualitas, latency, token dan biaya harus dilaporkan dari sampel nyata sebelum menetapkan target operasional.

## Verifikasi penyusunan blueprint

Pemeriksaan dokumentasi dilakukan pada tiga file saja: konsistensi otoritas/istilah/status, kesesuaian referensi repo, validitas JSON contoh, resolusi tautan lokal/anchor, dan whitespace diff. Dokumentasi resmi framework/protocol/embedding ditinjau saat penyusunan. Tidak ada runtime agent, browser, provider, database, atau deployment dijalankan; tidak ada test suite ditambahkan. Hasil pemeriksaan akhir dilaporkan pada penyelesaian pekerjaan, bukan dianggap otomatis oleh checklist.
