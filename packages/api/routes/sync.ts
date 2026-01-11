import { Hono } from 'hono'
import type { DatabaseAdapter } from '../db/interface'
import type { CSPReport } from '@pleno-audit/csp'

const DEFAULT_BATCH_SIZE = 500

export function createSyncRoutes(db: DatabaseAdapter) {
  const app = new Hono()

  app.get('/', async (c) => {
    const since = c.req.query('since') || '1970-01-01T00:00:00.000Z'
    const limitParam = c.req.query('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_BATCH_SIZE

    const result = await db.getReports({ since, limit })
    return c.json({
      reports: result.data,
      total: result.total,
      hasMore: result.hasMore,
      serverTime: new Date().toISOString()
    })
  })

  app.post('/', async (c) => {
    const body = await c.req.json<{ reports: CSPReport[], clientTime: string, limit?: number }>()

    if (body.reports?.length) {
      await db.insertReports(body.reports)
    }

    const limit = body.limit ?? DEFAULT_BATCH_SIZE
    const result = await db.getReports({
      since: body.clientTime || '1970-01-01T00:00:00.000Z',
      limit
    })

    return c.json({
      serverReports: result.data,
      total: result.total,
      hasMore: result.hasMore,
      serverTime: new Date().toISOString()
    })
  })

  return app
}
