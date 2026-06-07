/** The Sift funnel mark. Inherits color from `fill`/CSS; size via props. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg
      className="logo"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <rect x="0.5" y="0.5" width="23" height="23" rx="6" fill="#4f46e5" />
      <path
        d="M5 7h14l-5.2 6v4.2l-3.6 1.8V13L5 7z"
        fill="#ffffff"
      />
      <circle cx="12" cy="19.2" r="1.15" fill="#c7d2fe" />
    </svg>
  );
}
