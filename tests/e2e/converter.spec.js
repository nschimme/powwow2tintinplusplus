import { test, expect } from '@playwright/test';

test.describe('TinTin++ Script Converter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should convert Powwow script by default', async ({ page }) => {
    const input = '#alias ks=kill $1';
    await page.fill('#powwow-input', input);

    // The conversion is debounced, so we might need to wait a bit or click the convert button
    await page.click('#convert-btn');

    const output = await page.inputValue('#tintin-output');
    expect(output).toContain('#ALIAS {ks} {kill %1}');
    expect(output).toContain('#CLASS {converted} {OPEN}');
  });

  test('should convert JMC script when mode is changed', async ({ page }) => {
    await page.selectOption('#mode-select', 'jmc');

    const input = '#alias {k} {kill %1}';
    await page.fill('#powwow-input', input);
    await page.click('#convert-btn');

    const output = await page.inputValue('#tintin-output');
    expect(output).toContain('#ALIAS {k} {kill %1}');
  });

  test('should clear input and output when Clear button is clicked', async ({ page }) => {
    await page.fill('#powwow-input', '#alias test=test');
    await page.click('#convert-btn');

    await page.click('#clear-btn');

    const input = await page.inputValue('#powwow-input');
    const output = await page.inputValue('#tintin-output');

    expect(input).toBe('');
    expect(output).toBe('');
  });

  test('should load example and convert it', async ({ page }) => {
    // Click the "JMC Alias" example button
    await page.click('button:has-text("JMC Alias")');

    const input = await page.inputValue('#powwow-input');
    const output = await page.inputValue('#tintin-output');
    const mode = await page.inputValue('#mode-select');

    expect(mode).toBe('jmc');
    expect(input).toContain('#alias {k} {kill %1}');
    expect(output).toContain('#ALIAS {k} {kill %1}');
  });
});
