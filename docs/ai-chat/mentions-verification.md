# Verifikasi konteks per pesan dan inline mention

13 September 2026. Perubahan lokal; tidak ada migrasi database atau deployment.

## Perilaku

- Composer bersama memakai token inline: `@` mencari modul ready milik user (arsip disaring); `:` setelah token modul memilih lesson/flashcard yang dapat diakses. Node terkunci dan assessment tidak ditawarkan.
- Token bisa dihapus melalui tombol yang muncul saat hover/fokus, atau dengan keyboard; perangkat tanpa hover menampilkan tombolnya. Mendukung undo/redo dan Shift+Enter.
- Maksimal delapan mention per pesan. Label untuk tampilan; ID UUID untuk otorisasi dan retrieval.
- Mention eksplisit menggantikan cakupan sebelumnya. Pesan tanpa mention meneruskan cakupan terakhir; pesan pertama modern tanpa mention tidak memakai konteks modul asal secara tersembunyi.
- Modul asal thread tetap menjadi metadata navigasi/kompatibilitas, bukan pembatas retrieval. Floating/sidebar pada halaman modul/node selalu memasang konteks halaman yang terkunci; fullscreen tetap memakai mention yang dapat dihapus.
- Cakupan disimpan atomik bersama pesan di `chat_message_contexts` dengan kind `scope`. Retry mengambil cakupan pesan asal; replay idempotent mengembalikan run yang sama.
- Snapshot baru menyimpan moduleId untuk pemeriksaan akses lintas modul. Snapshot lama tetap memakai fallback modul asal. Riwayat tidak dihapus ketika chip draft dihapus.
- Editor dimuat terpisah dan diinisialisasi setelah mount, termasuk saat berpindah layout. Dialog konteks lama dan aksi membuka chat lain untuk mengganti modul dihapus.

## Verifikasi

Typecheck seluruh workspace, build API/web, Biome pada kode tersentuh, dan `git diff --check`: **PASS**. Build web masih memberi warning chunk >500 kB; editor menjadi chunk terpisah sekitar 341 kB minified / 105 kB gzip.

**16 pemeriksaan lokal service/database/tool PASS**, memakai salinan database fixture `ngertiin_chat_mentions_verify`, bukan database aplikasi:

1. Dua mention modul/node tersimpan.
2. Follow-up mewarisi cakupan terakhir.
3. Mention baru menggantikan cakupan.
4. Retry menggunakan cakupan asli meskipun input retry berbeda.
5. Replay idempotent tetap menunjuk run/cakupan lama setelah percakapan beralih konteks.
6. Mention modul user lain ditolak.
7. Pasangan modul/node yang tidak sesuai ditolak.
8. Node terkunci ditolak.
9. Menghapus mention awal menghasilkan cakupan kosong.
10. Client lama tetap mendapat fallback modul thread.
11. Batas jumlah dan format identifier divalidasi.
12. Riwayat mengembalikan mention eksplisit dan cakupan efektif.
13. Bukti lintas modul diperiksa terhadap pemilik setiap modul.
14. read_excerpt menolak bukti di luar cakupan aktif.
15. search_module_materials meneruskan cakupan modul/node dan membagi budget.
16. Reader kutipan lintas modul dapat membaca snapshot tersimpan dan menolak setelah node dikunci.

**Browser fixture komponen produksi PASS:** menu modul dan pencarian, menu node, dua mention dalam satu pesan, penghapusan dan undo, Shift+Enter, pengiriman teks+ID mention dan pengosongan draft, serta pemulihan draft setelah remount fullscreen/sidebar/overlay. Tampilan diperiksa pada lebar desktop dan 390 px. Pemeriksaan memakai Chromium melalui agent-browser setelah browser bawaan gagal tersambung. Fixture menyuplai cache daftar modul/node sintetis; bukan login aplikasi nyata.

**NOT RUN:** alur HTTP dengan login Clerk, jawaban provider, evaluasi retrieval/ranking end-to-end dengan indeks nyata, browser mobile Safari/IME nyata, deployment/proxy, serta regresi seluruh race durable-run. Copy/paste belum diverifikasi end-to-end.

Harness sementara dan database salinan dibersihkan setelah verifikasi; tidak menambahkan unit/integration test suite.

## Pembaruan konteks halaman terkunci

Konteks halaman dipasang juga untuk percakapan yang sudah ada dan dipulihkan setelah pengiriman. Token tidak memiliki tombol hapus, dan normalisasi transaksi editor mempertahankannya saat seluruh teks diganti/dihapus. Konteks mengikuti halaman modul/node saat menyusun pesan baru; retry tetap memakai cakupan pesan asal. Mention tambahan tetap dapat dihapus. Hanya konteks otomatis tanpa pertanyaan tidak mengaktifkan tombol kirim.

Daftar mention meminta `status=ready`, menyaring status hasil, dan memakai cache terpisah dari daftar sebelumnya. Setelah operasi arsip berhasil, modul dikeluarkan dari cache mention dan query diinvalidasi.

Verifikasi browser fixture tambahan: konteks otomatis, tanpa tombol hapus, select-all + Backspace, select-all + ketik pengganti, pergantian modul ke node tanpa kehilangan teks, konteks tetap setelah kirim, ID node masuk payload, mention tambahan memiliki tombol hapus, serta item arsip tidak muncul meskipun disisipkan dalam cache fixture. Pengujian memakai komponen produksi dan data sintetis; HTTP Clerk/provider tidak diulang. Clipboard cut belum diverifikasi melalui clipboard sistem.

Pemeriksaan akhir pembaruan: typecheck web, build web, Biome file tersentuh, dan whitespace PASS. Undo tetap mempertahankan konteks halaman; perpindahan ke fullscreen membuka kunci token. Fixture sementara dibersihkan.

## Pemeriksaan setelah cleanup

Cleanup memperjelas tipe props editor/menu dan hasil resolusi cakupan, menyederhanakan pencocokan referensi serta fallback cakupan, dan memakai konstanta nama agen pada label editor. Perilaku mention dipertahankan.

Pemeriksaan ulang: typecheck seluruh workspace, build API/web, Biome pada seluruh file kode yang berubah, dan `git diff --check` **PASS**. Build web tetap memperingatkan chunk di atas 500 kB; chunk editor sekitar 343 kB minified / 105 kB gzip. Lint global gagal dengan 53 error, 118 warning, dan 60 info; diagnostik prototype berada di luar perubahan ini.

Pemeriksaan service/database/tool dan browser fixture di atas merupakan hasil sebelum cleanup, bukan pengujian ulang pada commit ini. Browser, database, Clerk, provider, dan deployment **NOT RUN** pada tahap cleanup.
