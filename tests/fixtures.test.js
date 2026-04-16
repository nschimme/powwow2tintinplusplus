import { describe, it, expect } from 'vitest';
import { TinTinConverter } from '../src/converter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Real-world Fixtures', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (fs.existsSync(fixturesDir)) {
      const files = fs.readdirSync(fixturesDir);

      files.forEach(file => {
        if (file.endsWith('.txt')) {
          it(`converts ${file} without crashing`, () => {
            const content = fs.readFileSync(path.join(fixturesDir, file), 'utf8');
            const cleanContent = content.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');

            const converter = new TinTinConverter();

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

            const unconvertedMatches = output.match(/UNCONVERTED/g);
            const unconvertedCount = unconvertedMatches ? unconvertedMatches.length : 0;

            if (unconvertedCount > 0) {
                console.warn(`Fixture ${file} produced ${unconvertedCount} UNCONVERTED segment(s).`);
            }

            // Stricter for JMC as it's new and should be handled better
            if (isJMC) {
                expect(unconvertedCount).toBe(0);
            } else {
                expect(unconvertedCount).toBeLessThanOrEqual(5);
            }
          });
        }
      });
  }
});
