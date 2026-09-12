# Kontrak AI Chat

Status: **M1–M4 diimplementasikan; chat/retrieval/indexing selalu aktif**. Lihat [verifikasi M4](./m4-verification.md) untuk bukti retrieval dan batas pengujian.

Dokumen ini otoritatif untuk DTO, persistence, streaming, lifecycle, dan konfigurasi chat. Perilaku/otorisasi agent mengikuti [README](./README.md#batas-akses-dan-assessment); urutan delivery dan bukti ada di [implementation](./implementation.md). Konvensi existing dirujuk dari [API Contract §3](../API_CONTRACT.md#3-protocol-conventions), tanpa mendefinisikan ulang envelope/auth/error umum.

## Endpoint

Path thread di bawah relatif terhadap `/api/v1/chat`. `:threadId` dan `:runId` wajib milik pengguna yang terautentikasi; module diambil server dari record thread. Endpoint materi tetap relatif terhadap `/api/v1/modules/:moduleId/chat`. Route thread lama di prefix module tetap tersedia sebagai adapter dengan pemeriksaan kecocokan module. Body tidak menerima `userId`, `role`, system prompt, model, atau riwayat lengkap dari client.

| Method/path | Input | Hasil |
| --- | --- | --- |
| `GET /materials` | `nodeId?`, `after?` UUID | `200`, `{data:{items,nextCursor}}`; 20 materi per halaman; tanpa nodeId menampilkan sumber terkait |
| `POST /materials/preview` | `{target,startCodePoint?}` | `200`, proyeksi teks aman maksimal 12000 code points, revision dan total panjang |
| `GET /threads/:threadId/messages/:messageId/citations/:citationId` | — | `200`, envelope snapshot yang tersimpan; akses pesan dan semua dependensinya diperiksa ulang |
| `POST /threads` | `{title?,moduleId?: UUID \| null}` | `201`, envelope `Thread` |
| `GET /threads` | `cursor?`, `limit?`, `moduleId?` (tanpa filter: semua thread pengguna) | `200`, halaman `Thread` |
| `GET /threads/:threadId` | — | `200`, envelope `Thread` |
| `PATCH /threads/:threadId` | `{title}` | `200`, envelope `Thread` |
| `DELETE /threads/:threadId` | — | `204`, tanpa body; `409 CHAT_RUN_ACTIVE` jika masih aktif |
| `GET /threads/:threadId/messages` | `cursor?`, `limit?` | `200`, halaman `Message` |
| `POST /threads/:threadId/messages` | `SendMessage`, `Idempotency-Key` | `202`, envelope `{messageId,runId,status,eventsUrl}` |
| `GET /threads/:threadId/runs/:runId` | — | `200`, envelope `Run` |
| `POST /threads/:threadId/runs/:runId/cancel` | `{}` | `200`, envelope `Run`; idempotent |
| `GET /threads/:threadId/runs/:runId/events` | Tidak ada cursor token | `200`, AI SDK UI SSE; jalur observasi opsional |

Acknowledgment memakai eventsUrl sesuai route yang dipanggil. Replay antara route canonical dan adapter module berbagi identitas idempotency yang sama; URL respons dinormalisasi setelah replay.

Thread yang dihapus tidak terlihat lagi. DELETE ulang pada tombstone milik pengguna mengembalikan `204`; ID tidak dikenal mengikuti baseline not-found. Penghapusan modul/pengguna harus mengoordinasikan cancellation sebelum purge pesan dan run. Tombstone thread mempertahankan kunci idempotency sampai masa deduplikasi berakhir; retry send ke thread terhapus tidak menghidupkan thread kembali.

## Payload dan pagination

`Thread = {id,moduleId,moduleTitle?,title,createdAt,updatedAt,activeRunId}`; `moduleId`, `moduleTitle`, dan `activeRunId` nullable. Module thread tetap setelah dibuat; PATCH hanya menerima title. Tanpa module, server menolak pageContext/references dan tidak memasang tools module. UI membuat thread saat pesan pertama dikirim, dengan judul dari 80 code points pertama pesan. Title default `Percakapan baru`, trim, panjang 1–120 Unicode code points, tanpa pemanggilan model untuk judul otomatis.

`Message = {id,threadId,runId,sequence,role,parts,contexts,references,createdAt,availability}`. `runId` selalu ada; role `user | assistant`; `availability = available | unavailable`. `parts` adalah subset `UIMessage.parts`: text, tool parts aman, source-document, dan data-citation. System prompt/raw provider transcript tidak dikirim ke browser. `references` memuat referensi eksplisit pesan user, untuk retry dengan konteks asal. `unavailable` memberi `parts: []`, `references: []` dan konteks tanpa body/rentang sensitif, sesuai kebijakan README. Metadata `runId` dan status dipasang saat DTO dikonversi menjadi `UIMessage`.

`ContextReference` memakai discriminated union:

- `{kind:"activity",nodeId,activityId,contentRevision,startCodePoint,endCodePoint}` untuk materi belajar yang diizinkan.
- `{kind:"source",sourceId,sourceContentId,contentRevision,startCodePoint,endCodePoint}` untuk sumber terkait.

Rentang `[startCodePoint,endCodePoint)` terhadap teks normalisasi server, bukan offset HTML/UTF-16. `contentRevision` adalah hash SHA-256 teks normalisasi beserta versi normalizer. Normalizer M3 mengganti CRLF/CR menjadi LF lalu NFC, dengan hash `SHA256("chat-material-v1\n" + text)`. Server memastikan revision dan rentang untuk pembacaan baru masih cocok; mismatch `409 CONTEXT_STALE`. Pembukaan citation lama membaca snapshot, bukan memvalidasi revision terhadap materi terbaru. Page/section diambil dari server, tidak dipercaya dari client.

`SendMessage` berisi `text` nonempty setelah trim, `pageContext?` berupa `{surface:"journey"}` atau `{surface:"node",nodeId}`, `references?` berupa array `ContextReference`, dan `retryOfRunId?`. Page context hanya metadata; node identifier diverifikasi tanpa memuat isi otomatis. Retry eksplisit terminal run membuat pesan/run baru dengan key baru, menyertakan `retryOfRunId`; tidak melanjutkan checkpoint lama. Target retry harus pada thread yang sama dan terminal selain `completed`.

```json
{
  "text": "Jelaskan hubungan konsep ini dengan materi sebelumnya.",
  "pageContext": {"surface": "journey"},
  "references": []
}
```

Contoh response send (UUID ilustratif):

```json
{
  "data": {
    "messageId": "11111111-1111-4111-8111-111111111111",
    "runId": "22222222-2222-4222-8222-222222222222",
    "status": "queued",
    "eventsUrl": "/api/v1/chat/threads/44444444-4444-4444-8444-444444444444/runs/22222222-2222-4222-8222-222222222222/events"
  }
}
```

`Run = {id,threadId,messageId,assistantMessageId,status,createdAt,startedAt,finishedAt,errorCode,usage}`. `assistantMessageId`, `startedAt`, `finishedAt`, `errorCode` nullable. `usage = {inputTokens,outputTokens,totalTokens,coverage}`; hitungan nullable bila tidak diketahui, `coverage = complete | partial | unavailable`. Tidak ada estimasi token yang dilaporkan sebagai usage aktual. Model/provider metadata hanya internal.

Daftar thread canonical diurutkan `(updatedAt DESC,id DESC)`, dengan precision millisecond dan index pengguna/module. Client melakukan deduplikasi berdasarkan ID setelah refetch ketika urutan berubah. Adapter route module lama mempertahankan `(createdAt DESC,id DESC)` dan scope cursor lama; pesan `(sequence DESC,id DESC)`, ditampilkan frontend dalam urutan kronologis. Limit default 20, maksimum 100; cursor opaque mengikat scope dan pasangan urutan terakhir. Halaman pertama history memuat pesan terbaru. Contoh response kosong: `{"data":[],"pageInfo":{"nextCursor":null,"hasNextPage":false}}`. Cursor invalid atau scope berbeda menghasilkan validation error baseline. Snapshot pagination tidak dijanjikan; pesan baru diambil dengan refetch halaman pertama dan deduplikasi ID.

## Admission dan error

Validasi server dilakukan sebelum admission: auth/scope, schema, batas input, referensi, idempotency, lalu konflik run dan admission budget. Kunci mengikuti scope baseline; hash mencakup teks, pageContext, references yang dinormalisasi, dan retryOfRunId. Transaksi menyimpan kunci, pesan user, run queued, dan sequence secara atomik. Replay key/payload sama mengembalikan response `202` awal beserta ID sama, sekalipun run kini terminal; baca status untuk keadaan terbaru. Replay tidak mengonsumsi slot run baru. Konflik payload memakai `IDEMPOTENCY_CONFLICT` baseline.

Lock row thread serta row pengguna saat admission; lock singleton slot global untuk batas lintas pengguna dengan urutan konsisten global → user → thread. Partial unique index melarang dua run aktif per thread. Dua send berbeda secara bersamaan: satu diterima; lainnya `409 CHAT_RUN_ACTIVE`, tanpa menyimpan pesan/kunci send yang ditolak. Client mempertahankan draft, mengambil run aktif, dan meminta kirim ulang setelah terminal. Tidak ada antrean pesan tersembunyi per thread.

| Kondisi | HTTP sebelum SSE / `Run.errorCode` terminal |
| --- | --- |
| Scope milik pengguna lain | Baseline `404 NOT_FOUND` |
| Node terkunci / konteks assessment | `403 NODE_LOCKED` / `403 CHAT_CONTEXT_FORBIDDEN` |
| Bentuk atau panjang input salah | Baseline validation `422` |
| Rate atau konkurensi user/global penuh | `429 RATE_LIMITED` dengan `Retry-After` |
| Infrastruktur admission tidak tersedia | `503 CHAT_UNAVAILABLE`; tidak mengakui run yang belum durable |
| Provider gagal | `PROVIDER_ERROR`, status `failed` |
| Langkah habis / output total habis | `STEP_LIMIT` / `OUTPUT_LIMIT`, status `failed` |
| Deadline | `RUN_TIMEOUT`, status `timed_out` |
| Cancel diterima dan diterapkan | `USER_CANCELLED`, status `cancelled` |
| Lease executor kedaluwarsa | `PROCESS_INTERRUPTED`, status `interrupted` |

`INDEX_NOT_READY` adalah output tool terstruktur, bukan kegagalan run secara otomatis. Tool akses terlarang ditolak tanpa isi; agent dapat memberi penjelasan aman. Error setelah SSE dimulai memakai event error tersanitasi dan status run, bukan mengganti HTTP status.

## Lifecycle run

Enum lengkap: `queued | running | cancelling | completed | failed | cancelled | timed_out | interrupted`. Tiga status pertama aktif; sisanya terminal dan immutable.

1. Run queued tersimpan di PostgreSQL sebagai antrean durable. Scheduler di setiap instance API melakukan claim memakai `FOR UPDATE SKIP LOCKED`, mengisi `executorId`, `leaseEpoch`, `leaseExpiresAt`, dan berpindah ke running. Hanya executor pemenang menjalankan `createAgent`. Tidak menunggu koneksi events; tidak memakai callback response HTTP sebagai pemilik pekerjaan.
2. Executor mengonsumsi stream sampai terminal, memperbarui snapshot pesan assistant secara berkala dan setelah tool selesai. Snapshot mencakup dependensi materi dan parts aman. Snapshot final, usage dan status terminal di-commit dalam satu transaksi **sebelum** completion diterbitkan. Pesan assistant parsial memiliki satu ID yang tetap.
3. Semua write executor memakai fencing `(runId,leaseEpoch,status aktif,lease masih berlaku)` dan waktu database. Kehilangan lease menghentikan output/provider lokal; executor lama tidak dapat menimpa status atau hasil baru. Run running tidak diambil alih untuk mengulang provider otomatis.
4. Sweep lintas instance menandai running/cancelling yang kehilangan lease sebagai interrupted; deadline antrean/run menghasilkan timed_out. Run queued yang belum diklaim boleh diambil instance sehat. Setelah restart, sweep dijalankan sebelum menerima traffic fitur. Tidak bergantung flag in-memory. Bila seluruh API mati, rekonsiliasi terjadi saat instance kembali hidup.
5. Cancel queued langsung cancelled. Cancel running menjadi cancelling; executor membaca flag database, memanggil AbortController khusus run dan menyelesaikan cancelled. Bila provider tak merespons abort, finalisasi lokal setelah grace period, fence write selanjutnya dan tandai usage partial. Biaya upstream mungkin belum diketahui. Completion versus cancellation diputuskan transaksi pertama yang mengunci row: completed yang sudah committed tetap completed; cancelling yang lebih dahulu diterima tidak boleh menjadi completed.
6. Disconnect hanya menutup subscriber. Run berjalan dan menyimpan hasil. Reconnect membaca status/history, lalu poll selama aktif; tidak mengirim ulang pesan otomatis. Retry pengguna menggunakan kontrak retry eksplisit di atas. Partial output terminal ditandai gagal/terhenti dan dikeluarkan dari prompt run berikutnya; retry tidak memasukkan duplikat pesan asal ke prompt.

M1 sudah memakai eksekusi independen dari socket dan hasil durable; M2 mengeraskan konflik lintas instance dan pemulihan restart. Tidak ada milestone yang mengubah janji disconnect menjadi cancellation.

## Streaming dan frontend

Gunakan `useChat` dari `@ai-sdk/react` dengan custom `ChatTransport`: `sendMessages` mengirim hanya pesan baru melalui POST JSON di atas, lalu membuka `eventsUrl` menggunakan authenticated fetch. Jangan memakai `DefaultChatTransport` tanpa adaptasi karena POST menghasilkan acknowledgment, bukan stream. History server adalah otoritas; frontend mengonversi `Message` ke `UIMessage`, menggunakan ID assistant stabil dan mengganti snapshot berdasarkan ID. Tombol cancel memanggil endpoint cancel; stop/abort transport saja hanya melepas koneksi.

API executor mengubah stream LangGraph melalui `toUIMessageStream` dari `@ai-sdk/langchain` (mode `['values','messages','tools']` sesuai contoh agent pada adapter). Normalisasi metadata, sanitasi tool dan persistence ada di ChatService. Adapter bukan penyimpan run. Scope/rahasia tidak boleh dimasukkan ke input tool yang tampil di UI.

M1 mengirim frame teks dari snapshot PostgreSQL committed melalui polling SSE 500 ms; tidak memiliki Redis replay log atau Pub/Sub. Run tetap independen dari socket. Pembatasan client lambat pada M1 langsung menutup subscriber saat write buffer penuh.

Untuk delivery lintas instance M2, executor menerbitkan frame UI tervalidasi ke Redis Pub/Sub setelah menyimpan snapshot; endpoint SSE di instance mana pun dapat subscribe. Subscriber dibuka lalu memuat snapshot durable. Snapshot memuat revision/frame sequence internal; buang frame sampai sequence snapshot, kemudian teruskan delta baru. Pakai snapshot awal hanya untuk state yang sudah dikomit. Redis subscription terputus atau ada gap sequence menutup SSE agar client beralih ke status/history; tidak membatalkan run. Jika snapshot sudah terminal, endpoint menyintesis satu stream hasil tersimpan lalu menutupnya. Kanal/transient buffer tidak menjadi replay log. Slow client diputus setelah buffer terbatas; tidak memberikan backpressure kepada executor.

Snapshot disintesis menjadi rangkaian UI start/text/tool/source yang valid sebelum delta lanjutan; block text yang masih aktif mempertahankan ID sehingga delta tidak digandakan. Frame sebelum snapshot yang belum committed tidak boleh mengalahkan snapshot. M2 wajib memverifikasi race ini. Reconnect produk memakai history/polling, bukan janji replay semua token.

Wire mengikuti [AI SDK UI stream protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol): SSE `data: <JSON>`, header `x-vercel-ai-ui-message-stream: v1`, `Content-Type: text/event-stream`, `Cache-Control: no-cache`, dan terminator `data: [DONE]`. Proxy harus menonaktifkan buffering. Tidak memakai event generation existing.

| Isi | UI frame |
| --- | --- |
| Awal pesan | `start` dengan `messageId` assistant |
| Teks | `text-start`, `text-delta`, `text-end` dengan block ID stabil |
| Tool | `tool-input-start`, `tool-input-delta`, `tool-input-available`, `tool-output-available` atau `tool-output-error` |
| Rujukan | `source-document` untuk identitas sumber dan `data-citation` untuk lokasi internal |
| Status terminal | `data-run-status` tersimpan, lalu `finish`; error juga mengirim `error` tersanitasi |

`Citation = {id,origin,title,reference,excerpt,pageNumber,sectionTitle}`; lokasi nullable dan berasal dari server. ID citation diberikan server dari referensi yang benar-benar dibaca. Model hanya boleh menggunakan marker `[[cite:UUID]]`; backend menerbitkan card hanya untuk ID yang ada dalam evidence ledger dan digunakan di teks. UI mengubah marker valid menjadi tombol angka; marker rekaan tidak menghasilkan card.

`CitationSnapshot = {citation,text,startCodePoint,capturedAt}` menyimpan teks yang diberikan kepada model: kutipan ditambah maksimal 400 code points sebelum/sesudahnya. Sorotan dihitung dari rentang citation relatif ke `startCodePoint` snapshot. Reader bukan preview PDF biner: teks ekstraksi dan nomor halaman tetap tersedia. Snapshot berada di `chat_message_contexts.reference_json` (`kind=material`), dengan snapshot_text/content_revision dan ID row deterministik per pesan/citation. Tidak memerlukan schema atau migrasi baru di M3. Snapshot hanya diinsert, tidak diperbarui; bukti yang diwarisi dapat disalin ke pesan berikutnya dengan citation ID yang sama.

Selected context disimpan atomik saat admission dengan `dependency_only=false`. Seluruh materi yang dibaca tool atau diwarisi dari pasangan history yang dimasukkan ke prompt disimpan pada assistant dengan `dependency_only=true`, meski tidak menjadi card. Snapshot/evidence dan parts di-commit di bawah fence run sebelum publikasi. Checkpoint sebelum model call berikutnya menyimpan hasil tool. History mengeluarkan kedua pesan satu run jika salah satu dependensi tidak dapat diakses; pasangan itu tidak masuk prompt berikutnya. Stream memeriksa akses sebelum setiap batch dengan buffer terbatas.

Arsip sumber/modul tidak mencabut akses pemilik. Update materi tidak mengubah reader lama; dialog menampilkan “Materi saat jawaban dibuat”. Kehilangan akses sungguhan menyembunyikan pesan/card dan menolak reader. Gangguan memuat tetap memiliki aksi coba lagi. Referensi baru yang stale harus dipilih ulang; replay idempotency yang telah committed tetap mengembalikan ID lama tanpa rehydration.

M3 menyimpan `text`, `data-citation`, dan `data-run-status` sebagai parts publik. SSE dan history mapper menyintesis `source-document` dari citation yang sama. Raw tool transcript, input scope, dan provider metadata tidak dikirim ke UI; tools M3 bekerja di agent dengan usage/call count untuk observability.


Contoh stream jawaban langsung (baris kosong adalah pemisah SSE):

```text
data: {"type":"start","messageId":"55555555-5555-4555-8555-555555555555"}

data: {"type":"text-start","id":"text-1"}

data: {"type":"text-delta","id":"text-1","delta":"Hai! Mau bahas apa?"}

data: {"type":"text-end","id":"text-1"}

data: {"type":"data-run-status","data":{"status":"completed"}}

data: {"type":"finish"}

data: [DONE]
```

Contoh frame tambahan: `{"type":"tool-input-available","toolCallId":"call-1","toolName":"read_progress","input":{}}`, diikuti `{"type":"tool-output-available","toolCallId":"call-1","output":{"completedNodes":2,"totalNodes":5}}`. Kutipan memakai `{"type":"source-document","sourceId":"citation-1","mediaType":"text/plain","title":"Materi konsep"}` disertai `data-citation` dengan Citation tervalidasi. Error memakai `{"type":"error","errorText":"Jawaban belum dapat diselesaikan."}`; `data-run-status` membawa status terminal dan errorCode aman. Field aplikasi `data-*` divalidasi di contracts; tidak mengubah nama frame standar.

## Model persistence

Tabel conversation `chat_threads`, `chat_messages`, `chat_message_contexts`, `chat_runs`, dan `chat_run_usage` sudah ditambahkan pada M1. `chat_admission_slots` ditambahkan pada M2; tabel knowledge ditambahkan pada M4 melalui `0019_slim_nextwave`. Dedicated Chat memakai migrasi `0020_confused_newton_destine`: module nullable dan index daftar terbaru. UUID FK mengikuti tabel pengguna/modul existing; timestamps memakai waktu database. DTO tidak mengekspos row internal.

| Tabel | Kolom inti dan constraint |
| --- | --- |
| `chat_threads` | `id,user_id,module_id,title,next_sequence,created_at,updated_at,deleted_at`; module_id nullable; index user/updated/id dan user/module/updated/id, index created lama dipertahankan |
| `chat_messages` | `id,thread_id,run_id,sequence,role,parts_json,content_revision,created_at`; unique thread/sequence; satu user dan maksimum satu assistant per run |
| `chat_message_contexts` | `id,message_id,kind,reference_json,snapshot_text,content_revision,dependency_only`; page metadata tanpa isi, selected context dan semua dependensi baca; snapshot tetap tunduk revalidasi akses |
| `chat_runs` | `id,thread_id,user_message_id,assistant_message_id,status,error_code,executor_id,lease_epoch,lease_expires_at,heartbeat_at,cancel_requested_at,deadline_at,started_at,finished_at,created_at,snapshot_sequence`; partial unique thread untuk status aktif; index status/lease dan status/created |
| `chat_run_usage` | `run_id,call_id,provider,model,input_tokens,output_tokens,total_tokens,coverage`; unique run/call; nullable token unknown, agregasi tidak menghitung ulang retry call yang sama |
| `chat_admission_slots` | Row singleton `id=global`; lock berikutnya memakai row `users` existing (`FOR NO KEY UPDATE`); jumlah slot dihitung dari run aktif dalam transaksi |
| `knowledge_index_versions` | `id,embedding_model,dimensions,normalizer_version,chunker_version,status,created_at`; status building/active/retired; satu versi active |
| `knowledge_documents` | `id,module_id,origin,source_content_id,node_id,activity_id,current_content_revision,deleted_at`; tepat satu identitas origin, unique module/origin/item |
| `knowledge_document_revisions` | `id,document_id,index_version_id,content_revision,status,error_code,created_at,activated_at`; unique document/version/revision; status pending/indexing/ready/failed/obsolete |
| `knowledge_chunks` | `id,document_revision_id,ordinal,text,location_json,content_hash,search_vector,embedding vector(1536)`; unique revision/ordinal, GIN search_vector |

Send memakai `idempotency_records` existing dengan scope chat; retention khusus chat di bawah. FK pesan/run yang melingkar dibuat nullable terlebih dahulu lalu diisi dalam transaksi; constraint role dan unique run/role mencegah duplikasi. Raw tool transcript untuk kelanjutan model disimpan hanya dalam field internal run bila diperlukan, dengan proyeksi aman yang sama; tidak menyimpan chain-of-thought.

Indexing job memakai `{documentId,indexVersionId,contentRevision}` dan key deterministik gabungannya pada BullMQ worker. Worker memastikan sumber masih sama sebelum dan sesudah embedding; upsert chunk dalam staging revision, kemudian atomik tandai ready. Retrieval hanya revision ready yang cocok dengan current_content_revision dan versi indeks aktif. Duplicate delivery tidak membuat embedding ulang jika revision ready; kegagalan sebelum commit mungkin memanggil provider ulang, tanpa menduplikasi row. Sweep merekonsiliasi konten/hash dan job hilang sehingga tidak bergantung sekali publish event. Cutover versi global hanya setelah coverage semua dokumen eligible terpenuhi; query embedding memakai versi aktif yang sama. Chunk lama dibersihkan setelah grace period dan tidak pernah ikut hasil pencarian revision baru.

M4 memakai trigger invalidasi pada perubahan activity/source content, metadata lokasi, kepemilikan, status, relasi sumber, dan scope node/modul. `current_content_revision` nullable selama invalidasi; chunk lama langsung tidak memenuhi filter pencarian. FK cascade menghapus dokumen/revision/chunk bila materi fisik dihapus. Pembacaan bukti tetap memvalidasi revision dan akses melalui ModulesService setelah ranking.

Chunker `paragraph-utf8-v1-{budget}-{overlap}` memakai jumlah byte UTF-8 sebagai batas atas token konservatif: default **maksimal 600 byte per chunk dan 80 byte overlap**, bukan klaim 600 token tokenizer aktual. Paragraf menjadi batas pilihan ketika cukup panjang; paragraf panjang dipotong tanpa merusak code point. Normalizer/proyeksi kutipan dan indexing berbagi utilitas server-only `@ngertiin/shared/knowledge`. Perubahan anggaran chunk mengubah identitas chunker dan memerlukan versi indeks baru.

Rekonsiliasi melakukan scan modul secara keyset, menyimpan dokumen/revision, memublikasikan job setelah commit, dan otomatis mengaktifkan versi building bila coverage lengkap. Scan diserialisasi dengan advisory lock dan SHARE lock tabel materi agar cutover tidak melewatkan perubahan concurrent; tidak ada provider call selama scan. Lock timeout 2 detik dan statement timeout 30 detik membatasi antrean lock/query; kegagalan scan diulang pada interval berikutnya. Indexing mengambil advisory lock per key job, memeriksa materi sebelum/sesudah embedding, dan menulis chunk + status ready secara atomik. Proyeksi rusak ditandai `MATERIAL_INVALID` tanpa menghambat indexing dokumen lain. Semantik ini perlu pengukuran lock/scan pada ukuran staging sebelum rollout besar.

## Konfigurasi

Chat, retrieval, dan indexing selalu aktif; tidak ada feature flag/cohort gate. API wajib memiliki `OPENAI_API_KEY` dan `OPENAI_CHAT_MODEL` saat startup. Indeks tetap memerlukan revision ready yang valid sebelum dapat dipakai sebagai bukti; status pending/failed memakai degradasi terstruktur. Migrasi database dijalankan sebelum service dimulai.

Nilai berikut **default operasional awal**, bukan hasil benchmark. Validasi environment fail-fast; batas token juga tidak boleh melebihi context window model. Chat hanya memakai rate limit, tanpa kuota harian/subscription dan tanpa memakai accounting kuota generation existing.

| Identifier | Default | Alasan / semantik |
| --- | --- | --- |
| `OPENAI_API_KEY` | Secret existing, wajib pada API/worker terkait | Integrasi OpenAI server-side |
| `OPENAI_CHAT_MODEL` | Wajib eksplisit, tanpa default | Model chat independen dari `OPENAI_MODEL` generation; dipilih operator dan diverifikasi kemampuan tools/stream pada M1 |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Keputusan model embedding versi pertama |
| `OPENAI_EMBEDDING_DIMENSIONS` | `1536` | Dimensi default resmi model; konsisten schema/query/worker |
| `KNOWLEDGE_INDEX_VERSION` | `1` | Identitas immutable model+dimensi+normalizer+chunker |
| `CHAT_INPUT_MAX_CODE_POINTS` | `8000` | Membatasi satu input tanpa membatasi percakapan dengan kuota |
| `CHAT_CONTEXT_MAX_REFERENCES` | `5` | Menjaga fokus konteks eksplisit |
| `CHAT_CONTEXT_MAX_CODE_POINTS` | `12000` | Total teks selected context tervalidasi |
| `CHAT_PROMPT_MAX_TOKENS` | `16000` | Total system, history, selected context dan hasil tools per model call |
| `CHAT_OUTPUT_MAX_TOKENS` | `2048` | Total output provider seluruh call run; sisa budget diterapkan pada call berikutnya |
| `CHAT_AGENT_MAX_STEPS` | `6` | Maksimum model invocation; bukan nilai recursionLimit LangGraph yang dihitung berbeda |
| `CHAT_TOOL_MAX_CALLS` | `8` | Mencegah banyak tool paralel melewati batas langkah |
| `CHAT_RUN_TIMEOUT_MS` | `120000` | Deadline dari admission, termasuk queued dan retry |
| `CHAT_PROVIDER_TIMEOUT_MS` | `60000` | Dibatasi lagi sisa deadline run |
| `CHAT_PROVIDER_MAX_RETRIES` | `1` | Hanya kegagalan transient sebelum output; budget run tetap berlaku |
| `CHAT_RATE_LIMIT_PER_MINUTE` | `10` | Send baru per user, rolling window Redis; baseline HTTP limiter tetap berlaku |
| `CHAT_MAX_ACTIVE_RUNS_PER_USER` | `2` | Lintas thread dan instance |
| `CHAT_MAX_ACTIVE_RUNS_GLOBAL` | `20` | Batas deployment termasuk queued/cancelling |
| `CHAT_MAX_EXECUTING_RUNS_PER_INSTANCE` | `4` | Melindungi proses; global admission tetap otoritatif |
| `CHAT_LEASE_MS` / `CHAT_HEARTBEAT_MS` | `30000` / `5000` | Toleransi jeda singkat; heartbeat < lease/3 |
| `CHAT_SWEEP_INTERVAL_MS` | `5000` | Pemulihan lease/deadline secara periodik |
| `CHAT_CANCEL_POLL_MS` / `CHAT_CANCEL_GRACE_MS` | `1000` / `5000` | Cancel lintas instance dengan batas tunggu |
| `CHAT_SNAPSHOT_INTERVAL_MS` | `500` | Snapshot parsial saat ada perubahan; final wajib durable |
| `CHAT_CLIENT_POLL_MS` | `2000` | Reconnect aktif membaca history/status sampai terminal |
| `CHAT_STREAM_BUFFER_MAX_BYTES` | `262144` | Memutus subscriber lambat tanpa menghentikan executor |
| `CHAT_IDEMPOTENCY_RETENTION_HOURS` | `168` | Deduplikasi tujuh hari; setelah TTL key dianggap send baru |
| `KNOWLEDGE_CHUNK_TOKENS` / `KNOWLEDGE_CHUNK_OVERLAP_TOKENS` | `600` / `80` | Batas awal paragraph chunk dan overlap lokal |
| `KNOWLEDGE_SEARCH_CANDIDATES` / `KNOWLEDGE_SEARCH_TOP_K` | `20` / `6` | Per jalur lexical/vector dan hasil gabungan |
| `KNOWLEDGE_RRF_K` | `60` | Konstanta fusion, bobot kedua jalur sama |
| `KNOWLEDGE_EMBEDDING_BATCH_SIZE` | `32` | Batch awal, tetap validasi token/request provider |
| `KNOWLEDGE_INDEX_CONCURRENCY` | `2` | Batasi beban worker awal |
| `KNOWLEDGE_RECONCILE_INTERVAL_MS` | `60000` | Menutup gap job/event yang hilang |
| `KNOWLEDGE_OBSOLETE_RETENTION_HOURS` | `24` | Grace cleanup; bukan izin membaca chunk stale |

Tool query maksimum mengikuti input max; total teks hasil tools dan seluruh prompt dibatasi token budget. Potong history dari pasangan user/assistant tertua, jangan memisahkan tool-call/result; pertahankan pesan baru dan selected context. Retry mengganti pesan asal dalam proyeksi prompt. Jika bagian wajib saja melampaui budget, tolak sebelum provider. Hasil retrieval dipotong sesuai batas chunk dan sisa token. Tidak melakukan summarization tersembunyi. Output parsial karena batas output ditandai terminal sesuai tabel error.

OpenAI mendokumentasikan default `1536` untuk `text-embedding-3-small` serta parameter `dimensions` pada [panduan embeddings resmi](https://developers.openai.com/api/docs/guides/embeddings). Model, dimensi, normalizer, atau chunker yang berubah wajib membuat index version baru dan backfill; dilarang mengganti vector pada versi aktif secara diam-diam. Perubahan dimensi memerlukan kolom/tabel vector baru lewat migrasi, bukan cast paksa. Tidak ada angka biaya atau performa yang sudah diukur dalam blueprint ini.
