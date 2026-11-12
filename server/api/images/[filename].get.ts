import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { getDatabase } from '~/server/utils/database'
import { getUploadDirectory } from '~/server/utils/uploads'

const contentTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}

export default defineEventHandler(async event => {
  const filename = getRouterParam(event, 'filename') || ''
  if (!/^[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid image file.' })
  }
  const imageUrl = `/api/images/${filename}`
  const db = getDatabase()
  const post = db.prepare("SELECT id FROM posts WHERE imageUrl = ? AND status = 'approved'").get(imageUrl)
  const comment = db.prepare(`
    SELECT c.id FROM comments c JOIN posts p ON p.id = c.postId
    WHERE c.imageUrl = ? AND p.status = 'approved'
  `).get(imageUrl)
  if (!post && !comment) throw createError({ statusCode: 404, statusMessage: 'Image not found.' })

  const filePath = join(getUploadDirectory('images'), filename)
  try {
    const fileStats = await stat(filePath)
    const extension = filename.split('.').pop()?.toLowerCase() || 'jpg'
    setResponseHeader(event, 'content-type', contentTypes[extension] || 'application/octet-stream')
    setResponseHeader(event, 'content-length', fileStats.size)
    setResponseHeader(event, 'content-disposition', `inline; filename="${filename}"`)
    return sendStream(event, createReadStream(filePath))
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Image file not found.' })
  }
})
