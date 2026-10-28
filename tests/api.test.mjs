import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

test('SQLite schema supports posts, comments, and cascade deletion', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'makerhub-forum-'))
  const db = new DatabaseSync(join(directory, 'test.sqlite'))
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(`
    CREATE TABLE posts (id INTEGER PRIMARY KEY, nickname TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, content TEXT NOT NULL, imageUrl TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL);
    CREATE TABLE comments (id INTEGER PRIMARY KEY, postId INTEGER NOT NULL, nickname TEXT NOT NULL, content TEXT NOT NULL, createdAt TEXT NOT NULL, FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE);
  `)
  const post = db.prepare('INSERT INTO posts (nickname, title, category, content, createdAt) VALUES (?, ?, ?, ?, ?)').run('Maya', 'Test idea', 'Idea', 'A test', new Date().toISOString())
  db.prepare('INSERT INTO comments (postId, nickname, content, createdAt) VALUES (?, ?, ?, ?)').run(post.lastInsertRowid, 'Jordan', 'Looks good', new Date().toISOString())
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM comments WHERE postId = ?').get(post.lastInsertRowid).count, 1)
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.lastInsertRowid)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM comments').get().count, 0)
  db.close()
  await rm(directory, { recursive: true, force: true })
})
