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
    imageUrl: '',
    modelUrl: '',
    modelFileName: '',
    modelFileSize: 0
  },
  {
    nickname: 'Jordan',
    title: 'Looking for a simple design to print',
    category: 'Help',
    content: 'I am learning basic CAD and would like to start with a practical project. What is a good first object to design and test?',
    imageUrl: '',
    modelUrl: '',
    modelFileName: '',
    modelFileSize: 0
  },
  {
    nickname: 'Maya',
    title: 'Knot: 2017 Corolla control parts',
    category: 'Project',
    content: 'Knot is a measurement-driven 3D-printing project for a 2017 Toyota Corolla right TUNE / SCROLL control knob and a protective shell for the existing four-button key fob. This is a non-safety-critical, personal fit-test project — not a factory replacement.\n\nSTART HERE\n1. Download the included 20 mm calibration cube STL and print it with your normal material and profile.\n2. Measure the printed cube on each axis with calipers. Record any X/Y/Z error before modeling a part that needs to fit.\n3. Measure the original knob or fob shell: outside diameter, height, shaft opening, keying flats, and clearance to nearby trim. Photograph the part beside a ruler so later revisions are traceable.\n4. Make a small, thin fit-test ring or shell section first. Test without force; it should seat securely but release without cracking the original part.\n\nPRINT BASELINE\n• PLA or PETG, 0.20 mm layer height, 3 perimeters, 20–30% infill.\n• Print one orientation at a time and write the orientation on the test piece.\n• For a first snap/press fit, start conservatively with about 0.20–0.30 mm total clearance, then adjust from the measured result. Your printer and material determine the final value.\n\nWHAT TO SHARE IN A REVISION\nInclude the caliper measurements, printer/material, layer height, fit result (loose / good / tight), and the exact dimension you changed. That makes the next version reproducible.\n\nSAFETY NOTE\nDo not use this project for steering, braking, airbags, ignition, security components, or any other safety-critical vehicle control. The included STL is only a 20 mm print-calibration cube; it is not a vehicle component.',
    imageUrl: '/knot-control-knob.svg',
    modelUrl: '/models/knot-fit-test-cube-20mm.stl',
    modelFileName: 'knot-fit-test-cube-20mm.stl',
    modelFileSize: 1778
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
      versionNote TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      rejectionReason TEXT NOT NULL DEFAULT '',
      reviewedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS project_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postId INTEGER NOT NULL,
      versionNumber INTEGER NOT NULL,
      label TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      imageUrl TEXT NOT NULL DEFAULT '',
      modelUrl TEXT NOT NULL DEFAULT '',
      modelFileName TEXT NOT NULL DEFAULT '',
      modelFileSize INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
      UNIQUE(postId, versionNumber)
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
  const revisionColumns = new Set((database.prepare('PRAGMA table_info(post_revisions)').all() as Array<{ name: string }>).map(column => column.name))
  if (!revisionColumns.has('versionNote')) database.exec("ALTER TABLE post_revisions ADD COLUMN versionNote TEXT NOT NULL DEFAULT ''")
  database.exec("UPDATE posts SET status = 'approved' WHERE status = '' OR status IS NULL")

  const insertIfMissing = database.prepare(`
    INSERT INTO posts (nickname, title, category, content, imageUrl, modelUrl, modelFileName, modelFileSize, status)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'approved'
    WHERE NOT EXISTS (SELECT 1 FROM posts WHERE title = ?)
  `)
  const refreshKnotSample = database.prepare(`
    UPDATE posts
    SET content = ?, imageUrl = ?, modelUrl = ?, modelFileName = ?, modelFileSize = ?
    WHERE title = ? AND nickname = ? AND modelUrl = ''
  `)
  database.exec('BEGIN')
  try {
    seedPosts.forEach(post => insertIfMissing.run(post.nickname, post.title, post.category, post.content, post.imageUrl, post.modelUrl || '', post.modelFileName || '', post.modelFileSize || 0, post.title))
    const knot = seedPosts.find(post => post.title === 'Knot: 2017 Corolla control parts')!
    refreshKnotSample.run(knot.content, knot.imageUrl, knot.modelUrl, knot.modelFileName, knot.modelFileSize, knot.title, knot.nickname)
    database.prepare(`
      INSERT INTO project_versions (postId, versionNumber, label, note, imageUrl, modelUrl, modelFileName, modelFileSize)
      SELECT id, 1, 'V1 · Initial release', 'First approved version of this project.', imageUrl, modelUrl, modelFileName, modelFileSize
      FROM posts
      WHERE title != 'Knot: 2017 Corolla control parts'
        AND NOT EXISTS (SELECT 1 FROM project_versions WHERE project_versions.postId = posts.id)
    `).run()
    database.prepare(`
      INSERT INTO project_versions (postId, versionNumber, label, note, imageUrl, modelUrl, modelFileName, modelFileSize, createdAt)
      SELECT id, 1, 'V1 · Shape study', 'Started with a low-profile wedge to validate the overall footprint before measuring the original part.', imageUrl, '/models/knot-v1-wedge.stl', 'knot-v1-wedge.stl', 984, datetime('now', '-21 days')
      FROM posts
      WHERE title = 'Knot: 2017 Corolla control parts'
        AND NOT EXISTS (SELECT 1 FROM project_versions WHERE project_versions.postId = posts.id)
    `).run()
    database.prepare(`
      INSERT INTO project_versions (postId, versionNumber, label, note, imageUrl, modelUrl, modelFileName, modelFileSize, createdAt)
      SELECT id, 2, 'V2 · Calibration check', 'Moved to a 20 mm calibration cube to measure printer error and set the fitting tolerance.', imageUrl, '/models/knot-fit-test-cube-20mm.stl', 'knot-fit-test-cube-20mm.stl', 1778, datetime('now', '-14 days')
      FROM posts
      WHERE title = 'Knot: 2017 Corolla control parts'
        AND NOT EXISTS (SELECT 1 FROM project_versions WHERE project_versions.postId = posts.id AND versionNumber = 2)
    `).run()
    database.prepare(`
      INSERT INTO project_versions (postId, versionNumber, label, note, imageUrl, modelUrl, modelFileName, modelFileSize, createdAt)
      SELECT id, 3, 'V3 · Current fit-test', 'Current printable reference model. Next: measure the actual knob and publish a thin fit-test ring.', imageUrl, modelUrl, modelFileName, modelFileSize, datetime('now', '-2 days')
      FROM posts
      WHERE title = 'Knot: 2017 Corolla control parts'
        AND NOT EXISTS (SELECT 1 FROM project_versions WHERE project_versions.postId = posts.id AND versionNumber = 3)
    `).run()
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  return database
}

export function recordProjectVersion(db: DatabaseSync, post: Record<string, any>, note = '') {
  const versionNumber = Number((db.prepare('SELECT COALESCE(MAX(versionNumber), 0) AS versionNumber FROM project_versions WHERE postId = ?').get(post.id) as { versionNumber: number }).versionNumber) + 1
  const label = `V${versionNumber} · ${versionNumber === 1 ? 'Initial release' : 'Project update'}`
  db.prepare('INSERT INTO project_versions (postId, versionNumber, label, note, imageUrl, modelUrl, modelFileName, modelFileSize) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(post.id, versionNumber, label, note || (versionNumber === 1 ? 'First approved version of this project.' : 'Approved project update.'), post.imageUrl || '', post.modelUrl || '', post.modelFileName || '', post.modelFileSize || 0)
}

export function closeDatabase() {
  database?.close()
  database = null
}
