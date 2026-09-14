# Operasi dan rilis AI Chat

Acuan produk: chat mandiri, scope per pesan/mention lintas modul, attachment native dengan OCR fallback, dan Wikimedia proaktif. Kontrak lama tidak boleh dipakai untuk mematikan perilaku tersebut. M5 tidak memperkenalkan flag fitur, kuota harian, atau subscription.

Panduan langkah production: [production-deploy.md](production-deploy.md).

## Preflight

1. Catat commit API/worker/web, environment, operator, waktu dan target. Jalankan build/typecheck, `bun run db:check`, pemeriksaan diff dan konfigurasi Compose tanpa mencetak secret. Pisahkan warning baseline dari perubahan chat.
2. Cocokkan environment dengan schema executable dan `.env.example`. Model chat harus mendukung Responses, tool call, stream, dan jenis file yang digunakan. Default output 8192, prompt teks 16000, provider timeout 180000 ms, deadline run 240000 ms. Provider menilai konteks file native; tidak memakai heuristik ukuran file sebagai token.
3. Pastikan PostgreSQL target mendukung pgvector 1536 dimensi, Redis, storage privat, serta key OpenAI/Mistral. Terapkan migrasi additive sampai `0021` **sebelum** API baru. Jangan menghapus data/volume untuk memperbaiki readiness.
4. Periksa versi indeks aktif, coverage revision terkini dan worker. Jangan mengaktifkan versi building sebelum dokumen eligible ready. Perubahan model/dimensi/chunker memerlukan versi baru dan backfill.
5. Jalankan evaluasi dengan akun pengujian yang terautentikasi; dua akun diperlukan untuk isolasi akses. Gunakan data sintetis. Kegagalan akses atau kebocoran assessment menggagalkan release.

## Dashboard tanpa layanan tambahan

Jalankan SQL dengan role read-only dan credential dari environment operator, bukan command literal:

```sh
psql "$DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -f docs/ai-chat/m5-operations.sql > /tmp/chat-operations.json
bun scripts/chat-operations.mjs /tmp/chat-operations.json /tmp/chat-dashboard.html /tmp/api-log.jsonl
```

Argumen log opsional. SQL memakai transaksi read-only dan statement timeout 10 detik. Output agregat tidak membaca isi pesan, file, prompt, user, key atau signed URL. Dashboard offline menampilkan status/latency 24 jam, penggunaan model, antrean, expired lease, coverage indeks, OCR dan cleanup. Angka tool/image berasal dari rentang log yang diberikan; jangan menyamakan rentangnya dengan jendela database tanpa menyelaraskannya. `eligible_documents` adalah dokumen yang sudah terinventarisasi oleh reconciler, bukan bukti bahwa scan sumber terbaru sudah selesai.

Log `chat.send_acknowledged` menghubungkan requestId dengan threadId/runId/messageId, termasuk replay. `chat.run_finished` mencatat status/errorCode, durasi eksekusi, queueMs, jumlah model/tool call, token/coverage, konfigurasi indexVersion, dan outcome gambar. `indexVersion` adalah konfigurasi executor, bukan bukti bahwa retrieval terjadi. `chat.run_recovered` mencatat finalisasi sweep; `chat.drain_started/finished` mencatat drain dan leftovers. `chat.images` hanya memakai outcome kategori, jumlah kandidat, nama berkas Commons publik, tahap dan durasi; query dan alasan review model tidak dicatat. Jangan mengaktifkan raw prompt/tool/provider logging untuk diagnosis rutin.

Pantau error/timeout terpisah dari cancelled/interrupted. Queue melewati deadline, lease expired yang menetap lebih dari interval sweep, cleanup yang terus bertambah, dan coverage turun memerlukan investigasi. Target p95/throughput/biaya ditetapkan dari staging representatif, bukan default. Usage aktual tersimpan per call; OCR dipisah. Biaya memerlukan tarif/invoice provider yang berlaku, memperhitungkan cached tokens dan usage partial; jangan mengarang biaya dari total token saja.

## Rehearsal deploy, drain dan rollback

Langkah berikut dijalankan pada staging yang ditetapkan operator; bukan instruksi otomatis deploy production.

1. Rekam baseline dashboard/readiness dan buat backup database menggunakan mekanisme operator. Restore backup ke target disposable, periksa migrasi, count dan pembacaan snapshot citation. Backup tanpa percobaan restore belum memenuhi acceptance.
2. Bangun/pilih immutable image tag API, worker dan migrasi; catat tag sebelumnya yang kompatibel dengan schema/parts terbaru. Jalankan migrasi satu kali lewat service `migrate`, lalu API/worker.
3. Uji `/health/ready` dan SSE melalui hostname/proxy staging dengan token akun tes. Pastikan POST send mendapat 202 sebelum provider selesai; frame tiba bertahap tanpa buffering. Verifikasi proxy idle timeout melebihi deadline run + margin (default >240 detik), cache dimatikan, dan disconnect tidak mengirim cancel. Jangan mencatat header Authorization.
4. Jalankan minimal dua instance API. Saat run aktif, kirim SIGTERM pada satu instance melalui orchestrator. Readiness instance tersebut menjadi 503; admission/claim lokal berhenti. Run yang selesai dalam drain tetap completed. Setelah 30 detik default, sisa run di-abort PROCESS_INTERRUPTED, diberi cancellation grace + 5 detik finalisasi. Setelah drain, hook HTTP memanggil closeAllConnections sebelum disposal Nest; socket tracking saja tidak cukup pada Bun yang diverifikasi. Batas total konfigurasi <110 detik dan Compose stop grace 120 detik. Cancellation yang sudah diterima tetap cancelled; sisa lease dipulihkan oleh instance sehat.
5. Periksa tidak ada run aktif setelah deadline/sweep, duplikasi pesan, atau write executor lama. Ulangi dengan kill mendadak untuk memverifikasi fencing/recovery, kemudian Redis/proxy disconnect dan OCR/gambar aktif. Jangan mematikan layanan bersama di production sebagai fault injection.
6. Rollback aplikasi dengan drain lalu deploy tag sebelumnya yang **memahami** scope per pesan, attachment dan image parts. Jangan rollback ke versi sebelum fitur-fitur tersebut hanya karena schema additive. Pertahankan database, snapshot citation dan objek privat. Tidak ada migrasi turun atau toggle chat.
7. Jika indeks rusak, pertahankan degradasi INDEX_NOT_READY/lexical fallback; rebuild versi yang konsisten. Jangan mengembalikan pointer ke embedding/revision yang tidak cocok.
8. Frontend memakai workflow manual `frontend-deploy.yml`. Push backend/frontend bukan bukti deploy web. Catat hasil browser setelah kedua sisi cocok dan rollback diulang.

## Matriks evaluasi wajib

Gunakan sapaan, aritmetika, follow-up history, kutipan langsung, dua modul, materi locked, assessment aktif, akses tercabut, bukti kurang dan prompt injection. Tambahkan attachment-only, native PDF/gambar/Office/teks, OCR fallback/cache, batas 10/25 MiB, lima file, mention dengan file, upload retry/drop/paste/mobile, ilustrasi proaktif, tanpa gambar, visual rejection dan fallback. Untuk tiap kasus catat input sintetis, tool yang diperlukan/aktual, klaim didukung bukti, lokasi citation, hasil akses, status terminal, latency dan usage. Pengujian komponen/service tidak menggantikan HTTP Clerk dan browser.

## Penanganan gangguan

- 429 send: lihat rolling window dan jumlah run aktif lintas instance; user dapat cancel melalui window terpisah. Replay tidak membuat run baru.
- Redis mati: admission send dan upload gagal tertutup; cancel terotorisasi tetap tersedia melalui database. SSE kembali ke snapshot/history; jangan mengirim ulang prompt otomatis.
- Run interrupted: periksa drain/lease/heartbeat dan database, lalu tawarkan retry eksplisit. Disconnect browser sendiri bukan sebab interrupted.
- File gagal: periksa errorCode dan coverage OCR tanpa membaca/melog dokumen. Auth/rate/timeout/context overflow tidak boleh menjadi pemicu OCR. Tombstone objek diselesaikan cleanup retry.
- Gambar gagal: lihat stage dan outcome `chat.images`; jawaban teks harus tetap selesai. Jangan mengaktifkan logging query/purpose/review bebas.

Bukti tiap langkah harus memuat tanggal, commit, environment dan hasil aktual. `NOT RUN` tidak berubah menjadi PASS karena build atau konfigurasi lolos.
