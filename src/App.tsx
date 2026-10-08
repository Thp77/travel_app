import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { auth, cloudEnabled } from './firebase'
import { createInvite, createTrip, deleteExpense, errorMessage, joinTrip, saveCountry, saveExpense, saveTrip, sendFeedback, useRemoteData, useSession, useTrips } from './cloud'
import { budgetStats, CATEGORIES, categoryBreakdown, daysInclusive, liveExpenses, money, parseMoney, readBackup, shortDate, todayISO, totalSpent, validPeriod, type Category, type Country, type Expense, type TravelData, type Trip } from './domain'
import { downloadFile, exportJSON, saveLocalData, updateLocalData, useLocalData } from './local-store'

type Tab = 'home' | 'countries' | 'settings'
type Actions = {
  trip: (trip: Trip) => void | Promise<void>
  country: (country: Country, creating: boolean) => void | Promise<void>
  expense: (expense: Expense, creating: boolean) => void | Promise<void>
  removeExpense: (id: string) => void | Promise<void>
}
function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return online
}
function invitationCode() {
  return new URLSearchParams(location.hash.slice(1)).get('invite') || ''
}
function Brand() {
  return <header className="brand"><img src="/Logo.png" alt="" /><div><p>Travel <span>App</span></p><small>LE VOYAGE, L’ESPRIT LIBRE</small></div><span className="beta-badge">BÊTA</span></header>
}
function Banner({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`banner ${error ? 'banner-error' : ''}`} role={error ? 'alert' : 'status'}>{children}</div>
}
function Loading() { return <div className="app-shell"><Brand /><div className="card loading" role="status">Chargement de votre voyage…</div></div> }

export default function App() {
  const session = useSession()
  const [authOpen, setAuthOpen] = useState(!!invitationCode() && cloudEnabled)
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()
  if (session.loading) return <Loading />
  return <>
    {needRefresh && <div className="update-bar" role="status"><span>Une nouvelle version est disponible.</span><button onClick={() => void updateServiceWorker(true)}>Mettre à jour</button><button aria-label="Plus tard" onClick={() => setNeedRefresh(false)}>×</button></div>}
    {session.user ? <CloudHome key={session.user.uid} user={session.user} /> : authOpen && auth ? <AuthScreen onClose={() => setAuthOpen(false)} /> : <LocalHome onConnect={() => setAuthOpen(true)} />}
  </>
}

function LocalHome({ onConnect }: { onConnect: () => void }) {
  const { data, error } = useLocalData()
  const actions: Actions = {
    trip: trip => updateLocalData(old => ({ ...old, trip })),
    country: (country, creating) => updateLocalData(old => ({ ...old, countries: creating ? [...old.countries, country] : old.countries.map(c => c.id === country.id ? country : c) })),
    expense: (expense, creating) => updateLocalData(old => {
      if (!creating && !old.expenses.some(e => e.id === expense.id && !e.deleted)) throw new Error('Cette dépense a été supprimée entre-temps.')
      return { ...old, expenses: creating ? [...old.expenses, expense] : old.expenses.map(e => e.id === expense.id ? expense : e) }
    }),
    removeExpense: id => updateLocalData(old => ({ ...old, expenses: old.expenses.map(e => e.id === id ? { ...e, deleted: true } : e) })),
  }
  return <Workspace data={data} actions={actions} error={error} onConnect={onConnect} />
}

function CloudHome({ user }: { user: User }) {
  const { trips, loaded, fromCache, pendingTripIds, error } = useTrips(user.uid)
  const online = useOnline()
  const [selected, setSelected] = useState('')
  const [creating, setCreating] = useState(false)
  const [code, setCode] = useState(invitationCode())
  const [joining, setJoining] = useState(false)
  const [message, setMessage] = useState('')
  const trip = trips.find(t => t.id === selected) || trips[0]
  async function join(event: FormEvent) {
    event.preventDefault(); setJoining(true); setMessage('')
    try {
      const token = code.includes('#invite=') ? code.split('#invite=')[1] : code.trim()
      setSelected(await joinTrip(token, user.uid)); setCode('')
      history.replaceState(null, '', location.pathname + location.search)
    } catch (e) { setMessage(errorMessage(e)) }
    finally { setJoining(false) }
  }
  if (!loaded && !error) return <Loading />
  return <>
    <div className="app-shell cloud-controls">
      {error && <Banner error>{error}</Banner>}
      <div className="trip-switcher">
        {trips.length > 0 && <label>Voyage actif<select value={trip.id} onChange={e => { setSelected(e.target.value); setCreating(false) }}>{trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
        <button className="button secondary" onClick={() => setCreating(!creating)}>{creating ? 'Annuler' : '+ Nouveau voyage'}</button>
      </div>
      <details open={!!invitationCode()} className="card compact"><summary>Rejoindre le voyage d’un compagnon</summary><form className="inline-form" onSubmit={join}><label>Lien ou code d’invitation<input value={code} onChange={e => setCode(e.target.value)} autoComplete="off" required /></label><button className="button" disabled={joining || !online}>{joining ? 'Vérification…' : 'Rejoindre'}</button></form><small>Chaque invitation est valable 6 jours et utilisable une seule fois.</small>{message && <Banner error>{message}</Banner>}</details>
      {fromCache && !trips.length && <Banner>Vos voyages ne sont pas encore disponibles sur cet appareil. Une première connexion est nécessaire.</Banner>}
      {(creating || !trip) && <><Brand /><TripForm ownerId={user.uid} onSave={value => {
        setSelected(value.id)
        void createTrip(value).catch(e => setMessage(errorMessage(e)))
        setCreating(false)
        return true
      }} />{message && <Banner error>{message}</Banner>}<button className="text-button" onClick={() => void signOut(auth!)}>Se déconnecter</button></>}
    </div>
    {trip && !creating && <RemoteWorkspace key={trip.id} trip={trip} user={user} tripPending={pendingTripIds.includes(trip.id)} tripFromCache={fromCache} />}
  </>
}
function RemoteWorkspace({ trip, user, tripPending, tripFromCache }: { trip: Trip; user: User; tripPending: boolean; tripFromCache: boolean }) {
  const remote = useRemoteData(trip, tripPending)
  const actions: Actions = {
    trip: value => saveTrip(value),
    country: (value, creating) => saveCountry(trip.id, value, creating),
    expense: (value, creating) => saveExpense(trip.id, value, creating),
    removeExpense: id => deleteExpense(trip.id, id),
  }
  if (remote.error) return <div className="app-shell"><Brand /><Banner error>{remote.error}</Banner><button className="button secondary" onClick={() => location.reload()}>Recharger le voyage</button></div>
  if (!remote.loaded) return <Loading />
  return <Workspace data={remote.data} actions={actions} user={user} pending={remote.pending || tripPending} fromCache={remote.fromCache || tripFromCache} />
}

function Workspace({ data, actions, user = null, pending = false, fromCache = false, error = '', onConnect }: {
  data: TravelData; actions: Actions; user?: User | null; pending?: boolean; fromCache?: boolean; error?: string; onConnect?: () => void
}) {
  const online = useOnline()
  const [tab, setTab] = useState<Tab>('home')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [editing, setEditing] = useState<Expense | null>(null)
  const trip = data.trip
  function perform(action: () => void | Promise<void>, message: string) {
    setActionError(''); setNotice('')
    if (error) { setActionError(error); return false }
    try {
      const result = action()
      setNotice(user ? `${message} Synchronisation en cours si nécessaire.` : message)
      if (result) void result.catch(e => { setNotice(''); setActionError(errorMessage(e)) })
      return true
    } catch (e) { setActionError(errorMessage(e)); return false }
  }
  const status = !user ? (online ? 'Sur cet appareil' : 'Hors connexion · sur cet appareil') : pending ? 'En attente de synchronisation' : !online || fromCache ? 'Hors connexion ou vérification en cours' : 'Synchronisé'
  return <div className="app-shell">
    <Brand />
    <div className="status-row"><span className={`status-dot ${user && !pending && online && !fromCache ? 'synced' : ''}`} /><span role="status">{status}</span>{!user && cloudEnabled && <button className="text-button" onClick={onConnect}>Se connecter</button>}</div>
    {(error || actionError) && <Banner error>{error || actionError}<button className="dismiss" aria-label="Fermer le message" onClick={() => setActionError('')}>×</button></Banner>}
    {notice && <Banner>{notice}<button className="dismiss" aria-label="Fermer la confirmation" onClick={() => setNotice('')}>×</button></Banner>}
    {!trip ? <><section className="welcome card"><span className="eyebrow">VOTRE PROCHAIN DÉPART</span><h1>Un voyage.<br />Un budget commun.</h1><p>Gardez le cap sur vos dépenses, jour après jour, même sans réseau.</p><p className="muted">Votre budget couvre les dépenses sur place. Les vols internationaux et l’assurance restent à part.</p></section><TripForm ownerId={user?.uid || 'local'} onSave={value => perform(() => actions.trip(value), 'Voyage créé.')} />{!user && <p className="footnote">Vos données restent sur cet appareil. {cloudEnabled ? 'Connectez-vous pour retrouver votre voyage sur plusieurs téléphones.' : 'Le partage sera disponible dans la version connectée.'}</p>}</> : <>
      {tab === 'home' && <>
        <section className="welcome"><span className="eyebrow">{trip.name}</span><h1>Le voyage, l’esprit libre.</h1><p>{shortDate(trip.startDate)} → {shortDate(trip.endDate)}{user?.displayName && ` · Bonjour ${user.displayName}`}</p></section>
        <Dashboard trip={trip} expenses={data.expenses} onConfigure={() => setTab('settings')} />
        <div className="two-column"><div><ExpenseForm key={editing?.id || 'new'} trip={trip} countries={data.countries} userId={user?.uid || 'local'} editing={editing} onCancel={() => setEditing(null)} onSave={(value, creating) => {
          const ok = perform(() => actions.expense(value, creating), 'Dépense enregistrée.')
          if (ok) setEditing(null)
          return ok
        }} /><Breakdown expenses={data.expenses} /></div><ExpenseList countries={data.countries} expenses={data.expenses} onEdit={value => { setEditing(value); window.scrollTo({ top: 0, behavior: 'smooth' }) }} onDelete={id => { if (window.confirm('Supprimer cette dépense du budget commun ?')) perform(() => actions.removeExpense(id), 'Dépense supprimée.') }} /></div>
      </>}
      {tab === 'countries' && <Countries trip={trip} countries={data.countries} expenses={data.expenses} onSave={(country, creating) => perform(() => actions.country(country, creating), 'Étape enregistrée.')} />}
      {tab === 'settings' && <Settings data={data} user={user} online={online} pending={pending || fromCache} onSave={value => perform(() => {
        if (data.countries.some(c => c.startDate < value.startDate || c.startDate > value.endDate || (c.endDate && c.endDate > value.endDate)) || liveExpenses(data.expenses).some(e => e.date < value.startDate || e.date > value.endDate)) throw new Error('Ces dates excluent une étape ou une dépense existante. Choisissez une période qui conserve votre historique.')
        return actions.trip(value)
      }, 'Budget et dates enregistrés.')} onError={setActionError} onConnect={onConnect} />}
      <nav className="bottom-nav" aria-label="Navigation principale">
        <button aria-current={tab === 'home' ? 'page' : undefined} onClick={() => setTab('home')}><span aria-hidden="true">🏠</span>Budget</button>
        <button aria-current={tab === 'countries' ? 'page' : undefined} onClick={() => setTab('countries')}><span aria-hidden="true">🌍</span>Étapes</button>
        <button className="quick-add" onClick={() => { setEditing(null); setTab('home'); requestAnimationFrame(() => document.getElementById('expense-amount')?.focus()) }} aria-label="Ajouter une dépense"><span>＋</span>Dépense</button>
        <button aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => setTab('settings')}><span aria-hidden="true">⚙️</span>Réglages</button>
      </nav>
    </>}
    <footer>Travel App · 0.1.0 bêta · Montants en euros</footer>
  </div>
}

function TripForm({ initial, ownerId, onSave }: { initial?: Trip; ownerId: string; onSave: (value: Trip) => boolean }) {
  const [name, setName] = useState(initial?.name || 'Mon voyage')
  const [budget, setBudget] = useState(initial ? String(initial.budgetCents / 100) : '')
  const [start, setStart] = useState(initial?.startDate || todayISO())
  const [end, setEnd] = useState(initial?.endDate || '')
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const amount = parseMoney(budget)
    if (!name.trim() || !amount || !validPeriod(start, end)) { setError('Indiquez un budget positif et une date de retour égale ou postérieure au départ.'); return }
    setError('')
    onSave({ ...(initial || { id: crypto.randomUUID(), ownerId, memberIds: [ownerId], lastInviteId: '', createdAt: Date.now() }), name: name.trim(), budgetCents: amount, startDate: start, endDate: end })
  }
  return <section className="card"><h2>{initial ? 'Budget et dates du voyage' : 'Préparer mon voyage'}</h2><form onSubmit={submit} className="form-grid">
    <label className="full-width">Nom du voyage<input value={name} onChange={e => setName(e.target.value)} maxLength={100} required /></label>
    <label className="full-width">Budget global sur place (€)<input inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Ex. 12000" required /></label>
    <label>Date de départ<input type="date" value={start} onChange={e => setStart(e.target.value)} required /></label>
    <label>Date de retour<input type="date" min={start} value={end} onChange={e => setEnd(e.target.value)} required /></label>
    <p className="help full-width">Un seul budget pour tout le voyage et tous les compagnons. Les dates restent modifiables.</p>
    {error && <div className="full-width"><Banner error>{error}</Banner></div>}
    <button className="button full-width">{initial ? 'Enregistrer le voyage' : 'Créer mon voyage'}</button>
  </form></section>
}

function Dashboard({ trip, expenses, onConfigure }: { trip: Trip; expenses: Expense[]; onConfigure: () => void }) {
  const stats = budgetStats(trip, expenses)
  const percent = Math.max(0, Math.min(100, stats.spent / trip.budgetCents * 100))
  return <>
    <section className="stats-grid" aria-label="État du budget">
      <div className="stat card"><span>Budget global</span><strong>{money(trip.budgetCents)}</strong><small>Dépenses sur place</small></div>
      <div className="stat card"><span>Dépensé</span><strong className="orange">{money(stats.spent)}</strong><small>{liveExpenses(expenses).length} dépenses</small></div>
      <div className="stat card"><span>Restant</span><strong className={stats.overspending ? 'red' : 'green'}>{money(stats.remaining)}</strong><small>Pour l’ensemble du voyage</small></div>
      <div className="stat card daily"><span>Disponible / jour</span><strong>{stats.dailyAvailableCents === null ? '—' : money(stats.dailyAvailableCents)}</strong><small>{stats.remainingDays ? `${stats.remainingDays} jours restants · aujourd’hui inclus` : stats.dated ? 'Voyage terminé' : 'Dates à compléter'}</small></div>
    </section>
    <section className={`card projection ${stats.atRisk ? 'at-risk' : ''}`}><div className="section-heading"><h2>Le rythme du voyage</h2><span>{Math.round(stats.spent / trip.budgetCents * 100)} % dépensés</span></div><progress value={percent} max="100" aria-label="Part du budget dépensée" />
      {!stats.dated ? <p>Complétez la date de retour pour calculer le budget quotidien. <button className="text-button" onClick={onConfigure}>Définir les dates</button></p> : <div className="rhythm-grid"><div><small>Moyenne depuis le départ</small><strong>{stats.averageCents === null ? '—' : `${money(stats.averageCents)} / jour`}</strong><span>{stats.elapsedDays} jours écoulés</span></div><div><small>{stats.remainingDays ? 'Projection à la fin du voyage' : 'Total de fin de voyage'}</small><strong>{stats.projectedCents === null ? '—' : money(stats.projectedCents)}</strong><span>{stats.elapsedDays ? 'D’après les dépenses enregistrées' : 'Disponible après le départ'}</span></div></div>}
      {stats.atRisk ? <Banner error>{stats.overspending ? `Le budget est dépassé de ${money(-stats.remaining)}.` : `À ce rythme, les dépenses pourraient dépasser le budget de ${money(stats.projectedCents! - trip.budgetCents)}. Le montant disponible par jour vous aide à ajuster la suite.`}</Banner> : stats.elapsedDays > 0 && stats.spent > 0 ? <p className="help green">Votre rythme actuel reste dans le budget.</p> : <p className="help">La projection évoluera avec vos dépenses. Les gros paiements ponctuels peuvent modifier la moyenne.</p>}
    </section>
  </>
}

function ExpenseForm({ trip, countries, userId, editing, onCancel, onSave }: {
  trip: Trip; countries: Country[]; userId: string; editing: Expense | null; onCancel: () => void; onSave: (expense: Expense, creating: boolean) => boolean
}) {
  const sorted = [...countries].sort((a, b) => Number(a.archived) - Number(b.archived) || b.startDate.localeCompare(a.startDate))
  const [amount, setAmount] = useState(editing ? String(editing.amountCents / 100) : '')
  const [countryId, setCountryId] = useState(editing?.countryId || sorted.find(c => c.startDate <= todayISO() && !c.archived)?.id || sorted[0]?.id || '')
  const [category, setCategory] = useState<Category>(editing?.category || 'Repas')
  const [date, setDate] = useState(editing?.date || [todayISO(), trip.endDate || todayISO()].sort()[0])
  const [note, setNote] = useState(editing?.note || '')
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    const cents = parseMoney(amount)
    const selectedId = countryId || sorted[0]?.id
    if (!cents) { setError('Saisissez un montant positif, avec au maximum deux décimales.'); return }
    if (!validPeriod(trip.startDate, trip.endDate) || date < trip.startDate || date > trip.endDate || date > todayISO()) { setError('La date doit être comprise dans le voyage et ne pas être dans le futur.'); return }
    if (!countries.some(c => c.id === selectedId)) { setError('Ajoutez une étape avant de saisir votre dépense.'); return }
    // eslint-disable-next-line react-hooks/purity -- This timestamp is created only by the form submit event, never during render.
    const metadata = editing ? { id: editing.id, createdAt: editing.createdAt, createdBy: editing.createdBy, deleted: editing.deleted } : { id: crypto.randomUUID(), createdAt: Date.now(), createdBy: userId, deleted: false }
    const ok = onSave({ ...metadata, amountCents: cents, category, countryId: selectedId, date, note: note.trim() }, !editing)
    if (ok) { setAmount(''); setNote(''); setError('') }
  }
  return <section className="card" id="expense-form"><div className="section-heading"><h2>{editing ? 'Modifier la dépense' : 'Ajouter une dépense'}</h2><span className="small-pill">EN EUROS</span></div>{!countries.length ? <p className="empty">Ajoutez votre première étape dans l’onglet Étapes pour commencer.</p> : <form onSubmit={submit} className="form-grid">
    <label>Montant (€)<input id="expense-amount" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" autoComplete="off" required /></label>
    <label>Catégorie<select value={category} onChange={e => setCategory(e.target.value as Category)}>{CATEGORIES.map(c => <option key={c.name}>{c.name}</option>)}</select></label>
    <label>Pays / étape<select value={countryId || sorted[0]?.id || ''} onChange={e => setCountryId(e.target.value)}>{sorted.map(c => <option value={c.id} key={c.id}>{c.flag} {c.name}{c.archived ? ' · terminée' : ''}</option>)}</select></label>
    <label>Date de la dépense<input type="date" value={date} min={trip.startDate} max={[todayISO(), trip.endDate || todayISO()].sort()[0]} onChange={e => setDate(e.target.value)} required /></label>
    <label className="full-width">Note (facultative)<input value={note} onChange={e => setNote(e.target.value)} placeholder="Dîner, hôtel, billets de bus…" maxLength={200} /></label>
    {error && <div className="full-width"><Banner error>{error}</Banner></div>}
    <button className="button full-width">{editing ? 'Enregistrer la modification' : 'Enregistrer la dépense'}</button>
    {editing && <button type="button" className="text-button full-width" onClick={onCancel}>Annuler la modification</button>}
  </form>}</section>
}

function Breakdown({ expenses }: { expenses: Expense[] }) {
  const breakdown = categoryBreakdown(expenses)
  return <section className="card"><h2>Où passe le budget ?</h2><div className="breakdown"><div className="donut" role="img" aria-label={`Répartition de ${money(breakdown.spent)} par catégorie`} style={{ background: breakdown.gradient }}><div><strong>{money(breakdown.spent)}</strong><small>sur place</small></div></div><ul>{breakdown.items.map(c => <li key={c.name}><span className="color-dot" style={{ background: c.color }} /><span>{c.icon} {c.name}</span><strong>{money(c.total)}</strong><small>{Math.round(c.percent)} %</small></li>)}</ul></div></section>
}

function ExpenseList({ expenses, countries, onEdit, onDelete }: { expenses: Expense[]; countries: Country[]; onEdit: (expense: Expense) => void; onDelete: (id: string) => void }) {
  const [country, setCountry] = useState('')
  const [category, setCategory] = useState('')
  const [limit, setLimit] = useState(20)
  const filtered = liveExpenses(expenses).filter(e => (!country || e.countryId === country) && (!category || e.category === category)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt || a.id.localeCompare(b.id))
  return <section className="card"><div className="section-heading"><h2>Vos dépenses</h2><span>{filtered.length}</span></div><div className="form-grid filters"><label>Filtrer par étape<select value={country} onChange={e => setCountry(e.target.value)}><option value="">Toutes les étapes</option>{countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Filtrer par catégorie<select value={category} onChange={e => setCategory(e.target.value)}><option value="">Toutes les catégories</option>{CATEGORIES.map(c => <option key={c.name}>{c.name}</option>)}</select></label></div>
    {!filtered.length && <p className="empty">Aucune dépense{expenses.length ? ' pour ces filtres' : ' pour le moment'}. Le prochain repas sera peut-être la première !</p>}
    <ul className="expense-list">{filtered.slice(0, limit).map(e => <li key={e.id}><span className="expense-icon">{CATEGORIES.find(c => c.name === e.category)?.icon}</span><div className="expense-detail"><strong>{e.note || e.category}</strong><small>{shortDate(e.date)} · {countries.find(c => c.id === e.countryId)?.name || 'Étape'} · {e.category}</small></div><div className="expense-actions"><strong>{money(e.amountCents)}</strong><div><button className="text-button" aria-label={`Modifier ${e.note || e.category}`} onClick={() => onEdit(e)}>Modifier</button><button className="text-button red" aria-label={`Supprimer ${e.note || e.category}`} onClick={() => onDelete(e.id)}>Supprimer</button></div></div></li>)}</ul>
    {filtered.length > limit && <button className="button secondary" onClick={() => setLimit(limit + 20)}>Voir les dépenses suivantes</button>}
  </section>
}

function Countries({ trip, countries, expenses, onSave }: { trip: Trip; countries: Country[]; expenses: Expense[]; onSave: (country: Country, creating: boolean) => boolean }) {
  const [name, setName] = useState('')
  const [flag, setFlag] = useState('🌍')
  const [start, setStart] = useState([todayISO(), trip.startDate].sort().at(-1)!)
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || !validPeriod(trip.startDate, trip.endDate) || start < trip.startDate || start > trip.endDate) { setError('Complétez les dates du voyage et choisissez une date d’étape comprise dans cette période.'); return }
    if (onSave({ id: crypto.randomUUID(), name: name.trim(), flag: flag || '🌍', startDate: start, endDate: '', archived: false, createdAt: Date.now() }, true)) { setName(''); setError('') }
  }
  return <><section className="welcome"><span className="eyebrow">LE PARCOURS</span><h1>Vos étapes, vos souvenirs.</h1><p>Les dépenses sont regroupées par pays. Votre budget reste global.</p></section><div className="two-column"><section className="card"><h2>Ajouter une étape</h2><form className="form-grid" onSubmit={submit}><label>Pays / ville<input value={name} onChange={e => setName(e.target.value)} placeholder="Thaïlande, Chiang Mai…" required maxLength={80} /></label><label>Drapeau<input value={flag} onChange={e => setFlag(e.target.value)} maxLength={16} /></label><label className="full-width">Début de l’étape<input type="date" value={start} min={trip.startDate} max={trip.endDate || undefined} onChange={e => setStart(e.target.value)} required /></label>{error && <div className="full-width"><Banner error>{error}</Banner></div>}<button className="button full-width">Créer l’étape</button></form></section><div>
    {!countries.length && <section className="card empty">Aucune étape pour le moment. Ajoutez votre premier pays.</section>}
    {[...countries].sort((a, b) => Number(a.archived) - Number(b.archived) || b.startDate.localeCompare(a.startDate)).map(c => {
      const spent = totalSpent(expenses.filter(e => e.countryId === c.id))
      const lastDay = [c.endDate || todayISO(), todayISO(), trip.endDate || todayISO()].sort()[0]
      const days = daysInclusive(c.startDate, lastDay)
      const endDate = [todayISO(), trip.endDate || todayISO()].sort()[0]
      return <section className="card country-card" key={c.id}><div className="section-heading"><div><span className="country-flag">{c.flag}</span><h2>{c.name}</h2></div><span className="small-pill">{c.archived ? 'TERMINÉE' : c.startDate > todayISO() ? 'À VENIR' : 'EN COURS'}</span></div><p className="help">{shortDate(c.startDate)} → {c.endDate ? shortDate(c.endDate) : 'En cours'}</p><div className="country-totals"><strong>{money(spent)}</strong><span>{days ? `${money(Math.round(spent / days))} / jour · ${days} jours` : 'Étape à venir'}</span></div><button className="button secondary" disabled={!c.archived && endDate < c.startDate} onClick={() => onSave({ ...c, archived: !c.archived, endDate: c.archived ? '' : endDate }, false)}>{c.archived ? 'Rouvrir cette étape' : 'Terminer cette étape'}</button><small className="help">L’historique des dépenses est conservé.</small></section>
    })}
  </div></div></>
}

function Settings({ data, user, online, pending, onSave, onError, onConnect }: { data: TravelData; user: User | null; online: boolean; pending: boolean; onSave: (trip: Trip) => boolean; onError: (error: string) => void; onConnect?: () => void }) {
  const [invite, setInvite] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [feedbackBusy, setFeedbackBusy] = useState(false)
  const [message, setMessage] = useState('')
  const trip = data.trip!
  async function generateInvite() {
    setInviteBusy(true)
    try { setInvite(`${location.origin}${location.pathname}#invite=${await createInvite(trip, user!.uid)}`) }
    catch (e) { onError(errorMessage(e)) }
    finally { setInviteBusy(false) }
  }
  async function feedbackSubmit(event: FormEvent) {
    event.preventDefault(); setFeedbackBusy(true)
    try {
      if (feedback.trim().length < 5) throw new Error('Décrivez votre retour en au moins 5 caractères.')
      if (user) { await sendFeedback(user.uid, feedback.trim()); setMessage('Merci ! Votre retour a été enregistré.'); setFeedback('') }
      else { downloadFile(`Travel App 0.1.0 bêta\n\n${feedback.trim()}`, 'retour-travel-app.txt'); setMessage('Votre retour est prêt à être partagé.') }
    } catch (e) { onError(errorMessage(e)) }
    finally { setFeedbackBusy(false) }
  }
  return <><section className="welcome"><span className="eyebrow">LES RÉGLAGES</span><h1>Un budget qui vous suit.</h1></section><div className="two-column"><div><TripForm key={trip.id} initial={trip} ownerId={trip.ownerId} onSave={onSave} /><section className="card"><h2>Sauvegarder mes données</h2><p className="help">Une copie du voyage, des étapes et des dépenses au format JSON.</p><button className="button secondary" onClick={() => exportJSON(data)}>Exporter ma sauvegarde</button>{!user && <><label className="import-label">Restaurer une sauvegarde<input type="file" accept=".json,application/json" onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return
      try {
        if (file.size > 10_000_000) throw new Error('Cette sauvegarde est trop volumineuse (maximum 10 Mo).')
        const restored = readBackup(JSON.parse(await file.text()))
        if (!window.confirm('Remplacer les données de cet appareil par cette sauvegarde ? Exportez d’abord votre voyage actuel.')) return
        saveLocalData({ ...restored, trip: restored.trip ? { ...restored.trip, ownerId: 'local', memberIds: ['local'], lastInviteId: '' } : null })
        setMessage('Sauvegarde restaurée sur cet appareil.')
      } catch (error) { onError(errorMessage(error)) }
      finally { e.target.value = '' }
    }} /></label><p className="help">Les données de l’ancienne version restent conservées sur cet appareil. Une restauration ne modifie aucun voyage partagé.</p></>}</section></div><div>
    <section className="card"><h2>Voyager ensemble</h2>{user ? <><p>{user.email}</p><p className="help">{trip.memberIds.length} compagnon{trip.memberIds.length > 1 ? 's' : ''}, vous compris. Les membres de ce voyage peuvent consulter et modifier les dépenses.</p>{trip.ownerId === user.uid ? <><button className="button secondary" disabled={!online || inviteBusy} onClick={() => void generateInvite()}>{inviteBusy ? 'Création…' : 'Créer une invitation'}</button>{invite && <div className="invite-result"><label>Lien à partager<input readOnly value={invite} onFocus={e => e.target.select()} /></label><button className="text-button" onClick={() => void navigator.clipboard.writeText(invite).then(() => setMessage('Lien copié.')).catch(() => setMessage('Sélectionnez le lien pour le copier.'))}>Copier le lien</button><small>Valable 6 jours, pour un seul compagnon. Créez un nouveau lien pour chaque personne.</small></div>}</> : <p className="help">Le créateur du voyage peut inviter d’autres compagnons.</p>}<button className="text-button logout" disabled={!online || pending} onClick={() => {
      if (window.confirm('Se déconnecter ? Vérifiez que le statut indique « Synchronisé » avant de changer de compte.')) void signOut(auth!).catch(e => onError(errorMessage(e)))
    }}>Se déconnecter</button>{pending && <p className="help">La déconnexion sera disponible après la synchronisation de vos données.</p>}</> : <><p className="help">Ce voyage est actuellement enregistré sur cet appareil. Exportez-le avant de changer de téléphone.</p>{cloudEnabled ? <button className="button secondary" onClick={onConnect}>Se connecter pour partager</button> : <p className="help">La connexion et les invitations seront disponibles dans la version connectée.</p>}</>}</section>
    <section className="card"><h2>Votre avis fait voyager l’app</h2><p className="help">Un bug, une idée ou quelque chose qui manque ? Aucun montant de votre budget n’est ajouté à votre retour.</p><form onSubmit={feedbackSubmit}><label>Votre retour<textarea value={feedback} onChange={e => setFeedback(e.target.value)} minLength={5} maxLength={3000} rows={4} required placeholder="Ce qui s’est passé, ce que vous attendiez…" /></label><button className="button secondary" disabled={feedbackBusy || (!!user && !online)}>{feedbackBusy ? 'Envoi…' : user ? 'Envoyer mon retour' : 'Télécharger mon retour'}</button></form></section>
    {message && <Banner>{message}</Banner>}
  </div></div></>
}

function AuthScreen({ onClose }: { onClose: () => void }) {
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (register) { const credential = await createUserWithEmailAndPassword(auth!, email.trim(), password); await updateProfile(credential.user, { displayName: name.trim() }) }
      else await signInWithEmailAndPassword(auth!, email.trim(), password)
      onClose()
    } catch (e) { setError(errorMessage(e)) }
    finally { setBusy(false) }
  }
  return <div className="app-shell auth-shell"><Brand /><section className="welcome"><span className="eyebrow">VOTRE VOYAGE, ENSEMBLE</span><h1>{register ? 'Prêt à prendre le départ ?' : 'Heureux de vous retrouver.'}</h1><p>Un compte personnel, un budget privé, vos compagnons sur invitation.</p>{invitationCode() && <p className="help">Connectez-vous pour accepter l’invitation que vous avez reçue.</p>}</section><section className="card"><h2>{register ? 'Créer un compte' : 'Se connecter'}</h2><form onSubmit={submit} className="form-grid">{register && <label className="full-width">Prénom<input value={name} onChange={e => setName(e.target.value)} maxLength={60} autoComplete="given-name" required /></label>}<label className="full-width">Adresse email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label><label className="full-width">Mot de passe<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={register ? 8 : 1} autoComplete={register ? 'new-password' : 'current-password'} required /></label>{error && <div className="full-width"><Banner error>{error}</Banner></div>}{message && <div className="full-width"><Banner>{message}</Banner></div>}<button className="button full-width" disabled={busy}>{busy ? 'Connexion…' : register ? 'Créer mon compte' : 'Connexion'}</button></form><button className="text-button" onClick={() => { setRegister(!register); setError('') }}>{register ? 'J’ai déjà un compte' : 'Créer un compte'}</button>{!register && <button className="text-button" disabled={busy} onClick={async () => {
      if (!email.trim()) { setError('Saisissez votre adresse email pour réinitialiser le mot de passe.'); return }
      setBusy(true)
      try { await sendPasswordResetEmail(auth!, email.trim()); setMessage('Si cette adresse possède un compte, un email de réinitialisation a été envoyé.') }
      catch (e) { setError(errorMessage(e)) }
      finally { setBusy(false) }
    }}>Mot de passe oublié</button>}</section><button className="text-button" onClick={onClose}>Revenir au voyage sur cet appareil</button><p className="footnote">Connectez-vous sur votre appareil personnel : vos données y seront conservées pour fonctionner hors connexion.</p></div>
}
