import { TinTinConverter } from '../src/converter.js';

const converter = new TinTinConverter({ mode: 'powwow' });

const testExpressions = [
    { in: '1 + 2', out: '1 + 2' },
    { in: '$1 - @-5', out: '%1 - $powwow_at_m5' },
    { in: 'rand 10', out: '@powwow_rand{10}' },
    { in: 'timer', out: '@powwow_timer{}' },
    { in: '":?" + $5', out: '":?"%5' }, // word count operator suffix vs prefix
    { in: '$5:?', out: '@powwow_word_count{%5}' },
    { in: ':?$5', out: '@powwow_word_count{%5}' },
    { in: '"Hello " + $name', out: 'Hello $p_name' },
    { in: 'attr "bold red" + "ALARM"', out: '<119>ALARM' },
    { in: 'noattr + "Reset"', out: '<099>Reset' },
    { in: '$str:2', out: '@powwow_word{$p_str;2}' },
    { in: '$str.>3', out: '$p_str.char[3..-1]' },
    { in: '$str.<3', out: '$p_str.char[1..3]' },
    { in: '(%($sessxp))+(%($gainxp))', out: '(@powwow_to_number{$p_sessxp}) + (@powwow_to_number{$p_gainxp})' },
    { in: '$BLUE + " " + $(0) + $NORM', out: '$p_BLUE %0$p_NORM' },
    { in: '!@autoreplied_$2', out: '!$powwow_at_autoreplied_%2' }
];

console.log('--- EXPRESSION CONVERSION TESTS ---');
let passed = 0;
testExpressions.forEach(test => {
    const result = converter.evaluatePowwowExpression(test.in);
    const success = result.trim() === test.out.trim();
    console.log(`INPUT:  ${test.in}`);
    console.log(`EXPECT: ${test.out}`);
    console.log(`ACTUAL: ${result}`);
    console.log(`STATUS: ${success ? 'PASSED' : 'FAILED'}`);
    if (success) passed++;
    console.log('---');
});

console.log(`Tests: ${passed}/${testExpressions.length} passed.`);
if (passed !== testExpressions.length) process.exit(1);
