import { expect, test, type Page } from '@playwright/test';

const handCards = (page: Page) => page.locator('.hand button.card');

async function startGame(
  page: Page,
  opts: { opponent?: RegExp; level?: RegExp; first?: RegExp } = {},
) {
  await page.goto('/?seed=7&fast=1&lang=en');
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

  // On phones the log lives behind the Chronicle button.
  if ((page.viewportSize()?.width ?? 0) <= 760) {
    await page.getByRole('button', { name: 'Chronicle' }).click();
  }
  const log = page.getByRole('region', { name: 'Game log' }).locator('li');
  await expect(log.filter({ hasText: 'You played' })).toHaveCount(1);
  await expect(log.filter({ hasText: 'Opponent played' })).toHaveCount(1);
  await expect(page.getByTestId('house-4').locator('.house__side--mine .card')).toHaveCount(1);
  await expect(handCards(page)).toHaveCount(7); // played one, drew one
});

test('supports keyboard play: Enter selects a card, digits pick the house', async ({ page }) => {
  await startGame(page, { first: /^You$/ });
  // Cards can't be played until the opening deal is finished.
  await expect(page.locator('.hand:not(.is-disabled) button.card')).toHaveCount(7);
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
  // Won houses keep no winner label; only the winner's side of the column is coloured.
  const won = page.locator('.house[data-claim="viewer"], .house[data-claim="opponent"]').first();
  await expect(won).toBeVisible();
  await expect(page.locator('.house__pledge')).toHaveCount(0);
  const claim = await won.getAttribute('data-claim');
  const winnerSide = won.locator(claim === 'viewer' ? '.house__side--mine' : '.house__side--opp');
  const loserSide = won.locator(claim === 'viewer' ? '.house__side--opp' : '.house__side--mine');
  const bg = (l: typeof won) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await bg(loserSide)).toBe('rgba(0, 0, 0, 0)');
  expect(await bg(winnerSide)).not.toBe('rgba(0, 0, 0, 0)');
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
  // Default game has no wildcards: 52 cards, 7 in each hand, 38 to draw.
  await page.getByRole('button', { name: /Draw pile, 38 cards/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Unseen cards (45)' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.mini-card:not(.is-gone)')).toHaveCount(45);
  await expect(dialog).not.toContainText('Joker');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

test('starts with the No wildcards variant on and No Same Colour off', async ({ page }) => {
  await page.goto('/?seed=7&fast=1&lang=en');
  await page.getByText('Variants').click();
  await expect(page.getByRole('checkbox', { name: /No Same Colour level/ })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /No wildcards/ })).toBeChecked();
});

test('jokers are dealt when the No wildcards variant is switched off', async ({ page }) => {
  await page.goto('/?seed=7&fast=1&lang=en');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByText('Variants').click();
  await page.getByRole('checkbox', { name: /No wildcards/ }).uncheck();
  await page.getByRole('group', { name: 'First move' }).getByText(/^You$/).click();
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(handCards(page).filter({ hasText: 'Joker' })).toHaveCount(1);
});

test('highlighting playable houses never changes the size of the board', async ({ page }) => {
  await startGame(page, { first: /^You$/ });
  await expect(handCards(page)).toHaveCount(7);
  const board = page.getByRole('region', { name: 'Noble houses' }).or(page.locator('.board'));
  const before = await board.boundingBox();
  await handCards(page).first().click();
  await expect(page.locator('.house.is-playable')).toHaveCount(9);
  const after = await board.boundingBox();
  expect(after?.height).toBeCloseTo(before!.height, 0);
  expect(after?.width).toBeCloseTo(before!.width, 0);
  await expect(page.locator('.slot')).toHaveCount(0);
});

test('shows a level tug-of-war bar and no house names at the start', async ({ page }) => {
  await startGame(page, { first: /^You$/ });
  const meter = page.getByRole('meter', { name: 'Houses won' });
  await expect(meter).toHaveAttribute('aria-valuenow', '0');
  await expect(meter).toHaveAttribute('aria-valuetext', 'Level, 0 houses each');
  await expect(page.locator('.house__tier').filter({ hasText: /\d\/3/ })).toHaveCount(0);
  await expect(page.locator('.seat--opponent .card-back')).toHaveCount(0);
  await expect(page.locator('.house__number')).toHaveCount(0);
});

test('speaks Serbian by default and switches language with the flags', async ({ page }) => {
  await page.goto('/?seed=7&fast=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'sr');
  await expect(page.getByRole('button', { name: 'Počni' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Srpski' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // The choice is remembered.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible();
  await page.getByRole('button', { name: 'Srpski' }).click();
  await page.getByRole('button', { name: 'Počni' }).click();
  await expect(page.getByRole('status')).toHaveText(/Izaberi kartu za igru|Protivnik razmišlja/);
});

test('picks the difficulty with a slider', async ({ page }) => {
  await page.goto('/?seed=7&fast=1&lang=en');
  const slider = page.getByRole('slider', { name: 'Difficulty' });
  await expect(slider).toHaveAttribute('aria-valuetext', 'Knight, Normal');
  await slider.fill('2');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Chancellor, Hard');
  await page.getByRole('button', { name: 'Squire' }).click();
  await expect(slider).toHaveValue('0');
});

test('centres the tug-of-war bar on phones, with the names above it', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) > 760, 'portrait layout only');
  await startGame(page, { first: /^You$/ });
  const track = await page.locator('.tug__track').boundingBox();
  const viewport = page.viewportSize()!;
  const trackCentre = track!.x + track!.width / 2;
  expect(Math.abs(trackCentre - viewport.width / 2)).toBeLessThan(2);
  const name = await page.locator('.tug__side--viewer .tug__name').boundingBox();
  expect(name!.y + name!.height).toBeLessThanOrEqual(track!.y);
});

test('rates completed alliances with stars and has a sound switch', async ({ page }) => {
  await startGame(page, { first: /^You$/ });
  await page.getByRole('button', { name: 'Sound' }).click();
  await expect(page.getByRole('button', { name: 'Sound' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  // Play until some alliance is complete, then check its star rating.
  const stars = page.locator('.house__tier .stars');
  for (let i = 0; i < 20 && (await stars.count()) === 0; i++) await playFirstCard(page);
  await expect(stars.first()).toBeVisible();
  await expect(stars.first().locator('span')).toHaveCount(6);
  await expect(stars.first()).toHaveAttribute('aria-label', /, \d of 6 stars$/);
});

test('deals the opening hand one card at a time before anyone can play', async ({ page }) => {
  // Without ?fast=1 the deal is slow enough to observe.
  await page.goto('/?seed=7&lang=en');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('group', { name: 'First move' }).getByText(/^You$/).click();
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('status')).toHaveText('Dealing the cards…');
  expect(await handCards(page).count()).toBeLessThan(7);
  await expect(page.getByRole('status')).toHaveText('Choose a card to play');
  await expect(page.locator('.hand:not(.is-disabled) button.card')).toHaveCount(7);
});

test.describe('tutorial', () => {
  test('is suggested on the first visit, plays through to the win and explains 9 houses', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto('/?fast=1&lang=en');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByText('New here? Start with the tutorial.')).toBeVisible();
    await page.getByRole('button', { name: 'Tutorial' }).click();

    const coach = page.getByTestId('coach').filter({ visible: true });
    const isPhone = (page.viewportSize()?.width ?? 0) <= 760;
    if (isPhone) await expect(page.getByTestId('coach-combos')).toHaveCount(0);
    await expect(page.locator('.house')).toHaveCount(5);

    const playGame = page.getByRole('button', { name: 'Play a game' });
    for (let i = 0; i < 60 && !(await playGame.isVisible()); i++) {
      const next = coach.getByRole('button', { name: 'Next' });
      const playable = page.locator('.hand:not(.is-disabled) button.card:not(.is-dimmed)');
      await Promise.race([
        next.waitFor().catch(() => {}),
        playable
          .first()
          .waitFor()
          .catch(() => {}),
        playGame.waitFor().catch(() => {}),
      ]);
      if (await playGame.isVisible()) break;
      if (await next.isVisible()) {
        if (isPhone && (await coach.textContent())?.includes('These are the combinations')) {
          await expect(page.getByTestId('coach-combos').locator('tr')).toHaveCount(7);
        }
        await next.click();
        continue;
      }
      if ((await playable.count()) === 1) {
        // Only the expected card can be picked, and only one house accepts it.
        await expect(page.locator('.hand button.card.is-dimmed')).not.toHaveCount(0);
        await playable.click();
        await expect(page.locator('.house__hit')).toHaveCount(1);
        if (isPhone && (await coach.textContent())?.includes('Straight Flush (a run')) {
          await expect(page.getByTestId('coach-combos').locator('tr')).toHaveCount(2);
        }
        await page.locator('.house__hit').click();
      }
    }
    await expect(coach).toContainText('9 houses');
    await expect(page.locator('.house.is-winning')).toHaveCount(3);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(page.getByText('New here? Start with the tutorial.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Tutorial' })).toBeVisible();
  });

  test('can be skipped', async ({ page }) => {
    await page.goto('/?fast=1&lang=en');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Tutorial' }).click();
    await page.getByRole('button', { name: 'Skip tutorial' }).click();
    await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible();
  });
});

test('menu, game and tutorial fit on one screen without scrolling', async ({ page }) => {
  const fits = async (where: string) => {
    const o = await page.evaluate(() => ({
      y: document.documentElement.scrollHeight - innerHeight,
      x: document.documentElement.scrollWidth - innerWidth,
    }));
    expect(o, where).toEqual({ y: 0, x: 0 });
  };
  await page.goto('/?seed=7&fast=1&lang=en');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await fits('menu');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.locator('.house')).toHaveCount(9);
  await fits('game');
  await page.goto('/?fast=1&lang=en');
  await page.getByRole('button', { name: 'Tutorial' }).first().click();
  await expect(page.getByTestId('coach').filter({ visible: true })).toBeVisible();
  await fits('tutorial');
});

test('combinations are always on screen on wide windows and behind a button on phones', async ({
  page,
}) => {
  await startGame(page, { first: /^You$/ });
  const isPhone = (page.viewportSize()?.width ?? 0) <= 760;
  const panel = page.locator('.game__combos');
  if (isPhone) {
    await expect(panel).toBeHidden();
    await page.getByRole('button', { name: 'Combinations' }).click();
    await expect(page.getByRole('dialog', { name: 'Combinations' }).locator('tr')).toHaveCount(7);
  } else {
    await expect(panel.locator('tr')).toHaveCount(7);
  }
});
