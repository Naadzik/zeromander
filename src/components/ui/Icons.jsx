const PATHS = {
  ballot: (
    <>
      <rect x="3" y="10" width="18" height="10" rx="1.5" />
      <path d="M9 10h6" />
      <path d="M9.5 10V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V10" />
    </>
  ),
  chart: (
    <>
      <path d="M5 20v-6" />
      <path d="M11 20V6" />
      <path d="M17 20v-10" />
      <path d="M3 20h18" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.5" fill="currentColor" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16" />
      <path d="M8 20h8" />
      <path d="M4 7h16" />
      <path d="M6.5 7 4 12.5a2.6 2.6 0 0 0 5 0L6.5 7z" />
      <path d="M17.5 7 15 12.5a2.6 2.6 0 0 0 5 0L17.5 7z" />
    </>
  ),
  map: (
    <>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  ),
  redo: (
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M6 11l6 6 6-6" />
      <path d="M4 21h16" />
    </>
  ),
  check: <path d="M4 12l5 5L20 7" />,
  cross: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
};

export default function Icon({ name, size = 16, className = '' }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}
