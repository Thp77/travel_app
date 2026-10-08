import { useSyncExternalStore } from 'react'
import { EMPTY_DATA, migrateLegacy, readBackup, type TravelData } from './domain'

const STORAGE_KEY = 'travel-app-v2'
type Snapshot = { data: TravelData; error: string }
let snapshot: Snapshot | undefined
const listeners = new Set<() => void>()
function getSnapshot(): Snapshot {
  if (!snapshot) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      snapshot = { data: saved ? readBackup(JSON.parse(saved)) : migrateLegacy(localStorage), error: '' }
    } catch (error) {
      snapshot = { data: EMPTY_DATA, error: error instanceof Error ? error.message : 'Le stockage local est indisponible.' }
    }
  }
  return snapshot
}
function receive(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return
  try { snapshot = { data: event.newValue ? readBackup(JSON.parse(event.newValue)) : EMPTY_DATA, error: '' } }
  catch { snapshot = { ...getSnapshot(), error: 'La sauvegarde locale est illisible. Exportez vos données avant de continuer.' } }
  listeners.forEach(listener => listener())
}
function subscribe(listener: () => void) {
  if (!listeners.size) window.addEventListener('storage', receive)
  listeners.add(listener)
  return () => { listeners.delete(listener); if (!listeners.size) window.removeEventListener('storage', receive) }
}
export function useLocalData() { return useSyncExternalStore(subscribe, getSnapshot) }
export function saveLocalData(data: TravelData) {
  readBackup(data)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  catch { throw new Error('Enregistrement impossible : le stockage de cet appareil est plein ou indisponible. Exportez vos données.') }
  snapshot = { data, error: '' }
  listeners.forEach(listener => listener())
}
export function updateLocalData(update: (data: TravelData) => TravelData) {
  if (getSnapshot().error) throw new Error(getSnapshot().error)
  saveLocalData(update(getSnapshot().data))
}
export function exportJSON(data: TravelData) {
  downloadFile(JSON.stringify(data, null, 2), `travel-app-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
}
export function downloadFile(content: string, name: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
