import type { Database, SqlJsStatic } from 'sql.js'
import type { CSPViolation, NetworkRequest, CSPReport } from '@service-policy-auditor/core'
import type { DatabaseAdapter, DatabaseStats } from './interface'

export interface SqlJsAdapterOptions {
  persistPath?: string
  loadFromBuffer?: Uint8Array
  onSave?: (data: Uint8Array) => void
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS csp_violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    page_url TEXT NOT NULL,
    directive TEXT NOT NULL,
    blocked_url TEXT NOT NULL,
    domain TEXT NOT NULL,
    disposition TEXT,
    original_policy TEXT,
    source_file TEXT,
    line_number INTEGER,
    column_number INTEGER,
    status_code INTEGER
  );

  CREATE TABLE IF NOT EXISTS network_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    page_url TEXT NOT NULL,
    url TEXT NOT NULL,
    method TEXT NOT NULL,
    initiator TEXT NOT NULL,
    domain TEXT NOT NULL,
    resource_type TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON csp_violations(timestamp);
  CREATE INDEX IF NOT EXISTS idx_violations_domain ON csp_violations(domain);
  CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON network_requests(timestamp);
  CREATE INDEX IF NOT EXISTS idx_requests_domain ON network_requests(domain);
`

export class SqlJsAdapter implements DatabaseAdapter {
  private db: Database | null = null
  private SQL: SqlJsStatic
  private options: SqlJsAdapterOptions

  constructor(SQL: SqlJsStatic, options: SqlJsAdapterOptions = {}) {
    this.SQL = SQL
    this.options = options
  }

  async init(): Promise<void> {
    if (this.db) return

    if (this.options.loadFromBuffer) {
      this.db = new this.SQL.Database(this.options.loadFromBuffer)
    } else {
      this.db = new this.SQL.Database()
    }

    this.db.run(SCHEMA)
    this.save()
  }

  private save(): void {
    if (this.db && this.options.onSave) {
      const data = this.db.export()
      this.options.onSave(data)
    }
  }

  private getDb(): Database {
    if (!this.db) throw new Error('Database not initialized. Call init() first.')
    return this.db
  }

  async insertReports(reports: CSPReport[]): Promise<void> {
    const db = this.getDb()

    db.run('BEGIN TRANSACTION')
    try {
      for (const report of reports) {
        if (report.type === 'csp-violation') {
          const v = report as CSPViolation
          db.run(
            `INSERT INTO csp_violations (timestamp, page_url, directive, blocked_url, domain, disposition, original_policy, source_file, line_number, column_number, status_code)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              v.timestamp, v.pageUrl, v.directive, v.blockedURL, v.domain,
              v.disposition || null, v.originalPolicy || null, v.sourceFile || null,
              v.lineNumber || null, v.columnNumber || null, v.statusCode || null
            ]
          )
        } else {
          const r = report as NetworkRequest
          db.run(
            `INSERT INTO network_requests (timestamp, page_url, url, method, initiator, domain, resource_type)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              r.timestamp, r.pageUrl, r.url, r.method, r.initiator, r.domain,
              r.resourceType || null
            ]
          )
        }
      }
      db.run('COMMIT')
    } catch (error) {
      db.run('ROLLBACK')
      throw error
    }
    this.save()
  }

  async getAllViolations(): Promise<CSPViolation[]> {
    const db = this.getDb()
    const results = db.exec('SELECT * FROM csp_violations ORDER BY timestamp DESC')
    if (results.length === 0) return []

    const columns = results[0].columns
    return results[0].values.map((row) => {
      const obj: Record<string, unknown> = {}
      columns.forEach((col, i) => { obj[col] = row[i] })
      return {
        type: 'csp-violation' as const,
        timestamp: obj.timestamp as string,
        pageUrl: obj.page_url as string,
        directive: obj.directive as string,
        blockedURL: obj.blocked_url as string,
        domain: obj.domain as string,
        disposition: obj.disposition as 'enforce' | 'report',
        originalPolicy: obj.original_policy as string | undefined,
        sourceFile: obj.source_file as string | undefined,
        lineNumber: obj.line_number as number | undefined,
        columnNumber: obj.column_number as number | undefined,
        statusCode: obj.status_code as number | undefined,
      }
    })
  }

  async getAllNetworkRequests(): Promise<NetworkRequest[]> {
    const db = this.getDb()
    const results = db.exec('SELECT * FROM network_requests ORDER BY timestamp DESC')
    if (results.length === 0) return []

    const columns = results[0].columns
    return results[0].values.map((row) => {
      const obj: Record<string, unknown> = {}
      columns.forEach((col, i) => { obj[col] = row[i] })
      return {
        type: 'network-request' as const,
        timestamp: obj.timestamp as string,
        pageUrl: obj.page_url as string,
        url: obj.url as string,
        method: obj.method as string,
        initiator: obj.initiator as NetworkRequest['initiator'],
        domain: obj.domain as string,
        resourceType: obj.resource_type as string | undefined,
      }
    })
  }

  async getAllReports(): Promise<CSPReport[]> {
    const violations = await this.getAllViolations()
    const requests = await this.getAllNetworkRequests()
    const all = [...violations, ...requests]
    all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return all
  }

  async getStats(): Promise<DatabaseStats> {
    const db = this.getDb()
    const vResult = db.exec('SELECT COUNT(*) as count FROM csp_violations')
    const rResult = db.exec('SELECT COUNT(*) as count FROM network_requests')
    const domainResult = db.exec(`
      SELECT COUNT(DISTINCT domain) as count FROM (
        SELECT domain FROM csp_violations
        UNION
        SELECT domain FROM network_requests
      )
    `)

    return {
      violations: vResult.length > 0 ? (vResult[0].values[0][0] as number) : 0,
      requests: rResult.length > 0 ? (rResult[0].values[0][0] as number) : 0,
      uniqueDomains: domainResult.length > 0 ? (domainResult[0].values[0][0] as number) : 0,
    }
  }

  async clearAll(): Promise<void> {
    const db = this.getDb()
    db.run('DELETE FROM csp_violations')
    db.run('DELETE FROM network_requests')
    this.save()
  }

  async close(): Promise<void> {
    if (this.db) {
      this.save()
      this.db.close()
      this.db = null
    }
  }

  async getReportsSince(timestamp: string): Promise<CSPReport[]> {
    const db = this.getDb()

    const vResults = db.exec(
      'SELECT * FROM csp_violations WHERE timestamp > ? ORDER BY timestamp ASC',
      [timestamp]
    )
    const rResults = db.exec(
      'SELECT * FROM network_requests WHERE timestamp > ? ORDER BY timestamp ASC',
      [timestamp]
    )

    const violations: CSPViolation[] = vResults.length > 0
      ? vResults[0].values.map((row) => {
          const columns = vResults[0].columns
          const obj: Record<string, unknown> = {}
          columns.forEach((col, i) => { obj[col] = row[i] })
          return {
            type: 'csp-violation' as const,
            timestamp: obj.timestamp as string,
            pageUrl: obj.page_url as string,
            directive: obj.directive as string,
            blockedURL: obj.blocked_url as string,
            domain: obj.domain as string,
            disposition: obj.disposition as 'enforce' | 'report',
            originalPolicy: obj.original_policy as string | undefined,
            sourceFile: obj.source_file as string | undefined,
            lineNumber: obj.line_number as number | undefined,
            columnNumber: obj.column_number as number | undefined,
            statusCode: obj.status_code as number | undefined,
          }
        })
      : []

    const requests: NetworkRequest[] = rResults.length > 0
      ? rResults[0].values.map((row) => {
          const columns = rResults[0].columns
          const obj: Record<string, unknown> = {}
          columns.forEach((col, i) => { obj[col] = row[i] })
          return {
            type: 'network-request' as const,
            timestamp: obj.timestamp as string,
            pageUrl: obj.page_url as string,
            url: obj.url as string,
            method: obj.method as string,
            initiator: obj.initiator as NetworkRequest['initiator'],
            domain: obj.domain as string,
            resourceType: obj.resource_type as string | undefined,
          }
        })
      : []

    return [...violations, ...requests].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
  }

  export(): Uint8Array {
    return this.getDb().export()
  }
}
