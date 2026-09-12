import type { JSX } from "react";

export const flashcardThemes = ["blue", "lavender", "peach", "yellow"] as const;
type FlashcardTheme = (typeof flashcardThemes)[number];

const motifs = {
  blue: (
    <>
      <path
        d="M17 40a10 10 0 0 1-1-20 15 15 0 0 1 29-2 11 11 0 0 1 2 22Z"
        fill="currentColor"
        fillOpacity=".18"
      />
      <path d="M25 27v3m12-3v3m-12 5q6 5 12 0M10 47h23q7 0 7 5t-7 5M7 54h14" />
    </>
  ),
  lavender: (
    <>
      <circle cx="32" cy="32" r="18" fill="currentColor" fillOpacity=".18" />
      <circle cx="32" cy="32" r="18" />
      <path d="M16 22C-9 31 7 57 40 43S65 14 49 19" />
      <circle cx="25" cy="25" r="3" />
      <path d="M48 6v8m-4-4h8M9 46v6m-3-3h6" />
    </>
  ),
  peach: (
    <>
      <path
        d="M18 17C9 4 29-3 33 11C43-2 59 10 49 22C65 25 58 43 44 39C46 56 26 61 23 43C7 49 0 31 16 26C9 24 11 18 18 17Z"
        fill="currentColor"
        fillOpacity=".18"
      />
      <path d="M18 17C9 4 29-3 33 11C43-2 59 10 49 22C65 25 58 43 44 39C46 56 26 61 23 43C7 49 0 31 16 26C9 24 11 18 18 17Z" />
      <path d="M25 25v4m13-4v4m-13 6q6 6 12 0M51 52q8-8 9 0-6 5-9 0Z" />
    </>
  ),
  yellow: (
    <>
      <circle cx="32" cy="32" r="16" fill="currentColor" fillOpacity=".18" />
      <circle cx="32" cy="32" r="16" />
      <path d="M32 4v6m0 44v6M4 32h6m44 0h6M12 12l5 5m30 30 5 5M12 52l5-5m30-30 5-5M26 28v3m12-3v3m-12 6q6 5 12 0" />
    </>
  ),
} satisfies Record<FlashcardTheme, JSX.Element>;

interface FlashcardDecorationProps {
  theme: FlashcardTheme;
}

export function FlashcardDecoration({ theme }: FlashcardDecorationProps): JSX.Element {
  return (
    <svg
      className="size-full"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {motifs[theme]}
    </svg>
  );
}
