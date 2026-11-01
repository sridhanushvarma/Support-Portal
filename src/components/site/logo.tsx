export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className={className}>
      <rect width="64" height="64" rx="14" fill="#0f2a43" />
      <path
        d="M18 40V24l14-8 14 8v16l-14 8z"
        fill="none"
        stroke="#2dd4bf"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="5" fill="#fff" />
    </svg>
  );
}
