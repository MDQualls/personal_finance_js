import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className = '', id, ...props },
  ref
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-medium font-heading text-[#1a2332]">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`
          h-[40px] px-3 rounded-[8px] border text-[14px] text-[#1a2332]
          placeholder:text-[#b0bac6] outline-none transition-colors
          ${error
            ? 'border-[#ef4444] focus:border-[#ef4444] focus:ring-1 focus:ring-[#ef4444]'
            : 'border-[#e8ecf0] focus:border-[#00b89c] focus:ring-1 focus:ring-[#00b89c]'
          }
          disabled:bg-[#f4f6f9] disabled:cursor-not-allowed
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-[12px] text-[#ef4444]">{error}</p>}
      {hint && !error && <p className="text-[12px] text-[#6b7a8d]">{hint}</p>}
    </div>
  )
})
