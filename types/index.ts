// types/index.ts
// Shared TypeScript interfaces for the MES application

export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
export type JobStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
export type RoutingStepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD'
export type LogAction = 'PASS' | 'REWORK' | 'REJECT'
export type DIDisposition = 'UNDER_REVIEW' | 'REWORK' | 'ACCEPTED_AS_IS' | 'REJECTED'
export type DIReason = 'DIMENSION_ISSUE' | 'SURFACE_FINISH' | 'CRACK' | 'MACHINE_ISSUE' | 'WRONG_SETUP' | 'MATERIAL_DEFECT' | 'OTHER'

// ── API Response shapes ────────────────────────────────────────────────────

export interface OperationDTO {
  id: string
  name: string
  code: string | null
  description: string | null
}

export interface CustomerDTO {
  id: string
  name: string
  code: string | null
  phone: string | null
  email: string | null
}

export interface PartDTO {
  id: string
  name: string
  code: string | null
  description: string | null
}

export interface DrawingDTO {
  id: string
  number: string
  revision: string | null
}

export interface RoutingStepDTO {
  id: string
  operationId: string
  operationName: string
  sequence: number
  status: RoutingStepStatus
  qtyIn: number
  qtyPassed: number
  qtyRework: number
  qtyRejected: number
  qtyPending: number
  startedAt: string | null
  completedAt: string | null
  updatedById: string | null
  updatedByName: string | null
  diCount: number
}

export interface JobPartDTO {
  id: string
  partId: string
  partName: string
  drawingNumber: string | null
  totalQty: number
  completedQty: number
  rejectedQty: number
  reworkQty: number
  pendingQty: number
  routingSteps: RoutingStepDTO[]
}

export interface JobListItemDTO {
  id: string
  jobNumber: string
  customerName: string
  poNumber: string | null
  dueDate: string | null
  priority: Priority
  status: JobStatus
  delayStatus: 'overdue' | 'due-today' | 'due-tomorrow' | 'on-track' | 'completed'
  totalParts: number
  activeOperation: string | null
  stepsTotal: number
  stepsDone: number
}

export interface JobDetailDTO extends JobListItemDTO {
  notes: string | null
  customerId: string
  jobParts: JobPartDTO[]
}

export interface DiscrepancyIssueDTO {
  id: string
  jobPartId: string
  routingStepId: string
  operationName: string
  reason: DIReason
  description: string | null
  qty: number
  disposition: DIDisposition
  isReworkable: boolean
  resolvedAt: string | null
  createdAt: string
  updatedByName: string
}

// ── API Request shapes ─────────────────────────────────────────────────────

export interface CreateJobRequest {
  customerId: string
  poNumber?: string
  dueDate?: string
  priority?: Priority
  notes?: string
  parts: Array<{
    partId: string
    drawingId?: string
    totalQty: number
    routing: Array<{ operationId: string; sequence: number }>
  }>
}

export interface UpdateStepRequest {
  action: LogAction
  qty: number
  notes?: string
}

export interface CreateDIRequest {
  jobPartId: string
  routingStepId: string
  reason: DIReason
  description?: string
  qty: number
  isReworkable?: boolean
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardStats {
  activeJobs: number
  delayedJobs: number
  totalRejections: number
  totalReworks: number
  openDIs: number
  bottleneck: { operationName: string; pendingQty: number } | null
}
