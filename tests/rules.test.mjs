import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { arrayUnion, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore'

let env
const trip = { name: 'Voyage test', budgetCents: 100000, startDate: '2026-01-01', endDate: '2026-12-31', ownerId: 'alice', memberIds: ['alice', 'bob'], lastInviteId: '', createdAt: 1 }
const country = { name: 'Test', flag: '🌍', startDate: '2026-01-01', endDate: '', archived: false, createdAt: 1 }
const expense = { amountCents: 1235, category: 'Repas', countryId: 'c', date: '2026-10-01', note: 'Test', createdBy: 'alice', createdAt: 1, deleted: false }
const token = 'abcdef0123456789abcdef0123456789'
function db(uid) { return (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore() }
function invitation() { return { tripId: 'a', tripName: trip.name, ownerId: 'alice', createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000), claimedBy: null, claimedAt: null } }
function join(database, uid, code = token) {
  const batch = writeBatch(database)
  batch.update(doc(database, 'trips/a'), { memberIds: arrayUnion(uid), lastInviteId: code })
  batch.update(doc(database, `invites/${code}`), { claimedBy: uid, claimedAt: serverTimestamp() })
  return batch.commit()
}
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-travel-app', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } }) })
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    const database = context.firestore()
    await setDoc(doc(database, 'trips/a'), trip)
    await setDoc(doc(database, 'trips/a/countries/c'), country)
    await setDoc(doc(database, 'trips/a/expenses/e'), expense)
    await setDoc(doc(database, 'trips/other'), { ...trip, ownerId: 'charlie', memberIds: ['charlie'] })
    await setDoc(doc(database, 'trips/other/countries/c'), country)
  })
})
after(async () => { await env?.cleanup() })

test('budgets, expenses and country lists are private, including collection queries', async () => {
  await assertFails(getDoc(doc(db(), 'trips/a')))
  await assertFails(getDoc(doc(db('charlie'), 'trips/a')))
  await assertFails(getDocs(collection(db('charlie'), 'trips/a/expenses')))
  await assertFails(getDocs(collection(db('charlie'), 'trips/a/countries')))
  await assertFails(getDocs(collection(db('alice'), 'trips')))
  const result = await assertSucceeds(getDocs(query(collection(db('alice'), 'trips'), where('memberIds', 'array-contains', 'alice'))))
  assert.deepEqual(result.docs.map(d => d.id), ['a'])
  await assertSucceeds(getDoc(doc(db('bob'), 'trips/a/expenses/e')))
})
test('private trip creation and genuine member writes work; forged ownership or membership do not', async () => {
  const database = db('alice')
  await assertSucceeds(setDoc(doc(database, 'trips/new'), { ...trip, memberIds: ['alice'] }))
  await assertFails(setDoc(doc(database, 'trips/forged'), { ...trip, memberIds: ['alice', 'charlie'] }))
  await assertFails(setDoc(doc(db('charlie'), 'trips/forged-owner'), { ...trip, memberIds: ['alice'] }))
  await assertSucceeds(setDoc(doc(db('bob'), 'trips/a/expenses/bob'), { ...expense, createdBy: 'bob' }))
  await assertSucceeds(updateDoc(doc(db('bob'), 'trips/a'), { budgetCents: 120000 }))
  await assertFails(updateDoc(doc(db('bob'), 'trips/a'), { memberIds: arrayUnion('charlie') }))
  await assertFails(updateDoc(doc(database, 'trips/a'), { ownerId: 'bob' }))
  await assertFails(updateDoc(doc(db('charlie'), 'trips/a'), { budgetCents: 1 }))
})
test('invalid money, unknown categories, forged author and nonexistent countries are rejected', async () => {
  const database = db('alice')
  for (const change of [{ amountCents: -1 }, { amountCents: 0 }, { amountCents: 1.5 }, { category: 'Vols' }, { createdBy: 'bob' }, { countryId: 'missing' }, { note: 'x'.repeat(201) }, { date: '2027-01-01' }, { deleted: true }]) {
    await assertFails(setDoc(doc(database, `trips/a/expenses/${crypto.randomUUID()}`), { ...expense, ...change }))
  }
  await assertFails(updateDoc(doc(database, 'trips/a/expenses/e'), { createdAt: 2 }))
})
test('an invitation joins and consumes atomically; invitation enumeration and replay are denied', async () => {
  await assertSucceeds(setDoc(doc(db('alice'), `invites/${token}`), invitation()))
  await assertSucceeds(getDoc(doc(db('charlie'), `invites/${token}`)))
  await assertFails(getDocs(collection(db('charlie'), 'invites')))
  await assertFails(updateDoc(doc(db('charlie'), 'trips/a'), { memberIds: arrayUnion('charlie'), lastInviteId: token }))
  await assertFails(updateDoc(doc(db('charlie'), `invites/${token}`), { claimedBy: 'charlie', claimedAt: serverTimestamp() }))
  await assertSucceeds(join(db('charlie'), 'charlie'))
  await assertSucceeds(getDoc(doc(db('charlie'), 'trips/a')))
  await assertFails(join(db('dave'), 'dave'))
  await assertFails(setDoc(doc(db('bob'), `invites/${'0'.repeat(32)}`), { ...invitation(), ownerId: 'bob' }))
})
test('concurrent claims admit exactly one companion', async () => {
  await setDoc(doc(db('alice'), `invites/${token}`), invitation())
  const results = await Promise.allSettled([join(db('charlie'), 'charlie'), join(db('dave'), 'dave')])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  const snapshot = await getDoc(doc(db('alice'), 'trips/a'))
  assert.equal(snapshot.data().memberIds.length, 3)
})
test('expired invitation and changed trip ID cannot grant access', async () => {
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), `invites/${token}`), { ...invitation(), expiresAt: Timestamp.fromMillis(Date.now() - 1000) }))
  await assertFails(join(db('charlie'), 'charlie'))
  await assertFails(updateDoc(doc(db('charlie'), `invites/${token}`), { tripId: 'other' }))
  await assertFails(setDoc(doc(db('alice'), `invites/${'1'.repeat(32)}`), { ...invitation(), expiresAt: Timestamp.fromMillis(Date.now() + 8 * 86400000) }))
})
test('independent additions survive concurrency and a stale edit cannot resurrect a deletion', async () => {
  await Promise.all([
    assertSucceeds(setDoc(doc(db('alice'), 'trips/a/expenses/alice'), expense)),
    assertSucceeds(setDoc(doc(db('bob'), 'trips/a/expenses/bob'), { ...expense, createdBy: 'bob' })),
  ])
  assert.equal((await getDocs(collection(db('alice'), 'trips/a/expenses'))).size, 3)
  await assertSucceeds(updateDoc(doc(db('bob'), 'trips/a/expenses/e'), { deleted: true }))
  await assertFails(updateDoc(doc(db('alice'), 'trips/a/expenses/e'), { amountCents: 2000, deleted: false }))
})
test('feedback does not expose another tester’s message', async () => {
  await assertSucceeds(setDoc(doc(db('alice'), 'feedback/a'), { body: 'Un retour test', createdBy: 'alice', createdAt: serverTimestamp(), version: '0.1.0-beta' }))
  await assertFails(getDoc(doc(db('bob'), 'feedback/a')))
  await assertFails(setDoc(doc(db('bob'), 'feedback/forged'), { body: 'Un retour test', createdBy: 'alice', createdAt: serverTimestamp(), version: '0.1.0-beta' }))
})
