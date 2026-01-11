import type { Database, SqlJsStatic } from 'sql.js'
import type { CSPViolation, NetworkRequest, CSPReport } from '@pleno-audit/csp'
import type { DatabaseAdapter, DatabaseStats, QueryOptions, PaginatedResult } from './interface'

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

type SqlRow = (string | number | null)[]

function rowToObject(columns: string[], row: SqlRow): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  columns.forEach((col, i) => { obj[col] = row[i] })
  return obj
}

function mapViolation(obj: Record<string, unknown>): CSPViolation {
  return {
    type: 'csp-violation',
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
}

function mapNetworkRequest(obj: Record<string, unknown>): NetworkRequest {
  return {
    type: 'network-request',
    timestamp: obj.timestamp as string,
    pageUrl: obj.page_url as string,
    url: obj.url as string,
    method: obj.method as string,
    initiator: obj.initiator as NetworkRequest['initiator'],
    domain: obj.domain as string,
    resourceType: obj.resource_type as string | undefined,
  }
}

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
    const { columns, values } = results[0]
    return values.map((row) => mapViolation(rowToObject(columns, row)))
  }

  async getAllNetworkRequests(): Promise<NetworkRequest[]> {
    const db = this.getDb()
    const results = db.exec('SELECT * FROM network_requests ORDER BY timestamp DESC')
    if (results.length === 0) return []
    const { columns, values } = results[0]
    return values.map((row) => mapNetworkRequest(rowToObject(columns, row)))
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

  async deleteOldReports(beforeTimestamp: string): Promise<number> {
    const db = this.getDb()
    db.run('BEGIN TRANSACTION')
    try {
      db.run('DELETE FROM csp_violations WHERE timestamp < ?', [beforeTimestamp])
      const vChanges = db.getRowsModified()
      db.run('DELETE FROM network_requests WHERE timestamp < ?', [beforeTimestamp])
      const rChanges = db.getRowsModified()
      db.run('COMMIT')
      this.save()
      return vChanges + rChanges
    } catch (error) {
      db.run('ROLLBACK')
      throw error
    }
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

    const violations = vResults.length > 0
      ? vResults[0].values.map((row) => mapViolation(rowToObject(vResults[0].columns, row)))
      : []
    const requests = rResults.length > 0
      ? rResults[0].values.map((row) => mapNetworkRequest(rowToObject(rResults[0].columns, row)))
      : []

    return [...violations, ...requests].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
  }

  export(): Uint8Array {
    return this.getDb().export()
  }

  private buildWhereClause(options: QueryOptions, timestampColumn: string): { where: string; params: (string | number)[] } {
    const conditions: string[] = []
    const params: (string | number)[] = []

    if (options.since) {
      // sinceが数値（timestamp）の場合はISO文字列に変換
      const sinceValue = typeof options.since === 'number'
        ? new Date(options.since).toISOString()
        : options.since
      conditions.push(`${timestampColumn} >= ?`)
      params.push(sinceValue)
    }
    if (options.until) {
      const untilValue = typeof options.until === 'number'
        ? new Date(options.until).toISOString()
        : options.until
      conditions.push(`${timestampColumn} <= ?`)
      params.push(untilValue)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    return { where, params }
  }

  private buildLimitClause(options: QueryOptions): { limitClause: string; params: number[] } {
    // limitが指定されていない場合は無制限
    if (options.limit === undefined && options.offset === undefined) {
      return { limitClause: '', params: [] }
    }

    const offset = options.offset ?? 0
    if (options.limit === undefined) {
      // offsetのみ指定: LIMIT -1 OFFSET n（SQLiteでは-1は無制限）
      return { limitClause: 'LIMIT -1 OFFSET ?', params: [offset] }
    }

    return { limitClause: 'LIMIT ? OFFSET ?', params: [options.limit, offset] }
  }

  async getViolations(options: QueryOptions = {}): Promise<PaginatedResult<CSPViolation>> {
    const db = this.getDb()
    const { where, params: whereParams } = this.buildWhereClause(options, 'timestamp')

    const countResult = db.exec(`SELECT COUNT(*) as count FROM csp_violations ${where}`, whereParams)
    const total = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0

    const { limitClause, params: limitParams } = this.buildLimitClause(options)
    const queryParams = [...whereParams, ...limitParams]

    const query = `SELECT * FROM csp_violations ${where} ORDER BY timestamp DESC ${limitClause}`
    const results = db.exec(query, queryParams)

    const data = results.length > 0
      ? results[0].values.map((row) => mapViolation(rowToObject(results[0].columns, row)))
      : []

    const offset = options.offset ?? 0
    return {
      data,
      total,
      hasMore: offset + data.length < total,
    }
  }

  async getNetworkRequests(options: QueryOptions = {}): Promise<PaginatedResult<NetworkRequest>> {
    const db = this.getDb()
    const { where, params: whereParams } = this.buildWhereClause(options, 'timestamp')

    const countResult = db.exec(`SELECT COUNT(*) as count FROM network_requests ${where}`, whereParams)
    const total = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0

    const { limitClause, params: limitParams } = this.buildLimitClause(options)
    const queryParams = [...whereParams, ...limitParams]

    const query = `SELECT * FROM network_requests ${where} ORDER BY timestamp DESC ${limitClause}`
    const results = db.exec(query, queryParams)

    const data = results.length > 0
      ? results[0].values.map((row) => mapNetworkRequest(rowToObject(results[0].columns, row)))
      : []

    const offset = options.offset ?? 0
    return {
      data,
      total,
      hasMore: offset + data.length < total,
    }
  }

  async getReports(options: QueryOptions = {}): Promise<PaginatedResult<CSPReport>> {
    const db = this.getDb()
    const { where: vWhere, params: vParams } = this.buildWhereClause(options, 'timestamp')
    const { where: rWhere, params: rParams } = this.buildWhereClause(options, 'timestamp')

    const vCountResult = db.exec(`SELECT COUNT(*) as count FROM csp_violations ${vWhere}`, vParams)
    const rCountResult = db.exec(`SELECT COUNT(*) as count FROM network_requests ${rWhere}`, rParams)
    const vTotal = vCountResult.length > 0 ? (vCountResult[0].values[0][0] as number) : 0
    const rTotal = rCountResult.length > 0 ? (rCountResult[0].values[0][0] as number) : 0
    const total = vTotal + rTotal

    const { limitClause, params: limitParams } = this.buildLimitClause(options)
    const vQueryParams = [...vParams, ...limitParams]
    const rQueryParams = [...rParams, ...limitParams]

    const vQuery = `SELECT *, 'csp-violation' as report_type FROM csp_violations ${vWhere} ORDER BY timestamp DESC ${limitClause}`
    const rQuery = `SELECT *, 'network-request' as report_type FROM network_requests ${rWhere} ORDER BY timestamp DESC ${limitClause}`

    const vResults = db.exec(vQuery, vQueryParams)
    const rResults = db.exec(rQuery, rQueryParams)

    const violations = vResults.length > 0
      ? vResults[0].values.map((row) => mapViolation(rowToObject(vResults[0].columns, row)))
      : []
    const requests = rResults.length > 0
      ? rResults[0].values.map((row) => mapNetworkRequest(rowToObject(rResults[0].columns, row)))
      : []

    let data = [...violations, ...requests]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // limitが指定されている場合のみスライス
    if (options.limit !== undefined) {
      data = data.slice(0, options.limit)
    }

    const offset = options.offset ?? 0
    return {
      data,
      total,
      hasMore: offset + data.length < total,
    }
  }
}
