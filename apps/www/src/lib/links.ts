const appUrl = new URL(import.meta.env.PUBLIC_APP_URL || "http://localhost:5173");
if (!["http:", "https:"].includes(appUrl.protocol)) {
  throw new Error("PUBLIC_APP_URL must be an HTTP(S) URL");
}
export const dashboardUrl = new URL("/dashboard", appUrl).href;
export const signInUrl = new URL("/sign-in", appUrl).href;

export const navigationLinks = [
  { href: "#cara-kerja", label: "Cara kerja" },
  { href: "#kenapa-ngertiin", label: "Kenapa Ngerti.in" },
] as const;
