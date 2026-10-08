import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import {
  arrayUnion, collection, doc, getDocFromServer, onSnapshot, query, serverTimestamp,
  setDoc, Timestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { auth, cloudEnabled, db } from './firebase'
import { isCountry, isExpense, isTrip, type Country, type Expense, type Trip } from './domain'

export function errorMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (/invalid-credential|wrong-password|user-not-found/.test(code)) return 'Adresse ou mot de passe incorrect.'
  if (code.includes('email-already-in-use')) return 'Cette adresse possède déjà un compte. Connectez-vous.'
  if (code.includes('weak-password')) return 'Choisissez un mot de passe d’au moins 8 caractères.'
  if (/permission-denied/.test(code)) return 'Votre accès a changé ou cette modification n’est plus autorisée. Vérifiez vos dépenses avant de réessayer.'
  if (/unavailable|network-request-failed/.test(code)) return 'Connexion indisponible. Réessayez une fois en ligne.'
  if (code.includes('too-many-requests')) return 'Trop de tentatives. Réessayez dans quelques minutes.'
  if (code.includes('operation-not-allowed')) return 'La connexion n’est pas encore activée pour cette version.'
  return error instanceof Error && !code ? error.message : 'L’opération n’a pas abouti. Réessayez.'
}
export function useSession() {
  const [state, setState] = useState<{ loading: boolean; user: User | null }>({ loading: cloudEnabled, user: null })
  useEffect(() => auth ? onAuthStateChanged(auth, user => setState({ loading: false, user })) : undefined, [])
  return state
}
export function useTrips(uid: string) {
  const [state, setState] = useState<{ trips: Trip[]; loaded: boolean; fromCache: boolean; pendingTripIds: string[]; error: string }>({ trips: [], loaded: false, fromCache: true, pendingTripIds: [], error: '' })
  useEffect(() => {
    if (!db) return
    return onSnapshot(query(collection(db, 'trips'), where('memberIds', 'array-contains', uid)), { includeMetadataChanges: true }, snapshot => {
      const trips = snapshot.docs.map(d => ({ ...d.data(), id: d.id }))
      if (!trips.every(isTrip)) { setState(prev => ({ ...prev, error: 'Un voyage contient des données invalides. Contactez le support.' })); return }
      setState({ trips: trips.sort((a, b) => b.createdAt - a.createdAt), loaded: true, fromCache: snapshot.metadata.fromCache, pendingTripIds: snapshot.docs.filter(d => d.metadata.hasPendingWrites).map(d => d.id), error: '' })
    }, error => setState(prev => ({ ...prev, loaded: true, error: errorMessage(error) })))
  }, [uid])
  return state
}
export function useRemoteData(trip: Trip, tripPending: boolean) {
  const started = useRef(false)
  const [countries, setCountries] = useState<Country[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [state, setState] = useState({ countriesLoaded: false, expensesLoaded: false, countriesPending: false, expensesPending: false, countriesCache: true, expensesCache: true, error: '' })
  useEffect(() => {
    if (!db || (tripPending && !started.current)) return
    // A newly created parent must reach the server before its protected collections can be read.
    started.current = true
    const fail = (error: unknown) => setState(prev => ({ ...prev, error: errorMessage(error) }))
    const a = onSnapshot(collection(db, 'trips', trip.id, 'countries'), { includeMetadataChanges: true }, snapshot => {
      const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id }))
      if (!data.every(isCountry)) { fail(new Error('Une étape contient des données invalides.')); return }
      setCountries(data)
      setState(prev => ({ ...prev, countriesLoaded: true, countriesPending: snapshot.metadata.hasPendingWrites, countriesCache: snapshot.metadata.fromCache }))
    }, fail)
    const b = onSnapshot(collection(db, 'trips', trip.id, 'expenses'), { includeMetadataChanges: true }, snapshot => {
      const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id }))
      if (!data.every(isExpense)) { fail(new Error('Une dépense contient des données invalides.')); return }
      setExpenses(data)
      setState(prev => ({ ...prev, expensesLoaded: true, expensesPending: snapshot.metadata.hasPendingWrites, expensesCache: snapshot.metadata.fromCache }))
    }, fail)
    return () => { a(); b() }
  }, [trip.id, tripPending])
  return {
    data: { version: 2 as const, trip, countries, expenses },
    loaded: state.countriesLoaded && state.expensesLoaded,
    pending: state.countriesPending || state.expensesPending,
    fromCache: state.countriesCache || state.expensesCache,
    error: state.error,
  }
}
function requireDB() { if (!db) throw new Error('Le partage n’est pas disponible dans cette version.'); return db }
function withoutId<T extends { id: string }>(value: T) { const { id, ...rest } = value; void id; return rest }
export function createTrip(trip: Trip) { return setDoc(doc(requireDB(), 'trips', trip.id), withoutId(trip)) }
export function saveTrip(trip: Trip) {
  return updateDoc(doc(requireDB(), 'trips', trip.id), { name: trip.name, budgetCents: trip.budgetCents, startDate: trip.startDate, endDate: trip.endDate })
}
export function saveCountry(tripId: string, country: Country, creating: boolean) {
  const ref = doc(requireDB(), 'trips', tripId, 'countries', country.id)
  return creating ? setDoc(ref, withoutId(country)) : updateDoc(ref, withoutId(country))
}
export function saveExpense(tripId: string, expense: Expense, creating: boolean) {
  const ref = doc(requireDB(), 'trips', tripId, 'expenses', expense.id)
  // Independent documents prevent one companion's new expense from replacing another's.
  return creating ? setDoc(ref, withoutId(expense)) : updateDoc(ref, withoutId(expense))
}
export function deleteExpense(tripId: string, id: string) {
  // A tombstone prevents an older offline edit from resurrecting a deleted expense.
  return updateDoc(doc(requireDB(), 'trips', tripId, 'expenses', id), { deleted: true })
}
export async function createInvite(trip: Trip, uid: string) {
  if (trip.ownerId !== uid) throw new Error('Seul le créateur du voyage peut inviter un compagnon.')
  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('')
  await setDoc(doc(requireDB(), 'invites', token), { tripId: trip.id, tripName: trip.name, ownerId: uid, createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 6 * 86_400_000), claimedBy: null, claimedAt: null })
  return token
}
export async function joinTrip(token: string, uid: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) throw new Error('Le code d’invitation doit contenir 32 caractères. Copiez le lien ou le code complet.')
  const database = requireDB()
  const ref = doc(database, 'invites', token)
  const snapshot = await getDocFromServer(ref)
  if (!snapshot.exists()) throw new Error('Invitation inconnue ou révoquée.')
  const invitation = snapshot.data()
  if (invitation.claimedBy === uid) return invitation.tripId as string
  if (invitation.claimedBy || invitation.expiresAt.toMillis() <= Date.now()) throw new Error('Cette invitation a déjà été utilisée ou a expiré.')
  const batch = writeBatch(database)
  batch.update(doc(database, 'trips', invitation.tripId), { memberIds: arrayUnion(uid), lastInviteId: token })
  batch.update(ref, { claimedBy: uid, claimedAt: serverTimestamp() })
  await batch.commit()
  return invitation.tripId as string
}
export async function sendFeedback(uid: string, body: string) {
  await setDoc(doc(requireDB(), 'feedback', crypto.randomUUID()), { body, createdBy: uid, createdAt: serverTimestamp(), version: '0.1.0-beta' })
}
