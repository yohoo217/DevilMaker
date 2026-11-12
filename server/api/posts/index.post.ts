import { getDatabase } from '~/server/utils/database'
import { cleanCategory, cleanText, optionalEmail, optionalModelPath, optionalUrl } from '~/server/utils/validation'
import { createEditToken } from '~/server/utils/edit'

export default defineEventHandler(async event => {
  const body = await readBody(event)
  const nickname = cleanText(body?.nickname, 'Nickname', 40)
  const title = cleanText(body?.title, 'Title', 120)
  const category = cleanCategory(body?.category)
  const content = cleanText(body?.content, 'Description', 5000)
  const imageUrl = optionalUrl(body?.imageUrl)
  const modelUrl = optionalModelPath(body?.modelUrl)
  const modelFileName = modelUrl ? cleanText(body?.modelFileName, 'STL file name', 180) : ''
  const modelFileSize = modelUrl ? Number(body?.modelFileSize) : 0
  const contactEmail = optionalEmail(body?.contactEmail)
  if (modelUrl && (!Number.isInteger(modelFileSize) || modelFileSize < 1 || modelFileSize > 25 * 1024 * 1024)) {
    throw createError({ statusCode: 400, statusMessage: 'STL file size is invalid.' })
  }
  const editToken = createEditToken()
  const result = getDatabase().prepare(
    'INSERT INTO posts (nickname, title, category, content, imageUrl, modelUrl, modelFileName, modelFileSize, contactEmail, status, editTokenHash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, \'pending\', ?)'
  ).run(nickname, title, category, content, imageUrl, modelUrl, modelFileName, modelFileSize, contactEmail, editToken.hash)
  setResponseStatus(event, 201)
  return { id: Number(result.lastInsertRowid), editToken: editToken.token }
})
