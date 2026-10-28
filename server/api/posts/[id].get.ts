import { getDatabase } from '~/server/utils/database'

export default defineEventHandler(event => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id < 1) throw createError({ statusCode: 400, statusMessage: 'Invalid post id.' })
  const db = getDatabase()
  const post = db.prepare("SELECT id, nickname, title, category, content, CASE WHEN imageUrl = '' THEN '/default-idea.svg' ELSE imageUrl END AS imageUrl, modelUrl, modelFileName, modelFileSize, createdAt FROM posts WHERE id = ? AND status = 'approved'").get(id)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Post not found.' })
  const comments = db.prepare('SELECT id, nickname, content, createdAt FROM comments WHERE postId = ? ORDER BY datetime(createdAt) ASC, id ASC').all(id)
  return { ...post, comments }
})
