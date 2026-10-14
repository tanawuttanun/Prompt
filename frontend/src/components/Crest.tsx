// The Delux Sport Club crest (shield, laurels, crossed racket and golf club, ball, star),
// drawn in currentColor so it takes the gold of whatever holds it.
// `animated` strokes it in like ink being drawn, then fades in the solid parts.
type Props = { size?: number; animated?: boolean; className?: string; title?: string };

// [x, y, angle] of each leaf along the left branch: outer leaves lean out, inner ones lean in.
const LEAVES: Array<[number, number, number]> = [
  [30, 79.5, -62], [23.4, 71, -44], [20.2, 60, -24], [19.8, 49, -8], [24.6, 37.5, 4],
  [36, 75.5, -12], [30.2, 66.5, 8], [27.6, 56.5, 18], [27.4, 46.5, 26],
];
const LEAF = "M0 -5 C2.5 -2.4 2.5 2.4 0 5 C-2.5 2.4 -2.5 -2.4 0 -5 Z";

export function Crest({ size = 32, animated = false, className = '', title = 'Delux Sport Club' }: Props) {
  return (
    <svg
      className={`crest ${animated ? 'crest-draw' : ''} ${className}`.trim()}
      width={size}
      height={size}
      viewBox="10 12 80 80"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
    >
      {/* shield: wavy crown, short shoulders, chevron foot */}
      <path className="c1" d="M25 30 C38 20 62 20 75 30" />
      <path className="c1" d="M25 30 L26 45 M75 30 L74 45" />
      <path className="c2" d="M38 82 C44 85 47 87 50 88 C53 87 56 85 62 82" />
      {/* laurels */}
      {[1, -1].map(side => (
        <g key={side} transform={side === -1 ? 'translate(100 0) scale(-1 1)' : undefined}>
          <path className="c2" d="M42 83 C28 76 21 62 24.5 40" />
          {LEAVES.map(([x, y, a], i) => (
            <path key={i} className="c3" strokeWidth={1.4} d={LEAF} transform={`translate(${x} ${y}) rotate(${a})`} />
          ))}
        </g>
      ))}
      {/* tennis racket */}
      <ellipse className="c2" cx={42} cy={44} rx={7.2} ry={9.2} transform="rotate(-42 42 44)" />
      <path className="c4" strokeWidth={0.9} d="M37 41 L46 50 M38.5 38 L48 47.5 M41 36.6 L49 44.6 M36 44.5 L43.5 52 M38 49 L46.5 39 M35.8 46 L44.5 36.5 M41.5 51.5 L49 42.5" />
      <path className="c2" strokeWidth={2.6} d="M47.5 51 L61 66" />
      {/* golf club */}
      <path className="c2" d="M63 33 L42 64" />
      <path className="c5" fill="currentColor" stroke="none" d="M43 62.5 L36.5 65.6 C34.6 66.5 34.8 68.6 36.8 68.6 L42.6 67.8 C44 67.6 44.6 66 44 64.6 Z" />
      {/* ball and star */}
      <circle className="c3" strokeWidth={1.6} cx={50.5} cy={73} r={3.2} />
      <path className="c4" strokeWidth={0.8} d="M48 71 C49.6 72.4 49.6 73.8 48 75.2 M53 71 C51.4 72.4 51.4 73.8 53 75.2" />
      <path className="c5" fill="currentColor" stroke="none" d="M50 25.2 L51.2 28.4 L54.6 28.5 L51.9 30.6 L52.9 33.9 L50 31.9 L47.1 33.9 L48.1 30.6 L45.4 28.5 L48.8 28.4 Z" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`wordmark ${compact ? 'wordmark-compact' : ''}`}>
      <b className="gold-text">DELUX</b>
      <small>SPORT CLUB</small>
    </span>
  );
}
