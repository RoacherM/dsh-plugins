// DSH session logs are concatenated zstd frames; Node decodes only the first frame at a time.
import { zstdDecompressSync } from 'node:zlib'

const MAGIC = [0x28, 0xb5, 0x2f, 0xfd]

/** Decode a buffer made of concatenated zstd frames (a false magic inside a frame is merged away). */
export function decodeFrames(raw) {
  const starts = []
  for (let i = 0; i <= raw.length - 4; i++) {
    if (raw[i] === MAGIC[0] && raw[i + 1] === MAGIC[1] && raw[i + 2] === MAGIC[2] && raw[i + 3] === MAGIC[3]) starts.push(i)
  }
  if (!starts.length) return ''
  const parts = []
  let from = 0
  for (let k = 1; k <= starts.length; k++) {
    const end = k < starts.length ? starts[k] : raw.length
    try {
      parts.push(zstdDecompressSync(raw.subarray(starts[from], end)))
      from = k
    } catch (error) {
      if (k === starts.length) {
        // A torn final frame (the app was writing): keep what decoded.
        if (parts.length) break
        throw error
      }
    }
  }
  return Buffer.concat(parts).toString('utf8')
}

export function parseLines(text) {
  const records = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try { records.push(JSON.parse(line)) } catch { /* a torn last line */ }
  }
  return records
}
