import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

let database: DatabaseSync | null = null

const seedPosts = [
  {
    nickname: 'Maya',
    title: 'How can I improve this desk accessory?',
    category: 'Idea',
    content: 'I want to create a small 3D printed desk accessory that keeps one charging cable in place. What would make this useful for your workspace?',
    imageUrl: ''
  },
  {
    nickname: 'Jordan',
    title: 'Looking for a simple design to print',
    category: 'Help',
    content: 'I am learning basic CAD and would like to start with a practical project. What is a good first object to design and test?',
    imageUrl: ''
  },
  {
    nickname: 'Maya',
    title: 'Knot: 2017 Corolla control parts',
    category: 'Project',
    content: 'Knot is a measurement driven 3D printing project for a 2017 Toyota Corolla right TUNE / SCROLL control knob and a protective shell for the existing four button key fob. The first goal is a safe fit test, not a factory replacement. The workflow is simple: measure with calipers, print a small fit test, check the fit without force or slip, then revise the model. The knob and shell are non safety critical parts only. Never use this project for steering, braking, airbags, ignition, security components, or any other safety critical control.',
    imageUrl: '/knot-control-knob.svg'
  }
]

export function getDatabase(path = useRuntimeConfig().databasePath) {
  if (database) return database
  const absolutePath = resolve(process.cwd(), path)
  mkdirSync(dirname(absolutePath), { recursive: true })
  database = new DatabaseSync(absolutePath)
  database.exec('PRAGMA foreign_keys = ON')
  database.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      imageUrl TEXT NOT NULL DEFAULT '',
      modelUrl TEXT NOT NULL DEFAULT '',
      modelFileName TEXT NOT NULL DEFAULT '',
      modelFileSize INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      pinned INTEGER NOT NULL DEFAULT 0,
      reviewedAt TEXT,
      rejectionReason TEXT NOT NULL DEFAULT '',
      editTokenHash TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postId INTEGER NOT NULL,
      nickname TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS post_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postId INTEGER NOT NULL,
      nickname TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      content TEXT NOT NULL,
      imageUrl TEXT NOT NULL DEFAULT '',
      modelUrl TEXT NOT NULL DEFAULT '',
      modelFileName TEXT NOT NULL DEFAULT '',
      modelFileSize INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      rejectionReason TEXT NOT NULL DEFAULT '',
      reviewedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
    );
  `)

  const columns = database.prepare('PRAGMA table_info(posts)').all() as Array<{ name: string }>
  const columnNames = new Set(columns.map(column => column.name))
  const migrations = [
    ['modelUrl', "ALTER TABLE posts ADD COLUMN modelUrl TEXT NOT NULL DEFAULT ''"],
    ['modelFileName', "ALTER TABLE posts ADD COLUMN modelFileName TEXT NOT NULL DEFAULT ''"],
    ['modelFileSize', "ALTER TABLE posts ADD COLUMN modelFileSize INTEGER NOT NULL DEFAULT 0"],
    ['status', "ALTER TABLE posts ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'"],
    ['pinned', "ALTER TABLE posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0"],
    ['reviewedAt', 'ALTER TABLE posts ADD COLUMN reviewedAt TEXT'],
    ['rejectionReason', "ALTER TABLE posts ADD COLUMN rejectionReason TEXT NOT NULL DEFAULT ''"],
    ['editTokenHash', "ALTER TABLE posts ADD COLUMN editTokenHash TEXT NOT NULL DEFAULT ''"]
  ] as const
  migrations.forEach(([name, statement]) => {
    if (!columnNames.has(name)) database.exec(statement)
  })
  database.exec("UPDATE posts SET status = 'approved' WHERE status = '' OR status IS NULL")

  const insertIfMissing = database.prepare(`
    INSERT INTO posts (nickname, title, category, content, imageUrl, status)
    SELECT ?, ?, ?, ?, ?, 'approved'
    WHERE NOT EXISTS (SELECT 1 FROM posts WHERE title = ?)
  `)
  database.exec('BEGIN')
  try {
    seedPosts.forEach(post => insertIfMissing.run(post.nickname, post.title, post.category, post.content, post.imageUrl, post.title))
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  return database
}

export function closeDatabase() {
  database?.close()
  database = null
}
