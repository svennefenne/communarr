/**
 * The page backdrop (Deck Force's): deep space with faint orbit lines and a sparse star field, or a
 * star field alone, a retro grid, dunes, or plain; tinted by the theme. A theme's or the site's
 * background picture covers it (the theme's colour laid over the picture by --bg-dim).
 */

function stars(count: number, seed: number) {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: count }, () => ({ x: rnd() * 100, y: rnd() * 100, r: rnd() < 0.08 ? 1.3 : rnd() * 0.7 + 0.25, o: rnd() * 0.5 + 0.15 }));
}

const STARS = stars(150, 1977);

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <svg className="bd-layer bd-stars" viewBox="0 0 100 100" preserveAspectRatio="none">
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.08} className="bd-star" opacity={s.o} />
        ))}
      </svg>
      <svg className="bd-layer bd-orbits" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <g className="bd-line">
          <circle cx="1240" cy="520" r="430" />
          <circle cx="1240" cy="520" r="560" strokeDasharray="2 10" />
          <circle cx="1240" cy="520" r="720" />
          <ellipse cx="1240" cy="520" rx="900" ry="300" transform="rotate(-18 1240 520)" />
          <circle cx="160" cy="120" r="260" />
          <path d="M -40 860 Q 800 640 1640 860" />
        </g>
        <g className="bd-line-accent">
          <ellipse cx="1240" cy="520" rx="640" ry="210" transform="rotate(-18 1240 520)" strokeDasharray="1 7" />
        </g>
        <circle cx="1240" cy="520" r="3" className="bd-planet" />
      </svg>
      <svg className="bd-layer bd-grid" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="bdSun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="bd-sun-a" />
            <stop offset="1" className="bd-sun-b" />
          </linearGradient>
        </defs>
        <circle cx="800" cy="600" r="210" fill="url(#bdSun)" className="bd-sun" />
        <g className="bd-sun-cut">
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x="560" y={610 + i * 26} width="480" height={4 + i * 2} />
          ))}
        </g>
        <g className="bd-line">
          {Array.from({ length: 13 }, (_, i) => (
            <line key={`h${i}`} x1="-200" x2="1800" y1={640 + (i * i * 360) / 144} y2={640 + (i * i * 360) / 144} />
          ))}
          {Array.from({ length: 29 }, (_, i) => (
            <line key={`v${i}`} x1={800 + (i - 14) * 40} y1="640" x2={800 + (i - 14) * 260} y2="1000" />
          ))}
        </g>
      </svg>
      <svg className="bd-layer bd-waves" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice">
        <circle cx="1150" cy="300" r="190" className="bd-glow-a" />
        <circle cx="1150" cy="300" r="40" className="bd-sun-dot" />
        <circle cx="1310" cy="372" r="140" className="bd-glow-b" />
        <circle cx="1310" cy="372" r="25" className="bd-sun-dot2" />
        <path d="M -40 820 C 260 740 520 760 820 800 S 1380 760 1640 720 L 1640 1040 L -40 1040 Z" className="bd-dune-a" />
        <path d="M -40 900 C 320 820 640 860 980 880 S 1440 840 1640 860 L 1640 1040 L -40 1040 Z" className="bd-dune-b" />
      </svg>
      {/* shown only when the theme has a picture (--bg-on), so the theme editor can preview one */}
      <div className="bd-pic" />
    </div>
  );
}
