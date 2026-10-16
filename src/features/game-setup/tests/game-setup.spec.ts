import { expect, test, type Page } from '@playwright/test';

async function openControlledGame(page: Page, values: readonly number[]): Promise<void> {
  await page.addInitScript(
    (scriptedValues: number[]) => {
      Reflect.set(window, '__gameSetupRandomValues', scriptedValues);
    },
    [...values],
  );
  await page.goto('/__fixtures__/game-setup/');
  await expect(page.locator('canvas')).toHaveAttribute('data-rendered-revision', '1');
}

async function expectLayout(
  page: Page,
  revision: number,
  ship1: string,
  ship2: string,
): Promise<void> {
  await expect(page.locator('#ship-1-position')).toHaveText(ship1);
  await expect(page.locator('#ship-2-position')).toHaveText(ship2);
  await expect(page.locator('canvas')).toHaveAttribute('data-rendered-revision', String(revision));
  await expect(page.getByRole('status')).toHaveText(`Game ${revision} ready`);
}

async function getConsumedDraws(page: Page): Promise<number> {
  return page.evaluate(() => {
    const hooks = Reflect.get(window, '__gameSetupTestHooks');
    const getConsumedDraws = hooks && Reflect.get(hooks, 'getConsumedDraws');
    if (typeof getConsumedDraws !== 'function') {
      throw new Error('The fixture did not expose its scripted draw count.');
    }

    return getConsumedDraws.call(hooks) as number;
  });
}

test('US1 shows the supplied board, two labeled ships, and a rendered revision', async ({
  page,
}) => {
  await page.goto('/__fixtures__/game-setup/');
  await expect(page.locator('.game-shell')).toBeVisible();

  const canvas = page.locator('canvas[aria-describedby="board-description ship-summary"]');

  await expect(canvas).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'New Game' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Game' })).toBeEnabled();
  await expect(page.locator('#board-description')).toContainText('10 × 10');
  await expect(page.locator('#ship-1-position')).toHaveText('Ship 1 — row 1, column 1');
  await expect(page.locator('#ship-2-position')).toHaveText('Ship 2 — row 10, column 10');
  await expect(page.getByRole('status')).toHaveText('Game 1 ready');
  await expect(canvas).toHaveAttribute('data-rendered-revision', '1');
  await expect(canvas).toHaveScreenshot('us1-known-layout.png', {
    animations: 'disabled',
  });
});

test('US1 remains stable over 20 observations and fits a 360px viewport', async ({ page }) => {
  await page.goto('/__fixtures__/game-setup/');
  await expect(page.locator('.game-shell')).toBeVisible();

  const ship1 = page.locator('#ship-1-position');
  const ship2 = page.locator('#ship-2-position');
  const status = page.getByRole('status');

  for (let observation = 0; observation < 20; observation += 1) {
    await expect(ship1).toHaveText('Ship 1 — row 1, column 1');
    await expect(ship2).toHaveText('Ship 2 — row 10, column 10');
    await expect(status).toHaveText('Game 1 ready');
    await expect(page.locator('canvas')).toHaveCount(1);

    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  }

  await page.setViewportSize({ width: 360, height: 800 });
  await expect(ship1).toHaveText('Ship 1 — row 1, column 1');
  await expect(ship2).toHaveText('Ship 2 — row 10, column 10');

  const canvasBounds = await page.locator('canvas').boundingBox();
  if (!canvasBounds) {
    throw new Error('Expected a rendered board canvas after resize.');
  }
  expect(canvasBounds.width).toBeLessThanOrEqual(360);
});

test('US1 reports the documented error when WebGL initialization is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => null,
    });
  });

  await page.goto('/');
  await expect(
    page.getByText('Unable to start the game. Check that WebGL is available and reload the page.'),
  ).toBeVisible();
  await expect(page.getByRole('status')).not.toHaveText('Game 1 ready');
});

test('US2 initializes from scripted positions and publishes one synchronized pointer replacement', async ({
  page,
}) => {
  await openControlledGame(page, [0.01, 0.21, 0.61, 0.91]);
  await expectLayout(page, 1, 'Ship 1 — row 1, column 1', 'Ship 2 — row 9, column 5');

  const newGameButton = page.getByRole('button', { name: 'New Game' });
  await newGameButton.click();

  await expectLayout(page, 2, 'Ship 1 — row 2, column 3', 'Ship 2 — row 10, column 9');
  await expect(newGameButton).toBeFocused();
});

test('US2 supports Enter and Space activation with one ready revision per activation', async ({
  page,
}) => {
  await openControlledGame(page, [0.01, 0.21, 0.31, 0.51, 0.71, 0.11]);
  const newGameButton = page.getByRole('button', { name: 'New Game' });
  await newGameButton.focus();

  await page.keyboard.press('Enter');
  await expectLayout(page, 2, 'Ship 1 — row 1, column 7', 'Ship 2 — row 10, column 1');
  await expect(newGameButton).toBeFocused();

  await page.keyboard.press('Space');
  await expectLayout(page, 3, 'Ship 1 — row 2, column 5', 'Ship 2 — row 9, column 3');
  await expect(newGameButton).toBeFocused();
});

test('US2 accepts opposite-zone corner pairs, including matching columns', async ({ page }) => {
  const lastValueBelowOne = 1 - Number.EPSILON / 2;
  await openControlledGame(page, [0, 0, lastValueBelowOne, lastValueBelowOne]);
  await expectLayout(page, 1, 'Ship 1 — row 1, column 1', 'Ship 2 — row 9, column 1');

  await page.getByRole('button', { name: 'New Game' }).click();

  await expectLayout(page, 2, 'Ship 1 — row 2, column 10', 'Ship 2 — row 10, column 10');
});

test('US2 announces an identical layout as a new game revision', async ({ page }) => {
  await openControlledGame(page, [0.01, 0.21, 0.01, 0.21]);
  await expectLayout(page, 1, 'Ship 1 — row 1, column 1', 'Ship 2 — row 9, column 5');

  await page.getByRole('button', { name: 'New Game' }).click();

  await expectLayout(page, 2, 'Ship 1 — row 1, column 1', 'Ship 2 — row 9, column 5');
});

test('US2 retains the current layout on replacement failure and recovers on the next activation', async ({
  page,
}) => {
  await openControlledGame(page, [0.01, 0.21, 0.4, 1, 0.99, 0.99]);
  await expectLayout(page, 1, 'Ship 1 — row 1, column 1', 'Ship 2 — row 9, column 5');

  const newGameButton = page.getByRole('button', { name: 'New Game' });
  await newGameButton.click();
  await expect(page.getByRole('status')).toHaveText('Unable to start a new game. Try again.');
  await expect(page.locator('#ship-1-position')).toHaveText('Ship 1 — row 1, column 1');
  await expect(page.locator('#ship-2-position')).toHaveText('Ship 2 — row 9, column 5');
  await expect(page.locator('canvas')).toHaveAttribute('data-rendered-revision', '1');

  await newGameButton.click();
  await expectLayout(page, 2, 'Ship 1 — row 2, column 10', 'Ship 2 — row 10, column 10');
});

test('US2 preserves positions and drawn revision when the viewport resizes', async ({ page }) => {
  await openControlledGame(page, [0.01, 0.21]);
  await expectLayout(page, 1, 'Ship 1 — row 1, column 1', 'Ship 2 — row 9, column 5');

  await page.setViewportSize({ width: 360, height: 800 });

  await expectLayout(page, 1, 'Ship 1 — row 1, column 1', 'Ship 2 — row 9, column 5');
  const canvasBounds = await page.locator('canvas').boundingBox();
  expect(canvasBounds?.width).toBeLessThanOrEqual(360);
});

test('US2 redraw and scene recreation preserve the session without consuming placement values', async ({
  page,
}) => {
  await openControlledGame(page, [0.01, 0.21, 0.61, 0.91]);
  await page.getByRole('button', { name: 'New Game' }).click();
  await expectLayout(page, 2, 'Ship 1 — row 2, column 3', 'Ship 2 — row 10, column 9');

  for (let observation = 0; observation < 20; observation += 1) {
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  }
  expect(await getConsumedDraws(page)).toBe(4);

  const restarted = await page.evaluate(() => {
    const hooks = Reflect.get(window, '__gameSetupTestHooks');
    const restartScene = hooks && Reflect.get(hooks, 'restartScene');
    if (typeof restartScene !== 'function') {
      throw new Error('The fixture could not restart the game scene.');
    }

    return restartScene.call(hooks) as boolean;
  });
  expect(restarted).toBe(true);

  await expectLayout(page, 2, 'Ship 1 — row 2, column 3', 'Ship 2 — row 10, column 9');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(await getConsumedDraws(page)).toBe(4);
});

test('US2 teardown and remount leave one canvas and one active New Game handler', async ({
  page,
}) => {
  await openControlledGame(page, [0.01, 0.21, 0.61, 0.91]);

  await page.evaluate(() => {
    const hooks = Reflect.get(window, '__gameSetupTestHooks');
    const remount = hooks && Reflect.get(hooks, 'remount');
    if (typeof remount !== 'function') {
      throw new Error('The fixture could not remount the game application.');
    }

    remount.call(hooks);
  });

  await expectLayout(page, 1, 'Ship 1 — row 1, column 1', 'Ship 2 — row 9, column 5');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'New Game' }).click();
  await expectLayout(page, 2, 'Ship 1 — row 2, column 3', 'Ship 2 — row 10, column 9');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(await getConsumedDraws(page)).toBe(4);
});
