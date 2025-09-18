import { Hono } from 'hono'
import { health } from './routes/health'
import { correct } from './routes/correct'
const app = new Hono()
app.get('/', (c) => c.text('TranscriptorAI Worker orchestrator'))
// Mount routes
app.route('/', health)
app.route('/', correct)
app.onError((err, c) => {
  console.error(err)
  return c.text('Internal Server Error', 500)
})
export default app
