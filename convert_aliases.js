import { TinTinConverter } from './src/converter.js';
import fs from 'fs';

const converter = new TinTinConverter({ mode: 'powwow' });
const input = fs.readFileSync('tests/manual_validation/aliases.pow', 'utf8');
const output = converter.convert(input);
fs.writeFileSync('tests/manual_validation/aliases.tin', output);
console.log('Converted aliases.pow to aliases.tin');
