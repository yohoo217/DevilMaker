import { requireAdmin } from '~/server/utils/admin'
import { getDatabase } from '~/server/utils/database'

export default defineEventHandler(event => {
  requireAdmin(event)
  return getDatabase().prepare(`
    SELECT r.id, r.postId, r.nickname, r.title, r.category, r.content, r.imageUrl,
      r.modelUrl, r.modelFileName, r.modelFileSize, r.createdAt,
      p.title AS currentTitle
    FROM post_revisions r
    JOIN posts p ON p.id = r.postId
    WHERE r.status = 'pending'
    ORDER BY datetime(r.createdAt) ASC, r.id ASC
  `).all()
})
