import type { CSPViolation, NetworkRequest, CSPReport } from '@service-policy-auditor/csp'

export interface DatabaseStats {
  violations: number
  requests: number
  uniqueDomains: number
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
}
