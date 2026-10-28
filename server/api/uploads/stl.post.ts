import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const MAX_MODEL_SIZE = 25 * 1024 * 1024

export default defineEventHandler(async event => {
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file' && part.filename && part.data)
  if (!file?.filename || !file.data) {
    throw createError({ statusCode: 400, statusMessage: 'Please choose an STL file.' })
  }
  if (file.data.length > MAX_MODEL_SIZE) {
    throw createError({ statusCode: 400, statusMessage: 'STL files must be 25 MB or smaller.' })
  }
  if (extname(file.filename).toLowerCase() !== '.stl') {
    throw createError({ statusCode: 400, statusMessage: 'Only .stl files are supported.' })
  }

  const safeName = `${randomUUID()}.stl`
  const directory = join(process.cwd(), 'data', 'uploads', 'stl')
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, safeName), file.data)

  return {
    url: `/api/models/${safeName}`,
    fileName: file.filename.slice(0, 180),
    fileSize: file.data.length
  }
})
