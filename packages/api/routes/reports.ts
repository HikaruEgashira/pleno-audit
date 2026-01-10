import { Hono } from 'hono'
import type { DatabaseAdapter } from '../db/interface'
import type { CSPReport } from '@service-policy-auditor/csp'

export function createReportsRoutes(db: DatabaseAdapter) {
  const app = new Hono()

  app.get('/', async (c) => {
    const reports = await db.getAllReports()
    return c.json({ reports, lastUpdated: new Date().toISOString() })
  })

  app.post('/', async (c) => {
    const body = await c.req.json<{ reports?: CSPReport[] }>()
    if (body.reports?.length) {
      await db.insertReports(body.reports)
    }
    const stats = await db.getStats()
    return c.json({ success: true, totalReports: stats.violations + stats.requests })
  })

  app.delete('/', async (c) => {
    await db.clearAll()
    return c.json({ success: true })
  })

  return app
}
