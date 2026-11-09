import { requireAdmin } from '~/server/utils/admin'
import { getDatabase } from '~/server/utils/database'

export default defineEventHandler(event => {
  requireAdmin(event)
  const db = getDatabase()
  const count = (table: 'posts' | 'comments' | 'post_revisions') => Number((db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count)

  return {
    summary: {
      posts: count('posts'),
      approvedPosts: Number((db.prepare("SELECT COUNT(*) AS count FROM posts WHERE status = 'approved'").get() as { count: number }).count),
      pendingPosts: Number((db.prepare("SELECT COUNT(*) AS count FROM posts WHERE status = 'pending'").get() as { count: number }).count),
      comments: count('comments'),
      revisions: count('post_revisions')
    },
    posts: db.prepare(`SELECT id, nickname, title, category, content, imageUrl, modelUrl, modelFileName, modelFileSize, status, createdAt, reviewedAt, rejectionReason FROM posts ORDER BY id DESC LIMIT 100`).all(),
    comments: db.prepare(`SELECT c.id, c.postId, c.nickname, c.content, c.createdAt, p.title AS postTitle FROM comments c JOIN posts p ON p.id = c.postId ORDER BY c.id DESC LIMIT 100`).all(),
    revisions: db.prepare(`SELECT id, postId, nickname, title, category, status, createdAt, reviewedAt, rejectionReason FROM post_revisions ORDER BY id DESC LIMIT 100`).all()
  }
})
