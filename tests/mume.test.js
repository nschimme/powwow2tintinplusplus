import { describe, it, expect, beforeEach } from 'vitest';
import { TinTinConverter } from '../src/converter.js';

describe('TinTinConverter MUME Conversion', () => {
  let pwConverter;
  let jmcConverter;

  beforeEach(() => {
    pwConverter = new TinTinConverter({ mode: 'powwow' });
    jmcConverter = new TinTinConverter({ mode: 'jmc' });
  });

  describe('Powwow / PowTTY Scripts', () => {
    it('converts #add to the expected TAB command', () => {
      const input = '#alias setqt={#alias qt=tell $1 \\$0; #add $1}';
      const output = pwConverter.convert(input);
      expect(output).toContain('#TAB {%1}');
    });

    it('normalizes $(0) / $0 and preserves color variables in notify alias', () => {
      const input = '#alias notify={#print ($BLUE+"  "+$(0)+$NORM)}';
      const output = pwConverter.convert(input);
      expect(output).toContain('$p_BLUE  %0$p_NORM');
    });

    it('preserves complex variable mapping in afk action', () => {
      const input = '#action %-afk m([^ ]+) tells you .+={#print; #if (!@autoreplied_$2) { #send ("tell $2 I\'m AFK"); #var @autoreplied_$2=1 };  setqt $2 }';
      const output = pwConverter.convert(input);
      expect(output).toContain('#IF {!$powwow_at_autoreplied_%2}');
      expect(output).toContain('#VARIABLE {powwow_at_autoreplied_$2} {1}');
    });

    it('preserves color variables in mob say actions', () => {
      const input = '#action %+mobsay1 m(The|An|A) ([a-zA-Z ,\\-\']+) tells you (.+)=#print ("$2 "+$MOBCOL+"$3"+$NORM+" $4")';
      const output = pwConverter.convert(input);
      expect(output).toContain('%2 $p_MOBCOL%3$p_NORM %4');
    });

    it('handles auto-print behavior for actions with flags', () => {
      const autoPrintInput = '#action >+autodrink1 clear spring babbles={#print;drink water}';
      const gagInput = '#action >-filllant1 You fill the lantern.={#print;fill lantern}';

      const autoPrintOutput = pwConverter.convert(autoPrintInput);
      const gagOutput = pwConverter.convert(gagInput);

      expect(autoPrintOutput).toContain('#ACTION {clear spring babbles} {drink water}');
      expect(autoPrintOutput).not.toContain('#LINE GAG');

      expect(gagOutput).toContain('#ACTION {You fill the lantern.} {fill lantern}');
      expect(gagOutput).not.toContain('#LINE GAG'); // Because of #print
    });

    it('handles actions with color attributes (BlockResist example)', () => {
      const input = '#action >+BlockResist ^Your power blocking the $1 resisted!={#print (attr "cyan" + "Your power " + attr "yellow" + ">> $1 <<" + attr "cyan" + " resisted!" + noattr+$NORM)}';
      const output = pwConverter.convert(input);
      // Yellow matches <039> in our utility
      expect(output).toContain('<069>Your power <039>>> %1 <<<069> resisted!<099>$p_NORM');
    });

    it('converts Sìn\'s teleport system for Powwow', () => {
      const input = '#alias tel={#(@-10=0);#($-11=\\$1);kremsub1;#if (\\@-10!=0) cast n \'teleport\' ${key_$0}; #else #print ("%% " +attr "yellow" + "Location not found. Locate first"+noattr)}';
      const output = pwConverter.convert(input);
      expect(output).toContain('#MATH {powwow_at_m10} {0}');
      // $-11 is a string-type variable ($-prefix), so use #VARIABLE not #MATH
      expect(output).toContain('#VARIABLE {powwow_dollar_m11} {%1}');
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
  });

  describe('JMC Scripts', () => {
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
      expect(output).toContain('#NOP JMC IGNORE OFF');
      expect(output).toContain('#CONFIG {SPEEDWALK} {OFF}');
      expect(output).toContain('#CONFIG {VERBATIM} {OFF}');
      expect(output).toContain('#NOP JMC COLON: #colon leave');
      expect(output).toContain('#NOP #');
    });

    it('converts JMC comment and nope to #NOP', () => {
      const input = '#comment this is a comment\n#nope this is ignored\n#nop this is also ignored';
      const output = jmcConverter.convert(input);
      expect(output).toContain('#NOP this is a comment');
      expect(output).toContain('#NOP this is ignored');
      expect(output).toContain('#NOP this is also ignored');
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
      expect(output).toContain('#HIGHLIGHT {Thanks for playing!!!} {<green>}');
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
});
