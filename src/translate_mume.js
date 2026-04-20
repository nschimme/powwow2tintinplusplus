import fs from 'fs';
import path from 'path';
import { TinTinConverter } from './converter.js';

const inputDir = process.argv[2] || 'scripts_mume';
const outputDir = process.argv[3] || 'scripts_mume_tintin';

console.log(`Using input directory: ${inputDir}`);
console.log(`Using output directory: ${outputDir}`);

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
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
