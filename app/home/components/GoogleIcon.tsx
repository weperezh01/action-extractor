interface GoogleIconProps {
  className?: string
}

export function GoogleIcon({ className }: GoogleIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.08 3.56-5.16 3.56-8.65Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3A7.17 7.17 0 0 1 12 19.33a7.2 7.2 0 0 1-6.75-4.97H1.24v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.36a7.2 7.2 0 0 1 0-4.72V6.55H1.24a12 12 0 0 0 0 10.9l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.82l3.42-3.42A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.24 6.55l4 3.09A7.2 7.2 0 0 1 12 4.77Z"
      />
    </svg>
  )
}
