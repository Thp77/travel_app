import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, disableNetwork, enableNetwork, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
export const cloudEnabled = Object.values(config).every(Boolean)
const app = cloudEnabled ? initializeApp(config) : null
export const auth = app ? getAuth(app) : null
export const db = app ? initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
}) : null

// Emulators are deliberately restricted to local development builds.
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

// Use the application's own SDK instance to exercise durable offline writes in local integration tests.
export async function setEmulatorNetworkEnabled(enabled: boolean) {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_FIREBASE_EMULATORS !== 'true' || !db) throw new Error('Emulator network controls are unavailable in this build.')
  return enabled ? enableNetwork(db) : disableNetwork(db)
}
