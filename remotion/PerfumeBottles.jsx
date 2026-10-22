// Placeholder bottles, used only until the real product photos are added to remotion/public/perfumes/.
const W = 400;
const H = 700;

const Svg = ({ height, children }) => (
  <svg viewBox={`0 0 ${W} ${H}`} style={{ height, width: (height * W) / H }}>
    {children}
  </svg>
);

const HawasChrome = ({ height }) => (
  <Svg height={height}>
    <defs>
      <linearGradient id="chrome" x1="0" x2="1">
        <stop offset="0" stopColor="#6d7176" />
        <stop offset="0.18" stopColor="#f4f6f8" />
        <stop offset="0.35" stopColor="#9aa0a6" />
        <stop offset="0.55" stopColor="#ffffff" />
        <stop offset="0.75" stopColor="#80868c" />
        <stop offset="0.9" stopColor="#d9dde1" />
        <stop offset="1" stopColor="#5e6267" />
      </linearGradient>
      <pattern id="braid" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="22" height="22" fill="#b9bec3" />
        <rect width="11" height="22" fill="#eef0f2" />
        <rect y="10" width="22" height="2" fill="#7c8288" />
      </pattern>
    </defs>
    <rect x="130" y="40" width="140" height="190" rx="18" fill="url(#braid)" />
    <rect x="130" y="40" width="140" height="190" rx="18" fill="url(#chrome)" opacity="0.35" />
    <rect x="160" y="228" width="80" height="26" fill="url(#chrome)" />
    <path d="M90 300 Q90 254 140 254 H260 Q310 254 310 300 V630 Q310 670 270 670 H130 Q90 670 90 630 Z" fill="url(#chrome)" />
    <rect x="108" y="280" width="16" height="360" rx="8" fill="#fff" opacity="0.7" />
    <text x="200" y="480" textAnchor="middle" fontFamily="Georgia, serif" fontSize="44" letterSpacing="8" fill="#3d4146">HAWAS</text>
    <text x="200" y="520" textAnchor="middle" fontFamily="Georgia, serif" fontSize="20" letterSpacing="6" fill="#3d4146">CHROME</text>
  </Svg>
);

const Dunescape = ({ height }) => (
  <Svg height={height}>
    <defs>
      <linearGradient id="glass" x1="0" x2="1">
        <stop offset="0" stopColor="#d9dee2" />
        <stop offset="0.15" stopColor="#ffffff" />
        <stop offset="0.85" stopColor="#f2f4f5" />
        <stop offset="1" stopColor="#c9cfd4" />
      </linearGradient>
      <linearGradient id="juice" x1="0" x2="1">
        <stop offset="0" stopColor="#e3b414" />
        <stop offset="0.5" stopColor="#ffd84a" />
        <stop offset="1" stopColor="#d9a50c" />
      </linearGradient>
      <linearGradient id="gold" x1="0" x2="1">
        <stop offset="0" stopColor="#9a7420" />
        <stop offset="0.5" stopColor="#f3d27a" />
        <stop offset="1" stopColor="#8c6a1c" />
      </linearGradient>
      <filter id="sand">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="4" />
        <feColorMatrix values="0 0 0 0 0.86  0 0 0 0 0.74  0 0 0 0 0.55  0 0 0 1.2 -0.25" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
    </defs>
    <rect x="120" y="40" width="160" height="170" rx="10" fill="#d8bf92" />
    <rect x="120" y="40" width="160" height="170" rx="10" fill="#000" filter="url(#sand)" />
    <rect x="112" y="210" width="176" height="40" fill="url(#gold)" />
    <rect x="70" y="250" width="260" height="420" rx="14" fill="url(#glass)" />
    <rect x="92" y="275" width="216" height="372" rx="8" fill="url(#juice)" />
    <rect x="102" y="290" width="12" height="340" rx="6" fill="#fff" opacity="0.6" />
    <text x="200" y="470" textAnchor="middle" fontFamily="Georgia, serif" fontSize="34" letterSpacing="5" fill="#5a4310">DUNESCAPE</text>
    <text x="200" y="505" textAnchor="middle" fontFamily="Georgia, serif" fontSize="20" letterSpacing="6" fill="#5a4310">ARMAF</text>
  </Svg>
);

const Mandarinsky = ({ height }) => (
  <Svg height={height}>
    <defs>
      <linearGradient id="leather" x1="0" x2="1">
        <stop offset="0" stopColor="#0f7d80" />
        <stop offset="0.35" stopColor="#25c3c0" />
        <stop offset="0.7" stopColor="#14a3a3" />
        <stop offset="1" stopColor="#0b6a6d" />
      </linearGradient>
      <linearGradient id="orange" x1="0" x2="1">
        <stop offset="0" stopColor="#c94f00" />
        <stop offset="0.45" stopColor="#ff8a1c" />
        <stop offset="1" stopColor="#b84700" />
      </linearGradient>
    </defs>
    <path d="M145 150 Q145 40 200 40 Q255 40 255 150" fill="none" stroke="url(#orange)" strokeWidth="26" strokeLinecap="round" />
    <rect x="130" y="140" width="140" height="110" rx="20" fill="url(#orange)" />
    <path d="M80 300 Q80 250 130 250 H270 Q320 250 320 300 V620 Q320 670 270 670 H130 Q80 670 80 620 Z" fill="url(#leather)" />
    <path d="M98 300 Q98 268 130 268 H270 Q302 268 302 300 V620 Q302 652 270 652 H130 Q98 652 98 620 Z" fill="none" stroke="#e8fbfa" strokeWidth="3" strokeDasharray="10 8" opacity="0.8" />
    <text x="200" y="455" textAnchor="middle" fontFamily="Georgia, serif" fontSize="38" letterSpacing="5" fill="#ff8a1c">ODYSSEY</text>
    <text x="200" y="495" textAnchor="middle" fontFamily="Georgia, serif" fontSize="22" letterSpacing="4" fill="#ffffff">MANDARINSKY</text>
  </Svg>
);

export const BOTTLE_ILLUSTRATIONS = {
  'hawas-chrome': HawasChrome,
  dunescape: Dunescape,
  mandarinsky: Mandarinsky,
};
