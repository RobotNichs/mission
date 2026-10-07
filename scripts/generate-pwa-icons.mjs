// Deterministic, dependency-free rasterization of the Mission m. vector mark.
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
const directory = new URL('../public/icons/', import.meta.url)
mkdirSync(directory, { recursive: true })
const points = [[148, 336], [148, 224]]
function arch(x) {
  for (let i = 1; i <= 32; i++) {
    const t = i / 32
    points.push([x + 74 * t, 224 - 96 * t * (1 - t)])
  }
}
arch(148); points.push([222, 336], [222, 224]); arch(222); points.push([296, 336])
function distance(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)
}
function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0) }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const content = Buffer.concat([Buffer.from(type), data]), size = Buffer.alloc(4), checksum = Buffer.alloc(4)
  size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(content))
  return Buffer.concat([size, content, checksum])
}
function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0]
    for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
      const px = (x + (sx + .5) / 2) * 512 / size, py = (y + (sy + .5) / 2) * 512 / size
      let color = [8, 14, 24]
      if (points.some((a, i) => i > 0 && distance(px, py, points[i - 1], a) <= 20)) color = [226, 237, 249]
      if (Math.hypot(px - 349, py - 321) <= 18) color = [115, 215, 230]
      color.forEach((c, i) => { sum[i] += c })
    }
    const offset = y * (size * 3 + 1) + 1 + x * 3
    sum.forEach((c, i) => { raw[offset + i] = Math.round(c / 4) })
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
for (const [file, size] of [['mission-192.png',192], ['mission-512.png',512], ['mission-maskable-512.png',512], ['apple-touch-icon.png',180]]) writeFileSync(new URL(file, directory), png(size))
writeFileSync(new URL('favicon.svg', directory), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#080e18"/><polyline points="${points.map(p => p.join(',')).join(' ')}" fill="none" stroke="#e2edf9" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/><circle cx="349" cy="321" r="18" fill="#73d7e6"/></svg>`)
