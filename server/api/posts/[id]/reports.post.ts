import { getDatabase } from '~/server/utils/database'
import { sendReportEmail } from '~/server/utils/email'

const reportReasons = new Set(['Spam', 'Harassment', 'Inappropriate content', 'Copyright', 'Other'])

export default defineEventHandler(async event => {
  const postId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(postId) || postId < 1) throw createError({ statusCode: 400, statusMessage: 'Invalid post id.' })

  const body = await readBody(event)
  const targetType = body?.targetType
  if (targetType !== 'post' && targetType !== 'comment') {
    throw createError({ statusCode: 400, statusMessage: 'Please choose a post or reply to report.' })
  }
  if (typeof body?.reason !== 'string' || !reportReasons.has(body.reason)) {
    throw createError({ statusCode: 400, statusMessage: 'Please choose a valid report reason.' })
  }
  if (body?.details !== undefined && typeof body.details !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Report details are invalid.' })
  }
  const details = typeof body?.details === 'string' ? body.details.trim() : ''
  if (details.length > 1000) throw createError({ statusCode: 400, statusMessage: 'Report details are too long.' })

  const db = getDatabase()
  const post = db.prepare("SELECT id, title, nickname, content FROM posts WHERE id = ? AND status = 'approved'")
    .get(postId) as { id: number; title: string; nickname: string; content: string } | undefined
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Post not found.' })

  let comment: { id: number; nickname: string; content: string } | undefined
  if (targetType === 'comment') {
    const commentId = body?.commentId
    if (!Number.isInteger(commentId) || commentId < 1) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid reply id.' })
    }
    comment = db.prepare('SELECT id, nickname, content FROM comments WHERE id = ? AND postId = ?')
      .get(commentId, postId) as typeof comment
    if (!comment) throw createError({ statusCode: 404, statusMessage: 'Reply not found.' })
  } else if (body?.commentId !== undefined && body.commentId !== null) {
    throw createError({ statusCode: 400, statusMessage: 'A post report cannot include a reply id.' })
  }

  const result = db.prepare(`
    INSERT INTO reports (targetType, postId, commentId, reason, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(targetType, postId, comment?.id ?? null, body.reason, details)
  const reportId = Number(result.lastInsertRowid)
  const report = {
    id: reportId,
    targetType,
    postId,
    commentId: comment?.id ?? null,
    postTitle: post.title,
    postNickname: post.nickname,
    contentAuthor: comment?.nickname ?? post.nickname,
    targetContent: comment?.content ?? post.content,
    reason: body.reason,
    details,
    createdAt: new Date().toISOString()
  }

  let emailSent = false
  try {
    emailSent = await sendReportEmail(report)
    if (emailSent) db.prepare('UPDATE reports SET emailSent = 1 WHERE id = ?').run(reportId)
  } catch (error) {
    console.error(`Report #${reportId} was saved, but its email notification failed.`, error)
  }

  setResponseStatus(event, 201)
  return { id: reportId, emailSent }
})
