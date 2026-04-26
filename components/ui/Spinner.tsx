export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-block rounded-full border-2 border-[#e8ecf0] border-t-[#00b89c] animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}
