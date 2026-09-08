import { cn } from "../../lib/utils";

const books = [
  { color: "fill-primary", angle: 3, x: 6, width: 128 },
  { color: "fill-success", angle: -3, x: 12, width: 122 },
  { color: "fill-adaptive", angle: 3, x: 4, width: 126 },
  { color: "fill-primary-edge", angle: -4, x: 13, width: 118 },
];

type LeaderboardBookStackProps = {
  position: 1 | 2 | 3;
  rank: number | null;
};

export function LeaderboardBookStack({ position, rank }: LeaderboardBookStackProps) {
  const count = 5 - position;
  return (
    <svg
      viewBox={`0 0 144 ${count * 32 + 12}`}
      className="mt-5 block w-full overflow-visible"
      aria-hidden="true"
    >
      {books.slice(0, count).map((book, index) => {
        const y = (count - index - 1) * 32 + 6;
        return (
          <g key={book.x} transform={`rotate(${book.angle} 72 ${y + 14})`}>
            <rect x={book.x} y={y} width={book.width} height="29" rx="5" className={book.color} />
            <rect
              x={book.x + 9}
              y={y + 5}
              width={book.width - 14}
              height="18"
              rx="2"
              className="fill-book-page"
            />
            <path
              d={`M${book.x + 14} ${y + 11}h${book.width - 24}m-${book.width - 24} 6h${book.width - 24}`}
              className="stroke-book-clay"
              fill="none"
            />
            <path d={`M105 ${y + 4}h8v29l-4-5-4 5z`} className="fill-adaptive-ink" />
          </g>
        );
      })}
      <g transform={`rotate(${rank === 1 ? 7 : -7} 72 23)`}>
        <rect
          x="53"
          y="3"
          width="38"
          height="43"
          rx="14"
          className={cn(
            "stroke-background stroke-3",
            rank === 1 ? "fill-adaptive" : "fill-primary",
          )}
        />
        <text
          x="72"
          y="33"
          textAnchor="middle"
          className={cn(
            "font-display text-2xl font-black",
            rank === 1 ? "fill-adaptive-ink" : "fill-night-ink",
          )}
        >
          {rank ?? "·"}
        </text>
      </g>
    </svg>
  );
}
