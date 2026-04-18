import { TinTinConverter } from './src/converter.js';
import fs from 'fs';

const converter = new TinTinConverter({ mode: 'powwow' });
const input = fs.readFileSync('tests/manual_validation/xp_counter.pow', 'utf8');
const output = converter.convert(input);
fs.writeFileSync('tests/manual_validation/xp_counter.tin', output);
console.log('Converted xp_counter.pow to xp_counter.tin');
