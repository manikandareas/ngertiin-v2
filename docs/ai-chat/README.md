# Blueprint AI Chat Ngerti.in

Status: **blueprint pengembangan, belum diimplementasikan**. Disusun 11 September 2026.
Pekerjaan ini hanya dokumentasi; tidak memasang dependency, membuat migrasi, atau mengaktifkan fitur.

## Otoritas dokumen

| Dokumen | Aturan yang dimiliki |
| --- | --- |
| README ini | Perilaku produk, arsitektur, tanggung jawab domain, kebijakan akses agent, strategi retrieval |
| [contracts.md](./contracts.md) | Endpoint, payload, persistence, lifecycle run, streaming, konfigurasi dan default numerik |
| [implementation.md](./implementation.md) | Urutan implementasi, dependency, migrasi, rollout, rollback, acceptance dan bukti |

Konvensi HTTP, autentikasi, envelope, error, identifier, dan idempotency umum mengikuti [API Contract §3](../API_CONTRACT.md#3-protocol-conventions). Blueprint ini menambahkan rancangan chat; belum mengubah baseline executable di `packages/contracts`.
**Keputusan final** adalah aturan normatif di blueprint. **Default operasional** diberi label di kontrak dan dapat dituning. Kualitas retrieval, latency, throughput, dan biaya adalah **belum diukur**, bukan janji produk.

## Perilaku produk dan konteks

Chat berada dalam satu modul, dengan banyak thread untuk setiap pasangan pengguna/modul. Journey dan Node membaca daftar serta pesan thread yang sama. Pemilihan thread dipertahankan ketika berpindah antara keduanya; layout panel, drawer, atau halaman tidak dikunci. Tidak ada thread lintas modul pada versi awal.

Konteks halaman bersifat sementara: halaman Journey atau Node yang sedang dibuka tidak otomatis menambahkan seluruh isinya ke prompt. Konteks percakapan berasal dari pesan tersimpan dan referensi yang dipilih untuk pesan tersebut. Saat mengirim, server menyimpan snapshot konteks halaman yang telah divalidasi sebagai metadata pesan; konten pilihan dan kutipan terikat pada pesan pemakainya. Pindah halaman tidak menulis ulang konteks pesan lama. Client mengirim identifier dan rentang, bukan isi node atau objek riwayat yang dipercaya server.

Agent menjawab sapaan dan percakapan sederhana langsung. Tidak ada tahap wajib planning, retrieval, atau tool call. Pertanyaan lanjutan menggunakan riwayat yang relevan dahulu. Konteks pilihan dapat dibaca langsung; pencarian diperlukan ketika bukti tambahan dibutuhkan. Jawaban berbasis materi menampilkan rujukan yang dapat dibuka ke lokasi asal. Bila bukti tidak tersedia, agent menyatakan keterbatasan dan dapat memberi penjelasan umum tanpa mengklaimnya berasal dari materi modul.

Riwayat disimpan sebagai pesan, tanpa vectorization. Pemilihan riwayat mengikuti anggaran di [kontrak konfigurasi](./contracts.md#konfigurasi). Tidak ada ringkasan permanen otomatis pada versi awal.

## Batas akses dan assessment

Semua jalur baca menerapkan identitas server, kepemilikan modul, relasi materi, dan akses terkini: pengambilan konteks, history, tool, retrieval, dan pembukaan kutipan. Identifier dalam tool tidak boleh mengubah user/module scope. Status node diperiksa melalui aturan domain progression existing, bukan keputusan model.

- Isi node `locked` tidak boleh masuk prompt, hasil tool, chunk yang dikembalikan, atau snapshot history yang ditampilkan. Metadata progres aman boleh menyebut status terkunci tanpa isi aktivitas.
- `activities.evaluation_config`, kunci jawaban, rubrik privat, dan konfigurasi penilaian tidak pernah diindeks atau diteruskan kepada agent. Proyeksi data menggunakan allowlist, bukan menyerialisasikan row database.
- Untuk assessment, chat memberi petunjuk konsep dan cara berpikir. Tidak mengerjakan atau membenarkan jawaban soal aktif; pertanyaan dan opsi assessment tidak diindeks dan tidak diterima sebagai konteks referensi langsung. Teks yang diketik pengguna tetap diperlakukan sebagai input tidak tepercaya. Kebijakan prompt mengarahkan pembahasan ke konsep dan contoh berbeda; ketepatan perilaku ini memerlukan evaluasi, bukan jaminan filter sempurna.
- Sumber asli terkait tetap dapat dicari untuk menjelaskan konsep walaupun node turunannya terkunci. Larangan isi node tidak menjadi larangan konsep pada sumber asli.
- Chat hanya membaca; tidak menyelesaikan node, mengirim attempt, mengubah mastery/progres, atau memberikan XP.

Materi dan teks pengguna adalah data tidak tepercaya: instruksi di dalamnya tidak boleh mengganti system prompt, memperluas scope, atau membuka tool baru. History lama diperiksa kembali; konten yang hak aksesnya dicabut ditampilkan sebagai bagian tidak tersedia dan dikeluarkan dari prompt. Karena jawaban dapat memparafrasekan materi, jika dependensi materi sebuah pesan tidak lagi sah, seluruh pesan assistant terkait disembunyikan dari konteks model dan body history, sambil mempertahankan ID/status. Versi awal menyimpan seluruh referensi yang dibaca run sebagai dependensi jawabannya, bukan hanya yang akhirnya dikutip.

## Arsitektur dan batas tanggung jawab

Agent menggunakan `createAgent` dari `langchain`, berjalan di atas LangGraph OSS dalam proses NestJS API. Tools opsional; tidak menggunakan planner atau graph supervisor terpisah. API memakai `ChatOpenAI` dengan pola integrasi existing dan konfigurasi model chat tersendiri. Frontend memakai AI SDK UI; konversi stream API memakai adapter resmi `@ai-sdk/langchain`.

API memiliki domain `chat`, `knowledge`, dan `ai`, masing-masing **satu service**. Controller hanya autentikasi, validasi DTO, dan delegasi. Lifecycle hooks/scheduler dapat memanggil service tanpa menjadi service orchestration tambahan.

| Pemilik | Tanggung jawab |
| --- | --- |
| API `ChatService` | Thread, history, konteks pesan, admission/idempotency run, executor dan lease, cancellation, persistence, adapter streaming |
| API `KnowledgeService` | Pembacaan konteks/kutipan dan hybrid search; filter akses melalui domain existing; proyeksi materi aman |
| API `AiService` | Konfigurasi `ChatOpenAI`, embedding query, normalisasi error dan usage provider |
| API `ModulesService` existing | Kepemilikan dan proyeksi materi/progres yang aman; perluasan read method bila diperlukan |
| Worker `KnowledgeService` | Indexing, rekonsiliasi perubahan, backfill, aktivasi revision dan pembersihan chunk usang |
| Worker `AiService` existing | Menambahkan embedding batch tanpa mengubah tanggung jawab generation existing |
| Packages | Schema/DTO/job di contracts, tabel/migrasi di database, utilitas murni reusable di shared |

Tidak ada import `apps/api` dari worker atau sebaliknya. Service dengan nama sama pada aplikasi berbeda merupakan implementasi lokal. Kontrak job dan format proyeksi yang diperlukan bersama berada di packages. Worker menjalankan indexing; eksekusi chat tetap pada API dengan model durable run di [kontrak](./contracts.md#lifecycle-run).

```text
apps/api/src/
  chat/
    chat.module.ts
    chat.controller.ts
    chat.service.ts
    learning.agent.ts
    learning.context.ts
    tools/
      search-module-materials.tool.ts
      read-excerpt.tool.ts
      read-progress.tool.ts
    prompts/
      learning.prompt.ts
  knowledge/{knowledge.module.ts,knowledge.service.ts}
  ai/{ai.module.ts,ai.service.ts}
apps/worker/src/
  knowledge/{knowledge.module.ts,knowledge.processor.ts,knowledge.service.ts}
  ai/ai.service.ts                         # existing, diperluas
apps/web/src/features/chat/
  api/                                    # transport dan query
  components/                             # UI reusable Journey/Node
  use-module-chat.ts
packages/contracts/src/api/chat/
packages/contracts/src/jobs/knowledge-indexing.ts
packages/database/src/schema.ts           # tabel tambahan
packages/database/migrations/
```

`*.agent.ts` menyusun model, tools, dan prompt; `*.context.ts` mendefinisikan runtime context immutable berisi scope server serta referensi tervalidasi. Tools tidak memanggil `ChatService` kembali. Instruksi belajar tinggal dalam `prompts/`; persistence dan transport tidak masuk agent definition.

## Tools awal

| Tool | Input model | Layanan tujuan | Output aman |
| --- | --- | --- | --- |
| `search_module_materials` | `query` | `KnowledgeService.search` | Cuplikan, citation ID, lokasi, origin, status indeks |
| `read_excerpt` | Referensi materi dan rentang | `KnowledgeService.readExcerpt` | Kutipan tervalidasi, lokasi dan versi konten |
| `read_progress` | Tidak ada scope dari model | `ModulesService` | Ringkasan progres, status node, tanpa isi terkunci atau evaluasi privat |

Kontrak bentuk referensi mengikuti [model konteks](./contracts.md#payload-dan-pagination). Semua tools read-only, dibatasi runtime budget, dan memakai scope dari server. Direct context hydration oleh server bukan tool call model; sapaan tanpa referensi tidak melakukan hydration materi.

## Retrieval dan indexing

PostgreSQL full-text search dengan konfigurasi `simple` dan pgvector menjadi satu sumber retrieval. Strategi awal: jalankan lexical ranking dan cosine distance pada himpunan **yang sudah disaring aksesnya**, gabungkan ranking dengan reciprocal rank fusion, deduplikasi, lalu ambil hasil sesuai [default kontrak](./contracts.md#konfigurasi). Query pendek tetap dapat memakai full-text search jika embedding provider gagal; tandai hasil sebagai retrieval terdegradasi. Tanpa bukti, jangan membuat kutipan.

Versi awal memakai exact vector search agar filter akses sederhana dan recall tidak bergantung tuning approximate index. `GIN` mendukung full-text; HNSW bukan syarat awal, hanya dipertimbangkan setelah pengukuran. pgvector mendukung exact search dan cosine distance menurut [dokumentasi pgvector](https://github.com/pgvector/pgvector).

Indeks mencakup materi belajar non-assessment hasil generasi dan sumber asli terkait. Relasi sumber existing ditelusuri dari `modules.generation_request_id` melalui `generation_request_sources` ke `sources` dan `source_contents`. Origin `generated_material` dan `original_source` tetap berbeda. Chunk mempertahankan source/node/activity ID yang relevan, posisi halaman/section, rentang teks, hash, serta revision. Materi node tersedia di indeks hanya ketika aksesnya mengizinkan; indeks bukan otoritas akses dan filter runtime selalu dijalankan kembali.

Pemotongan mengikuti paragraph/section, tidak mencampur dokumen atau origin. Rentang tetap merujuk teks normalisasi revision yang sama, sehingga overlap tidak menghasilkan rujukan bergeser. Penghapusan/perubahan konten langsung menginvalidasi revision untuk retrieval; background job membuat penggantinya. Chunk revision lama tidak dipakai selama menunggu revision baru. Backfill tidak memblokir jawaban langsung atau pembacaan konteks yang tersedia.

## Dasar repo dan sumber resmi

Pemeriksaan checkout menemukan NestJS/Express di [API package](../../apps/api/package.json), `ChatOpenAI` dan `useResponsesApi` di [worker AiService](../../apps/worker/src/ai/ai.service.ts), model generation di [worker environment](../../packages/contracts/src/environment/models/worker-environment.ts), serta tabel materi/progres di [schema](../../packages/database/src/schema.ts). Dependency chat baru belum terpasang. [Request policy](../../apps/api/src/http/request-policy.interceptor.ts) perlu mengenali route chat; SSE generation existing bukan wire protocol chat.

Sumber resmi diakses saat penyusunan; dukungan dokumentasi bukan hasil uji integrasi:

- [LangChain agents](https://docs.langchain.com/oss/javascript/langchain/agents) mendokumentasikan `createAgent`, model, tools, dan system prompt.
- [LangGraph.js OSS](https://github.com/langchain-ai/langgraphjs) menyediakan library berlisensi MIT. Menjalankan library dalam NestJS adalah keputusan deployment aplikasi ini; bukan menggunakan LangSmith Deployment atau Agent Server berlisensi. Lease, scheduler, dan penyimpanan run merupakan tanggung jawab aplikasi, bukan kemampuan otomatis adapter.
- [AI SDK LangChain adapter](https://ai-sdk.dev/providers/adapters/langchain) mendokumentasikan `toUIMessageStream` dan stream LangGraph. Detail wire dipusatkan di kontrak.
- Model embedding dan dasar dimensinya ada di [konfigurasi kontrak](./contracts.md#konfigurasi).
