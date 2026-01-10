/**
 * SQLite Database Module for Service Policy Auditor (using sql.js)
 */

import initSqlJs, { Database } from 'sql.js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CSPViolation, NetworkRequest } from '@service-policy-auditor/csp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../data')
const DB_PATH = join(DATA_DIR, 'service_exposure.db')

let db: Database | null = null

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function saveDbToFile() {
  if (db) {
    const data = db.export()
    const buffer = Buffer.from(data)
    writeFileSync(DB_PATH, buffer)
  }
}

export async function initDatabase(): Promise<Database> {
  if (db) return db

  ensureDataDir()
  const SQL = await initSqlJs()

  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  db.run(`
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
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS network_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      page_url TEXT NOT NULL,
      url TEXT NOT NULL,
      method TEXT NOT NULL,
      initiator TEXT NOT NULL,
      domain TEXT NOT NULL,
      resource_type TEXT
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON csp_violations(timestamp)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_violations_domain ON csp_violations(domain)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON network_requests(timestamp)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_requests_domain ON network_requests(domain)`)

  saveDbToFile()
  return db
}

function getDb(): Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}

export function insertReports(reports: (CSPViolation | NetworkRequest)[]): void {
  const database = getDb()

  for (const report of reports) {
    if (report.type === 'csp-violation') {
      const v = report as CSPViolation
      database.run(
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
      database.run(
        `INSERT INTO network_requests (timestamp, page_url, url, method, initiator, domain, resource_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          r.timestamp, r.pageUrl, r.url, r.method, r.initiator, r.domain,
          r.resourceType || null
        ]
      )
    }
  }
  saveDbToFile()
}

export function getAllViolations(): CSPViolation[] {
  const database = getDb()
  const results = database.exec('SELECT * FROM csp_violations ORDER BY timestamp DESC')
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

export function getAllNetworkRequests(): NetworkRequest[] {
  const database = getDb()
  const results = database.exec('SELECT * FROM network_requests ORDER BY timestamp DESC')
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

export function getAllReports(): (CSPViolation | NetworkRequest)[] {
  const violations = getAllViolations()
  const requests = getAllNetworkRequests()
  const all = [...violations, ...requests]
  all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return all
}

export function clearAllData(): void {
  const database = getDb()
  database.run('DELETE FROM csp_violations')
  database.run('DELETE FROM network_requests')
  saveDbToFile()
}

export function getStats(): { violations: number; requests: number } {
  const database = getDb()
  const vResult = database.exec('SELECT COUNT(*) as count FROM csp_violations')
  const rResult = database.exec('SELECT COUNT(*) as count FROM network_requests')
  return {
    violations: vResult.length > 0 ? (vResult[0].values[0][0] as number) : 0,
    requests: rResult.length > 0 ? (rResult[0].values[0][0] as number) : 0,
  }
}

export function closeDatabase(): void {
  if (db) {
    saveDbToFile()
    db.close()
    db = null
  }
}
