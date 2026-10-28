import { requireAdmin } from '~/server/utils/admin'
import { getDatabase } from '~/server/utils/database'
import { cleanText } from '~/server/utils/validation'

export default defineEventHandler(async event => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  if (!Number.isInteger(id) || id < 1) throw createError({ statusCode: 400, statusMessage: 'Invalid revision id.' })
  const db = getDatabase()
  const revision = db.prepare("SELECT * FROM post_revisions WHERE id = ? AND status = 'pending'").get(id) as Record<string, any> | undefined
  if (!revision) throw createError({ statusCode: 404, statusMessage: 'Revision not found.' })

  if (body?.action === 'approve') {
    db.exec('BEGIN')
    try {
      db.prepare('UPDATE posts SET nickname = ?, title = ?, category = ?, content = ?, imageUrl = ?, modelUrl = ?, modelFileName = ?, modelFileSize = ? WHERE id = ?').run(revision.nickname, revision.title, revision.category, revision.content, revision.imageUrl, revision.modelUrl, revision.modelFileName, revision.modelFileSize, revision.postId)
      db.prepare("UPDATE post_revisions SET status = 'approved', reviewedAt = CURRENT_TIMESTAMP WHERE id = ?").run(id)
      db.prepare("UPDATE post_revisions SET status = 'rejected', reviewedAt = CURRENT_TIMESTAMP, rejectionReason = 'Superseded by an approved revision.' WHERE postId = ? AND id != ? AND status = 'pending'").run(revision.postId, id)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  } else if (body?.action === 'reject') {
    const reason = body?.reason ? cleanText(body.reason, 'Rejection reason', 500) : ''
    db.prepare("UPDATE post_revisions SET status = 'rejected', reviewedAt = CURRENT_TIMESTAMP, rejectionReason = ? WHERE id = ?").run(reason, id)
  } else {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported revision action.' })
  }
  return { ok: true }
})
