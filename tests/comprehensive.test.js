import { describe, it, expect } from 'vitest';
import { TinTinConverter } from '../src/converter.js';

describe('Comprehensive Script Conversion', () => {
  const pwConverter = new TinTinConverter({ mode: 'powwow' });
  const jmcConverter = new TinTinConverter({ mode: 'jmc' });

  it('converts complex Powwow script: Sìn\'s teleport system', () => {
    const script = `
#alias tel={#(@-10=0);#($-11=\$1);kremsub1;#if (\\@-10!=0) cast n 'teleport' \${key_\$0}; #else #print ("%% " +attr "yellow" + "Location not found. Locate first"+noattr)}
#alias port={#(@-10=0);#($-11=\$1);kremsub1;#if (\\@-10!=0) cast n 'portal' u \${key_\$0}; #else #print ("%% " +attr "yellow" + "Location not found. Locate first"+noattr)}
#alias kremsub1={#for (\\@1=1; \\@1<=(:?$-10); \\@1++) #if (\\$-10:\\@1==\\$-11) #(@-10=\\@1)}
    `;
    const output = pwConverter.convert(script);

    // Check key variable mappings and intent
    expect(output).toContain('#MATH {powwow_at_m10} {0}');
    expect(output).toContain('#IF {$powwow_at_m10 != 0}');
    expect(output).toContain('#WHILE {$powwow_at_1<=(@powwow_word_count{$powwow_dollar_m10})}');
    expect(output).toContain('#IF {$powwow_dollar_m10:$powwow_at_1 == $powwow_dollar_m11}');
  });

  it('converts JMC portkey script', () => {
    const script = `
#alias {addkey} {#var %1 %2;#alias %1 #var key %2}
#alias {port} {%1;privateport %2} {default}
#alias {privateport} {cast 'portal' %1 $key} {default}
    `;
    const output = jmcConverter.convert(script);

    expect(output).toContain('#ALIAS {addkey} {#VARIABLE {j_%1} {%2}; #ALIAS {%1} {#VARIABLE {j_key} {%2}}}');
    expect(output).toContain('#CLASS {default} {OPEN}');
    expect(output).toContain('#ALIAS {port} {%1; privateport %2}');
  });

  it('handles JMC multiline and secure send', () => {
    const script = '#daa mypassword\n#alias test {say hello; #hide secret}';
    const output = jmcConverter.convert(script);
    expect(output).toContain('#SEND {mypassword}');
    expect(output).toContain('#LINE GAG');
    expect(output).toContain('#ALIAS {test} {say hello; #SEND {secret}; #LINE GAG; #NOP DAA/HIDE/WHISPER (Secure send)}');
  });

  it('converts Jahara\'s Time Checker for Powwow', () => {
    const script = `
#action >+timeam $1am on $2, the $3 of $4, Year $5 of the Third Age.\\015={#print|#var $realtime=$1am|#var $checkmonth=$4|#if ($1 == 12) #var @checktime=(%($1+12))|#else #var @checktime=$1|checkdate}
#alias dwatch={#if (@timeleft == 1) #send ("emote 's digital watch displays "+$realtime+", which leaves only "+%(@timeleft)+" tick left until "+$timeofday+"!")|#else #send ("emote 's digital watch displays "+$realtime+", which leaves "+%(@timeleft)+" ticks left until "+$timeofday+"!")}
    `;
    const output = pwConverter.convert(script);

    expect(output).toContain('#ACTION {%1am on %2, the %3 of %4, Year %5 of the Third Age.\\015}');
    expect(output).toContain('#IF {%1 == 12}');
    expect(output).toContain('emote \'s digital watch displays $p_realtime, which leaves only +(@powwow_to_number{($powwow_at_timeleft)})+ tick left until $p_timeofday!');
  });
});
