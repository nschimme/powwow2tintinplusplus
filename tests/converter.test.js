import { describe, it, expect } from 'vitest';
import { PowwowConverter } from '../src/converter.js';

describe('PowwowConverter', () => {
  const converter = new PowwowConverter();

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
    const pipeConverter = new PowwowConverter({ separator: '|' });
    const input = '#alias test={command1 | command2}';
    const output = pipeConverter.convert(input);
    expect(output).toContain('#ALIAS {test} {command1; command2}');
  });

  it('handles line continuation', () => {
    const input = '#alias long={\\\n  cmd1;\\\n  cmd2\\\n}';
    const output = converter.convert(input);
    expect(output).toContain('#ALIAS {long} {cmd1; cmd2}');
  });

  it('handles nested braces', () => {
    const input = '#alias nested={#if (1) {say yes}}';
    const output = converter.convert(input);
    expect(output).toContain('#ALIAS {nested} {#IF {1} {say yes}}');
  });

  it('converts complex expressions', () => {
    const input = '#var x=("hello " + $name)';
    const output = converter.convert(input);
    expect(output).toContain('#VARIABLE {p_x} {hello $p_name}');
  });

  it('converts delayed substitutions', () => {
    const input = '#alias ac=#alias $1=cast \'$2\' \\$0';
    const output = converter.convert(input);
    expect(output).toContain("#ALIAS {ac} {#ALIAS {%1} {cast '%2' %%0}}");
  });

  it('converts attributes', () => {
    const input = '#print (attr "bold yellow" + "Alert!" + noattr)';
    const output = converter.convert(input);
    expect(output).toContain('#SHOWME {<139>Alert!<099>}');
  });

  it('converts numbered variables', () => {
    const input = '#var @7=22';
    const output = converter.convert(input);
    expect(output).toContain('#VARIABLE {powwow_at[7]} {22}');
  });

  it('handles tickers', () => {
    const input = '#in attack (2000) kill wolf';
    const output = converter.convert(input);
    expect(output).toContain('#TICKER {attack} {kill wolf} {2.00}');
  });
});
