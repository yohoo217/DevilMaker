import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getDatabase } from '~/server/utils/database'
import { getUploadDirectory } from '~/server/utils/uploads'

export default defineEventHandler(async event => {
  const filename = getRouterParam(event, 'filename') || ''
  if (!/^[a-z0-9-]+\.stl$/i.test(filename)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid model file.' })
  }
  const modelUrl = `/api/models/${filename}`
  const db = getDatabase()
  const post = db.prepare("SELECT id FROM posts WHERE modelUrl = ? AND status = 'approved'").get(modelUrl)
  const version = db.prepare('SELECT id FROM project_versions WHERE modelUrl = ?').get(modelUrl)
  const comment = db.prepare(`
    SELECT c.id FROM comments c JOIN posts p ON p.id = c.postId
    WHERE c.modelUrl = ? AND p.status = 'approved'
  `).get(modelUrl)
  if (!post && !version && !comment) throw createError({ statusCode: 404, statusMessage: 'Model not found.' })

  const filePath = join(getUploadDirectory('stl'), filename)
  try {
    const fileStats = await stat(filePath)
    setResponseHeader(event, 'content-type', 'model/stl')
    setResponseHeader(event, 'content-length', fileStats.size)
    setResponseHeader(event, 'content-disposition', `inline; filename="${filename}"`)
    return sendStream(event, createReadStream(filePath))
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Model file not found.' })
  }
})
