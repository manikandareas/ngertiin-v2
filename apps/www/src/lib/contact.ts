export const contact = {
  businessName: "Manika Technologies",
  email: "me@whoismanik.dev",
  emailUrl: "mailto:me@whoismanik.dev",
  phone: "085171227008",
  whatsappUrl: "https://wa.me/6285171227008",
  address: "Jalan Soekarno Hatta, Samarinda, Kalimantan Timur, Indonesia",
} as const;

// Set this to the publication date when publishing a policy revision.
export const policyEffectiveDate = "2026-10-07";
export const policyEffectiveLabel = "7 Oktober 2026";

export const policyLinks = [
  { href: "/contact", label: "Kontak" },
  { href: "/terms", label: "Syarat dan Ketentuan" },
  { href: "/privacy", label: "Kebijakan Privasi" },
  { href: "/refund", label: "Kebijakan Pengembalian Dana" },
] as const;
