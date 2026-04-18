import { describe, it, expect } from 'vitest';
import { TinTinConverter } from '../src/converter.js';

describe('Real-world scripts from elvenrunes.com', () => {
  const pwConverter = new TinTinConverter({ mode: 'powwow' });
  const jmcConverter = new TinTinConverter({ mode: 'jmc' });

  it('converts Sìn\'s teleport system for Powwow', () => {
    const input = '#alias tel={#(@-10=0);#($-11=\\$1);kremsub1;#if (\\@-10!=0) cast n \'teleport\' ${key_$0}; #else #print ("%% " +attr "yellow" + "Location not found. Locate first"+noattr)}';
    const output = pwConverter.convert(input);
    expect(output).toContain('#MATH {powwow_at_m10} {0}');
    expect(output).toContain('#MATH {powwow_dollar_m11} {%%1}');
    expect(output).toContain('#IF {$powwow_at_m10 != 0}');
    expect(output).toContain('cast n \'teleport\' $p_key_%0');
  });

  it('converts Axel\'s XP counter for Powwow', () => {
    const input = '#al xpcalc={#var $gainxp=($1-@oldxp);#var $gaintp=($2-@oldtp);#if (@oldxp==0) {#var $gainxp=0;#var $sessxp=0};#if (@oldtp==0) {#var $gaintp=0;#var $sesstp=0};#var $sessxp=((%($sessxp))+(%($gainxp)));#var $sesstp=((%($sesstp))+(%($gaintp)));#var @oldxp=$1;#var @oldtp=$2}';
    const output = pwConverter.convert(input);
    expect(output).toContain('#MATH {p_gainxp} {%1-$powwow_at_oldxp}');
    expect(output).toContain('#VARIABLE {p_sessxp}');
    expect(output).toContain('#VARIABLE {powwow_at_oldxp} {%1}');
  });

  it('converts PowTTY XP counter (uses #sep and ANSI)', () => {
    const input = '#sep ;\n#var $xpcal=0\n#var $bgr=\\033[32\\;1m\n#ac >+xp1 XPCOUNTER: &1 &2 &3 &4.={#if ($xpcal=="1") {xpcalc $1 $2\\;#var $xpcal=0}\\;xpprint $1 $2 $3 $4}';
    const output = pwConverter.convert(input);
    expect(output).toContain('#NOP SEPARATOR set to');
    expect(output).toContain('#VARIABLE {p_xpcal} {0}');
    expect(output).toContain('#ACTION {XPCOUNTER: %1 %2 %3 %4.}');
  });

  it('converts Antar\'s Grouping for JMC', () => {
    const input = '#Alias {%2 raises her hand.} {group %2}';
    const output = jmcConverter.convert(input);
    expect(output).toContain('#ALIAS {%2 raises her hand.} {group %2}');
  });

  it('converts Antar\'s Reporting for JMC', () => {
    const input = '#Alias {%0 hits, %1 mana, and %2 moves.} {#alias report emote has %0 hps, %1 mana, and %2 moves.}';
    const output = jmcConverter.convert(input);
    expect(output).toContain('#ALIAS {%0 hits, %1 mana, and %2 moves.} {#ALIAS {report} {emote has %0 hps, %1 mana, and %2 moves.}}');
  });
});
