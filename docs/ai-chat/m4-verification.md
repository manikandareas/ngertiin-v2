# Verifikasi M4 — Knowledge retrieval

Tanggal: 12 September 2026 (Asia/Makassar). Bukti dari working tree M4, Bun 1.3.10, PostgreSQL 17 dengan pgvector 0.8.2, Redis/BullMQ lokal, OpenAI embeddings/Responses API, dan browser komponen React. Seluruh materi/pengguna adalah fixture. Tidak menambahkan test suite; fixture test AiService existing disesuaikan dengan dependency environment baru.

## Aktivasi lokal setelah verifikasi awal

Atas instruksi pengguna, gate chat/retrieval/indexing dihapus dari runtime, schema environment, env example, dan compose. API sekarang memerlukan key/model saat startup. Image PostgreSQL lokal dibangun dengan pgvector dan tetap memakai volume `ngertiin_postgres_data`; migrasi `0019` diterapkan pada database aplikasi `ngertiin`. API/worker berjalan dan backfill selesai: 593 dokumen ready, 4.589 chunk, versi indeks 1 active. Pencarian nyata menghasilkan 6 citation dengan status ready dan tanpa degradasi. Jumlah data utama tetap 16 modul, 185 source content, dan 727 activity. Backup lokal tersimpan di `~/Library/Application Support/ngertiin/backups/before-m4-activation-20260912.dump`. Hasil akhir aktivasi dicatat di [activation.json](./evidence/m4/activation.json). Tabel verifikasi awal di bawah tetap merupakan catatan fixture sebelum aktivasi ini.

## Delivery

- Migrasi additive `0019_slim_nextwave`: empat tabel knowledge, vector(1536), generated `tsvector`/GIN, unique revision/ordinal dan satu versi aktif, FK cascade, trigger invalidasi.
- Worker `KnowledgeService` dan processor BullMQ: enumerasi modul keyset, backfill saat startup dan rekonsiliasi berkala, job key deterministik, advisory lock untuk duplicate delivery, batch embedding, pemeriksaan konten sebelum/sesudah provider, publication atomik, cutover versi setelah coverage lengkap, serta cleanup obsolete setelah grace period.
- API `KnowledgeService`: lexical `simple`, exact cosine search, RRF, deduplikasi overlap, batas evidence, scope/progres sebelum ranking dan revalidasi materi saat membuat citation. Query memakai model/dimensi dari row versi aktif, bukan konfigurasi versi building.
- `search_module_materials` terpasang pada agent. Hasilnya masuk evidence ledger dan persistence/fencing citation M3 yang sama. Indeks pending/failed menghasilkan `INDEX_NOT_READY`; kegagalan embedding query memakai lexical dengan `degraded=true` dan instruksi menjelaskan keterbatasan.
- Proyeksi allowlist dan normalizer/hash dipakai bersama oleh indexing dan kutipan melalui subpath server `@ngertiin/shared/knowledge`. Assessment/evaluation config tidak diserialisasi. Frontend menggunakan card dan snapshot reader existing.

## Bukti verifikasi awal

| Pemeriksaan | Hasil | Bukti/batas |
| --- | --- | --- |
| Migrasi dari database kosong dan `db:check` | PASS lokal | Seluruh migrasi diterapkan pada container fixture terpisah, image `pgvector/pgvector:0.8.2-pg17`. Database aplikasi utama tidak dimigrasikan. |
| Extension, dimensi, coverage dan row per versi/revision | PASS lokal | [runtime.json](./evidence/m4/runtime.json): pgvector 0.8.2, seluruh vector 1536, versi 1 membangun 3 dokumen eligible. |
| Hybrid search, origin, halaman/section dan rentang snapshot | PASS provider/database | Hasil dari sumber asli halaman 7 serta lesson terbuka. Rentang highlight dibandingkan dengan substring snapshot. |
| Locked node dan assessment/private config | PASS fixture | Locked lesson tetap boleh diindeks tetapi tidak masuk hasil untuk node locked. Marker assessment/private config tidak masuk teks embedding; sumber asli tetap tersedia. Scope pengguna lain ditolak pada service. HTTP Clerk NOT RUN. |
| Duplicate ready dan pending job | PASS database/queue | Ready tidak memanggil embedding lagi; dua pemrosesan pending concurrent menghasilkan satu embedding. Unique chunk/revision mencegah row ganda. |
| Perubahan konten sebelum/dalam embedding | PASS fault fixture | Trigger langsung mengosongkan current revision. Update saat provider berjalan menghasilkan obsolete dengan nol chunk yang dipublikasikan. |
| Penghapusan relasi dan konten | PASS database | Sumber yang dilepas dari modul tidak dikembalikan. Delete fisik fixture source content/activity membersihkan dependensi indeks melalui FK cascade. |
| Reindex/cutover/identitas versi | PASS lokal | Versi 1 tetap aktif selama versi 2 building; setelah coverage lengkap pointer pindah ke 2. Mengubah model pada ID versi yang sama ditolak. |
| Indeks belum terbentuk, konten baru belum direkonsiliasi, proyeksi rusak, provider gagal | PASS service/worker | [faults-agent.json](./evidence/m4/faults-agent.json): konten baru memberi status pending; proyeksi rusak hanya menggagalkan dokumennya; retry melalui Queue/Worker BullMQ nyata memulihkan kegagalan embedding. Queue memakai nama fixture terisolasi. |
| Lexical fallback | PASS fault/service | [runtime.json](./evidence/m4/runtime.json) memuat `degraded=true` dengan bukti lexical setelah error embedding query disuntikkan. Browser/model jawaban degradasi NOT RUN. |
| Agent mencari dan mengutip | PASS provider | [faults-agent.json](./evidence/m4/faults-agent.json): 3 model call, 2 search tool call, jawaban mengutip evidence ID sumber asli dan lesson. Bukan uji HTTP/SSE durable end-to-end baru. |
| Card/reader desktop dan mobile | PASS browser fixture | [browser.json](./evidence/m4/browser.json), [desktop](./evidence/m4/reader-desktop.png), [mobile 390px](./evidence/m4/reader-mobile.png). Mengimpor ChatCitedAnswer produksi dengan jawaban/snapshot hasil agent; halaman 7, sorotan, pindah citation, Escape/focus restore, tanpa overflow atau browser error. |
| Progres/attempt/XP | PASS database fixture | Snapshot node_progress dan jumlah attempts/xp_events sebelum/sesudah operasi retrieval identik. |
| Typecheck dan build | PASS | API, worker, web, contracts, database, shared. Build web mengeluarkan warning ukuran chunk >500 kB. |
| Biome, migrasi metadata, compose, whitespace | PASS | Check pada 23 file kode/package tersentuh; `bun run db:check`; compose production dengan env example; `git diff --check`. |
| Test existing AiService | PASS | `bun test src/ai/ai.service.spec.ts` pada worker: 3 pass, 0 fail. Tidak menambah kasus/suite baru. |

Fixture/harness sementara, server browser, queue fixture dan container database pengujian dibersihkan setelah bukti disimpan. Secret, query vector, dan raw provider transcript tidak disimpan dalam evidence. JSON hanya berisi materi fixture, ID, hasil pemeriksaan, serta metadata aman.

## Pengukuran terbatas

[Query plans](./evidence/m4/query-plans.json) memakai 1000 chunk sintetis eligible ditambah 2 chunk fixture yang dapat diakses, masing-masing 1536 dimensi. Exact cosine memproses 1002 kandidat dan mengambil 20 hasil; satu pengukuran execution time **8.005 ms**. Lexical memproses 1000 kecocokan; satu pengukuran **1.287 ms**. Planner memilih scan/join/sort sesuai sampel, bukan HNSW. Expression yang berisi query vector dihapus dari artifact plan.

Sembilan request embedding nyata pada [runtime.json](./evidence/m4/runtime.json) tercatat 294–3523 ms/request. Pemanggilan langsung AiService worker dengan dependency worker sendiri menghasilkan vector 1536 dalam 624 ms. Angka ini mencakup sampel kecil dan bukan percentile, target produksi, atau benchmark kapasitas. Token/biaya embedding aktual **NOT MEASURED**; tidak mengarang estimasi biaya.

## Aktivasi dan operasi

1. Compose lokal membangun image `ngertiin-postgres:17-vector` dari [Dockerfile PostgreSQL](../../infra/postgres/Dockerfile), memakai PostgreSQL 17 Alpine dan pgvector 0.8.2. Volume PostgreSQL existing tetap digunakan. Host staging/production harus menyediakan extension yang sama; rehearsal restore production **NOT RUN**.
2. Jalankan `bun run db:migrate` sebelum API/worker dimulai. Chat, retrieval, dan indexing selalu aktif tanpa feature flag; API memvalidasi key/model saat startup.
3. Worker otomatis mendaftarkan versi, menjalankan startup backfill, dan merekonsiliasi setiap 60 detik. Model awal `text-embedding-3-small`, dimensions `1536`, version `1`. Missing job dipublikasikan ulang setelah status DB diperiksa.
4. Pantau event `knowledge.coverage` (`eligible`, `ready`, `failed`, `missing`, `indexVersion`, `jobs`) dan status berikut. Pointer versi building otomatis menjadi active ketika missing nol dalam scan yang konsisten. Indeks baru yang pending setelah cutover tetap memberi hasil parsial berlabel.

```sql
SELECT id, embedding_model, dimensions, normalizer_version, chunker_version, status
FROM knowledge_index_versions ORDER BY id;

SELECT r.index_version_id, r.status, r.error_code, count(*)
FROM knowledge_document_revisions r
JOIN knowledge_documents d ON d.id = r.document_id
WHERE d.deleted_at IS NULL AND r.content_revision = d.current_content_revision
GROUP BY r.index_version_id, r.status, r.error_code
ORDER BY r.index_version_id, r.status;
```

5. API otomatis memakai indeks aktif setelah coverage siap. Indeks pending atau failed memberi keterangan terbatas; autentikasi, akses node, budget, serta fencing tetap berlaku.
6. Untuk reindex, ubah `KNOWLEDGE_INDEX_VERSION` bersamaan dengan model/chunker yang baru pada worker. Query API tetap memakai versi aktif sebelumnya sampai cutover. Dimensi selain 1536 ditolak environment; perubahan dimensi memerlukan migrasi baru. Retired version tidak diaktifkan ulang otomatis oleh worker lama.
7. Untuk gangguan indeks, perbaiki/rebuild versi tersebut; degradasi terstruktur dan pembacaan kutipan langsung tetap tersedia. Pertahankan schema dan snapshot citation. Cleanup revision obsolete memakai grace 24 jam, bukan izin membaca revision stale.

Scan awal dan cutover memakai SHARE lock tabel materi; provider tidak berjalan di dalam scan. Lock timeout 2 detik dan statement timeout 30 detik berlaku pada rekonsiliasi. Ukuran corpus, lama scan/lock, throughput multi-worker, retry berkepanjangan, dan cleanup setelah 24 jam nyata perlu diukur pada staging sebelum rollout besar. Ini batas operasional yang belum dibuktikan oleh fixture kecil.

Clerk lintas pengguna, database staging, deployment/proxy production, dan biaya aktual tetap **NOT RUN / NOT MEASURED**. M5 belum dimulai.

## Cleanup sebelum commit

Cleanup mempertahankan perilaku M4: query daftar versi building/active dipindahkan keluar dari loop dokumen, lookup kandidat menggunakan map, pemilihan target/message memakai conditional eksplisit, dan padding excerpt memakai konstanta bersama. Tipe hasil pencarian, chunk, helper, dan lifecycle processor dibuat eksplisit.

Verifikasi cleanup: typecheck seluruh workspace, build API/worker, tiga test AiService existing, Biome pada 24 file kode/package tersentuh, `db:check`, validasi JSON evidence/snapshot migrasi, Compose lokal dan production, serta `git diff --check` PASS. Compose production menggunakan env example dengan placeholder `OPENAI_CHAT_MODEL` hanya untuk validasi konfigurasi. Lint seluruh repo selesai tanpa error; 106 warning dan 38 info berada pada prototype existing.

Browser, Clerk, provider, database runtime/migrasi, rebuild image PostgreSQL, dan deployment **NOT RUN ulang pada cleanup**. Bukti runtime sebelumnya tetap merupakan hasil implementasi/aktivasi awal, bukan pengujian ulang perubahan cleanup.
