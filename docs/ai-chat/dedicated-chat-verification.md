# Dedicated Chat — implementasi dan verifikasi

Tanggal: 12 September 2026. Dedicated Chat diimplementasikan pada working tree lokal. Tidak di-commit atau di-deploy oleh tugas ini. M5 blueprint tetap terpisah.

## Perilaku yang tersedia

- `/chat` memulai percakapan mandiri; `/chat/:threadId` membuka thread yang tersimpan. Thread dibuat pada pengiriman pertama, dengan judul dari pesan pertama.
- Menu Chat selalu tersedia. Tombol Chat baru dan daftar thread hanya muncul di sidebar aplikasi pada route Chat, termasuk drawer navigasi mobile. Usage dapat dibuka melalui bagian yang dilipat agar daftar tetap mudah dijangkau.
- Module bersifat opsional dan tetap setelah thread dibuat. Pemilihan module pada percakapan yang sudah ada membuka chat baru. Materi yang belum dikirim dapat dipilih dari sumber atau lesson/flashcard/review yang terbuka dalam module tersebut.
- Panel module mempertahankan Sidebar/Overlay. Aksi Full Screen membuka thread yang sama di dedicated page; jika belum ada thread, membuka chat baru dengan module dan draft yang sama. Detail Chat tidak mempunyai dropdown mode, dan header module tidak ditambah aksi Buka Chat.
- Draft, cuplikan, pending idempotency key, dan acknowledgment berada dalam QueryClient milik sesi pengguna. Navigasi tidak membatalkan durable run. Reload memulihkan pesan/run dari server; draft tidak dijanjikan bertahan setelah reload.
- Kutipan dedicated chat memakai panel kanan desktop dan drawer mobile, dengan snapshot “Materi saat jawaban dibuat”. Reader dialog dalam module tetap tersedia.

## Perubahan kode dan data

| Area | Lokasi dan tanggung jawab |
| --- | --- |
| Routes dan halaman | `apps/web/src/routes/app-routes.tsx`, `apps/web/src/pages/chat.tsx` |
| Sidebar aplikasi | `apps/web/src/components/app-sidebar.tsx`; section fitur di `features/chat/components/chat-sidebar-section.tsx` |
| Data vs tampilan | `use-chat-threads.ts` mengelola daftar/API, `use-module-chat.ts` mengelola seleksi dan layout panel |
| State lintas route | `chat-session.ts`; cache terisolasi oleh QueryClient akun existing |
| Percakapan | `chat-new-conversation.tsx`, `chat-conversation.tsx`, `chat-thread-actions.tsx`; composer dan transport dipakai kembali |
| Konteks dan reader | `chat-module-picker.tsx`, `chat-context-picker.tsx`, `chat-citation.tsx`, `chat-citation-frame.tsx` |
| API | `apps/api/src/chat/chat.controller.ts`: route canonical dan adapter module; `chat-materials.controller.ts` khusus endpoint materi dalam module |
| Domain | `chat.service.ts`: ownership, nullable scope, pagination, durable runs, evidence; agent tidak mendapat tools module untuk chat mandiri |
| Contracts | `packages/contracts/src/api/chat/chat.ts`: nullable module, label module, create input, parameter route, canonical/legacy eventsUrl |
| Database | Migrasi `0020_confused_newton_destine`: module_id nullable, updated_at precision millisecond, index recent user dan user/module |

Thread/message/run/context tables existing digunakan kembali. Thread lama tidak dipindahkan atau dibuat ulang. Adapter lama menjaga scope cursor berbasis createdAt, sementara API canonical memakai updatedAt. Replay send antara kedua route berbagi identitas idempotency; response stream URL menyesuaikan route pemanggil.

## Bukti verifikasi

| Pemeriksaan | Hasil dan batas |
| --- | --- |
| Typecheck seluruh workspace | PASS |
| Build seluruh workspace | PASS; warning ukuran chunk Vite tetap ada |
| Biome kode tersentuh dan git diff whitespace | PASS |
| Drizzle migration metadata | `bun run db:check` PASS |
| Migrasi database aplikasi lokal | `0020` diterapkan pada `localhost/ngertiin`; schema change saja, tanpa migrasi/penghapusan isi percakapan |
| Migrasi dari database kosong | PASS pada database lokal terpisah `ngertiin_chat_dedicated_verify` |
| Canonical/legacy HTTP, ownership, pagination, SSE, idempotency, rename/delete | 26 pemeriksaan PASS di [runtime.json](./evidence/dedicated-chat/runtime.json) |
| Snapshot immutable, stale excerpt, arsip, foreign module/run, cursor legacy, cancel | 10 pemeriksaan PASS di [extra.json](./evidence/dedicated-chat/extra.json) |
| Provider nyata | Chat mandiri dan module selesai dengan pesan tersimpan; standalone toolCallCount 0. [Run metadata](./evidence/dedicated-chat/provider-runs.json) |
| Browser React + HTTP API | Flow, draft/cuplikannya, rename/batal, account cache, dan layout desktop/mobile PASS. [Catatan browser](./evidence/dedicated-chat/browser.json) |
| Route API aplikasi lokal tanpa token | `/api/v1/chat/threads` mengembalikan 401 |
| Login/otorisasi token Clerk nyata | **NOT RUN**; sesi browser lokal logout. Runtime/browser di atas memakai guard/hooks fixture di proses lokal terpisah |
| Keyboard perangkat mobile fisik | **NOT RUN**; viewport browser 390px diuji |
| Deployment dan reverse proxy production | **NOT RUN** |

Browser memakai komponen produksi dan Vite fixture di luar source tree; tidak menambahkan test suite. Data fixture berada di database terpisah, bukan data belajar pengguna. Provider memakai konfigurasi lokal yang sebenarnya. Bukti fixture tidak dianggap sebagai bukti autentikasi Clerk atau deployment.

Screenshot: [Chat desktop](./evidence/dedicated-chat/chat-desktop.png), [Chat mobile](./evidence/dedicated-chat/chat-mobile.png), [kutipan desktop](./evidence/dedicated-chat/citation-desktop.png), [kutipan mobile](./evidence/dedicated-chat/citation-mobile.png).

## Rollout

1. Terapkan migrasi `0020` sebelum API baru menerima thread tanpa module.
2. Deploy API dengan route canonical dan adapter lama, kemudian frontend.
3. Periksa chat mandiri, thread module lama, perpindahan saat send, serta kutipan memakai sesi Clerk nyata dan proxy target.
4. Jangan rollback ke API yang mewajibkan module setelah thread mandiri dibuat; gunakan versi API yang tetap memahami nullable module. Adapter dapat dihapus dalam perubahan terpisah setelah client lama tidak digunakan lagi.

## Verifikasi cleanup 12 September 2026

Cleanup memisahkan controller materi, memakai ulang schema parameter route, memberi nama pada props komponen, dan menyederhanakan percabangan halaman serta pembuatan tools agent. Prototype lokal juga dirapikan dan tombolnya diberi type eksplisit.

- **PASS**: typecheck dan build seluruh workspace; typecheck web diulang setelah perubahan terakhir pada halaman.
- **PASS**: Biome pada 28 file kode/prototype dalam perubahan, parsing JSON yang berubah, metadata Drizzle, dan `git diff --check`.
- Build Vite masih memberi warning chunk lebih dari 500 kB.
- Lint global masih gagal dengan 53 error pada prototype lama yang tidak diubah: `ai-chat-notion-prototype.html` (31), `chat-citation-compact-prototype.html` (9), dan `chat-mascot-prototype.html` (13), semuanya di `docs/prototype`.
- Browser, Clerk, provider, migrasi database runtime, dan deployment: **NOT RUN** pada sesi cleanup. Bukti runtime di atas berasal dari sesi implementasi sebelumnya.
