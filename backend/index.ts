import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { analyseScreen } from './routes/analyseScreen.js'

const app = express()
const port = Number(process.env.PORT || 3001)

app.use(cors())
app.use(express.json({ limit: '12mb' }))
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})
app.post('/api/analyse-screen', analyseScreen)

app.listen(port, () => {
  console.log(`GhostMode backend listening on port ${port}`)
})
