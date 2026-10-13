import { expect, test, type Page } from '@playwright/test';

const handCards = (page: Page) => page.locator('.hand button.card');

async function startGame(
  page: Page,
  opts: { opponent?: RegExp; level?: RegExp; first?: RegExp } = {},
) {
  await page.goto('/?seed=7&fast=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  if (opts.opponent) await page.getByText(opts.opponent).click();
  if (opts.level) await page.getByText(opts.level).click();
  if (opts.first)
    await page.getByRole('group', { name: 'First move' }).getByText(opts.first).click();
  await page.getByRole('button', { name: 'Begin' }).click();
}

/** Play the first card in hand to the first house that accepts it. */
async function playFirstCard(page: Page) {
  await expect(page.locator('.hand:not(.is-disabled) button.card').first()).toBeVisible();
  await handCards(page).first().click();
  await page.locator('.house__hit').first().click();
}

test('plays a card against the computer, which answers', async ({ page }) => {
  await startGame(page, { first: /^You$/ });
  await expect(page.getByRole('status')).toHaveText('Choose a card to play');
  await expect(handCards(page)).toHaveCount(7);

  await handCards(page).first().click();
  await expect(page.locator('.house.is-playable')).toHaveCount(9);
  await page.locator('.house__hit').nth(4).click();

  const log = page.getByRole('region', { name: 'Game log' }).locator('li');
  await expect(log.filter({ hasText: 'You played' })).toHaveCount(1);
  await expect(log.filter({ hasText: 'Opponent played' })).toHaveCount(1);
  await expect(page.getByTestId('house-4').locator('.house__side--mine .card')).toHaveCount(1);
  await expect(handCards(page)).toHaveCount(7); // played one, drew one
});

test('supports keyboard play: Enter selects a card, digits pick the house', async ({ page }) => {
  await startGame(page, { first: /^You$/ });
  await handCards(page).first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Choose a house');
  await page.keyboard.press('3');
  await expect(page.getByTestId('house-2').locator('.house__side--mine .card')).toHaveCount(1);
});

test('hot-seat hides each hand behind a hand-off screen', async ({ page }) => {
  await startGame(page, { opponent: /A friend on this device/, first: /Player 1/ });
  const handOff = page.getByRole('dialog', { name: /Pass the device to Player 1/ });
  await expect(handOff).toBeVisible();
  await expect(handCards(page)).toHaveCount(0);
  await page.getByRole('button', { name: /show my hand/ }).click();

  await playFirstCard(page);
  await expect(page.getByRole('dialog', { name: /Pass the device to Player 2/ })).toBeVisible();
  await expect(handCards(page)).toHaveCount(0);
  await page.getByRole('button', { name: /show my hand/ }).click();
  await expect(handCards(page)).toHaveCount(7);
});

test('a full game against the easy computer ends with a winner', async ({ page }) => {
  test.setTimeout(120_000);
  await startGame(page, { level: /Squire/, first: /^You$/ });
  const result = page.getByRole('dialog', { name: /wins?!$/ });
  for (let i = 0; i < 30 && !(await result.isVisible()); i++) {
    const ready = page.locator('.hand:not(.is-disabled) button.card').first();
    await Promise.race([ready.waitFor(), result.waitFor()]);
    if (await result.isVisible()) break;
    await playFirstCard(page);
  }
  await expect(result).toBeVisible();
  await expect(page.locator('.house.is-winning').first()).toBeVisible();
});
