type BadgeVariant = 'active' | 'paused' | 'cancelled' | 'over-budget' | 'default'

const variantClasses: Record<BadgeVariant, string> = {
  active: 'bg-[#e6f7f5] text-[#00b89c]',
  paused: 'bg-[#fef9ec] text-[#d97706]',
  cancelled: 'bg-[#f4f6f9] text-[#6b7a8d]',
  'over-budget': 'bg-[#fef2f2] text-[#ef4444]',
  default: 'bg-[#f4f6f9] text-[#6b7a8d]',
}

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-[99px] px-2 py-0.5
        text-[11px] font-medium font-heading
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  )
}
