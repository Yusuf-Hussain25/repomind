// Centralised inline SVG icons used by the shell. Keeping them here means we
// don't pull in an icon library and we can hand-tune stroke weight for the
// glassmorphism look.

type IconProps = React.SVGProps<SVGSVGElement>;

const baseSvg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const Logo = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <path d="M4 4l8 4 8-4" />
    <path d="M4 12l8 4 8-4" />
    <path d="M4 20l8-4 8 4" />
  </svg>
);

export const HomeIcon = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h14V10" />
  </svg>
);

export const GridIcon = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const AgentIcon = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <circle cx="12" cy="12" r="3" />
    <circle cx="5" cy="6" r="2" />
    <circle cx="19" cy="6" r="2" />
    <circle cx="5" cy="18" r="2" />
    <circle cx="19" cy="18" r="2" />
    <path d="M9.5 11l-3-4M14.5 11l3-4M9.5 13l-3 4M14.5 13l3 4" />
  </svg>
);

export const ActivityIcon = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <path d="M3 12h4l3-9 4 18 3-9h4" />
  </svg>
);

export const ShieldIcon = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const FilesIcon = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
    <path d="M14 3v6h6" />
  </svg>
);

export const ChatIcon = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

export const SettingsIcon = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </svg>
);

export const SearchIcon = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const ChevronIcon = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const PanelIcon = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
  </svg>
);

export const SparkleIcon = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5z" />
  </svg>
);

export const PlusIcon = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ZapIcon = (props: IconProps) => (
  <svg {...baseSvg} {...props}>
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
);
