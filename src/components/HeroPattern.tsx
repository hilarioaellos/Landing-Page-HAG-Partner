export default function HeroPattern() {
  return (
    <svg className="hero-pattern" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="hag-grid-v2" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M80 0H0v80" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </pattern>
        <pattern id="hag-mark-v2" width="240" height="240" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="rgba(37,99,235,0.10)" strokeWidth="1">
            <rect x="40" y="40" width="80" height="80" />
            <rect x="100" y="100" width="80" height="80" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hag-grid-v2)" />
      <rect width="100%" height="100%" fill="url(#hag-mark-v2)" />
      <g fill="none" stroke="rgba(37,99,235,0.20)" strokeWidth="1.5">
        <rect x="1080" y="200" width="220" height="220" />
        <rect x="1190" y="310" width="220" height="220" />
      </g>
      <g fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1">
        <rect x="120" y="540" width="160" height="160" />
        <rect x="200" y="620" width="160" height="160" />
      </g>
    </svg>
  );
}
