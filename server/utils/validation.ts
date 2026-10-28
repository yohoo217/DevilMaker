export function cleanText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== 'string' || !value.trim()) {
    throw createError({ statusCode: 400, statusMessage: `${field} is required.` })
  }
  const text = value.trim()
  if (text.length > maxLength) {
    throw createError({ statusCode: 400, statusMessage: `${field} is too long.` })
  }
  return text
}

export function optionalUrl(value: unknown) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string' || value.length > 2000) {
    throw createError({ statusCode: 400, statusMessage: 'Image URL is invalid.' })
  }
  if (/^\/api\/images\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/i.test(value)) return value
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol')
    return url.toString()
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Image URL is invalid.' })
  }
}

export function optionalModelPath(value: unknown) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string' || value.length > 500 || !value.startsWith('/api/models/')) {
    throw createError({ statusCode: 400, statusMessage: 'STL model is invalid.' })
  }
  return value
}
