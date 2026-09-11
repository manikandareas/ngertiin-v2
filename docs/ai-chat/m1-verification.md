# Verifikasi M1 — Fondasi percakapan

Tanggal: 11 September 2026. Bukti implementasi awal diambil dari working tree di atas baseline `8ec08cc`. Environment: macOS, Bun 1.3.10, PostgreSQL 17 dan Redis lokal. Model pengujian dipilih eksplisit `gpt-5.6-luna`; provider OpenAI Responses API. Tidak ada secret, token autentikasi, atau data pengguna nyata di artefak berikut.

M1 diimplementasikan. Verifikasi lokal mencakup database, provider, dan browser fixture. **Acceptance dengan login Clerk sungguhan belum lengkap**; ini bukan persetujuan rollout production atau bukti M2.

## Hasil implementasi

- API `ChatModule`/`ChatService` dan `AiModule`/`AiService`, agent `createAgent` dengan `tools: []`, prompt belajar terpisah.
- Schema Zod strict; body menolak identity, role, model, system prompt, dan history dari client. Referensi materi ditolak sampai M3. Konteks halaman divalidasi melalui `ModulesService` tanpa membaca activity body.
- Migrasi additive `0017_broken_venom.sql`: thread, message, context, run dan usage; FK, urutan pesan, unique run/role, serta partial unique run aktif per thread. Sudah diterapkan di PostgreSQL lokal sebelum eksekusi chat.
- Thread create/list/detail/rename/delete, tombstone delete idempotent, history cursor berdasarkan sequence, dan scope cursor user/module/thread.
- POST send mengembalikan `202` acknowledgment dengan ID pesan/run dan URL events. Idempotency menggunakan penyimpanan existing dengan retention chat tujuh hari.
- Scheduler API mengklaim antrean PostgreSQL. Provider/adapter dikonsumsi oleh executor; socket browser hanya membaca snapshot committed. Final text, status dan usage disimpan dalam satu transaksi.
- History model hanya memuat pasangan completed, dibaca per batch dan dipotong dari yang tertua sesuai token budget. Pesan failed/interrupted tidak menjadi konteks model berikutnya.
- Sidebar kanan menggunakan primitive/token aplikasi, dapat ditutup, dan memiliki composer bawah serta scroll mandiri. AppShell dan NodePlayerLayout menyediakan slot sidebar. Mobile memakai dialog Radix. Pilihan thread berada di cache per user/modul dan bertahan saat berpindah Journey/Node; logout mengganti cache aplikasi.
- Frontend memakai `useChat` dan custom `ChatTransport`: hanya pesan baru dikirim, POST acknowledgment tidak dibatalkan oleh penutupan subscriber, kemudian authenticated fetch ke events. Reopen membaca history/status tanpa send otomatis. Data part status divalidasi dengan schema kontrak.

## Bukti

| Pemeriksaan | Hasil | Artefak / batas bukti |
| --- | --- | --- |
| Frozen install, typecheck seluruh workspace | PASS | `bun install --frozen-lockfile`; `bun run typecheck` |
| Build API dan web | PASS | `bun --cwd apps/api build`; `bun --cwd apps/web build`; web masih mengeluarkan peringatan ukuran chunk >500 kB |
| Schema migrasi | PASS | `bun run db:check`; `bun run db:migrate` sukses lokal |
| Biome file kode yang berubah | PASS | Pemeriksaan hanya path implementasi; tidak mengklaim lint seluruh repo |
| Schema body dan batas judul Unicode | PASS | [boundaries.json](./evidence/m1/boundaries.json): 120 emoji diterima, 121 ditolak; body identity/history ditolak |
| Node page locked, references M3, input terlalu panjang, cursor scope berbeda | PASS service lokal | [boundaries.json](./evidence/m1/boundaries.json) |
| Dua thread, rename, cursor, delete ulang | PASS service/database | [provider-database.json](./evidence/m1/provider-database.json) |
| Thread milik pengguna lain | PASS service/database | User fixture kedua mendapat `404`; HTTP dengan dua sesi Clerk **NOT RUN** |
| Sapaan singkat, nol tool call | PASS provider | [provider-log.jsonl](./evidence/m1/provider-log.jsonl): 1 model call, 0 tool call; jawaban dan usage aktual di [provider-database.json](./evidence/m1/provider-database.json) |
| Follow-up memakai history | PASS provider | Setelah “Hai! Namaku Nara.”, pertanyaan “Siapa namaku tadi?” menghasilkan jawaban yang menyebut Nara |
| Run berjalan tanpa subscriber | PASS provider/database | Kedua run service selesai tanpa membuka endpoint events |
| Pasangan pesan dan ID run | PASS read-only SQL | [run-pairs.txt](./evidence/m1/run-pairs.txt): setiap run memiliki tepat satu user dan satu assistant |
| Sidebar, rename, pergantian konteks Journey/Node | PASS browser fixture | [sidebar-flow.webm](./evidence/m1/sidebar-flow.webm), [node-sidebar.png](./evidence/m1/node-sidebar.png). Komponen produksi; konteks/navigasi harness dan autentikasi fixture, bukan sesi Clerk |
| Custom transport dan SSE | PASS browser fixture + provider | Satu kirim menghasilkan 1 POST acknowledgment, 1 fetch events, 3 frame `text-delta`, dan `[DONE]`; respons `text/event-stream` |
| Pergantian halaman segera setelah kirim | PASS browser fixture | Race acknowledgment yang ditemukan diperbaiki: POST tetap menerima acknowledgment, invalidation dan polling thread menyegarkan history setelah remount tanpa send ulang |
| Thread kehilangan activeRunId sebelum status terminal terbaca | PASS browser fixture | [reconciliation.json](./evidence/m1/reconciliation.json): jawaban final tampil, teks parsial dan indikator busy hilang; tidak ada browser error pada pemeriksaan ini |
| Scroll AppShell/NodePlayerLayout | PASS browser layout fixture | Area belajar di-scroll tanpa mengubah scroll chat; desktop tidak overflow horizontal |
| Mobile | PASS browser layout fixture | [mobile-sidebar.png](./evidence/m1/mobile-sidebar.png): viewport 390×844, composer terlihat, tanpa overflow horizontal |
| Route nyata tanpa token | PASS HTTP | API NestJS asli mengembalikan `401 AUTHENTICATION_REQUIRED`: [auth-required.json](./evidence/m1/auth-required.json) |
| Login Clerk, navigasi route dengan akun sungguhan | NOT RUN | Tidak ada sesi pengguna interaktif yang dipakai untuk acceptance authenticated |
| Redis Pub/Sub/race dua instance/restart fault/cancel grace | NOT RUN | Gate M2; bukan cakupan bukti M1 |
| Deployment/proxy production | NOT RUN | Tidak ada push atau deploy |

Browser menggunakan harness sementara untuk memasang komponen dan layout asli serta menjembatani service API dengan identitas fixture. Harness tidak mengubah auth guard aplikasi dan sudah dihapus. Dua modul dan empat user fixture beserta data chatnya telah dibersihkan setelah bukti read-only disimpan. Tidak menambahkan unit/integration test suite.

## Mengaktifkan lokal

Jalankan PostgreSQL/Redis lalu `bun run db:migrate`. API membutuhkan `CHAT_ENABLED=true`, `OPENAI_CHAT_MODEL` eksplisit, dan `OPENAI_API_KEY`; contoh konfigurasi berada di `.env.example`. Environment API lokal pada sesi ini sudah diisi dengan model dan secret provider existing; file `.env` tetap diabaikan Git. Default deployment tetap `CHAT_ENABLED=false`.

Jalankan `bun dev:api` dan `bun dev:web`, masuk melalui Clerk, lalu buka Journey atau Node milik akun tersebut. Buat dua percakapan, ubah judul, kirim sapaan/follow-up, berpindah halaman saat jawaban berjalan, dan buka kembali thread. Pemeriksaan authenticated ini masih harus dicatat sebelum menutup seluruh acceptance M1.

## Batas milestone berikutnya

M1 sudah menyediakan claim, lease, fencing, sweep, snapshot periodik, dan cancellation dasar untuk menjaga fondasi executable. Belum ada admission slot user/global, rolling rate chat Redis, Pub/Sub, atau bukti race/fault lintas instance. SSE M1 membaca snapshot database setiap 500 ms; reconnect produk membaca history/status. Model context immutable untuk materi, safe excerpts, citations dan tools berada di M3; knowledge schema/worker/vector berada di M4. Rate policy dan rollout lengkap tetap M5.

Referensi integrasi yang diperiksa: [adapter LangChain resmi](https://ai-sdk.dev/providers/adapters/langchain), [ChatTransport](https://ai-sdk.dev/docs/ai-sdk-ui/transport), serta source package terpasang untuk `toUIMessageStream`, `parseJsonEventStream`, `useChat` dan `createAgent`.

## Review dan cleanup sebelum commit

Review 11 September 2026 mempertahankan batas M1. Transport snapshot SSE dipisahkan dari controller ke `chat.stream.ts`; lookup run aktif untuk daftar thread dibatch. Validasi model/prompt hanya berjalan pada admission baru sehingga replay idempotency tetap mengembalikan acknowledgment saat konfigurasi provider berubah. Dependency AI SDK dipin ke versi yang terpasang.

Frontend memulihkan run terakhir dari history untuk retry setelah remount, mempertahankan draft baru saat acknowledgment tiba, dan menyesuaikan interval polling dengan jumlah halaman history. Status run yang diamati diperbarui saat acknowledgment agar pergantian run tidak kembali ke status lama. Prototype diperbaiki untuk heading aksesibel dan callback iterable.

Verifikasi cleanup: frozen install, typecheck workspace (web diulang setelah koreksi target JavaScript), build API/web, `db:check`, dan Biome kode TypeScript/JSON yang berubah PASS. Lint seluruh repo PASS tanpa error, dengan warning/info pada prototype. Smoke check helper SSE untuk completed/failed/cancelled dan replay idempotency tanpa model dengan dependency stub PASS; ini bukan pengujian database/provider atau suite integration.

Browser, Clerk, provider, migrasi database runtime, dan deployment **NOT RUN ulang pada cleanup**. Bukti sebelumnya di atas tetap bukti implementasi awal, bukan verifikasi runtime atas perubahan cleanup. Build web tetap memberi peringatan chunk di atas 500 kB.
