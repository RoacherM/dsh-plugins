// Epi keeps its sessions in the same version-3 format as Pi, under EPI_HOME.
import * as pi from './pi.js'

export const agent = 'epi'

export function create(key) {
  return pi.create(key, 'epi')
}

export const feed = pi.feed
export const finalize = pi.finalize

export function readSession(file) {
  return pi.readSession(file, 'epi')
}
