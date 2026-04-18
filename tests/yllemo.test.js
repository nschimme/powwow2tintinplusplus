import { describe, it, expect } from 'vitest';
import { TinTinConverter } from '../src/converter.js';

describe('Real-world scripts from mume.yllemo.com', () => {
  const jmcConverter = new TinTinConverter({ mode: 'jmc' });

  it('converts JMC Set 1 configurations', () => {
    const input = [
      '#message alias OFF',
      '#message action OFF',
      '#presub on',
      '#echo off',
      '#ignore off',
      '#speedwalk off',
      '#verbat off',
      '#colon leave',
      '#NOP #',
    ].join('\n');
    const output = jmcConverter.convert(input);
    expect(output).toContain('#CONFIG {VERBOSE} {OFF}');
    expect(output).toContain('#NOP JMC PRESUB ON');
    expect(output).toContain('#IGNORE {off}');
    expect(output).toContain('#CONFIG {SPEEDWALK} {OFF}');
    expect(output).toContain('#CONFIG {VERBATIM} {OFF}');
    expect(output).toContain('#NOP JMC COLON: #colon leave');
    expect(output).toContain('#\n');
  });

  it('converts JMC Set 1 aliases and actions', () => {
    const input = [
      '#alias {.a} {stand;cast \'armour\';rest;wait} {default}',
      '#action TEXT {^You bleed from open wounds.} {#var wound Wounds|ssb} {5} {default}',
    ].join('\n');
    const output = jmcConverter.convert(input);
    expect(output).toContain('#ALIAS {.a} {stand; cast \'armour\'; rest; wait}');
    expect(output).toContain('#CLASS {default} {OPEN}');
    expect(output).toContain('#ACTION {^You bleed from open wounds.} {#VARIABLE {j_wound} {Wounds|ssb}} {5}');
  });

  it('converts JMC Set 1 variables and highlights', () => {
    const input = [
      '#variable {target} {dwarf}',
      '#highlight {green} {#showme Thanks for playing!!!} {default}',
    ].join('\n');
    const output = jmcConverter.convert(input);
    expect(output).toContain('#VARIABLE {j_target} {dwarf}');
    expect(output).toContain('#CLASS {default} {OPEN}');
    expect(output).toContain('#HIGHLIGHT {Thanks for playing!!!} {green}');
  });

  it('converts JMC Set 1 substitutions and hotkeys', () => {
    const input = [
      '#substitute {found} {FOUND}',
      '#hot {ESC} {panic} {default}',
    ].join('\n');
    const output = jmcConverter.convert(input);
    expect(output).toContain('#SUBSTITUTE {found} {FOUND}');
    expect(output).toContain('#CLASS {default} {OPEN}');
    expect(output).toContain('#MACRO {ESC} {panic}');
  });
});
