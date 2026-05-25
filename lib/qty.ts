// lib/qty.ts
// Quantity calculation utilities — single source of truth

export interface QtySnapshot {
  totalQty: number
  completedQty: number
  rejectedQty: number
  reworkQty: number
  pendingQty: number
  inProgressQty: number
}

export interface StepQty {
  qtyIn: number
  qtyPassed: number
  qtyRework: number
  qtyRejected: number
  qtyPending: number // in − passed − rework − rejected
}

/**
 * Compute the effective pending qty at a routing step.
 * Pending = pieces in the step not yet dispositioned.
 */
export function stepPendingQty(step: {
  qtyIn: number
  qtyPassed: number
  qtyRework: number
  qtyRejected: number
}): number {
  return Math.max(0, step.qtyIn - step.qtyPassed - step.qtyRework - step.qtyRejected)
}

/**
 * Compute high-level qty snapshot for a JobPart.
 * completedQty  = last COMPLETED step's qtyPassed
 * rejectedQty   = sum of all steps qtyRejected
 * reworkQty     = sum of all steps qtyRework that haven't been resolved
 * pendingQty    = totalQty − completedQty − rejectedQty
 */
export function computeJobPartQty(
  totalQty: number,
  steps: Array<{
    status: string
    qtyIn: number
    qtyPassed: number
    qtyRework: number
    qtyRejected: number
    sequence: number
  }>
): QtySnapshot {
  const sortedSteps = [...steps].sort((a, b) => a.sequence - b.sequence)

  let completedQty = 0
  let rejectedQty = 0
  let reworkQty = 0
  let inProgressQty = 0

  // Find the last completed step to get final passed qty
  const lastCompletedStep = sortedSteps.filter(s => s.status === 'COMPLETED').at(-1)
  if (lastCompletedStep) {
    completedQty = lastCompletedStep.qtyPassed
  }

  // Accumulate rejected across all steps
  for (const step of sortedSteps) {
    rejectedQty += step.qtyRejected
    reworkQty += step.qtyRework
    if (step.status === 'IN_PROGRESS') {
      inProgressQty = stepPendingQty(step)
    }
  }

  const pendingQty = Math.max(0, totalQty - completedQty - rejectedQty - inProgressQty)

  return {
    totalQty,
    completedQty,
    rejectedQty,
    reworkQty,
    pendingQty,
    inProgressQty,
  }
}

/**
 * Validate that a proposed qty update doesn't exceed available qty at a step.
 */
export function validateStepUpdate(
  step: { qtyIn: number; qtyPassed: number; qtyRework: number; qtyRejected: number },
  delta: number
): { valid: boolean; available: number } {
  const available = stepPendingQty(step)
  return { valid: delta > 0 && delta <= available, available }
}

/**
 * Get job delay status based on due date and job status.
 */
export function getJobDelayStatus(
  dueDate: Date | null,
  status: string
): 'overdue' | 'due-today' | 'due-tomorrow' | 'on-track' | 'completed' {
  if (status === 'COMPLETED') return 'completed'
  if (!dueDate) return 'on-track'

  const now = new Date()
  const due = new Date(dueDate)
  const diffDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'due-today'
  if (diffDays === 1) return 'due-tomorrow'
  return 'on-track'
}
