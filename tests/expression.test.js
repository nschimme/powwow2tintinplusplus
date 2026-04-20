import { describe, it, expect } from 'vitest';
import { TinTinConverter } from '../src/converter.js';

describe('TinTinConverter Expression Conversion', () => {
    const converter = new TinTinConverter({ mode: 'powwow' });

    const testExpressions = [
        { in: '1 + 2', out: '1 + 2' },
        { in: '$1 - @-5', out: '%1 - $powwow_at_m5' },
        { in: 'rand 10', out: '@powwow_rand{10}' },
        { in: 'timer', out: '@powwow_timer{}' },
        { in: '":?" + $5', out: ':?%5' },
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

    testExpressions.forEach(({ in: input, out: expected }) => {
        it(`converts expression: ${input}`, () => {
            const result = converter.evaluatePowwowExpression(input);
            expect(result.trim()).toBe(expected.trim());
        });
    });
});
