import React from "react";

type IconProps = { size?: number; className?: string };

const Base = ({
  children,
  size = 24,
  className = "",
}: IconProps & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="square"
    strokeLinejoin="miter"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const IconExport = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5c2.5 2.5 3.8 5.5 3.8 8.5s-1.3 6-3.8 8.5c-2.5-2.5-3.8-5.5-3.8-8.5s1.3-6 3.8-8.5z" />
  </Base>
);

export const IconLocal = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 6.5l5-1.5 6 2 5-1.5v12l-5 1.5-6-2-5 1.5v-12z" />
    <path d="M9 5v14" />
    <path d="M15 7v14" />
  </Base>
);

export const IconEcom = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 4.5h3l2 11h11" />
    <path d="M7 8h13.5l-1.5 6H8.5" />
    <circle cx="10" cy="19" r="1.2" />
    <circle cx="17" cy="19" r="1.2" />
  </Base>
);

export const IconReliability = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5l7.5 2.5v5.5c0 4.5-3 7.5-7.5 9-4.5-1.5-7.5-4.5-7.5-9V6L12 3.5z" />
    <path d="M8.5 12l2.5 2.5 4.5-5" />
  </Base>
);

export const IconReach = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="6" />
    <path d="M3.5 12h2M18.5 12h2M12 3.5v2M12 18.5v2" />
    <path d="M6 6l1.5 1.5M16.5 16.5L18 18M6 18l1.5-1.5M16.5 7.5L18 6" />
  </Base>
);

export const IconIntegrated = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="4" width="10" height="10" />
    <rect x="10" y="10" width="10" height="10" />
  </Base>
);

export const IconPersonal = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 10l4-4 3 2 3-2 4 4-4 4-3-2-3 2-4-4z" />
    <path d="M12 12v6.5" />
  </Base>
);

export const IconArrow = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14" />
    <path d="M14 6l6 6-6 6" />
  </Base>
);

export const IconMail = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="14" />
    <path d="M3 6l9 7 9-7" />
  </Base>
);

export const IconPin = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21c-4-4.5-7-8-7-12a7 7 0 1114 0c0 4-3 7.5-7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </Base>
);

export const IconBilingual = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 5h11v8H8l-3 3v-3H3z" />
    <path d="M10 14v2.5a1.5 1.5 0 001.5 1.5H16l3 3v-3h2v-8h-3" />
  </Base>
);

export const IconGrowth = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 19V5" />
    <path d="M4 19h16" />
    <path d="M7 15l4-5 3 2.5L19 7" />
    <path d="M19 7h-3.2M19 7v3.2" />
  </Base>
);

export const IconNetwork = (p: IconProps) => (
  <Base {...p}>
    <rect x="9.5" y="3" width="5" height="5" />
    <rect x="3" y="16" width="5" height="5" />
    <rect x="16" y="16" width="5" height="5" />
    <path d="M12 8v3M12 11H5.5v5M12 11h6.5v5" />
  </Base>
);

export const IconStore = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 9l1.5-4.5h13L20 9" />
    <path d="M5 9v10h14V9" />
    <path d="M9.5 19v-5h5v5" />
  </Base>
);

export const IconBoxes = (p: IconProps) => (
  <Base {...p}>
    <rect x="8" y="3.5" width="8" height="7" />
    <rect x="3" y="13.5" width="8" height="7" />
    <rect x="13" y="13.5" width="8" height="7" />
  </Base>
);

// ── Portal icons ──────────────────────────────────────────────────────────────
export const IconDashboard = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="8" height="8" />
    <rect x="13" y="3" width="8" height="8" />
    <rect x="3" y="13" width="8" height="8" />
    <rect x="13" y="13" width="8" height="8" />
  </Base>
);

export const IconUsers = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="7" r="3.5" />
    <path d="M2 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" />
    <path d="M16 3.5a3.5 3.5 0 010 7" />
    <path d="M22 20c0-3.5-2-5.5-5-6" />
  </Base>
);

export const IconWallet = (p: IconProps) => (
  <Base {...p}>
    <rect x="2" y="6" width="20" height="14" />
    <path d="M2 10h20" />
    <circle cx="17" cy="15" r="1.5" />
    <path d="M2 6l5-3h10" />
  </Base>
);

export const IconLedger = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 3h13l3 3v15H4z" />
    <path d="M14 3v6h6" />
    <path d="M8 12h8M8 16h6" />
  </Base>
);

export const IconTruck = (p: IconProps) => (
  <Base {...p}>
    <rect x="1" y="7" width="14" height="11" />
    <path d="M15 12h4l3 4v2H15z" />
    <circle cx="5.5" cy="18.5" r="2" />
    <circle cx="18.5" cy="18.5" r="2" />
  </Base>
);

export const IconFolder = (p: IconProps) => (
  <Base {...p}>
    <path d="M2 6.5C2 5 3 4 4.5 4H9l2 2.5h8.5C21 6.5 22 7.5 22 9v9c0 1.5-1 2.5-2.5 2.5h-15C3 20.5 2 19.5 2 18z" />
  </Base>
);

export const IconChat = (p: IconProps) => (
  <Base {...p}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </Base>
);

export const IconContacts = (p: IconProps) => (
  <Base {...p}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </Base>
);

export const IconLogout = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 21H4a2 2 0 01-2-2V5a2 2 0 012-2h5" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Base>
);

export const IconUser = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </Base>
);
