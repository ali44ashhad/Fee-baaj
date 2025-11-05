import { toast as sonnerToast } from "sonner"

type ToastProps = {
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function toast({ title, description, action, ...props }: ToastProps) {
  return sonnerToast(title || description, {
    description: title ? description : undefined,
    action: action
      ? {
          label: action.label,
          onClick: action.onClick,
        }
      : undefined,
    ...props,
  })
}

export { toast as default }

