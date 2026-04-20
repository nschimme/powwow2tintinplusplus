import { describe, it, expect, beforeEach } from 'vitest';
import { TinTinConverter } from '../src/converter.js';

describe('TinTinConverter MUME Conversion', () => {
  let converter;

  beforeEach(() => {
    converter = new TinTinConverter({ mode: 'powwow' });
  });

  it('converts #add to the expected TAB command', () => {
    const input = '#alias setqt={#alias qt=tell $1 \\$0; #add $1}';
    const output = converter.convert(input);
    expect(output).toContain('#TAB {%1}');
  });

  it('normalizes $(0) / $0 and preserves color variables in notify alias', () => {
    const input = '#alias notify={#print ($BLUE+"  "+$(0)+$NORM)}';
    const output = converter.convert(input);
    expect(output).toContain('$p_BLUE  %0$p_NORM');
  });

  it('preserves complex variable mapping in afk action', () => {
    const input = '#action %-afk m([^ ]+) tells you .+={#print; #if (!@autoreplied_$2) { #send ("tell $2 I\'m AFK"); #var @autoreplied_$2=1 };  setqt $2 }';
    const output = converter.convert(input);
    expect(output).toContain('#IF {!$powwow_at_autoreplied_%2}');
    expect(output).toContain('#VARIABLE {powwow_at_autoreplied_$2} {1}');
  });

  it('preserves color variables in mob say actions', () => {
    const input = '#action %+mobsay1 m(The|An|A) ([a-zA-Z ,\\-\']+) tells you (.+)=#print ("$2 "+$MOBCOL+"$3"+$NORM+" $4")';
    const output = converter.convert(input);
    expect(output).toContain('$2 $p_MOBCOL$3$p_NORM $4');
  });

  it('handles auto-print behavior for actions with flags', () => {
    const autoPrintInput = '#action >+autodrink1 clear spring babbles={#print;drink water}';
    const gagInput = '#action >-filllant1 You fill the lantern.={#print;fill lantern}';

    const autoPrintOutput = converter.convert(autoPrintInput);
    const gagOutput = converter.convert(gagInput);

    expect(autoPrintOutput).toContain('#ACTION {clear spring babbles} {drink water}');
    expect(autoPrintOutput).not.toContain('#LINE GAG');

    expect(gagOutput).toContain('#ACTION {You fill the lantern.} {fill lantern}');
    expect(gagOutput).not.toContain('#LINE GAG'); // Because of #print
  });

  it('handles actions with color attributes (BlockResist example)', () => {
    const input = '#action >+BlockResist ^Your power blocking the $1 resisted!={#print (attr "cyan" + "Your power " + attr "yellow" + ">> $1 <<" + attr "cyan" + " resisted!" + noattr+$NORM)}';
    const output = converter.convert(input);
    // Yellow matches <039> in our utility
    expect(output).toContain('<069>Your power <039>>> $1 <<<069> resisted!<099>$p_NORM');
  });
});
