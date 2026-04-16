import { describe, it, expect } from 'vitest';
import { TinTinConverter } from '../src/converter.js';

describe('TinTinConverter - Powwow Mode', () => {
  const converter = new TinTinConverter({ mode: 'powwow' });

  it('converts simple alias', () => {
    const input = '#alias ks=kill $1';
    const output = converter.convert(input);
    expect(output).toContain('#ALIAS {ks} {kill %1}');
  });

  it('converts simple action', () => {
    const input = '#action ^You parry.=say Nice parry!';
    const output = converter.convert(input);
    expect(output).toContain('#ACTION {^You parry.} {say Nice parry!}');
  });

  it('handles custom separator', () => {
    const pipeConverter = new TinTinConverter({ mode: 'powwow', separator: '|' });
    const input = '#alias test={command1 | command2}';
    const output = pipeConverter.convert(input);
    expect(output).toContain('#ALIAS {test} {command1; command2}');
  });

  it('converts complex expressions', () => {
    const input = '#var x=("hello " + $name)';
    const output = converter.convert(input);
    expect(output).toContain('#VARIABLE {p_x} {hello $p_name}');
  });

  it('converts numbered variables', () => {
    const input = '#var @7=22';
    const output = converter.convert(input);
    expect(output).toContain('#VARIABLE {powwow_at[7]} {22}');
  });
});

describe('TinTinConverter - JMC Mode', () => {
  const converter = new TinTinConverter({ mode: 'jmc' });

  it('converts JMC alias', () => {
    const input = '#alias {k} {kill %1}';
    const output = converter.convert(input);
    expect(output).toContain('#ALIAS {k} {kill %1}');
  });

  it('applies JMC variable substitution semantics', () => {
    const input = '#alias {test} {say $foo %1 \\$1 #{1+2}}';
    const output = converter.convert(input);

    // $foo -> $j_foo in JMC mode
    expect(output).toContain('$j_foo');
    // %1 is left unchanged
    expect(output).toContain('%1');
    // Powwow-only escaping (\$1 -> %%1) is NOT applied in JMC mode
    expect(output).toContain('\\$1');
    // Powwow-only math evaluation (#{...}) is NOT applied in JMC mode
    expect(output).toContain('#{1+2}');
  });

  it('converts JMC variables', () => {
    const input = '#var {gold} {100}';
    const output = converter.convert(input);
    expect(output).toContain('#VARIABLE {j_gold} {100}');
  });

  it('converts JMC numbered variables', () => {
    const input = '#var $7=22';
    const output = converter.convert(input);
    expect(output).toContain('#VARIABLE {jmc_dollar[7]} {22}');
  });

  it('converts JMC variable substitution', () => {
    const input = 'say I have $gold gold';
    const output = converter.convert(input);
    expect(output).toContain('say I have $j_gold gold');
  });

  it('converts JMC if statement', () => {
    const input = '#if {$hp < 50} {flee} {say I am fine}';
    const output = converter.convert(input);
    expect(output).toBe('#IF {$j_hp < 50} {flee} {#ELSE} {say I am fine}');
  });

  it('converts JMC math', () => {
    const input = '#math {double_hp} {$hp * 2}';
    const output = converter.convert(input);
    expect(output).toContain('#math {j_double_hp} {$j_hp * 2}');
  });

  it('converts JMC group enable/disable', () => {
    const input = '#group enable combat';
    const output = converter.convert(input);
    expect(output).toContain('#CLASS {combat} {OPEN}');

    const inputDisable = '#group disable combat';
    const outputDisable = converter.convert(inputDisable);
    expect(outputDisable).toContain('#CLASS {combat} {KILL}');
  });

  it('converts JMC gag', () => {
    const input = '#gag {^%0 arrived}';
    const output = converter.convert(input);
    expect(output).toContain('#GAG {^%0 arrived}');
  });

  it('converts JMC substitute', () => {
    const input = '#sub {foo} {bar}';
    const output = converter.convert(input);
    expect(output).toContain('#SUBSTITUTE {foo} {bar}');
  });

  it('converts JMC highlights', () => {
    const input = '#highlight {red} {trolls}';
    const output = converter.convert(input);
    expect(output).toContain('#HIGHLIGHT {trolls} {red}');
  });

  it('converts JMC comments', () => {
    const input = [
      '## this is a JMC comment with hash',
      '// this is a JMC comment with slashes',
    ].join('\n');

    const output = converter.convert(input);

    expect(output).toContain('#comment this is a JMC comment with hash');
    expect(output).toContain('#comment this is a JMC comment with slashes');
  });

  it('converts JMC hotkeys', () => {
    const input = '#hotkey {F1} {say hotkey pressed}';
    const output = converter.convert(input);
    expect(output).toContain('#MACRO {F1} {say hotkey pressed}');
  });

  it('converts basic JMC commands', () => {
    const input = [
      '#drop',
      '#cr',
      '#bell',
      '#ignore',
    ].join('\n');

    const output = converter.convert(input);

    expect(output).toContain('#line gag');
    expect(output).toContain('#send {\n}');
    expect(output).toContain('#bell');
    expect(output).toContain('#ignore');
  });

  it('converts #unalias / #unaction / #unvar in JMC mode', () => {
    const input = [
      '#unalias {k}',
      '#unaction {gag_line}',
      '#unvar {count}',
    ].join('\n');

    const output = converter.convert(input);

    expect(output).toContain('#UNALIAS {k}');
    expect(output).toContain('#UNACT {gag_line}');
    expect(output).toContain('#UNVAR {j_count}');
  });
});
