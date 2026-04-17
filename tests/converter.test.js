import { describe, it, expect } from 'vitest';
import { TinTinConverter } from '../src/converter.js';

describe('TinTinConverter - Powwow Mode', () => {
  const converter = new TinTinConverter({ mode: 'powwow' });

  it('converts simple alias', () => {
    const input = '#alias ks=kill $1';
    const output = converter.convert(input);
    expect(output).toContain('#ALIAS {ks} {kill %1}');
  });

  it('converts simple action with default gag behavior', () => {
    const input = '#action ^You parry.=say Nice parry!';
    const output = converter.convert(input);
    // In Powwow, actions gag by default.
    expect(output).toContain('#ACTION {^You parry.} {say Nice parry!; #LINE GAG}');
  });

  it('converts action with #print (no gag)', () => {
    const input = '#action ^You parry.={#print; say Nice parry!}';
    const output = converter.convert(input);
    expect(output).toContain('#ACTION {^You parry.} {#LINE PRINT; say Nice parry!}');
    expect(output).not.toContain('#LINE GAG');
  });

  it('respects #option +autoprint', () => {
    const input = '#option +autoprint\n#action ^You parry.=say Nice parry!';
    const output = converter.convert(input);
    expect(output).toContain('#COMMENT OPTION autoprint set to ON');
    expect(output).toContain('#ACTION {^You parry.} {say Nice parry!}');
    expect(output).not.toContain('#LINE GAG');
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

  it('converts #in and #at to #DELAY', () => {
    expect(converter.convert('#in (1000) {say hello}')).toContain('#DELAY {1.00} {say hello}');
    expect(converter.convert('#at (5.5) {say hello}')).toContain('#DELAY {5.5} {say hello}');
  });

  it('reproduces reported issue with loot+@autoloot', () => {
    const input = '#alias loot+@autoloot={#action +loot1;#action +loot2;#(@loot_timer = timer)}';
    const output = converter.convert(input);

    // User clarified: alias name is "loot+" and class is "autoloot"

    expect(output).toContain('#CLASS {autoloot} {OPEN}');
    expect(output).toContain('#ALIAS {loot+}');
    expect(output).toContain('#MATH {powwow_at_loot_timer} {timer}');
    expect(output).not.toContain('$p_p_at');
  });

  it('handles Powwow alias with minus suffix and label', () => {
    const input = '#alias loot-@autoloot={#action -loot1}';
    const output = converter.convert(input);
    expect(output).toContain('#CLASS {autoloot} {OPEN}');
    expect(output).toContain('#ALIAS {loot-}');
    expect(output).toContain('#CLASS {loot1} {KILL}');
  });

  it('correctly handles named parameters in ${var}', () => {
    const input = '#alias test=say ${target} is dead';
    const output = converter.convert(input);
    expect(output).toContain('say $p_target is dead');
    expect(output).not.toContain('$p_p_target');
  });

  it('converts Powwow #setvar, #mark, #hilite', () => {
    expect(converter.convert('#setvar timer=100')).toContain('#VARIABLE {p_timer} {100}');
    expect(converter.convert('#mark {Dragon}=bold red')).toContain('#HIGHLIGHT {{Dragon}} {bold red}');
    expect(converter.convert('#hilite inverse')).toContain('#HIGHLIGHT {.*} {inverse}');
    expect(converter.convert('#beep')).toContain('#BELL');
    expect(converter.convert('#time')).toContain('#FORMAT {powwow_at_time}');
    expect(converter.convert('#save my.tin')).toContain('#WRITE {my.tin}');
    expect(converter.convert('#load my.tin')).toContain('#READ {my.tin}');
    expect(converter.convert('#! ls')).toContain('#SYSTEM {ls}');
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
    expect(output).toContain('#IF {$j_hp < 50} {flee} {#ELSE} {say I am fine}');
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

    expect(output).toContain('#COMMENT this is a JMC comment with hash');
    expect(output).toContain('#COMMENT this is a JMC comment with slashes');
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

    expect(output).toContain('#LINE GAG');
    expect(output).toContain('#SEND {\n}');
    expect(output).toContain('#BELL');
    expect(output).toContain('#IGNORE');
  });

  it('converts JMC tick commands', () => {
    expect(converter.convert('#ticksize 60')).toContain('#VARIABLE {j_ticksize} {60}');
    expect(converter.convert('#ticksize 60')).toContain('#TICKER {jmc_tick} {#SHOWME #TICK} {60}');
    expect(converter.convert('#tickon')).toContain('#TICKER {jmc_tick} {#SHOWME #TICK} {$j_ticksize}');
    expect(converter.convert('#tickoff')).toContain('#UNTICKER {jmc_tick}');
    expect(converter.convert('#tickset')).toContain('#TICKER {jmc_tick} {#SHOWME #TICK} {$j_ticksize}');
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

  it('converts JMC #loop, #tolower, #toupper, #unsub', () => {
    expect(converter.convert('#loop {1,5} {say %0}')).toContain('#LOOP {1} {5} {v} {say $v}');
    expect(converter.convert('#tolower {target} {DRAGON}')).toContain('#FORMAT {j_target} {%l} {DRAGON}');
    expect(converter.convert('#toupper {target} {dragon}')).toContain('#FORMAT {j_target} {%u} {dragon}');
    expect(converter.convert('#unsub {foo}')).toContain('#UNSUB {foo}');
  });

  it('converts JMC #antisub and #speedwalk', () => {
    expect(converter.convert('#antisub {safe line}')).toContain('#ANTISUBSTITUTE {safe line}');
    expect(converter.convert('#speedwalk on')).toContain('#CONFIG {SPEEDWALK} {ON}');
  });

  it('converts more JMC commands: #bell, #break, #output, #pathdir, #wait', () => {
    expect(converter.convert('#bell')).toContain('#BELL');
    expect(converter.convert('#break')).toContain('#BREAK');
    expect(converter.convert('#output {hello}')).toContain('#SHOWME {hello}');
    expect(converter.convert('#pathdir {n} {s} {1}')).toContain('#PATHDIR {n} {s} {1}');
    expect(converter.convert('#wait 1.5')).toContain('#DELAY {1.5}');
  });
});
