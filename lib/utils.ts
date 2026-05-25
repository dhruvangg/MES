// lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`
  if (diffDays === -1) return 'Yesterday'
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  return `In ${diffDays} days`
}

export function generateJobNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 900) + 100
  const ts = Date.now().toString().slice(-4)
  return `JOB-${year}-${ts}${random}`
}

export function diReasonLabel(reason: string): string {
  const map: Record<string, string> = {
    DIMENSION_ISSUE: 'Dimension Issue',
    SURFACE_FINISH: 'Surface Finish',
    CRACK: 'Crack',
    MACHINE_ISSUE: 'Machine Issue',
    WRONG_SETUP: 'Wrong Setup',
    MATERIAL_DEFECT: 'Material Defect',
    OTHER: 'Other',
  }
  return map[reason] ?? reason
}

export function priorityLabel(p: string): string {
  const map: Record<string, string> = {
    LOW: 'Low',
    NORMAL: 'Normal',
    HIGH: 'High',
    URGENT: 'Urgent',
  }
  return map[p] ?? p
}
