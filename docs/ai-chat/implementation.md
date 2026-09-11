# Implementasi AI Chat

Status: **blueprint pengembangan, belum diimplementasikan**.

Dokumen ini otoritatif untuk delivery dan verifikasi. Keputusan produk/domain berada di [README](./README.md); payload, schema dan angka operasional berada di [contracts](./contracts.md). Seluruh milestone di bawah berstatus **belum dimulai**. Penyusunan blueprint tidak menambahkan test suite.

## Dependency dan kesiapan awal

Checkout memiliki Bun workspaces, NestJS/Express, Drizzle/PostgreSQL, Redis, BullMQ pada worker, React/Vite, serta LangGraph dan `@langchain/openai` pada worker. Belum ada `langchain`, `@ai-sdk/langchain`, `ai`, atau `@ai-sdk/react` di package aplikasi yang diperiksa. Ini baseline file, bukan hasil runtime.

| Area | Perubahan saat implementasi |
| --- | --- |
| API | Tambahkan `langchain`, `@langchain/core`, `@langchain/langgraph`, `@langchain/openai`, `@ai-sdk/langchain`, `ai`; register chat/knowledge/ai module dan lifecycle scheduler |
| Web | Tambahkan `ai`, `@ai-sdk/react`; custom transport, history mapper, status/cancel dan citation renderer |
| Worker | Gunakan BullMQ existing untuk indexing; perluas AiService untuk embeddings dan register knowledge module |
| Contracts | Tambahkan Zod DTO chat, custom UI data parts, environment API/worker, dan job indexing; export mengikuti pola package existing |
| Database | Tambah schema dan migrasi additive sesuai model persistence kontrak; siapkan extension pgvector sebelum migrasi vector |
| Infrastruktur | Redis untuk pub/sub dan rate limit; PostgreSQL untuk antrean/lease/status; proxy mendukung SSE tanpa buffering |

Saat M1, resolve dan pin versi yang kompatibel dalam lockfile, periksa peer dependency adapter, `createAgent`, Responses API dan format stream bersama. Nomor versi library baru tidak dikarang dalam blueprint. Validasi melalui [adapter resmi](https://ai-sdk.dev/providers/adapters/langchain) dan [ChatTransport AI SDK](https://ai-sdk.dev/docs/ai-sdk-ui/transport). Tidak memakai LangSmith Deployment/Agent Server; deployment library OSS dan tanggung jawab aplikasi dijelaskan di [README](./README.md#dasar-repo-dan-sumber-resmi).

## M1 — Fondasi percakapan

**Prasyarat:** autentikasi dan modul existing tersedia; dependency kompatibel; `OPENAI_CHAT_MODEL` dipilih eksplisit; secret API tersedia di environment pengujian.

**Deliverable:** migrasi thread/message/context/run dasar; CRUD dan pagination; akses server; agent dengan tools kosong; konsumsi stream API independen socket, snapshot final durable; web custom transport dan shared thread selection Journey/Node. Endpoint send mengembalikan acknowledgment dan stream dibaca terpisah sesuai kontrak sejak awal.

**Acceptance:** membuat dua thread dalam modul yang sama, mengganti judul dan membaca ulang; thread yang sama tersedia setelah navigasi Journey→Node; sapaan dijawab singkat dengan nol tool call; pertanyaan lanjutan menggunakan history; akses thread pengguna lain ditolak; pagination tidak menggandakan pesan. Hasil tersimpan tersedia meski halaman ditutup. Tidak ada kewajiban tampilan panel tertentu.

**Bukti yang harus dicatat:** typecheck paket tersentuh dan schema DTO; log call/tool count provider tersanitasi; rekaman browser navigasi dan streaming; query read-only pasangan user/assistant dan ID run. Status bukti runtime: **NOT RUN**.

## M2 — Ketahanan run

**Prasyarat:** M1; PostgreSQL/Redis pengujian; dua instance API untuk race lintas instance.

**Deliverable:** transaksi idempotency/admission, partial unique aktif, global/user limits, claim/fencing/heartbeat/sweep, cancellation, snapshot dan pub/sub lintas instance, rekonsiliasi setelah restart, usage aktual per call. Tuntaskan detail [lifecycle](./contracts.md#lifecycle-run) dan [streaming](./contracts.md#streaming-dan-frontend), termasuk subscriber yang bergabung setelah output dimulai.

**Acceptance:** retry request sama menghasilkan ID sama; payload berbeda ditolak; dua pesan bersamaan memiliki tepat satu pemenang; cancellation versus completion konsisten; disconnect tidak menghentikan provider; reconnect membaca hasil tanpa send otomatis. Matikan executor saat streaming lalu nyalakan kembali: run menjadi interrupted setelah lease/sweep, output lama tidak bisa menimpa hasil. Matikan seluruh API dan pulihkan: queued diklaim atau timed_out, running menjadi interrupted, tidak ada run aktif selamanya. Error provider, batas langkah/output, timeout dan cancellation menghasilkan status terminal sesuai kontrak.

**Bukti yang harus dicatat:** request/response tersanitasi dengan key/ID; row count run/message; status sebelum/sesudah fault; lease epoch dan finalisasi race; browser disconnect/reconnect; penggunaan token dibanding respons provider; pub/sub gap dan slow subscriber beralih ke history. Status: **NOT RUN**.

## M3 — Konteks belajar

**Prasyarat:** M2; aturan akses/progres existing; DTO proyeksi materi aman.

**Deliverable:** runtime context, direct excerpt hydration, `read_excerpt`, `read_progress`, message references/dependencies, citation reader, kebijakan prompt assessment. Search tool belum diaktifkan hingga M4. Penambahan read method ModulesService mengikuti batas tanggung jawab README, tanpa callback ke ChatService.

**Acceptance:** selected excerpt dijelaskan tanpa vector search; mengganti halaman tidak mengubah konteks pesan lama; scope lintas user/module, revision stale, node locked dan referensi assessment ditolak. Prompt/tool/history tidak memuat evaluation config atau kunci jawaban. Hak akses yang dicabut menyembunyikan pesan bergantung materi tersebut. Pertanyaan assessment mendapat petunjuk konsep; chat tidak menulis attempt, progres, mastery, atau XP.

**Bukti yang harus dicatat:** inspeksi proyeksi allowlist; request negatif lintas user; snapshot prompt/tool yang disunting rahasianya; tampilan citation menuju rentang asal; pembandingan tabel progression/XP sebelum/sesudah. Status: **NOT RUN**.

## M4 — Knowledge retrieval

**Prasyarat:** M3; extension pgvector pada target staging; model/dimensi embedding kontrak tersedia; migrasi dan indexing worker terpasang.

**Deliverable:** schema indeks, lexical + vector + fusion, tool `search_module_materials`, job dedup/reconciliation, initial indexing dan backfill, invalidation/revision cutover, citation origin/location, degradasi saat indeks pending/failed. Materi existing ditelusuri lewat relasi schema yang disebut README.

**Acceptance:** pertanyaan lintas materi menemukan bukti dengan origin dan rujukan benar; sumber asli boleh menjelaskan konsep ketika node hasil generasinya locked; isi node locked tetap tidak muncul. Material assessment/kunci tidak masuk embedding request. Duplicate job tidak membuat row ganda; perubahan konten meniadakan revision lama dari hasil segera; index version baru tidak bercampur dengan embedding query lama. Indeks belum siap menghasilkan keterangan terbatas tanpa citation rekaan. Kegagalan embedding query dapat memakai lexical search dengan label degradasi.

**Bukti yang harus dicatat:** extension/version database, dimensi vector, hasil query dan rencana query pada data representatif, coverage backfill, row count per revision, log embedding tersanitasi, contoh rujukan browser dan uji stale/deleted content. Latency dan biaya baru dicatat sebagai hasil pengukuran ini. Status: **NOT RUN**.

## M5 — Kesiapan rilis

**Prasyarat:** M1–M4 memenuhi acceptance; staging menyerupai deployment; seluruh default dapat dikonfigurasi.

**Deliverable:** rate policy route chat, feature flags, metrik/log, evaluasi kualitas, rehearsal deploy/drain/rollback, dokumentasi operator dan bukti release. Tidak menambahkan kuota harian atau subscription.

**Acceptance:** semua batas kontrak diuji pada boundary; limit lintas instance bekerja; logs tidak membocorkan prompt/kunci/konten pribadi; cancellation dan disconnect tidak disalahklasifikasikan; feature off menolak admission baru dan run aktif tetap difinalisasi. Semua skenario wajib di tabel berikut memiliki bukti sebelum perluasan rollout; kegagalan akses/assessment leakage menghalangi rilis.

**Bukti yang harus dicatat:** konfigurasi nonsecret, build/typecheck, hasil evaluasi manual berlabel, dashboard status/latency/tool count/usage/queue age/lease expired/index coverage, browser authenticated, provider dan database staging, serta deployment rollback rehearsal. Status: **NOT RUN**.

## Migrasi dan backfill

1. Tambah migrasi conversation secara additive sesuai kontrak, termasuk FK/unique/index. Terapkan dan verifikasi pada target **sebelum** API baru menulis kolom tersebut. Tidak mengubah tabel assessment atau progression demi chat.
2. Verifikasi build/image PostgreSQL target menyediakan pgvector; backup dan rehearsal restore. Jalankan `CREATE EXTENSION IF NOT EXISTS vector` dengan role migrasi berwenang, kemudian migrasi index version/revision/chunk. Ketersediaan extension pada host saat ini belum diverifikasi.
3. Deploy worker knowledge dengan feature retrieval mati. Daftarkan versi pertama; enumerasi modul dan sumber siap beserta materi belajar eligible, paginasi keyset dan job key deterministik. Persist status/revision sehingga backfill dapat dilanjutkan; reconcile menutup gap event selama scan.
4. Catat coverage eligible/ready/failed serta error tersanitasi. Jangan aktifkan versi sampai semua dokumen eligible pada cutover ready; bila konten berubah saat scan, ulangi rekonsiliasi hingga cutover konsisten. Dokumen baru setelah aktivasi tetap dapat pending tanpa menghalangi chat langsung.
5. Aktifkan pointer versi secara atomik, lalu retrieval untuk cohort awal. Reindex berikutnya membangun versi baru terpisah; perubahan model/dimensi mengikuti kontrak. Cleanup obsolete sesudah grace period; snapshot citation pesan tidak memerlukan chunk lama untuk ditampilkan, tetapi akses/revision tetap divalidasi.

## Rollout, observability, dan rollback

Rilis bertahap: staging → allowlist pengguna internal → cohort terbatas yang ditentukan operator → semua pengguna setelah review bukti. Allowlist/cohort adalah konfigurasi deployment, bukan hak subscription. Pada tiap tahap periksa correctness akses/citation, status terminal, queue age, error provider, timeout dan feedback kualitas. Tidak mengklaim target throughput/biaya sebelum pengukuran; operator mencatat baseline dan ambang alert hasil staging sebelum memperbesar cohort.

Log terstruktur menggunakan requestId, runId, threadId, status, duration, jumlah model/tool call, usage coverage, errorCode dan indexVersion. Konten pesan, tool body, token Clerk, API key, dan chain-of-thought tidak dicatat secara default. Penggunaan token untuk observability, bukan penagihan atau kuota pengguna. Rate limiter existing perlu klasifikasi khusus chat; cancellation tetap tersedia ketika send admission ditutup.

API di-deploy dengan scheduler in-process dan graceful shutdown: berhenti claim/admission lokal, drain hingga deadline; run yang tidak selesai dipulihkan lewat lease/sweep. Proxy SSE dan Redis harus diuji pada jalur production. Frontend memakai workflow manual [frontend-deploy.yml](../../.github/workflows/frontend-deploy.yml), bukan asumsi push otomatis deploy; API/worker mengikuti [compose production](../../compose.production.yml). Dokumen ini tidak menjalankan deployment.

Rollback: matikan retrieval untuk gangguan indeks sambil mempertahankan jawaban langsung; matikan admission chat untuk masalah run/akses, lakukan cancellation/drain melalui versi yang masih memahami tabel chat. Kembalikan aplikasi setelah semua run terminal atau lease disapu; jangan meninggalkan executor tanpa reaper. Pertahankan migrasi additive dan data, jangan drop tabel atau extension sebagai rollback rutin. Pointer index hanya boleh kembali ke versi lama bila model query tersedia dan revision kontennya masih cocok; bila tidak, retrieval tetap off sampai rebuild. Rehearsal restore adalah bukti tersendiri, bukan bukti migrasi production telah diterapkan.

## Acceptance checklist dan status bukti

Semua pemeriksaan runtime berikut **NOT RUN** pada tahap dokumentasi. Implementasi kelak mencatat tanggal, commit, environment, langkah, hasil aktual, dan lokasi bukti per baris. Static pass tidak mengubah status browser/provider/database/deployment.

| Skenario wajib | Jenis bukti | Milestone | Status |
| --- | --- | --- | --- |
| “Hi” singkat, nol tool call | Provider + browser + log | M1 | NOT RUN |
| Follow-up memakai riwayat tanpa retrieval tidak perlu | Provider + browser | M1/M3 | NOT RUN |
| Thread bersama Journey/Node, CRUD, pagination | Browser + database | M1 | NOT RUN |
| Dua pengguna/scope silang ditolak | HTTP authenticated + database | M1/M3 | NOT RUN |
| Node locked, assessment config/kunci tidak tersedia | Static proyeksi + provider + database | M3/M4 | NOT RUN |
| Konteks pilihan, stale revision, akses history dicabut | HTTP + browser + database | M3 | NOT RUN |
| Tidak ada perubahan progres atau XP | Database sebelum/sesudah | M3 | NOT RUN |
| Lintas materi dengan citation/origin/lokasi benar | Provider + browser + database | M4 | NOT RUN |
| Idempotency dan dua pesan bersamaan lintas instance | HTTP race + database | M2 | NOT RUN |
| Disconnect tetap berjalan; reconnect mendapat hasil | Browser + provider + database | M2 | NOT RUN |
| Provider error, step/output limit, timeout, cancel terminal | Fault injection + provider + database | M2 | NOT RUN |
| Restart/fencing tidak meninggalkan run aktif | Deployment fault + database | M2 | NOT RUN |
| Subscriber terlambat/gap/slow client tidak menggandakan teks | Browser + Redis fault + database | M2 | NOT RUN |
| Reindex tidak membaca chunk lama/duplikasi embedding row | Worker + provider + database | M4 | NOT RUN |
| Indeks belum siap dan lexical fallback | Provider fault + browser | M4 | NOT RUN |
| Batas rate/context/token/konkurensi dan feature off | HTTP + provider + database | M5 | NOT RUN |
| Build/typecheck dependency chat implementasi | Static | M1–M5 | NOT RUN |
| SSE proxy, graceful drain, rollout dan rollback | Deployment | M5 | NOT RUN |

Evaluasi kualitas memakai kumpulan contoh Bahasa Indonesia yang mencakup sapaan, follow-up, kutipan, lintas sumber, bukti kurang, prompt injection dalam materi, assessment aktif, dan akses tercabut. Reviewer mencatat apakah tool diperlukan, bukti mendukung klaim, lokasi citation benar, dan jawaban membantu belajar. Larangan akses merupakan gate tanpa toleransi kebocoran; skor kualitas, latency, token dan biaya harus dilaporkan dari sampel nyata sebelum menetapkan target operasional.

## Verifikasi penyusunan blueprint

Pemeriksaan dokumentasi dilakukan pada tiga file saja: konsistensi otoritas/istilah/status, kesesuaian referensi repo, validitas JSON contoh, resolusi tautan lokal/anchor, dan whitespace diff. Dokumentasi resmi framework/protocol/embedding ditinjau saat penyusunan. Tidak ada runtime agent, browser, provider, database, atau deployment dijalankan; tidak ada test suite ditambahkan. Hasil pemeriksaan akhir dilaporkan pada penyelesaian pekerjaan, bukan dianggap otomatis oleh checklist.
