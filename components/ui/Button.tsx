import { forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-[#00b89c] text-white hover:bg-[#009e87] border-transparent',
  secondary: 'bg-white text-[#00b89c] border-[#00b89c] hover:bg-[#e6f7f5]',
  danger: 'bg-[#fef2f2] text-[#ef4444] border-[#ef4444]/30 hover:bg-red-100',
  ghost: 'bg-transparent text-[#00b89c] border-transparent hover:bg-[#e6f7f5]',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-[30px] px-3 text-[12px]',
  md: 'h-[36px] px-4 text-[13px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, children, className = '', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        font-medium font-heading rounded-[8px] border
        transition-all active:scale-[0.98]
        disabled:opacity-60 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {loading ? <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" /> : null}
      {children}
    </button>
  )
})
