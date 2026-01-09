/**
 * Service Policy Auditor Local Development Server
 *
 * Receives CSP violation reports and network request data from the Chrome Extension
 * and provides a simple dashboard for viewing collected data.
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import type { CSPViolation, NetworkRequest } from '@service-policy-auditor/core'
import { initDatabase, getAllReports, insertReports, clearAllData, getStats } from './db.js'

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001

interface StoredData {
  reports: (CSPViolation | NetworkRequest)[]
  lastUpdated: string
}

function loadReports(): StoredData {
  const reports = getAllReports()
  return { reports, lastUpdated: new Date().toISOString() }
}

function saveReports(reports: (CSPViolation | NetworkRequest)[]): void {
  insertReports(reports)
}

async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function setCORSHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function jsonResponse(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function getDashboardHTML(data: StoredData): string {
  const violations = data.reports.filter(r => r.type === 'csp-violation')
  const networkRequests = data.reports.filter(r => r.type === 'network-request')

  const uniqueDomains = new Set(data.reports.map(r => r.domain).filter(Boolean))

  const directiveStats: Record<string, number> = {}
  for (const v of violations) {
    const d = (v as CSPViolation).directive || 'unknown'
    directiveStats[d] = (directiveStats[d] ?? 0) + 1
  }

  const initiatorStats: Record<string, number> = {}
  for (const r of networkRequests) {
    const i = (r as NetworkRequest).initiator || 'unknown'
    initiatorStats[i] = (initiatorStats[i] ?? 0) + 1
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Service Policy Auditor - Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: hsl(0 0% 98%);
      color: hsl(0 0% 10%);
      line-height: 1.5;
      padding: 24px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    h2 { font-size: 18px; margin: 24px 0 12px; color: hsl(0 0% 30%); }
    h3 { font-size: 14px; margin: 16px 0 8px; color: hsl(0 0% 40%); text-transform: uppercase; letter-spacing: 0.5px; }
    .subtitle { color: hsl(0 0% 50%); font-size: 14px; margin-bottom: 24px; }
    .stats { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 24px; }
    .stat {
      background: white;
      padding: 16px 24px;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .stat-value { font-size: 32px; font-weight: 700; color: hsl(0 0% 20%); }
    .stat-label { font-size: 12px; color: hsl(0 0% 50%); text-transform: uppercase; letter-spacing: 0.5px; }
    .card {
      background: white;
      padding: 16px;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 16px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid hsl(0 0% 95%); }
    th { background: hsl(0 0% 97%); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: hsl(0 0% 50%); }
    tr:hover { background: hsl(0 0% 99%); }
    code { font-family: 'Menlo', monospace; font-size: 11px; background: hsl(0 0% 95%); padding: 2px 4px; border-radius: 2px; }
    .badge { display: inline-block; padding: 2px 6px; background: hsl(0 0% 90%); border-radius: 2px; font-size: 11px; }
    .actions { margin-top: 24px; }
    .btn {
      padding: 8px 16px;
      background: hsl(0 0% 20%);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      margin-right: 8px;
    }
    .btn:hover { background: hsl(0 0% 30%); }
    .btn-secondary { background: hsl(0 0% 90%); color: hsl(0 0% 30%); }
    .btn-secondary:hover { background: hsl(0 0% 85%); }
    .url { word-break: break-all; max-width: 300px; }
    .empty { color: hsl(0 0% 60%); padding: 24px; text-align: center; }
    .refresh-note { font-size: 12px; color: hsl(0 0% 60%); margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Service Policy Auditor Dashboard</h1>
    <p class="subtitle">Last updated: ${data.lastUpdated}</p>

    <div class="stats">
      <div class="stat">
        <div class="stat-value">${data.reports.length}</div>
        <div class="stat-label">Total Events</div>
      </div>
      <div class="stat">
        <div class="stat-value">${violations.length}</div>
        <div class="stat-label">CSP Violations</div>
      </div>
      <div class="stat">
        <div class="stat-value">${networkRequests.length}</div>
        <div class="stat-label">Network Requests</div>
      </div>
      <div class="stat">
        <div class="stat-value">${uniqueDomains.size}</div>
        <div class="stat-label">Unique Domains</div>
      </div>
    </div>

    <div class="actions">
      <button class="btn" onclick="location.reload()">Refresh</button>
      <button class="btn btn-secondary" onclick="clearData()">Clear All Data</button>
      <button class="btn btn-secondary" onclick="exportData()">Export JSON</button>
      <p class="refresh-note">Page auto-refreshes every 5 seconds</p>
    </div>

    <h2>CSP Violations</h2>
    <div class="card">
      ${violations.length === 0 ? '<p class="empty">No CSP violations recorded</p>' : `
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Page</th>
            <th>Directive</th>
            <th>Blocked URL</th>
          </tr>
        </thead>
        <tbody>
          ${violations.slice(0, 50).map((v) => `
            <tr>
              <td>${new Date(v.timestamp).toLocaleTimeString()}</td>
              <td class="url">${truncate(v.pageUrl, 40)}</td>
              <td><code>${(v as CSPViolation).directive}</code></td>
              <td class="url">${truncate((v as CSPViolation).blockedURL, 40)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${violations.length > 50 ? `<p style="padding:8px;color:hsl(0 0% 60%);font-size:12px;">Showing latest 50 of ${violations.length}</p>` : ''}
      `}
    </div>

    <h2>Network Requests</h2>
    <div class="card">
      ${networkRequests.length === 0 ? '<p class="empty">No network requests recorded</p>' : `
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Method</th>
            <th>From</th>
            <th>Domain</th>
            <th>URL</th>
          </tr>
        </thead>
        <tbody>
          ${networkRequests.slice(0, 50).map((r) => `
            <tr>
              <td>${new Date(r.timestamp).toLocaleTimeString()}</td>
              <td><span class="badge">${(r as NetworkRequest).initiator}</span></td>
              <td><code>${(r as NetworkRequest).method || 'GET'}</code></td>
              <td class="url" title="${r.pageUrl}">${truncate(r.pageUrl, 30)}</td>
              <td>${r.domain}</td>
              <td class="url">${truncate((r as NetworkRequest).url, 40)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${networkRequests.length > 50 ? `<p style="padding:8px;color:hsl(0 0% 60%);font-size:12px;">Showing latest 50 of ${networkRequests.length}</p>` : ''}
      `}
    </div>

    <h2>Statistics</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="card">
        <h3>By Directive</h3>
        ${Object.keys(directiveStats).length === 0 ? '<p class="empty">No data</p>' : `
        <table>
          <thead><tr><th>Directive</th><th>Count</th></tr></thead>
          <tbody>
            ${Object.entries(directiveStats).sort((a, b) => b[1] - a[1]).map(([d, c]) => `
              <tr><td><code>${d}</code></td><td>${c}</td></tr>
            `).join('')}
          </tbody>
        </table>
        `}
      </div>
      <div class="card">
        <h3>By Initiator</h3>
        ${Object.keys(initiatorStats).length === 0 ? '<p class="empty">No data</p>' : `
        <table>
          <thead><tr><th>Initiator</th><th>Count</th></tr></thead>
          <tbody>
            ${Object.entries(initiatorStats).sort((a, b) => b[1] - a[1]).map(([i, c]) => `
              <tr><td><span class="badge">${i}</span></td><td>${c}</td></tr>
            `).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  </div>

  <script>
    setTimeout(() => location.reload(), 5000);

    async function clearData() {
      if (!confirm('Clear all collected data?')) return;
      await fetch('/api/v1/reports', { method: 'DELETE' });
      location.reload();
    }

    async function exportData() {
      const res = await fetch('/api/v1/reports');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'service-exposure-' + Date.now() + '.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>`
}

function truncate(str: string, len: number): string {
  return str && str.length > len ? str.substring(0, len) + '...' : str || ''
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)
  const method = req.method || 'GET'

  setCORSHeaders(res)

  if (method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  try {
    if (url.pathname === '/' && method === 'GET') {
      const data = loadReports()
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(getDashboardHTML(data))
      return
    }

    if (url.pathname === '/api/v1/reports' && method === 'GET') {
      const data = loadReports()
      jsonResponse(res, data)
      return
    }

    if (url.pathname === '/api/v1/reports' && method === 'POST') {
      const body = await parseBody(req) as { reports?: (CSPViolation | NetworkRequest)[] }

      if (body.reports && Array.isArray(body.reports)) {
        saveReports(body.reports)
        const stats = getStats()
        const total = stats.violations + stats.requests

        console.log(`[${new Date().toISOString()}] Received ${body.reports.length} reports (total: ${total})`)
        jsonResponse(res, { success: true, totalReports: total })
      } else {
        jsonResponse(res, { success: true, totalReports: 0 })
      }
      return
    }

    if (url.pathname === '/api/v1/reports' && method === 'DELETE') {
      clearAllData()
      console.log(`[${new Date().toISOString()}] All reports cleared`)
      jsonResponse(res, { success: true })
      return
    }

    jsonResponse(res, { error: 'Not found' }, 404)
  } catch (error) {
    console.error('Error handling request:', error)
    jsonResponse(res, { error: 'Internal server error' }, 500)
  }
}

async function startServer() {
  await initDatabase()
  console.log('[SQLite] Database initialized')

  const server = createServer(handleRequest)

  server.listen(PORT, () => {
    console.log(`
+================================================================+
|              Service Policy Auditor Local Server               |
+================================================================+
|                                                                |
|  Dashboard:  http://localhost:${PORT}/                            |
|  API:        http://localhost:${PORT}/api/v1/reports              |
|  Storage:    SQLite (data/service_exposure.db)                 |
|                                                                |
|  Endpoints:                                                    |
|    GET  /              - Dashboard                             |
|    GET  /api/v1/reports - Get all reports                      |
|    POST /api/v1/reports - Receive reports from extension       |
|    DELETE /api/v1/reports - Clear all reports                  |
|                                                                |
+================================================================+
`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
