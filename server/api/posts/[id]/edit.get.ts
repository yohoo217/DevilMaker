import { hashEditToken } from '~/server/utils/edit'
import { getDatabase } from '~/server/utils/database'

export default defineEventHandler(event => {
  const id = Number(getRouterParam(event, 'id'))
  const token = String(getQuery(event).token || '')
  if (!Number.isInteger(id) || id < 1 || !token) throw createError({ statusCode: 400, statusMessage: 'A valid edit link is required.' })
  const post = getDatabase().prepare(`
    SELECT id, nickname, title, category, content, imageUrl, modelUrl, modelFileName, modelFileSize, status
    FROM posts WHERE id = ? AND editTokenHash = ? AND status IN ('pending', 'approved')
  `).get(id, hashEditToken(token))
  if (!post) throw createError({ statusCode: 404, statusMessage: 'This edit link is invalid or expired.' })
  return post
})
