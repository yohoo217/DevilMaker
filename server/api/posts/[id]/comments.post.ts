import { getDatabase } from '~/server/utils/database'
import { cleanText } from '~/server/utils/validation'

export default defineEventHandler(async event => {
  const postId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(postId) || postId < 1) throw createError({ statusCode: 400, statusMessage: 'Invalid post id.' })
  const db = getDatabase()
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Post not found.' })
  const body = await readBody(event)
  const nickname = cleanText(body?.nickname, 'Nickname', 40)
  const content = cleanText(body?.content, 'Reply', 2000)
  const result = db.prepare('INSERT INTO comments (postId, nickname, content) VALUES (?, ?, ?)').run(postId, nickname, content)
  setResponseStatus(event, 201)
  return { id: Number(result.lastInsertRowid) }
})
