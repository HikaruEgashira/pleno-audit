import { Hono } from 'hono'
import type { DatabaseAdapter, QueryOptions } from '../db/interface'
import type { CSPReport } from '@pleno-audit/csp'

function parseQueryOptions(c: { req: { query: (key: string) => string | undefined } }): QueryOptions {
  const limit = c.req.query('limit')
  const offset = c.req.query('offset')
  const since = c.req.query('since')
  const until = c.req.query('until')

  return {
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
    since: since || undefined,
    until: until || undefined,
  }
}

export function createReportsRoutes(db: DatabaseAdapter) {
  const app = new Hono()

  app.get('/', async (c) => {
    const options = parseQueryOptions(c)

    if (options.limit !== undefined || options.offset !== undefined || options.since || options.until) {
      const result = await db.getReports(options)
      return c.json({
        reports: result.data,
        total: result.total,
        hasMore: result.hasMore,
        lastUpdated: new Date().toISOString()
      })
    }

    const reports = await db.getAllReports()
    return c.json({ reports, lastUpdated: new Date().toISOString() })
  })

  app.get('/violations', async (c) => {
    const options = parseQueryOptions(c)
    const result = await db.getViolations(options)
    return c.json({
      violations: result.data,
      total: result.total,
      hasMore: result.hasMore,
      lastUpdated: new Date().toISOString()
    })
  })

  app.get('/network', async (c) => {
    const options = parseQueryOptions(c)
    const result = await db.getNetworkRequests(options)
    return c.json({
      requests: result.data,
      total: result.total,
      hasMore: result.hasMore,
      lastUpdated: new Date().toISOString()
    })
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
