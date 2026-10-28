import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getDatabase } from '~/server/utils/database'

export default defineEventHandler(async event => {
  const filename = getRouterParam(event, 'filename') || ''
  if (!/^[a-z0-9-]+\.stl$/i.test(filename)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid model file.' })
  }
  const modelUrl = `/api/models/${filename}`
  const post = getDatabase().prepare("SELECT id FROM posts WHERE modelUrl = ? AND status = 'approved'").get(modelUrl)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Model not found.' })

  const filePath = join(process.cwd(), 'data', 'uploads', 'stl', filename)
  try {
    const fileStats = await stat(filePath)
    setResponseHeader(event, 'content-type', 'model/stl')
    setResponseHeader(event, 'content-length', String(fileStats.size))
    setResponseHeader(event, 'content-disposition', `inline; filename="${filename}"`)
    return sendStream(event, createReadStream(filePath))
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Model file not found.' })
  }
})
