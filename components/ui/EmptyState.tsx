import { type LucideIcon } from 'lucide-react'
import { Button } from './Button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-[12px] bg-[#e6f7f5] flex items-center justify-center mb-4">
        <Icon size={24} strokeWidth={1.5} className="text-[#00b89c]" />
      </div>
      <p className="text-[16px] font-semibold font-heading text-[#1a2332] mb-1">{title}</p>
      {description && (
        <p className="text-[14px] text-[#6b7a8d] max-w-xs">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          <Button onClick={action.onClick}>{action.label}</Button>
        </div>
      )}
    </div>
  )
}
