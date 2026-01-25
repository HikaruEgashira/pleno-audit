import { serve } from '@hono/node-server'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp as createApiApp } from '@pleno-audit/api'
import { FileSystemAdapter } from './filesystem-adapter'
import { ServerParquetAdapter } from './server-parquet-adapter'
import { getDashboardHTML } from './dashboard'
import { Hono } from 'hono'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../data')
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true })
}

export async function createApp() {
  await ensureDataDir()

  const storage = new FileSystemAdapter(DATA_DIR)
  const db = new ServerParquetAdapter(storage)
  await db.init()

  const apiApp = createApiApp(db)

  const app = new Hono()

  app.get('/', async (c) => {
    const reports = await db.getAllReports()
    const lastUpdated = new Date().toISOString()
    return c.html(getDashboardHTML(reports, lastUpdated))
  })

  app.route('/', apiApp)

  return app
}

async function startServer() {
  const app = await createApp()

  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`
+================================================================+
|                   Pleno Audit Local Server                     |
+================================================================+
|                                                                |
|  Dashboard:  http://localhost:${PORT}/                            |
|  API:        http://localhost:${PORT}/api/v1/reports              |
|  Storage:    Parquet (FileSystem: ${DATA_DIR})
|                                                                |
|  Endpoints:                                                    |
|    GET  /              - Dashboard                             |
|    GET  /api/v1/reports - Get all reports                      |
|    POST /api/v1/reports - Receive reports from extension       |
|    DELETE /api/v1/reports - Clear all reports                  |
|    GET  /api/v1/stats  - Get statistics                        |
|    GET  /api/v1/sync   - Get reports since timestamp           |
|    POST /api/v1/sync   - Sync reports                          |
|                                                                |
+================================================================+
`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
