import { Hono } from 'hono'
import type { DatabaseAdapter } from '../db/interface'
import type { CSPReport } from '@service-policy-auditor/csp'

export function createSyncRoutes(db: DatabaseAdapter) {
  const app = new Hono()

  app.get('/', async (c) => {
    const since = c.req.query('since') || '1970-01-01T00:00:00.000Z'
    const reports = await db.getReportsSince(since)
    return c.json({ reports, serverTime: new Date().toISOString() })
  })

  app.post('/', async (c) => {
    const body = await c.req.json<{ reports: CSPReport[], clientTime: string }>()

    if (body.reports?.length) {
      await db.insertReports(body.reports)
    }

    const serverReports = await db.getReportsSince(body.clientTime || '1970-01-01T00:00:00.000Z')
    return c.json({ serverReports, serverTime: new Date().toISOString() })
  })

  return app
}
