import { requireAdmin } from '~/server/utils/admin'
import { getDatabase } from '~/server/utils/database'

export default defineEventHandler(event => {
  requireAdmin(event)
  return getDatabase().prepare(`
    SELECT p.id, p.nickname, p.title, p.category, p.content, p.imageUrl,
      p.modelUrl, p.modelFileName, p.modelFileSize, p.status, p.pinned, p.createdAt
    FROM posts p
    WHERE p.status = 'pending'
    ORDER BY datetime(p.createdAt) ASC, p.id ASC
  `).all()
})
