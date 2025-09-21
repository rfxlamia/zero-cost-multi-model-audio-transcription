import { vi } from 'vitest'

const honoCors = await import('../apps/worker/node_modules/hono/dist/middleware/cors/index.js')
const honoCookie = await import('../apps/worker/node_modules/hono/dist/helper/cookie/index.js')

vi.mock('hono/cors', () => honoCors)
vi.mock('hono/cookie', () => honoCookie)
