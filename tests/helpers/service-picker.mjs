export async function chooseService(page, id) {
  await page.getByRole('button', { name: 'Servicio', exact: true }).click()
  await page.locator(`[role="option"][data-service-id="${id}"]`).click()
  await page.getByRole('dialog', { name: 'Elige tu servicio', exact: true }).waitFor({ state: 'hidden' })
}
