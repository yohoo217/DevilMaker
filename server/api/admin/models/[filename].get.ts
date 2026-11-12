import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { requireAdmin } from '~/server/utils/admin'
import { getUploadDirectory } from '~/server/utils/uploads'

export default defineEventHandler(async event => {
  requireAdmin(event)
  const filename = getRouterParam(event, 'filename') || ''
  if (!/^[a-z0-9-]+\.stl$/i.test(filename)) throw createError({ statusCode: 400, statusMessage: 'Invalid model file.' })
  const filePath = join(getUploadDirectory('stl'), filename)
  try {
    const fileStats = await stat(filePath)
    setResponseHeader(event, 'content-type', 'model/stl')
    setResponseHeader(event, 'content-length', fileStats.size)
    setResponseHeader(event, 'content-disposition', `attachment; filename="${filename}"`)
    return sendStream(event, createReadStream(filePath))
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Model file not found.' })
  }
})
