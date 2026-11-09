import { resolve } from 'node:path'

export function getUploadDirectory(type: 'images' | 'stl') {
  return resolve(process.cwd(), useRuntimeConfig().uploadPath, type)
}
