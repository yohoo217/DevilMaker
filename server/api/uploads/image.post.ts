import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { getUploadDirectory } from '~/server/utils/uploads'

const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const allowedTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
])

const isValidImage = (data: Buffer, type: string) => {
  if (type === 'image/jpeg') return data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9
  if (type === 'image/png') return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (type === 'image/webp') return data.length >= 12 && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP'
  return false
}

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
  if (!isValidImage(file.data, file.type || '')) {
    throw createError({ statusCode: 400, statusMessage: 'The uploaded file does not match its image type.' })
  }

  const safeName = `${randomUUID()}${extension === '.jpeg' ? '.jpg' : extension}`
  const directory = getUploadDirectory('images')
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, safeName), file.data)

  return {
    url: `/api/images/${safeName}`,
    fileName: file.filename.slice(0, 180),
    fileSize: file.data.length
  }
})
