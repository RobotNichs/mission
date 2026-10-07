export function assertNoClientSecrets(bundle, env = process.env) {
  if (Object.keys(env).some(name => name.startsWith('VITE_') && /GROQ|API_KEY|SECRET|TOKEN|PASSWORD/i.test(name) && env[name])) throw new Error('Secret-like VITE_ configuration is forbidden.')
  for (const item of Object.values(bundle)) {
    const text = String(item.type === 'chunk' ? item.code : item.source ?? '')
    if (item.fileName.split('/').some(part => part.startsWith('.env')) || (env.GROQ_API_KEY && text.includes(env.GROQ_API_KEY)) || /gsk_[A-Za-z0-9]{20,}/.test(text)) {
      throw new Error('Production output contains a server secret. Build blocked.')
    }
  }
}
export function buildSecurityPlugin() {
  return { name: 'mission-build-security', apply: 'build', generateBundle: { order: 'post', handler(_options, bundle) { assertNoClientSecrets(bundle) } } }
}
