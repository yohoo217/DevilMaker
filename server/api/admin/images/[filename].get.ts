import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { requireAdmin } from '~/server/utils/admin'
import { getUploadDirectory } from '~/server/utils/uploads'

const contentTypes: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export default defineEventHandler(async event => {
  requireAdmin(event)
  const filename = getRouterParam(event, 'filename') || ''
  if (!/^[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) throw createError({ statusCode: 400, statusMessage: 'Invalid image file.' })
  const filePath = join(getUploadDirectory('images'), filename)
  try {
    const fileStats = await stat(filePath)
    const extension = filename.split('.').pop()?.toLowerCase() || 'jpg'
    setResponseHeader(event, 'content-type', contentTypes[extension])
    setResponseHeader(event, 'content-length', fileStats.size)
    setResponseHeader(event, 'content-disposition', `inline; filename="${filename}"`)
    return sendStream(event, createReadStream(filePath))
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Image file not found.' })
  }
})
