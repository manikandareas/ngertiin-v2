export function formatUsageReset(resetAt: string) {
  return `${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(resetAt))} pukul 00.00 WIB`;
}
