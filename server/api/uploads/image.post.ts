import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const allowedTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
])

export default defineEventHandler(async event => {
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file' && part.filename && part.data)
  if (!file?.filename || !file.data) {
    throw createError({ statusCode: 400, statusMessage: 'Please choose an image file.' })
  }
  if (file.data.length > MAX_IMAGE_SIZE) {
    throw createError({ statusCode: 400, statusMessage: 'Images must be 10 MB or smaller.' })
  }
  const extension = allowedTypes.get(file.type || '') || extname(file.filename).toLowerCase()
  if (!allowedTypes.has(file.type || '') || !['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) {
    throw createError({ statusCode: 400, statusMessage: 'Only JPG, PNG, and WebP images are supported.' })
  }

  const safeName = `${randomUUID()}${extension === '.jpeg' ? '.jpg' : extension}`
  const directory = join(process.cwd(), 'data', 'uploads', 'images')
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, safeName), file.data)

  return {
    url: `/api/images/${safeName}`,
    fileName: file.filename.slice(0, 180),
    fileSize: file.data.length
  }
})
