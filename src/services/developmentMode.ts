export function isLocalDevelopment(development: boolean, hostname: string): boolean {
  return development && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)
}
