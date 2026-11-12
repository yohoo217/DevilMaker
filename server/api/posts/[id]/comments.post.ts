import { getDatabase } from '~/server/utils/database'
import { cleanText, optionalModelPath, optionalUrl } from '~/server/utils/validation'
import { sendCommentNotification } from '~/server/utils/email'

export default defineEventHandler(async event => {
  const postId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(postId) || postId < 1) throw createError({ statusCode: 400, statusMessage: 'Invalid post id.' })
  const db = getDatabase()
  const post = db.prepare("SELECT id, title, nickname, contactEmail FROM posts WHERE id = ? AND status = 'approved'").get(postId) as { id: number; title: string; nickname: string; contactEmail: string } | undefined
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Post not found.' })
  const body = await readBody(event)
  const nickname = cleanText(body?.nickname, 'Nickname', 40)
  const content = cleanText(body?.content, 'Reply', 2000)
  const imageUrl = optionalUrl(body?.imageUrl)
  const modelUrl = optionalModelPath(body?.modelUrl)
  const modelFileName = modelUrl ? cleanText(body?.modelFileName, 'STL file name', 180) : ''
  const modelFileSize = modelUrl ? Number(body?.modelFileSize) : 0
  if (modelUrl && (!Number.isInteger(modelFileSize) || modelFileSize < 1 || modelFileSize > 25 * 1024 * 1024)) {
    throw createError({ statusCode: 400, statusMessage: 'STL file size is invalid.' })
  }
  if (imageUrl && modelUrl) throw createError({ statusCode: 400, statusMessage: 'Attach one image or one STL file, not both.' })
  if (imageUrl && !/^\/api\/images\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(imageUrl) && !/^https?:\/\//i.test(imageUrl)) {
    throw createError({ statusCode: 400, statusMessage: 'Reply image URL is invalid.' })
  }
  let projectVersionId: number | null = null
  if (body?.projectVersionId !== undefined && body.projectVersionId !== null && body.projectVersionId !== '') {
    projectVersionId = Number(body.projectVersionId)
    if (!Number.isInteger(projectVersionId) || projectVersionId < 1 ||
      !db.prepare('SELECT id FROM project_versions WHERE id = ? AND postId = ?').get(projectVersionId, postId)) {
      throw createError({ statusCode: 400, statusMessage: 'Choose a version from this post.' })
    }
  }
  const result = db.prepare(`
    INSERT INTO comments (postId, nickname, content, imageUrl, modelUrl, modelFileName, modelFileSize, projectVersionId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(postId, nickname, content, imageUrl, modelUrl, modelFileName, modelFileSize, projectVersionId)
  const commentId = Number(result.lastInsertRowid)
  let authorNotified = false
  if (post.contactEmail) {
    try {
      authorNotified = await sendCommentNotification({
        postId,
        postTitle: post.title,
        recipient: post.contactEmail,
        nickname,
        content
      })
    } catch (error) {
      console.error(`Reply #${commentId} was saved, but its author notification failed.`, error)
    }
  }
  setResponseStatus(event, 201)
  return { id: commentId, authorNotified }
})
