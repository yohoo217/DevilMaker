import { getDatabase } from '~/server/utils/database'

export default defineEventHandler(event => {
  const db = getDatabase()
  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const category = typeof query.category === 'string' ? query.category.trim() : ''
  const sort = query.sort === 'replies' ? 'replies' : 'latest'
  const searchPattern = `%${search}%`
  const orderBy = sort === 'replies'
    ? 'commentCount DESC, datetime(p.createdAt) DESC, p.id DESC'
    : 'datetime(p.createdAt) DESC, p.id DESC'

  return db.prepare(`
    SELECT p.id, p.nickname, p.title, p.category, p.content,
      CASE WHEN p.imageUrl = '' THEN '/default-idea.svg' ELSE p.imageUrl END AS imageUrl,
      p.modelUrl, p.modelFileName, p.pinned, p.createdAt,
      COUNT(c.id) AS commentCount
    FROM posts p
    LEFT JOIN comments c ON c.postId = p.id
    WHERE p.status = 'approved'
      AND (? = '' OR p.title LIKE ? OR p.content LIKE ? OR p.nickname LIKE ?)
      AND (? = '' OR p.category = ?)
    GROUP BY p.id
    ORDER BY p.pinned DESC, ${orderBy}
  `).all(search, searchPattern, searchPattern, searchPattern, category, category)
})
