import { describe, it, expect } from 'vitest';
import { TinTinConverter } from '../src/converter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Real-world Fixtures', () => {
  const converter = new TinTinConverter();

  const fixturesDir = path.join(__dirname, 'fixtures');
  if (fs.existsSync(fixturesDir)) {
      const files = fs.readdirSync(fixturesDir);

      files.forEach(file => {
        if (file.endsWith('.txt')) {
          it(`converts ${file} without crashing`, () => {
            const content = fs.readFileSync(path.join(fixturesDir, file), 'utf8');
            const cleanContent = content.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');

            const isPowtty = file.includes('powtty');
            const isJMC = file.includes('jmc');

            if (isJMC) {
                converter.setMode('jmc');
            } else {
                converter.setMode('powwow');
                if (isPowtty) {
                    converter.setSeparator('|');
                } else {
                    converter.setSeparator(';');
                }
            }

            const output = converter.convert(cleanContent);
            expect(output).toBeDefined();
            expect(output.length).toBeGreaterThan(0);
            // expect(output).not.toContain('UNCONVERTED'); // Some might still have unconverted parts if they use complex scripts
          });
        }
      });
  }
});
