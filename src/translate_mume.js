import fs from 'fs';
import path from 'path';
import { TinTinConverter } from './converter.js';

const inputDir = 'scripts_mume';
const outputDir = 'scripts_mume_tintin';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const converter = new TinTinConverter({ mode: 'powwow' });

const files = fs.readdirSync(inputDir);

files.forEach(file => {
    // Skip binary map files and other non-script assets
    if (file.endsWith('.mm2') || file === 'README.md' || file.startsWith('.')) {
        return;
    }

    if (file.endsWith('.txt')) {
        console.log(`Translating ${file}...`);
        const inputPath = path.join(inputDir, file);
        const outputPath = path.join(outputDir, file.replace(/\.txt$/, '.tin'));

        try {
            const content = fs.readFileSync(inputPath, 'utf8');
            // Ensure we handle potential stack issues for very large files
            const result = converter.convert(content);
            fs.writeFileSync(outputPath, result);
        } catch (err) {
            console.error(`Error translating ${file}:`, err.message);
        }
    }
});

console.log('Translation complete.');
