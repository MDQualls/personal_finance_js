import { forwardRef } from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, options, placeholder, className = '', id, ...props },
  ref
) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-[13px] font-medium font-heading text-[#1a2332]">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={`
          h-[40px] px-3 rounded-[8px] border text-[14px] text-[#1a2332] bg-white
          outline-none transition-colors appearance-none cursor-pointer
          ${error
            ? 'border-[#ef4444] focus:border-[#ef4444] focus:ring-1 focus:ring-[#ef4444]'
            : 'border-[#e8ecf0] focus:border-[#00b89c] focus:ring-1 focus:ring-[#00b89c]'
          }
          ${className}
        `}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-[12px] text-[#ef4444]">{error}</p>}
    </div>
  )
})
