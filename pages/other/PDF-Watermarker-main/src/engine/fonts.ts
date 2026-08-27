import heitiUrl from '../assets/fonts/heiti.ttf?url'
import songtiUrl from '../assets/fonts/songti.ttf?url'
import type { FontKind } from './types'

const cache = new Map<FontKind, Uint8Array>()

export async function loadFont(kind: FontKind): Promise<Uint8Array> {
  const cached = cache.get(kind)
  if (cached) return cached
  const url = kind === 'heiti' ? heitiUrl : songtiUrl
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
  cache.set(kind, bytes)
  return bytes
}
