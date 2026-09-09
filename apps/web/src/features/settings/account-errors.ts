import { isClerkAPIResponseError, isReverificationCancelledError } from "@clerk/react/errors";

export function accountError(error: unknown) {
  if (isReverificationCancelledError(error))
    return "Aksi dibatalkan. Tidak ada perubahan lanjutan.";
  if (isClerkAPIResponseError(error))
    return error.errors[0]?.longMessage ?? error.errors[0]?.message ?? "Aksi akun belum berhasil.";
  return "Aksi akun belum berhasil. Periksa koneksi lalu coba lagi.";
}
