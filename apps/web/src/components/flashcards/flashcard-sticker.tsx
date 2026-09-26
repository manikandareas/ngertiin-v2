export const flashcardColors = ["#ffda55", "#8dded4", "#bce775", "#ff97be", "#b9a1f1", "#82d6f4"];

export function FlashcardSticker({ index, className }: { index: number; className?: string }) {
  return (
    <svg viewBox="0 0 112 106" fill="none" aria-hidden="true" className={className}>
      {index % 3 === 0 ? (
        <>
          {" "}
          <g fill="#fffaf0" stroke="#fffaf0" strokeWidth="8" strokeLinejoin="round">
            <path d="M56 14C70 -2 86 12 78 28C101 25 107 48 88 56C106 71 89 91 72 81C67 104 44 103 40 81C21 94 5 72 23 57C1 49 10 26 32 29C23 9 43 -1 56 14Z" />
          </g>
          <path
            fill="#a776ee"
            d="M56 14C70 -2 86 12 78 28C101 25 107 48 88 56C106 71 89 91 72 81C67 104 44 103 40 81C21 94 5 72 23 57C1 49 10 26 32 29C23 9 43 -1 56 14Z"
          />
          <circle cx="56" cy="53" r="25" fill="#ffda48" />
          <g fill="#302942">
            <ellipse cx="48" cy="49" rx="2.6" ry="3.7" />
            <ellipse cx="64" cy="49" rx="2.6" ry="3.7" />
          </g>
          <path
            d="M50 59 Q56 65 62 59"
            fill="none"
            stroke="#302942"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <ellipse cx="39" cy="57" rx="5" ry="3" fill="#ff9c85" />
          <ellipse cx="73" cy="57" rx="5" ry="3" fill="#ff9c85" />{" "}
        </>
      ) : null}
      {index % 3 === 1 ? (
        <>
          {" "}
          <path
            d="M15 66C-5 80 16 92 64 71S116 31 94 36"
            fill="none"
            stroke="#fffaf0"
            strokeWidth="15"
            strokeLinecap="round"
          />
          <circle cx="55" cy="47" r="34" fill="#ff935c" stroke="#fffaf0" strokeWidth="5" />
          <path
            d="M18 66C1 79 23 85 65 66S110 35 94 39"
            fill="none"
            stroke="#7354b8"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <g transform="translate(-1,-7)">
            <g fill="#302942">
              <ellipse cx="48" cy="49" rx="2.6" ry="3.7" />
              <ellipse cx="64" cy="49" rx="2.6" ry="3.7" />
            </g>
            <path
              d="M50 59 Q56 65 62 59"
              fill="none"
              stroke="#302942"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>
          <path d="m94 8 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#fff3a0" />
          <circle cx="13" cy="22" r="4" fill="#7354b8" />{" "}
        </>
      ) : null}
      {index % 3 === 2 ? (
        <>
          {" "}
          <g stroke="#fffaf0" strokeWidth="5">
            <rect
              x="16"
              y="21"
              width="53"
              height="66"
              rx="24"
              fill="#ff846d"
              transform="rotate(-16 42 54)"
            />
            <rect
              x="51"
              y="12"
              width="45"
              height="67"
              rx="21"
              fill="#ad84f3"
              transform="rotate(17 73 45)"
            />
          </g>
          <g fill="#302942">
            <circle cx="34" cy="48" r="2.5" />
            <circle cx="47" cy="45" r="2.5" />
            <circle cx="67" cy="38" r="2.5" />
            <circle cx="80" cy="41" r="2.5" />
          </g>
          <g fill="none" stroke="#302942" strokeWidth="2.4" strokeLinecap="round">
            <path d="M37 57q7 6 12-3" />
            <path d="M67 50q7 7 13 1" />
          </g>
          <path d="m17 9 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#fbea78" />{" "}
        </>
      ) : null}
    </svg>
  );
}
