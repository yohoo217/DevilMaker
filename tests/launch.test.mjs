import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const projectRoot = join(import.meta.dirname, '..')
const port = 3200 + (process.pid % 500)
const baseUrl = `http://127.0.0.1:${port}`

const waitForServer = async () => {
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/posts`)
      if (response.ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error('Nuxt test server did not start in time.')
}

const startServer = async databasePath => {
  const server = spawn(process.execPath, ['node_modules/nuxt/bin/nuxt.mjs', 'dev', '--port', String(port)], {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_PATH: databasePath, ADMIN_KEY: 'launch-test-admin', NUXT_IGNORE_LOCK: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let output = ''
  server.stdout.on('data', chunk => { output += chunk.toString() })
  server.stderr.on('data', chunk => { output += chunk.toString() })
  try {
    await waitForServer()
    return server
  } catch (error) {
    server.kill('SIGTERM')
    throw new Error(`${error.message}\n${output}`)
  }
}

const stopServer = async server => {
  if (!server || server.exitCode !== null) return
  server.kill('SIGTERM')
  await new Promise(resolve => {
    const timer = setTimeout(() => {
      server.kill('SIGKILL')
      resolve()
    }, 5_000)
    server.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

const json = async (path, options = {}) => {
  const { headers: optionHeaders, ...requestOptions } = options
  const response = await fetch(`${baseUrl}${path}`, {
    ...requestOptions,
    headers: { 'content-type': 'application/json', ...(optionHeaders || {}) }
  })
  const body = await response.json().catch(() => null)
  return { response, body }
}

test('launch workflow covers roles, moderation, uploads, and restart persistence', { timeout: 120_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'devil-maker-launch-'))
  const databasePath = join(directory, 'forum.sqlite')
  let server

  try {
    server = await startServer(databasePath)

    const unauthorizedAdmin = await fetch(`${baseUrl}/api/admin/posts`)
    assert.equal(unauthorizedAdmin.status, 401)

    const invalidImageForm = new FormData()
    invalidImageForm.set('file', new File(['not an image'], 'launch-test.txt', { type: 'text/plain' }))
    assert.equal((await fetch(`${baseUrl}/api/uploads/image`, { method: 'POST', body: invalidImageForm })).status, 400)

    const invalidModelForm = new FormData()
    invalidModelForm.set('file', new File(['not an stl'], 'launch-test.txt', { type: 'text/plain' }))
    assert.equal((await fetch(`${baseUrl}/api/uploads/stl`, { method: 'POST', body: invalidModelForm })).status, 400)

    const invalidPost = await json('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'Launch Tester', title: 'Invalid upload path', category: 'Idea', content: 'This should fail.', imageUrl: 'javascript:alert(1)' })
    })
    assert.equal(invalidPost.response.status, 400)

    const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    const imageForm = new FormData()
    imageForm.set('file', new File([imageBytes], 'launch-test.png', { type: 'image/png' }))
    const imageUpload = await fetch(`${baseUrl}/api/uploads/image`, { method: 'POST', body: imageForm })
    assert.equal(imageUpload.status, 200)
    const image = await imageUpload.json()

    const modelForm = new FormData()
    modelForm.set('file', new File(['solid test\nendsolid test'], 'launch-test.stl', { type: 'model/stl' }))
    const modelUpload = await fetch(`${baseUrl}/api/uploads/stl`, { method: 'POST', body: modelForm })
    assert.equal(modelUpload.status, 200)
    const model = await modelUpload.json()

    const created = await json('/api/posts', {
      method: 'POST',
      body: JSON.stringify({
        nickname: 'Launch Tester',
        title: '[TEST] Launch workflow post',
        category: 'Project',
        content: 'A temporary launch workflow post.',
        imageUrl: image.url,
        modelUrl: model.url,
        modelFileName: model.fileName,
        modelFileSize: model.fileSize
      })
    })
    assert.equal(created.response.status, 201)
    const postId = created.body.id
    const editToken = created.body.editToken

    const boardBeforeApproval = await json('/api/posts')
    assert.equal(boardBeforeApproval.response.status, 200)
    assert.equal(boardBeforeApproval.body.some(post => post.id === postId), false)
    assert.equal((await fetch(`${baseUrl}${image.url}`)).status, 404)
    assert.equal((await fetch(`${baseUrl}${model.url}`)).status, 404)

    const pendingAdmin = await json('/api/admin/posts', { headers: { 'x-admin-key': 'launch-test-admin' } })
    assert.equal(pendingAdmin.response.status, 200)
    assert.equal(pendingAdmin.body.some(post => post.id === postId && post.status === 'pending'), true)

    const approved = await json(`/api/admin/posts/${postId}`, {
      method: 'PATCH',
      headers: { 'x-admin-key': 'launch-test-admin' },
      body: JSON.stringify({ action: 'approve' })
    })
    assert.equal(approved.response.status, 200, JSON.stringify(approved.body))
    assert.equal((await fetch(`${baseUrl}${image.url}`)).status, 200)
    assert.equal((await fetch(`${baseUrl}${model.url}`)).status, 200)

    const publicPost = await json(`/api/posts/${postId}`)
    assert.equal(publicPost.response.status, 200)
    assert.equal(publicPost.body.title, '[TEST] Launch workflow post')

    const edited = await json(`/api/posts/${postId}/edit`, {
      method: 'POST',
      body: JSON.stringify({
        token: editToken,
        nickname: 'Launch Tester',
        title: '[TEST] Launch workflow post updated',
        category: 'Project',
        content: 'The approved edit is now public.',
        imageUrl: image.url,
        modelUrl: model.url,
        modelFileName: model.fileName,
        modelFileSize: model.fileSize
      })
    })
    assert.equal(edited.response.status, 200)
    assert.equal(edited.body.status, 'revision_pending')

    const publicBeforeEditApproval = await json(`/api/posts/${postId}`)
    assert.equal(publicBeforeEditApproval.body.title, '[TEST] Launch workflow post')

    const revisions = await json('/api/admin/revisions', { headers: { 'x-admin-key': 'launch-test-admin' } })
    assert.equal(revisions.response.status, 200)
    const revision = revisions.body.find(item => item.postId === postId)
    assert.ok(revision)

    const approvedEdit = await json(`/api/admin/revisions/${revision.id}`, {
      method: 'PATCH',
      headers: { 'x-admin-key': 'launch-test-admin' },
      body: JSON.stringify({ action: 'approve' })
    })
    assert.equal(approvedEdit.response.status, 200)

    const publicAfterEditApproval = await json(`/api/posts/${postId}`)
    assert.equal(publicAfterEditApproval.body.title, '[TEST] Launch workflow post updated')

    const comment = await json(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ nickname: 'Reply Tester', content: 'Launch workflow reply.' })
    })
    assert.equal(comment.response.status, 201)
    const postWithComment = await json(`/api/posts/${postId}`)
    assert.equal(postWithComment.body.comments.length, 1)

    const rejectedCreated = await json('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'Launch Tester', title: '[TEST] Launch rejection post', category: 'Idea', content: 'Temporary rejection workflow post.' })
    })
    const rejectedId = rejectedCreated.body.id
    const rejectedToken = rejectedCreated.body.editToken
    const rejected = await json(`/api/admin/posts/${rejectedId}`, {
      method: 'PATCH',
      headers: { 'x-admin-key': 'launch-test-admin' },
      body: JSON.stringify({ action: 'reject', reason: 'Please add more detail.' })
    })
    assert.equal(rejected.response.status, 200)

    const rejectedEditPage = await json(`/api/posts/${rejectedId}/edit?token=${rejectedToken}`)
    assert.equal(rejectedEditPage.response.status, 200)
    assert.equal(rejectedEditPage.body.status, 'rejected')
    assert.equal(rejectedEditPage.body.rejectionReason, 'Please add more detail.')

    const resubmitted = await json(`/api/posts/${rejectedId}/edit`, {
      method: 'POST',
      body: JSON.stringify({ token: rejectedToken, nickname: 'Launch Tester', title: '[TEST] Launch rejection post fixed', category: 'Idea', content: 'Updated rejection workflow post.' })
    })
    assert.equal(resubmitted.response.status, 200)
    assert.equal(resubmitted.body.status, 'pending')

    await stopServer(server)
    server = await startServer(databasePath)
    const afterRestart = await json(`/api/posts/${postId}`)
    assert.equal(afterRestart.response.status, 200)
    assert.equal(afterRestart.body.title, '[TEST] Launch workflow post updated')
  } finally {
    await stopServer(server)
    await rm(directory, { recursive: true, force: true })
  }
})
