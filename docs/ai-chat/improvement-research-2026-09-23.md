# Riset improvement AI chat Ngerti.in

Tanggal: 23 September 2026. Checkout: `1c61212` beserta working tree saat audit. Cakupan: inspeksi kode, dokumen verifikasi, dan sumber primer. Tidak menjalankan provider, browser, load test, atau deployment. Usulan di bawah belum diimplementasikan; ukuran keberhasilan adalah rancangan evaluasi, bukan hasil pengukuran.

## Kesimpulan

Investasi pertama: evaluasi kualitas yang dapat diulang, ketepatan sumber, dan pembuktian recovery melalui jalur deployment. Fitur pembeda berikutnya: tutor dengan latihan bertahap dan kesinambungan percakapan panjang. Arsitektur existing cukup menjadi dasar; belum ada bukti kebutuhan migrasi framework atau database.

## Kondisi yang ditemukan

| Area | Bukti checkout | Implikasi |
| --- | --- | --- |
| Eksekusi | [ChatService](../../apps/api/src/chat/chat.service.ts): admission, idempotency, lease fencing, snapshot, cancel, recovery; [budget](../../apps/api/src/chat/chat.budget.ts): batas model/tool/output/deadline | Fondasi reliability sudah ada. Prioritasnya menguji kegagalan nyata dan memantau hasil. |
| Retrieval | [KnowledgeService.search](../../apps/api/src/knowledge/knowledge.service.ts): filter akses, lexical + vector, RRF, deduplikasi, revision check, lexical fallback | Sudah memakai hybrid retrieval. Belum terlihat reranking atau keputusan relevansi minimum pada jalur ini. |
| Lintas modul | [search_module_materials](../../apps/api/src/chat/tools/search-module-materials.tool.ts): budget dibagi per scope; hasil tiap scope digabung berurutan | Hipotesis: pembagian rata/urutan scope dapat mengurangi bukti paling relevan saat budget sempit. Perlu fixture sebelum mengubah ranking. |
| Citation | Jalur penyimpanan snapshot `ChatService` menyertakan citation terdaftar yang penandanya muncul dalam teks; [renderer](../../apps/web/src/features/chat/components/chat-citation.tsx) menyediakan salin dan sumber | Validitas ID belum membuktikan klaim didukung kutipan. Semantic faithfulness perlu diukur. |
| History | `ChatService.promptMessages`: memasukkan pasangan pesan completed terbaru sampai batas token | Tidak ditemukan ringkasan pada jalur ini. Detail lama bisa keluar dari konteks walaupun masih tampil di UI. |
| Tutor | [learning.prompt.ts](../../apps/api/src/chat/prompts/learning.prompt.ts): bahasa ramah, sumber, assessment protection, ilustrasi; [read_progress](../../apps/api/src/chat/tools/read-progress.tool.ts) hanya membaca progres | Belum ada alur latihan terstruktur. Larangan menjawab/memvalidasi soal cukup luas sehingga latihan perlu kontrak tersendiri. |
| UX | [conversation](../../apps/web/src/features/chat/components/chat-conversation.tsx), [welcome](../../apps/web/src/features/chat/components/chat-welcome.tsx): suggestion awal, streaming, cancel/retry; citation renderer: copy | Dalam komponen/kontrak yang diperiksa belum ditemukan feedback per jawaban, latihan interaktif, atau regenerasi jawaban completed. Retry run gagal sudah ada. |
| Operasional | [M5 verification](./m5-verification.md), [runbook](./m5-runbook.md) | Dokumen mencatat evaluasi sintetis kecil, dashboard offline, serta gate staging/auth/retrieval yang belum selesai pada saat pencatatan. Status live sekarang belum diverifikasi. |

## Prioritas yang disarankan

P0 = bukti keandalan dan kualitas dasar; P1 = kemampuan belajar utama; P2 = pengembangan setelah data penggunaan. Ukuran S/M/L menunjukkan luas perubahan relatif, bukan estimasi hari.

| Prioritas | Improvement | Dampak yang dituju | Ukuran |
| --- | --- | --- | --- |
| P0 | Dataset evaluasi + regression runner | Perubahan prompt/model/retrieval dapat dinilai secara konsisten | M |
| P0 | Citation faithfulness + perilaku saat bukti kurang | Mengurangi jawaban meyakinkan dengan sumber yang tidak mendukung | M |
| P0 | Acceptance auth/proxy/restart + telemetry aktif | Membuktikan jawaban tetap pulih dan akses terjaga pada deployment | M |
| P1 | Mode Jelaskan / Bimbing / Latihan | Membantu siswa berlatih dan mengoreksi miskonsepsi | M–L |
| P1 | Ringkasan percakapan dengan provenance | Menjaga kesinambungan ketika history panjang | M |
| P1 | Feedback per jawaban | Mengubah keluhan menjadi kasus regresi yang bisa diperbaiki | S–M |
| P1 | Perbaikan retrieval berdasarkan kasus gagal | Menemukan bukti yang tepat untuk bahasa dan materi pengguna | M |
| P2 | Simpan catatan/flashcard, pencarian history, preferensi belajar | Menghubungkan diskusi dengan aktivitas belajar berikutnya | M |

### 1. Evaluasi kualitas sebagai fondasi

Mulai dengan usulan 80–120 kasus berlabel dari materi representatif dan data sintetis: konsep Indonesia, istilah Inggris, typo, follow-up, kutipan, perbandingan dua modul, bukti kosong/kontradiktif, file, assessment, akses tercabut, serta injection di dokumen. Jumlah ini titik awal, bukan ukuran sampel yang menjamin keamanan.

Pisahkan pemeriksaan deterministik (scope/ID/status/akses), penilaian manusia (benar dan mudah dipahami), dan evaluator model yang dikalibrasi dengan manusia. Jalankan sampel berulang untuk kasus penting karena hasil model dapat bervariasi. Simpan model/provider, versi prompt, versi indeks, fixture, token, dan latensi. Gunakan sebagian kasus sebagai holdout.

Laporkan correctness, citation precision (klaim berkutip benar-benar didukung), citation coverage (klaim berbasis materi yang perlu sumber memiliki sumber), retrieval recall@k, penolakan berlebihan pada konsep biasa, dan assessment leakage secara terpisah. Jangan mencampur semuanya menjadi satu angka kualitas. Landasan evaluasi dan sumber primer dirangkum di [catatan sumber](./research-primary-sources-2026-09-23.md).

Acceptance awal yang diusulkan: setiap perubahan prompt/model memiliki perbandingan baseline; semua kasus akses wajib lulus; kegagalan serius menahan rilis. Nol kegagalan dalam fixture tidak membuktikan nol risiko di semua input.

### 2. Jawaban yang dapat ditelusuri ke bukti

Perjelas apakah jawaban berdasarkan materi pengguna, lampiran, atau pengetahuan umum. Atribut sumber harus berasal dari evidence yang benar-benar dibaca, bukan badge kepercayaan buatan model. Pertahankan citation per klaim, lokasi sumber dan snapshot existing.

Uji pasangan klaim–kutipan secara offline terlebih dahulu. Tambahkan kasus sumber tampak relevan tetapi tidak menjawab pertanyaan, angka yang berbeda, dan sumber asli bertentangan dengan materi generasi. Jika bukti kurang, model perlu menyatakan batas, meminta konteks, atau memberi penjelasan umum yang dibedakan secara jelas. Hindari skor confidence numerik tanpa kalibrasi.

Jika evaluasi membuktikan kebutuhan pemeriksaan runtime, mulai pada jalur jawaban berbasis sumber dengan batas biaya/latensi dan kegagalan yang terdefinisi. Validator model tetap bisa keliru; jangan membuat agent reviewer wajib untuk semua sapaan. Mengubah jawaban sesudah streaming selesai juga perlu UX koreksi yang eksplisit.

### 3. Reliability dan observability yang terukur

Lanjutkan gate yang sudah tertulis pada M5: dua akun authenticated, scope tercabut, citation lintas modul, SSE lewat proxy, dua proses API, SIGTERM/kill/restart, cancel ketika OCR berjalan, serta cleanup storage gagal. Catat hasil baru beserta commit dan environment; jangan menganggap catatan NOT RUN historis sebagai status produksi terkini.

Kembangkan agregat existing menjadi pemantauan periodik dan alert. Ukur waktu acknowledgment, waktu hingga teks jawaban pertama, total waktu, queue wait, retrieval/OCR/image latency, completion/error rate, serta token dan biaya per kategori. Bedakan event status pertama dari teks jawaban pertama. Taruh metrik per tahap pada run ID tanpa raw prompt atau signed URL. Tidak perlu platform observability baru untuk tahap pertama.

Tentukan SLO setelah baseline staging representatif tersedia; tetapkan segmen teks sederhana, retrieval, dan attachment secara terpisah. Catat biaya OCR/gambar dan usage yang tidak lengkap. Kuota harian atau perubahan paket adalah keputusan produk lanjutan, bukan konsekuensi otomatis dari kebutuhan monitoring.

### 4. Tutor yang membimbing dan menguji pemahaman

Tawarkan pilihan ringan: **Jelaskan**, **Bimbing langkah demi langkah**, **Latihan konsep ini**. Default tetap membantu langsung sesuai pertanyaan. Mode bimbing mengajukan satu pertanyaan diagnostik, memberi hint secukupnya, menyesuaikan penjelasan dari jawaban siswa, kemudian meminta siswa menjelaskan kembali.

Latihan: buat satu soal dari materi yang sah, tunggu jawaban siswa, lalu berikan feedback spesifik pada miskonsepsi. Tandai latihan buatan tutor secara eksplisit. Kebijakan current prompt harus diperbarui dengan server-owned distinction antara latihan tutor dan assessment resmi; label pengguna “ini latihan” tidak boleh membuka jawaban assessment. Soal resmi, kunci privat, dan node locked tetap mengikuti aturan domain.

Gunakan `read_progress` untuk rekomendasi bagian yang perlu diulang dengan alasan yang terlihat, tanpa menulis mastery/XP dari penilaian chat. Penilaian belajar resmi tetap milik domain assessment. Ukur kemampuan menyelesaikan soal transfer setelah sesi, ketepatan feedback, dan frekuensi petunjuk yang membocorkan jawaban. Dampak belajar di Ngerti.in masih hipotesis yang perlu pilot; lihat riset pendidikan pada [catatan sumber](./research-primary-sources-2026-09-23.md).

### 5. Kesinambungan percakapan panjang

Tambahkan ringkasan terbatas per thread sebelum pasangan history lama terbuang: tujuan belajar, konsep yang dibahas, kesulitan yang dinyatakan pengguna, dan pertanyaan yang belum selesai. Simpan rentang sequence, versi ringkasan, serta dependensi sumber/revision. Ambil pesan terbaru secara utuh seperti sekarang.

Ringkasan harus mewarisi aturan akses history: jika sumber dicabut, segmen ringkasan terkait harus dikeluarkan atau dibangun ulang. Ringkasan bukan bukti baru untuk citation, tidak boleh mengubah scope aktif, dan tetap diperlakukan sebagai data tidak tepercaya. Jangan menyimpulkan “sudah menguasai” hanya dari percakapan. Uji detail lama, perubahan topik/scope, penghapusan thread dan prompt injection yang mencoba menetap dalam ringkasan.

Compaction merupakan salah satu teknik pengelolaan konteks panjang yang dibahas dalam [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents). Desain provenance dan invalidasi di atas merupakan usulan khusus untuk kontrak Ngerti.in, bukan fitur otomatis framework.

### 6. Feedback yang bisa ditindaklanjuti

Di samping copy/sumber, tambahkan “Membantu” dan “Ada masalah”. Alasan singkat: salah fakta, sumber tidak cocok, terlalu rumit, tidak menjawab, atau lainnya. Kaitkan dengan message/run ID dan konfigurasi saat jawaban dibuat. Umpan balik tidak otomatis membuktikan jawaban salah; lakukan triage sebelum memasukkannya ke dataset.

Mulai dengan antrean review internal sederhana dan kasus yang sudah disanitasi. Jangan menyalin isi dokumen pribadi ke layanan evaluasi eksternal secara otomatis. Ukur masalah yang direproduksi, diperbaiki, dan ditambahkan sebagai regresi; rating saja mudah bias.

### 7. Retrieval yang lebih baik melalui eksperimen terarah

Baseline existing memakai PostgreSQL lexical ranking (`ts_rank_cd`, konfigurasi `simple`) dan cosine vector dengan RRF; ini tidak sama dengan BM25. Bandingkan secara bertahap:

1. Follow-up menjadi query mandiri hanya bila perlu, dengan scope tetap ditentukan server.
2. Penggabungan kandidat lintas modul sebelum seleksi akhir; ukur bias urutan scope dan cakupan pertanyaan perbandingan. Jangan membandingkan skor lokal mentah seolah terkalibrasi global.
3. Reranking kandidat terbatas dan keputusan bukti tidak relevan. RRF adalah skor gabungan ranking, bukan probabilitas jawaban benar; threshold harus dikalibrasi.
4. Konteks judul/section pada representasi pencarian bila error analysis menunjukkan chunk kehilangan makna. Offset citation tetap pada teks sumber asli; perubahan proyeksi melewati versi indeks/backfill existing.

[Eksperimen contextual retrieval Anthropic](https://www.anthropic.com/engineering/contextual-retrieval) memberi dasar untuk menguji contextual chunk dan reranking. Hasil vendor tidak menjadi estimasi peningkatan Ngerti.in. Pilih perubahan hanya jika recall/faithfulness naik pada holdout dengan biaya dan latensi yang dapat diterima. HNSW atau database baru baru layak dipertimbangkan bila query plan dan load menunjukkan bottleneck.

### 8. Pengembangan produk sesudah fondasi

- **Simpan hasil belajar:** pengguna memilih jawaban menjadi catatan atau draft flashcard dengan sumber; konfirmasi simpan melalui layanan domain pemilik data.
- **Tindak lanjut kontekstual:** tombol “beri contoh lain”, “jelaskan lebih sederhana”, atau “uji pemahamanku” di jawaban yang sesuai, bukan daftar generik pada setiap pesan.
- **Pencarian history dan export:** manfaatkan thread existing; export menyertakan sumber dan membedakan jawaban terhenti.
- **Preferensi belajar yang dapat diedit:** tingkat detail, bahasa, dan tujuan yang pengguna pilih; mulai eksplisit dan terbatas, ukur manfaat sebelum persistent memory lintas thread.
- **Lifecycle data:** thread saat ini di-soft-delete dan attachment punya cleanup. Definisikan retention/purge pesan, snapshot, feedback, dan ringkasan saat fitur itu ditambahkan; audit lifecycle keseluruhan sebelum menyatakan penghapusan permanen.

Voice, web search umum, cabang percakapan kompleks, dan multi-agent tutor berpotensi berguna tetapi belum menjadi prioritas dari bukti audit ini. Tambahkan ketika ada kebutuhan pengguna serta evaluasi untuk biaya, kualitas dan sumber baru.

## Urutan implementasi yang konkret

1. **Slice A — baseline:** dataset, runner, laporan per kategori, versi prompt/model/index, pengukuran latensi. Selesai ketika regresi dapat direproduksi dan gap terbesar terlihat.
2. **Slice B — trust:** perbaiki kasus citation/retrieval terburuk, uji no-answer dan akses, selesaikan acceptance deployment yang relevan. Selesai ketika holdout membaik dan gate akses/recovery lulus di target nyata.
3. **Slice C — learning:** satu alur latihan dan hint bertahap beserta batas assessment; feedback per jawaban. Selesai ketika pilot menunjukkan feedback benar dan hasil latihan dapat dinilai.
4. **Slice D — continuity:** ringkasan thread beserta invalidasi akses. Selesai ketika percakapan panjang mempertahankan detail penting tanpa menghidupkan kembali sumber yang dicabut.

Jika hanya memilih tiga pekerjaan berikutnya: **evaluation suite**, **citation/retrieval quality**, dan **mode latihan bertahap**. Jalankan pembuktian deployment sebagai gate rilis sepanjang pekerjaan tersebut.

## Batas kesimpulan

Ini audit statis dan riset, bukan sertifikasi production readiness atau pengukuran efektivitas belajar. Temuan “belum ditemukan” terbatas pada jalur kode yang disebut. Ingatan proyek hanya dipakai untuk orientasi; perilaku utama diperiksa ulang pada checkout. Graph MCP tidak tersedia dalam sesi sehingga penelusuran memakai file langsung. Dokumen sumber primer pendamping menyimpan rincian referensi dan batas generalisasinya.
