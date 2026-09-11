# Verifikasi M3 — Konteks belajar dan citation snapshot

Tanggal: 12 September 2026 (Asia/Makassar). Bukti dari working tree M3, Bun 1.3.10, PostgreSQL/Redis lokal, OpenAI Responses API, dan browser fixture komponen React. Database `ngertiin_chat_m3` terpisah dari database aplikasi; semua materi, pengguna, pertanyaan, dan percakapan bukti adalah fixture. Tidak menambahkan unit/integration test suite, commit, push, atau deployment.

## Delivery

- Proyeksi `ModulesService` hanya membaca lesson/flashcard yang dapat diakses atau sumber yang terkait dengan generation request modul dan dimiliki pengguna. SQL tidak memilih evaluation_config; schema allowlist tidak menyertakan field privat. Assessment dan node locked tidak menjadi materi chat. Arsip tidak mencabut akses pemilik.
- `KnowledgeService` menormalisasi teks (LF, NFC, normalizer v1), memvalidasi revision/rentang Unicode, dan menghasilkan snapshot kutipan dengan maksimal 400 code points konteks di tiap sisi. UI memilih teks dari preview berhalaman 12000 code points; daftar materi memakai pagination 20 item.
- Selected context dihydrate sebelum admission baru dan disimpan atomik bersama pesan/run. Retry idempotent yang sudah committed tidak melakukan hydration ulang. Referensi baru yang stale tetap ditolak.
- Agent memakai `read_excerpt` dan `read_progress`, scope server immutable, budget existing, dan kebijakan assessment. Pencarian/embedding/indexing tidak diaktifkan. Snapshot direct context masuk prompt tanpa tool call wajib. Semua dependensi dari history/tool disimpan, termasuk yang tidak menjadi citation.
- Citation ID dibuat server. Card hanya diterbitkan untuk snapshot yang tersimpan dan marker valid yang digunakan di jawaban. Reader membuka snapshot melalui endpoint yang mengikat user/module/thread/message/citation. Update dan arsip mempertahankan isi reader; akses yang hilang menyembunyikan kedua pesan run, beserta jawaban turunannya yang memakai history tersebut.
- Frame `source-document` dan `data-citation` melewati whitelist Pub/Sub. Stream memeriksa akses setiap batch; batch selama pemeriksaan masuk buffer terbatas dan diproses berurutan. Output dan evidence tetap memakai transaksi/fencing M2.
- Frontend menyediakan pemilih kutipan, chips sebelum kirim, penanda citation, card, reader dengan sorotan, navigasi antar-rujukan, dan coba lagi saat gagal memuat. Retry memakai referensi dan metadata halaman pesan asal. Pesan unavailable tidak dirender, termasuk override stream setelah history mencabut akses.
- Prototype HTML citation juga diselaraskan: reader memakai snapshot tanpa state revision stale/akses dicabut dalam flow normal.
- Tabel `chat_message_contexts` M1 sudah memadai. Tidak ada migrasi/schema database baru. Snapshot disimpan immutable per pesan/citation; ini bukan penyimpanan seluruh PDF per pesan.

## Bukti

| Pemeriksaan | Hasil | Bukti dan batas |
| --- | --- | --- |
| Proyeksi privat, assessment picker, scope lintas user/module, node locked | PASS service/database | [runtime.json](./evidence/m3/runtime.json); marker privat fixture tidak masuk proyeksi. Tidak memakai HTTP Clerk. |
| Direct excerpt, Unicode emoji, citation tersimpan | PASS provider/database | Satu model call, nol tool call pada jawaban pertama. Kutipan sama dengan rentang code points yang dipilih. |
| Follow-up dari history, metadata Node ke Journey | PASS provider/database | Jawaban berikutnya memakai riwayat dengan nol tool call; snapshot pesan asal tetap disimpan. |
| Revision baru versus snapshot lama, idempotency replay | PASS database/service | Setelah isi activity berubah: reader identik, replay mengembalikan run lama, send baru memakai revision lama ditolak `CONTEXT_STALE`. |
| Arsip sumber dan modul | PASS database/service | Reader sumber masih mengembalikan snapshot asli setelah kedua status arsip diubah. |
| `read_excerpt` dan `read_progress` | PASS provider + tool/service | Masing-masing satu tool call dan dua model call pada permintaan eksplisit; tidak ada search tool. |
| Assessment aktif | PASS sampel provider | Sampel akhir memberi pertanyaan penuntun tanpa memilih kandidat jawaban. Uji awal terlalu mengarah ke jawaban, lalu prompt diperketat. Ini sampel terbatas, bukan jaminan seluruh soal aman. |
| Tidak menulis attempt/progres/mastery/XP | PASS database | Snapshot enam tabel sebelum/sesudah identik; mutasi fixture untuk pencabutan akses dilakukan setelah pembandingan ini. |
| Pencabutan akses dan dependensi transitif | PASS service/database | Mengunci node menyembunyikan pasangan asal dan follow-up; reader dan snapshot stream ditolak. |
| Citation Pub/Sub, batch berurutan, revocation, batas buffer | PASS Redis/helper | [stream.json](./evidence/m3/stream.json); source-document/data-citation tervalidasi, tidak duplikat, finish tersedia, konten baru tidak terkirim setelah otorisasi ditolak. |
| SSE run provider | PASS lokal | Enam run pada runtime.json mencapai finish; citation disertakan pada run yang merujuk bukti. Pengujian source-document tambahan dilakukan sesudahnya pada stream.json. |
| Reader/card/picker React | PASS browser fixture | [browser.json](./evidence/m3/browser.json), [desktop](./evidence/m3/reader-desktop.png), [mobile](./evidence/m3/reader-mobile.png). Klik marker, ganti rujukan, Escape/focus restore, seleksi keyboard, mobile 390px, tanpa error runtime. Endpoint fixture reader memakai snapshot hasil provider; bukan login Clerk. |
| Typecheck/build | PASS | Typecheck seluruh workspace; build API/web. Build web masih memberi warning chunk >500 kB. |
| Biome, schema, compose, whitespace | PASS | Biome file TypeScript tersentuh, lint repo (warning/info prototype existing tetap ada), `db:check`, `infra:config`, `git diff --check`. |
| HTTP authenticated lintas pengguna, full Journey/Node + composer dengan Clerk | NOT RUN | Masih memerlukan pengujian autentikasi aplikasi nyata. |
| Provider adversarial assessment/prompt injection menyeluruh | NOT RUN | Evaluasi kualitas dan gate rilis M5 tetap diperlukan. |
| Staging, deployment/proxy, race M2 lintas proses ulang | NOT RUN | Bukti M2 tidak diulang seluruhnya; perubahan stream M3 diverifikasi secara lokal di atas. |

Browser bawaan gagal tersambung karena konfigurasi alat sesi. Verifikasi akhir memakai Chromium lokal dan fixture sementara yang mengimpor komponen produksi. Harness dan fixture sementara dibersihkan setelah evidence disimpan; database aplikasi dan percakapan pengguna tidak diubah.

## Batas operasional

`CHAT_CONTEXT_MAX_REFERENCES=5` dan `CHAT_CONTEXT_MAX_CODE_POINTS=12000` ditambahkan pada schema environment, contoh env, dan Compose production. Budget menghitung teks yang benar-benar dihydrate termasuk konteks sekitar; keseluruhan prompt tetap dibatasi token sebelum setiap model call. Tidak ada kuota generation tambahan.

Snapshot tidak melewati otorisasi. Penghapusan fisik data, perpindahan kepemilikan, atau perubahan kebijakan akses kelak tetap harus mengoordinasikan retensi dan pencabutan akses chat. Produk saat ini memakai arsip; arsip bukan penghapusan bukti.

## Review dan cleanup sebelum commit

Review perubahan terhadap `HEAD` mencakup kesesuaian M3, batas tanggung jawab, otorisasi, dan konsistensi TypeScript/React. Budget `read_excerpt` kini memeriksa dan memasukkan snapshot secara sinkron setelah hydration, sehingga pembacaan tool paralel tidak memakai sisa anggaran yang sama. Pemeriksaan akses menghindari pengecekan target yang sama berulang kali dalam satu batch; batch berikutnya tetap memvalidasi akses ulang. Renderer menyembunyikan marker citation yang baru menerima satu kurung penutup.

Verifikasi cleanup: typecheck workspace, typecheck API sesudah perbaikan, build API/web, Biome kode aplikasi yang disentuh dan JSON evidence, `db:check`, `infra:config`, serta whitespace lulus. Harness sementara memverifikasi dua pemanggilan tool paralel dengan snapshot masing-masing 7000 Unicode code points dan budget 12000: hanya satu diterima; marker parsial disembunyikan sementara marker lengkap dipertahankan. Tidak menambahkan test suite. Lint repository lulus dengan warning/info prototype existing; build web masih memperingatkan chunk >500 kB.

Bukti provider/database/browser sebelumnya tidak dijalankan ulang pada cleanup ini. HTTP Clerk, deployment, dan evaluasi adversarial tetap **NOT RUN** sesuai batas di atas.
