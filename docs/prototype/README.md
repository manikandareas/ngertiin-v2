# Prototipe UI Ngerti.in

Direktori ini berisi file eksplorasi dan prototipe antarmuka (HTML standalone) yang digunakan selama tahap perancangan fitur Ngerti.in. Seluruh prototipe bersifat *self-contained* (termasuk inline style, data URI/font fallback, dan mock interaction), sehingga dapat dibuka langsung di browser tanpa ketergantungan pada backend API atau dev server Vite.

## Daftar Prototipe

1. **[adaptive-intervention-prototype.html](./adaptive-intervention-prototype.html)**
   - **Fokus:** Eksplorasi intervensi penguatan belajar adaptif.
   - **Fitur:** Menguji 3 variasi alur intervensi (Variant A, B, C) untuk rekomendasi remedial/penguatan materi berdasarkan hasil kuis.

2. **[dashboard-variations.html](./dashboard-variations.html)**
   - **Fokus:** Eksplorasi variasi tata letak dan hierarki visual beranda / dashboard.
   - **Fitur:** Simulasi variasi layout desktop dan mobile, folder modul, metrik streak, dan kartu aksi belajar.

3. **[module-node-prototype.html](./module-node-prototype.html)**
   - **Fokus:** Eksplorasi node player pembelajaran dan hasil assessment.
   - **Fitur:** Tampilan ringkasan evaluasi, visualisasi akurasi konsep, serta aksi adaptif opsional tanpa menghalangi progresi utama.

4. **[new-module-prototype.html](./new-module-prototype.html)**
   - **Fokus:** Eksplorasi alur pembuatan modul baru dan composer beranda.
   - **Fitur:** Simulasi lokal input sumber belajar, pemilihan fokus, penyesuaian materi, dan pratinjau silabus modul.

5. **[usage-banner-prototype.html](./usage-banner-prototype.html)**
   - **Fokus:** Eksplorasi visual banner kuota pemakaian (usage quota) pada sidebar.
   - **Fitur:** 5 konsep visual berbeda (space postcard, ticket silhouette, seed packet, cassette reel, delivery parcel) untuk menampilkan batas kuota mingguan.

6. **[source-item-variations.html](./source-item-variations.html)**
   - **Fokus:** Tiga bentuk item PDF, web, dan teks dalam layout halaman Modules.
   - **Pilihan:** Varian 2, Scrapbook, dengan ukuran seragam 400 px dan tanpa rotasi, telah diterapkan pada halaman Sources.
   - **Fitur:** Pergantian variasi, pencarian, filter jenis, arsip, dan pratinjau memakai data contoh. HTML tetap standalone; aplikasi menggunakan metadata asli dari API.
