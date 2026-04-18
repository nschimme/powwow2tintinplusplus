import { TinTinConverter } from './src/converter.js';
import fs from 'fs';

const converter = new TinTinConverter({ mode: 'powwow' });
const input = fs.readFileSync('tests/manual_validation/robot.pow', 'utf8');
const output = converter.convert(input);
fs.writeFileSync('tests/manual_validation/robot.tin', output);
console.log('Converted robot.pow to robot.tin');
