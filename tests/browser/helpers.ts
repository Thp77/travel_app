import { expect, type Page } from '@playwright/test'
export function dateOffset(days: number) {
  const date = new Date(); date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export async function setupTrip(page: Page) {
  await page.getByLabel('Nom du voyage', { exact: true }).fill('Voyage test')
  await page.getByLabel('Budget global sur place (€)').fill('1000')
  await page.getByLabel('Date de départ', { exact: true }).fill(dateOffset(-9))
  await page.getByLabel('Date de retour', { exact: true }).fill(dateOffset(20))
  await page.getByRole('button', { name: 'Créer mon voyage', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
  await page.getByRole('button', { name: 'Étapes', exact: true }).click()
  await page.getByLabel('Pays / ville').fill('Thaïlande')
  await page.getByLabel('Drapeau', { exact: true }).fill('🇹🇭')
  await page.getByLabel('Début de l’étape').fill(dateOffset(-9))
  await page.getByRole('button', { name: 'Créer l’étape', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Thaïlande', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Budget', exact: true }).click()
}
export async function addExpense(page: Page, amount: string, note: string, category = 'Repas') {
  await page.getByLabel('Montant (€)', { exact: true }).fill(amount)
  await page.getByRole('combobox', { name: 'Catégorie', exact: true }).selectOption(category)
  await page.getByLabel('Note (facultative)').fill(note)
  await page.getByRole('button', { name: 'Enregistrer la dépense', exact: true }).click()
  await expect(page.locator('.expense-list').getByText(note, { exact: true })).toBeVisible()
}
export async function register(page: Page, email: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await page.getByRole('button', { name: 'Créer un compte', exact: true }).click()
  await page.getByLabel('Prénom', { exact: true }).fill('Testeur')
  await page.getByLabel('Adresse email').fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill('test-password-2026')
  await page.getByRole('button', { name: 'Créer mon compte', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Créer mon voyage', exact: true })).toBeVisible()
}
