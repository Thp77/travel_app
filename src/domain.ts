export const CATEGORIES = [
  { name: 'Logement', icon: '🏠', color: '#ef6a2e' },
  { name: 'Repas', icon: '🍜', color: '#e6ad32' },
  { name: 'Transports', icon: '🚌', color: '#57a773' },
  { name: 'Activités', icon: '📷', color: '#3c91c9' },
  { name: 'Courses', icon: '🛍️', color: '#a76ccf' },
  { name: 'Divers', icon: '✨', color: '#cf6973' },
] as const

export type Category = typeof CATEGORIES[number]['name']
export type Trip = {
  id: string
  name: string
  budgetCents: number
  startDate: string
  endDate: string
  ownerId: string
  memberIds: string[]
  lastInviteId: string
  createdAt: number
}
export type Country = {
  id: string
  name: string
  flag: string
  startDate: string
  endDate: string
  archived: boolean
  createdAt: number
}
export type Expense = {
  id: string
  amountCents: number
  category: Category
  countryId: string
  date: string
  note: string
  createdBy: string
  createdAt: number
  deleted: boolean
}
export type TravelData = { version: 2; trip: Trip | null; countries: Country[]; expenses: Expense[] }
export const EMPTY_DATA: TravelData = { version: 2, trip: null, countries: [], expenses: [] }
export const MAX_CENTS = 10_000_000_000

export function todayISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Calendar days are independent of timezone changes and daylight saving time.
export function dayNumber(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1900 || year > 2200) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.getTime() / 86_400_000
}
export function daysInclusive(start: string, end: string) {
  const a = dayNumber(start)
  const b = dayNumber(end)
  return a === null || b === null || b < a ? 0 : b - a + 1
}
export function validPeriod(start: string, end: string) {
  return daysInclusive(start, end) > 0
}
export function parseMoney(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const [euros, decimals = ''] = normalized.split('.')
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_CENTS ? cents : null
}
export function money(cents: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(cents / 100)
}
export function shortDate(date: string) {
  if (dayNumber(date) === null) return 'À définir'
  return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
export function liveExpenses(expenses: Expense[]) { return expenses.filter(e => !e.deleted) }
export function totalSpent(expenses: Expense[]) { return liveExpenses(expenses).reduce((sum, e) => sum + e.amountCents, 0) }
export function budgetStats(trip: Trip, expenses: Expense[], today = todayISO()) {
  const spent = totalSpent(expenses)
  const remaining = trip.budgetCents - spent
  const totalDays = daysInclusive(trip.startDate, trip.endDate)
  const current = dayNumber(today)
  const start = dayNumber(trip.startDate)
  const end = dayNumber(trip.endDate)
  const dated = totalDays > 0 && current !== null && start !== null && end !== null
  const elapsedDays = dated ? Math.max(0, Math.min(totalDays, current - start + 1)) : 0
  // Today is included in the amount available until the end of the trip.
  const remainingDays = dated ? Math.max(0, end - Math.max(current, start) + 1) : 0
  const averageCents = elapsedDays ? Math.round(spent / elapsedDays) : null
  const dailyAvailableCents = remainingDays ? Math.max(0, Math.floor(remaining / remainingDays)) : null
  const projectedCents = elapsedDays ? Math.round(spent * totalDays / elapsedDays) : null
  const overspending = remaining < 0
  const atRisk = overspending || (projectedCents !== null && projectedCents > trip.budgetCents)
  return { spent, remaining, totalDays, elapsedDays, remainingDays, averageCents, dailyAvailableCents, projectedCents, atRisk, overspending, dated }
}

export function categoryBreakdown(expenses: Expense[]) {
  const spent = totalSpent(expenses)
  let cursor = 0
  const items = CATEGORIES.map(category => {
    const total = liveExpenses(expenses).filter(e => e.category === category.name).reduce((sum, e) => sum + e.amountCents, 0)
    const percent = spent ? total / spent * 100 : 0
    const start = cursor
    cursor += percent
    return { ...category, total, percent, start, end: cursor }
  })
  const gradient = spent ? `conic-gradient(${items.map(i => `${i.color} ${i.start}% ${i.end}%`).join(', ')})` : '#e7ddd2'
  return { spent, items, gradient }
}

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function cents(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_CENTS }
export function isTrip(value: unknown): value is Trip {
  return record(value) && typeof value.id === 'string' && typeof value.name === 'string' && value.name.length > 0 && value.name.length <= 100 &&
    cents(value.budgetCents) && typeof value.startDate === 'string' && dayNumber(value.startDate) !== null && typeof value.endDate === 'string' &&
    (value.endDate === '' || validPeriod(value.startDate, value.endDate)) && typeof value.ownerId === 'string' &&
    Array.isArray(value.memberIds) && value.memberIds.every(i => typeof i === 'string') && value.memberIds.includes(value.ownerId) &&
    typeof value.lastInviteId === 'string' && typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
}
export function isCountry(value: unknown): value is Country {
  return record(value) && typeof value.id === 'string' && typeof value.name === 'string' && value.name.length > 0 && value.name.length <= 80 &&
    typeof value.flag === 'string' && value.flag.length <= 16 && typeof value.startDate === 'string' && dayNumber(value.startDate) !== null &&
    typeof value.endDate === 'string' && (value.endDate === '' || validPeriod(value.startDate, value.endDate)) &&
    typeof value.archived === 'boolean' && typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
}
export function isExpense(value: unknown): value is Expense {
  return record(value) && typeof value.id === 'string' && cents(value.amountCents) && CATEGORIES.some(c => c.name === value.category) &&
    typeof value.countryId === 'string' && typeof value.date === 'string' && dayNumber(value.date) !== null &&
    typeof value.note === 'string' && value.note.length <= 200 && typeof value.createdBy === 'string' &&
    typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) && typeof value.deleted === 'boolean'
}
export function readBackup(value: unknown): TravelData {
  if (!record(value) || value.version !== 2 || !(value.trip === null || isTrip(value.trip)) ||
      !Array.isArray(value.countries) || !value.countries.every(isCountry) || !Array.isArray(value.expenses) || !value.expenses.every(isExpense)) {
    throw new Error('Ce fichier ne contient pas une sauvegarde Travel App valide.')
  }
  const countries = value.countries
  const expenses = value.expenses
  if (new Set(countries.map(c => c.id)).size !== countries.length || new Set(expenses.map(e => e.id)).size !== expenses.length ||
      expenses.some(e => !countries.some(c => c.id === e.countryId)) || (!value.trip && (countries.length || expenses.length))) {
    throw new Error('La sauvegarde contient des identifiants ou des étapes incohérents.')
  }
  return value as unknown as TravelData
}

// Only import explicitly saved data. The old hard-coded demo is never treated as real spending.
export function migrateLegacy(storage: Pick<Storage, 'getItem'>): TravelData {
  const raw = storage.getItem('tbt-countries')
  const budget = parseMoney(storage.getItem('tbt-budget-total') || '')
  if (!raw || !budget) return { ...EMPTY_DATA }
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error('Les anciennes données sont illisibles. Elles ont été conservées.')
  const countries: Country[] = []
  const expenses: Expense[] = []
  const names: Record<string, Category> = { Nourriture: 'Repas', Transport: 'Transports', Shopping: 'Courses', Santé: 'Divers', Extras: 'Divers' }
  for (const [i, item] of parsed.entries()) {
    if (!record(item) || typeof item.name !== 'string' || typeof item.startDate !== 'string' || dayNumber(item.startDate) === null || !Array.isArray(item.expenses)) {
      throw new Error('Une ancienne étape est illisible. Les données originales ont été conservées.')
    }
    const id = `legacy-country-${i}`
    const endDate = typeof item.endDate === 'string' && validPeriod(item.startDate, item.endDate) ? item.endDate : ''
    countries.push({ id, name: item.name.slice(0, 80) || 'Pays', flag: typeof item.flag === 'string' ? item.flag.slice(0, 16) : '🌍', startDate: item.startDate, endDate, archived: !!item.closed, createdAt: i })
    for (const [j, entry] of item.expenses.entries()) {
      if (!record(entry)) throw new Error('Une ancienne dépense est illisible. Les données originales ont été conservées.')
      const amount = typeof entry.amount === 'number' && Number.isFinite(entry.amount) ? Math.round(entry.amount * 100) : null
      const category = typeof entry.category === 'string' ? (names[entry.category] || entry.category) : ''
      if (!cents(amount) || !CATEGORIES.some(c => c.name === category)) throw new Error('Une ancienne dépense est invalide. Exportez les données originales avant de poursuivre.')
      expenses.push({ id: `legacy-expense-${i}-${j}`, amountCents: amount, category: category as Category, countryId: id, date: item.startDate, note: 'Import ancien format · date de l’étape', createdBy: 'local', createdAt: j, deleted: false })
    }
  }
  const startDate = countries.map(c => c.startDate).sort()[0] || todayISO()
  return { version: 2, trip: { id: 'local-trip', name: 'Mon voyage', budgetCents: budget, startDate, endDate: '', ownerId: 'local', memberIds: ['local'], lastInviteId: '', createdAt: 0 }, countries, expenses }
}
