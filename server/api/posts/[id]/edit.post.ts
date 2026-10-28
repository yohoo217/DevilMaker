import { hashEditToken } from '~/server/utils/edit'
import { getDatabase } from '~/server/utils/database'
import { cleanText, optionalModelPath, optionalUrl } from '~/server/utils/validation'

export default defineEventHandler(async event => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const token = cleanText(body?.token, 'Edit token', 200)
  const nickname = cleanText(body?.nickname, 'Nickname', 40)
  const title = cleanText(body?.title, 'Title', 120)
  const category = cleanText(body?.category, 'Category', 30)
  const content = cleanText(body?.content, 'Description', 5000)
  const imageUrl = optionalUrl(body?.imageUrl)
  const modelUrl = optionalModelPath(body?.modelUrl)
  const modelFileName = modelUrl ? cleanText(body?.modelFileName, 'STL file name', 180) : ''
  const modelFileSize = modelUrl ? Number(body?.modelFileSize) : 0
  if (!Number.isInteger(id) || id < 1) throw createError({ statusCode: 400, statusMessage: 'Invalid post id.' })
  if (modelUrl && (!Number.isInteger(modelFileSize) || modelFileSize < 1 || modelFileSize > 25 * 1024 * 1024)) {
    throw createError({ statusCode: 400, statusMessage: 'STL file size is invalid.' })
  }
  const db = getDatabase()
  const post = db.prepare('SELECT id, status FROM posts WHERE id = ? AND editTokenHash = ? AND status IN (\'pending\', \'approved\', \'rejected\')').get(id, hashEditToken(token)) as { id: number; status: string } | undefined
  if (!post) throw createError({ statusCode: 404, statusMessage: 'This edit link is invalid or expired.' })

  if (post.status === 'pending' || post.status === 'rejected') {
    db.prepare("UPDATE posts SET nickname = ?, title = ?, category = ?, content = ?, imageUrl = ?, modelUrl = ?, modelFileName = ?, modelFileSize = ?, status = 'pending', reviewedAt = NULL, rejectionReason = '' WHERE id = ?").run(nickname, title, category, content, imageUrl, modelUrl, modelFileName, modelFileSize, id)
  } else {
    db.prepare('INSERT INTO post_revisions (postId, nickname, title, category, content, imageUrl, modelUrl, modelFileName, modelFileSize) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, nickname, title, category, content, imageUrl, modelUrl, modelFileName, modelFileSize)
  }
  return { ok: true, status: post.status === 'approved' ? 'revision_pending' : 'pending' }
})
