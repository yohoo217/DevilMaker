export function requireAdmin(event: H3Event) {
  const config = useRuntimeConfig()
  const suppliedKey = getHeader(event, 'x-admin-key')
  if (!suppliedKey || suppliedKey !== config.adminKey) {
    throw createError({ statusCode: 401, statusMessage: 'Admin access is required.' })
  }
}
