import { useEffect, useLayoutEffect } from "react";
import { matchPath, useLocation } from "react-router-dom";

const pages = [
  ["/sign-in/*", "Masuk", "Masuk ke akun Ngerti.in untuk melanjutkan belajar."],
  ["/sign-up/*", "Daftar", "Buat akun Ngerti.in dan mulai perjalanan belajarmu."],
  ["/dashboard", "Beranda", "Lihat perkembangan belajar dan lanjutkan modulmu."],
  ["/leaderboard", "Papan peringkat", "Lihat pencapaian belajar di Ngerti.in."],
  ["/chat/citation", "Rujukan chat", "Buka materi yang dirujuk dalam percakapan."],
  ["/chat/:threadId", "Percakapan", "Lanjutkan percakapan dengan Teman Belajar."],
  ["/chat", "Chat", "Diskusikan materi bersama Teman Belajar."],
  ["/sources/:sourceId", "Detail materi", "Baca dan kelola materi belajarmu."],
  ["/sources", "Materi saya", "Kelola bahan belajar yang sudah kamu tambahkan."],
  ["/modules/new", "Buat modul", "Susun modul belajar dari materi pilihanmu."],
  ["/modules/:moduleId/journey", "Journey modul", "Ikuti tahapan belajar dalam modulmu."],
  ["/modules/:moduleId/practice/new", "Buat latihan", "Buat latihan dari materi dalam modulmu."],
  [
    "/modules/:moduleId/practice/:practiceId/attempts/:attemptId",
    "Sesi latihan",
    "Kerjakan dan tinjau sesi latihanmu.",
  ],
  [
    "/modules/:moduleId/practice/:practiceId",
    "Detail latihan",
    "Lihat latihan dan riwayat pengerjaanmu.",
  ],
  ["/modules/:moduleId/practice", "Latihan modul", "Lihat latihan dalam modul belajarmu."],
  [
    "/modules/:moduleId/nodes/:nodeId",
    "Ruang belajar",
    "Pelajari materi dan selesaikan aktivitas modulmu.",
  ],
  ["/modules/:moduleId", "Modul", "Lihat modul belajarmu."],
  ["/modules", "Modul saya", "Kelola modul dan perjalanan belajarmu."],
  ["/practices", "Latihan", "Kerjakan flashcard, kuis, dan exam dari modulmu."],
  [
    "/adaptive-interventions/:interventionId",
    "Penguatan belajar",
    "Lanjutkan penguatan belajar sesuai kebutuhanmu.",
  ],
  ["/settings/account-callback", "Menghubungkan akun", "Selesaikan koneksi akun Ngerti.in."],
  ["/settings", "Pengaturan", "Atur akun dan preferensi belajarmu."],
] as const;

function setMeta(name: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}

export function PageMetadata() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const page = pages.find(([pattern]) => matchPath({ path: pattern, end: true }, pathname));
    document.title = page ? `${page[1]} | Ngerti.in` : "Ngerti.in";
    setMeta("description", page?.[2] ?? "Belajar lebih terarah bersama Ngerti.in.");
    setMeta("robots", "noindex, nofollow");
  }, [pathname]);
  return null;
}

export function usePageTitle(title: string | null | undefined) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!pathname) return;
    if (title?.trim()) document.title = `${title.trim()} | Ngerti.in`;
  }, [pathname, title]);
}
