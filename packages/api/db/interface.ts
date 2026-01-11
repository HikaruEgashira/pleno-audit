import type { CSPViolation, NetworkRequest, CSPReport } from '@pleno-audit/csp'

export interface DatabaseStats {
  violations: number
  requests: number
  uniqueDomains: number
}

export interface QueryOptions {
  limit?: number
  offset?: number
  since?: string
  until?: string
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  hasMore: boolean
}

export interface DatabaseAdapter {
  init(): Promise<void>
  insertReports(reports: CSPReport[]): Promise<void>
  getAllReports(): Promise<CSPReport[]>
  getAllViolations(): Promise<CSPViolation[]>
  getAllNetworkRequests(): Promise<NetworkRequest[]>
  getStats(): Promise<DatabaseStats>
  clearAll(): Promise<void>
  close(): Promise<void>
  getReportsSince(timestamp: string): Promise<CSPReport[]>
  getReports(options?: QueryOptions): Promise<PaginatedResult<CSPReport>>
  getViolations(options?: QueryOptions): Promise<PaginatedResult<CSPViolation>>
  getNetworkRequests(options?: QueryOptions): Promise<PaginatedResult<NetworkRequest>>
}
