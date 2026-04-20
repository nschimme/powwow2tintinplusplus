import { describe, it, expect } from 'vitest';
import { TinTinConverter } from '../src/converter.js';

describe('Real-world scripts from elvenrunes.com', () => {
  const pwConverter = new TinTinConverter({ mode: 'powwow' });
  const jmcConverter = new TinTinConverter({ mode: 'jmc' });

  it('converts Sìn\'s teleport system for Powwow', () => {
    const input = '#alias tel={#(@-10=0);#($-11=\\$1);kremsub1;#if (\\@-10!=0) cast n \'teleport\' ${key_$0}; #else #print ("%% " +attr "yellow" + "Location not found. Locate first"+noattr)}';
    const output = pwConverter.convert(input);
    expect(output).toContain('#MATH {powwow_at_m10} {0}');
    // Special case: $1 is parameter 1, which maps to %1 in Powwow alias
    expect(output).toContain('#MATH {powwow_dollar_m11} {%1}');
    expect(output).toContain('#IF {$powwow_at_m10 != 0}');
    expect(output).toContain('cast n \'teleport\' $p_key_%0');
  });

  it('converts Axel\'s XP counter for Powwow', () => {
    const input = '#al xpcalc={#var $gainxp=($1-@oldxp);#var $gaintp=($2-@oldtp);#if (@oldxp==0) {#var $gainxp=0;#var $sessxp=0};#if (@oldtp==0) {#var $gaintp=0;#var $sesstp=0};#var $sessxp=((%($sessxp))+(%($gainxp)));#var $sesstp=((%($sesstp))+(%($gaintp)));#var @oldxp=$1;#var @oldtp=$2}';
    const output = pwConverter.convert(input);
    expect(output).toContain('#VARIABLE {p_gainxp} {$p_1-@oldxp}');
    expect(output).toContain('#MATH {p_sessxp} {(@powwow_to_number{$p_sessxp}) + (@powwow_to_number{$p_gainxp})}');
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

  it('converts Torq\'s Sunrise Script for JMC', () => {
    const input = [
      '#action {^The day has begun.} {#var sunrise 1}',
      '#action {^The sun rises in the east.} {#var sunrise 1}',
      '#alias {check_sunrise} {#if {$sunrise == 1} {say It is daytime} {say It is nighttime}}'
    ].join('\n');
    const output = jmcConverter.convert(input);
    expect(output).toContain('#ACTION {^The day has begun.} {#VARIABLE {j_sunrise} {1}}');
    expect(output).toContain('#ALIAS {check_sunrise} {#IF {$j_sunrise == 1} {say It is daytime} {#ELSE} {say It is nighttime}}');
  });

  it('converts Jahara\'s Direction Marker for PowTTY', () => {
    const input = [
      '#al mark=#mark $1=yellow',
      '#al unmark=#reset marks',
      '#al markall=#mark $0=bold red',
      '#al multi=#mark $1 $2=GREEN'
    ].join('\n');
    const output = pwConverter.convert(input);
    expect(output).toContain('#ALIAS {mark} {#HIGHLIGHT {%1} {yellow}}');
    expect(output).toContain('#ALIAS {unmark} {#KILL HIGHLIGHTS {*}*}');
    expect(output).toContain('#ALIAS {markall} {#HIGHLIGHT {%0} {bold red}}');
    expect(output).toContain('#ALIAS {multi} {#HIGHLIGHT {%1 %2} {GREEN}}');
  });

  it('converts secure send #daa with complex payloads', () => {
    const input = '#daa this is {top}% secret with spaces';
    const output = jmcConverter.convert(input);
    expect(output).toContain('#SEND {this is {top}% secret with spaces}; #LINE GAG; #NOP DAA/HIDE/WHISPER (Secure send)');
  });

  it('converts secure send #hide commands', () => {
    const input = '#hide quietly whisper {through} the%shadows';
    const output = jmcConverter.convert(input);
    expect(output).toContain('#SEND {quietly whisper {through} the%shadows}; #LINE GAG; #NOP DAA/HIDE/WHISPER (Secure send)');
  });

  it('converts secure send #whisper commands', () => {
    const input = '#whisper target multi word {payload} 100%hidden';
    const output = jmcConverter.convert(input);
    expect(output).toContain('#SEND {target multi word {payload} 100%hidden}; #LINE GAG; #NOP DAA/HIDE/WHISPER (Secure send)');
  });
});
