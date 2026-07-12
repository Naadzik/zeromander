const PATHS = {
  plusSquare: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 8.5v7" />
      <path d="M8.5 12h7" />
    </>
  ),
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
  // Streak flame
  flame: (
    <path d="M12 3c1 3-3.5 5-3.5 9a3.5 3.5 0 0 0 7 0c0-1.5-.8-2.6-1.5-3.5C15.5 10 18 11 18 14a6 6 0 0 1-12 0c0-5 5-6.5 6-11z" />
  ),
  // The heist: a fedora
  spy: (
    <>
      <path d="M8 12V8.5A2.5 2.5 0 0 1 10.5 6h3A2.5 2.5 0 0 1 16 8.5V12" />
      <path d="M3 14c3-1.6 6-2 9-2s6 .4 9 2" />
      <path d="M3 14c2.5 2 5.5 3 9 3s6.5-1 9-3" />
    </>
  ),
  // Undecided: a hatched square
  undecided: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <path d="M4 12 12 4" />
      <path d="M4 19 19 4" />
      <path d="M9 20 20 9" />
      <path d="M16 20l4-4" />
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
