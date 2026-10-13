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
  // Won houses are coloured by their winner.
  await expect(page.locator('.house[data-seat]').first()).toBeVisible();
});

const RANKS = [
  'Ace',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Jack',
  'Queen',
  'King',
];
const SUITS = ['Spades', 'Clubs', 'Hearts', 'Diamonds'];
/** Sort key of an aria-label such as "Queen of Hearts": rank, then colour and suit; jokers last. */
const sortKey = (label: string) => {
  if (label === 'Joker') return 1000;
  const [rank, , suit] = label.split(' ');
  return RANKS.indexOf(rank!) * 4 + SUITS.indexOf(suit!);
};

test('keeps the hand sorted by rank, colour and suit', async ({ page }) => {
  await startGame(page, { first: /^You$/ });
  await expect(handCards(page)).toHaveCount(7);
  for (let i = 0; i < 3; i++) {
    const labels = await handCards(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('aria-label') ?? ''),
    );
    const keys = labels.map(sortKey);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
    await playFirstCard(page);
    await expect(handCards(page)).toHaveCount(7);
  }
});

test('the deck shows every card not on the table or in your hand', async ({ page }) => {
  await startGame(page, { first: /^You$/ });
  await expect(handCards(page)).toHaveCount(7);
  await page.getByRole('button', { name: /Draw pile, 40 cards/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Unseen cards (47)' });
  await expect(dialog).toBeVisible();
  // 46 naturals are shown face up; the opponent's joker is mentioned below the grid.
  await expect(dialog.locator('.mini-card:not(.is-gone)')).toHaveCount(46);
  await expect(dialog).toContainText('The opponent still holds their Joker.');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

test('offers the optional variants switched off, so the standard game is the default', async ({
  page,
}) => {
  await page.goto('/?seed=7&fast=1');
  await page.getByText('Variants').click();
  await expect(page.getByRole('checkbox', { name: /No Motive tier/ })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /No wildcards/ })).not.toBeChecked();
});

test('shows a level tug-of-war bar and no house names at the start', async ({ page }) => {
  await startGame(page, { first: /^You$/ });
  const meter = page.getByRole('meter', { name: 'Houses won' });
  await expect(meter).toHaveAttribute('aria-valuenow', '0');
  await expect(meter).toHaveAttribute('aria-valuetext', 'Level, 0 houses each');
  await expect(page.locator('.house__tier').filter({ hasText: /\d\/3/ })).toHaveCount(0);
  await expect(page.locator('.seat--opponent .card-back')).toHaveCount(0);
});
