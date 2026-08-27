import { openDB, type IDBPDatabase } from 'idb'
import type { WatermarkConfig } from './types'

const DB_NAME = 'pdf-watermarker'
const STORE = 'presets'

export interface Preset {
  name: string
  layers: WatermarkConfig[]
}

function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: 'name' })
      }
    },
  })
}

export async function savePreset(name: string, layers: WatermarkConfig[]): Promise<void> {
  await (await db()).put(STORE, { name, layers })
}

export async function listPresets(): Promise<Preset[]> {
  return (await db()).getAll(STORE)
}

export async function deletePreset(name: string): Promise<void> {
  await (await db()).delete(STORE, name)
}
