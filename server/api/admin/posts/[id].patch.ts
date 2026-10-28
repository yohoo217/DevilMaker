import { requireAdmin } from '~/server/utils/admin'
import { getDatabase } from '~/server/utils/database'
import { cleanText } from '~/server/utils/validation'

export default defineEventHandler(async event => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id < 1) throw createError({ statusCode: 400, statusMessage: 'Invalid post id.' })
  const body = await readBody(event)
  const action = body?.action
  const db = getDatabase()
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(id)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Post not found.' })

  if (action === 'approve') {
    db.prepare("UPDATE posts SET status = 'approved', reviewedAt = CURRENT_TIMESTAMP, rejectionReason = '' WHERE id = ?").run(id)
  } else if (action === 'reject') {
    const reason = body?.reason ? cleanText(body.reason, 'Rejection reason', 500) : ''
    db.prepare("UPDATE posts SET status = 'rejected', reviewedAt = CURRENT_TIMESTAMP, rejectionReason = ? WHERE id = ?").run(reason, id)
  } else if (action === 'pin') {
    db.prepare('UPDATE posts SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id)
  } else {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported moderation action.' })
  }
  return { ok: true }
})
