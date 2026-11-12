import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

test('SQLite schema supports posts, comments, reports, and cascade deletion', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'devil-maker-'))
  const db = new DatabaseSync(join(directory, 'test.sqlite'))
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`
    CREATE TABLE posts (id INTEGER PRIMARY KEY, nickname TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, content TEXT NOT NULL, imageUrl TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL);
    CREATE TABLE project_versions (id INTEGER PRIMARY KEY, postId INTEGER NOT NULL, label TEXT NOT NULL, FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE);
    CREATE TABLE comments (id INTEGER PRIMARY KEY, postId INTEGER NOT NULL, nickname TEXT NOT NULL, content TEXT NOT NULL, imageUrl TEXT NOT NULL DEFAULT '', modelUrl TEXT NOT NULL DEFAULT '', modelFileName TEXT NOT NULL DEFAULT '', modelFileSize INTEGER NOT NULL DEFAULT 0, projectVersionId INTEGER, createdAt TEXT NOT NULL, FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE, FOREIGN KEY (projectVersionId) REFERENCES project_versions(id) ON DELETE SET NULL);
    CREATE TABLE reports (id INTEGER PRIMARY KEY, targetType TEXT NOT NULL CHECK (targetType IN ('post', 'comment')), postId INTEGER NOT NULL, commentId INTEGER, reason TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', emailSent INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK ((targetType = 'post' AND commentId IS NULL) OR (targetType = 'comment' AND commentId IS NOT NULL)), FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE, FOREIGN KEY (commentId) REFERENCES comments(id) ON DELETE CASCADE);
  `)
  const post = db.prepare('INSERT INTO posts (nickname, title, category, content, createdAt) VALUES (?, ?, ?, ?, ?)').run('Maya', 'Test idea', 'Idea', 'A test', new Date().toISOString())
  const version = db.prepare('INSERT INTO project_versions (postId, label) VALUES (?, ?)').run(post.lastInsertRowid, 'V1')
  const comment = db.prepare('INSERT INTO comments (postId, nickname, content, projectVersionId, createdAt) VALUES (?, ?, ?, ?, ?)').run(post.lastInsertRowid, 'Jordan', 'Looks good', version.lastInsertRowid, new Date().toISOString())
  assert.equal(db.prepare('SELECT projectVersionId FROM comments WHERE id = ?').get(comment.lastInsertRowid).projectVersionId, version.lastInsertRowid)
  db.prepare('INSERT INTO reports (targetType, postId, reason) VALUES (?, ?, ?)').run('post', post.lastInsertRowid, 'Spam')
  db.prepare('INSERT INTO reports (targetType, postId, commentId, reason) VALUES (?, ?, ?, ?)').run('comment', post.lastInsertRowid, comment.lastInsertRowid, 'Harassment')
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM comments WHERE postId = ?').get(post.lastInsertRowid).count, 1)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM reports WHERE postId = ?').get(post.lastInsertRowid).count, 2)
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.lastInsertRowid)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM comments').get().count, 0)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM reports').get().count, 0)
  db.close()
  await rm(directory, { recursive: true, force: true })
})
