import { test } from 'node:test'
import assert from 'node:assert/strict'
import { budgetStats, categoryBreakdown, daysInclusive, migrateLegacy, parseMoney, readBackup, todayISO, type Trip, type Expense } from '../src/domain.ts'

const trip: Trip = { id: 't', name: 'Test', ownerId: 'a', memberIds: ['a'], lastInviteId: '', budgetCents: 100_000, startDate: '2026-10-01', endDate: '2026-10-10', createdAt: 0 }
function expense(id: string, amountCents: number, deleted = false): Expense {
  return { id, amountCents, category: 'Repas', countryId: 'c', date: '2026-10-01', note: '', createdBy: 'a', createdAt: 0, deleted }
}
test('decimal commas and cent precision; negative, zero, fractional cents and infinite values rejected', () => {
  assert.equal(parseMoney('12,35'), 1235)
  assert.equal(parseMoney(' 1 200.01 '), 120001)
  assert.equal(parseMoney('0,01'), 1)
  for (const input of ['-3', '0', 'NaN', 'Infinity', '1.234', '3e5', '', '1,2,3']) assert.equal(parseMoney(input), null, input)
  assert.equal(budgetStats(trip, [expense('a', 10), expense('b', 20)]).spent, 30)
})
test('actual trip days, today included, and no overlapping-country double count', () => {
  const stats = budgetStats(trip, [expense('a', 20_000)], '2026-10-05')
  assert.equal(stats.totalDays, 10); assert.equal(stats.elapsedDays, 5); assert.equal(stats.remainingDays, 6)
  assert.equal(stats.averageCents, 4000); assert.equal(stats.dailyAvailableCents, 13333)
  assert.equal(stats.projectedCents, 40000); assert.equal(stats.atRisk, false)
})
test('future trips, final day, ended trips, missing end dates and overspending', () => {
  assert.equal(budgetStats(trip, [], '2026-09-20').remainingDays, 10)
  assert.equal(budgetStats(trip, [], '2026-09-20').projectedCents, null)
  assert.equal(budgetStats(trip, [], '2026-10-10').remainingDays, 1)
  assert.equal(budgetStats(trip, [], '2026-10-11').dailyAvailableCents, null)
  assert.equal(budgetStats({ ...trip, endDate: '' }, [], '2026-10-05').dated, false)
  const stats = budgetStats(trip, [expense('x', 120000)], '2026-10-05')
  assert.equal(stats.remaining, -20000); assert.equal(stats.dailyAvailableCents, 0); assert.equal(stats.atRisk, true)
  assert.equal(budgetStats(trip, [expense('x', 60000)], '2026-10-05').atRisk, true)
})
test('calendar day math stays correct over DST and leap dates; invalid dates rejected', () => {
  assert.equal(daysInclusive('2026-10-24', '2026-10-26'), 3)
  assert.equal(daysInclusive('2024-02-28', '2024-03-01'), 3)
  assert.equal(daysInclusive('2026-02-29', '2026-03-01'), 0)
  assert.equal(daysInclusive('2026-04-31', '2026-05-01'), 0)
  assert.equal(daysInclusive('2026-10-10', '2026-10-01'), 0)
  const date = new Date('2026-10-01T00:30:00+09:00')
  const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  assert.equal(todayISO(date), expected)
})
test('deleted expenses stay excluded and the chart matches actual categories', () => {
  const expenses = [expense('a', 1000), { ...expense('b', 3000), category: 'Logement' as const }, expense('deleted', 99999, true)]
  const chart = categoryBreakdown(expenses)
  assert.equal(chart.spent, 4000)
  assert.equal(chart.items.find(c => c.name === 'Repas')?.percent, 25)
  assert.equal(chart.items.find(c => c.name === 'Logement')?.percent, 75)
  assert.ok(chart.gradient.includes('75% 100%'))
  assert.equal(categoryBreakdown([]).gradient, '#e7ddd2')
})
test('legacy import preserves saved expenses, maps categories and never invents a demo', () => {
  const empty = { getItem: () => null }
  assert.equal(migrateLegacy(empty).trip, null)
  const values: Record<string, string> = { 'tbt-budget-total': '12000', 'tbt-countries': JSON.stringify([{ name: 'Thaïlande', flag: '🇹🇭', startDate: '2026-10-01', budget: 3000, expenses: [{ category: 'Nourriture', amount: 12.35 }, { category: 'Santé', amount: 4 }] }]) }
  const migrated = migrateLegacy({ getItem: key => values[key] || null })
  assert.equal(migrated.trip?.budgetCents, 1200000)
  assert.equal(migrated.trip?.endDate, '')
  assert.equal(migrated.expenses[0].amountCents, 1235)
  assert.equal(migrated.expenses[0].category, 'Repas')
  assert.equal(migrated.expenses[1].category, 'Divers')
  assert.deepEqual(readBackup(migrated), migrated)
})
test('invalid backup contents and dangling or duplicate IDs cannot replace existing data', () => {
  assert.throws(() => readBackup({ version: 2, trip, countries: [], expenses: [expense('a', 1)] }))
  assert.throws(() => readBackup({ version: 2, trip: { ...trip, budgetCents: -1 }, countries: [], expenses: [] }))
  assert.throws(() => readBackup({ version: 2, trip: null, countries: [], expenses: [expense('a', 1)] }))
  assert.throws(() => readBackup({ version: 1 }))
})
