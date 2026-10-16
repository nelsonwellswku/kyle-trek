import { expect, test } from '@playwright/test';

test('US1 shows the supplied board, two labeled ships, and a rendered revision', async ({
  page,
}) => {
  await page.goto('/__fixtures__/game-setup/');
  await expect(page.locator('.game-shell')).toBeVisible();

  const canvas = page.locator('canvas[aria-describedby="board-description ship-summary"]');

  await expect(canvas).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'New Game' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Game' })).toBeDisabled();
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
