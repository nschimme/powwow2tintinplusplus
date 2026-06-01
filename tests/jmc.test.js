import { describe, it, expect, beforeEach } from 'vitest';
import { TinTinConverter } from '../src/converter.js';

function jmc(input) {
    const c = new TinTinConverter();
    c.setMode('jmc');
    return c.convert(input);
}

describe('JMC - alias', () => {
    it('converts basic alias', () => {
        expect(jmc('#alias {k} {kill %1}')).toContain('#ALIAS {k} {kill %1}');
    });

    it('converts alias with group', () => {
        const out = jmc('#alias {k} {kill %1} {combat}');
        expect(out).toContain('#CLASS {combat} {OPEN}');
        expect(out).toContain('#ALIAS {k} {kill %1}');
        expect(out).toContain('#CLASS {combat} {CLOSE}');
    });
});

describe('JMC - action', () => {
    // JMC uses %0-%9 for captures (0-indexed), TinTin++ uses %1-%9 (1-indexed), so shift by +1
    it('converts basic action with parameter shift', () => {
        const out = jmc('#action {^%0 arrived} {kill %1}');
        expect(out).toContain('#ACTION {^%1 arrived} {kill %2}');
    });

    it('converts action with priority and parameter shift', () => {
        const out = jmc('#action {^%0 arrived from the %1} {kill %1} {0}');
        expect(out).toContain('#ACTION {^%1 arrived from the %2} {kill %2} {0}');
    });

    it('converts action with group', () => {
        const out = jmc('#action {^%0 arrived} {kill %1} {0} {combat}');
        expect(out).toContain('#CLASS {combat} {OPEN}');
        expect(out).toContain('#ACTION {^%1 arrived} {kill %2} {0}');
        expect(out).toContain('#CLASS {combat} {CLOSE}');
    });
});

describe('JMC - variable', () => {
    it('converts variable assignment', () => {
        expect(jmc('#variable {gold} {100}')).toContain('#VARIABLE {j_gold} {100}');
    });

    it('converts var shorthand', () => {
        expect(jmc('#var {gold} {100}')).toContain('#VARIABLE {j_gold} {100}');
    });
});

describe('JMC - math', () => {
    it('converts math expression', () => {
        expect(jmc('#math {gold} {$gold + 50}')).toContain('#math {j_gold} {$j_gold + 50}');
    });
});

describe('JMC - if', () => {
    it('converts if with true block', () => {
        expect(jmc('#if {$gold > 0} {#showme {rich}}')).toContain('#IF {$j_gold > 0} {#SHOWME {rich}}');
    });

    it('converts if/else', () => {
        const out = jmc('#if {$gold > 0} {#showme {rich}} {#showme {poor}}');
        expect(out).toContain('#IF {$j_gold > 0} {#SHOWME {rich}}');
        expect(out).toContain('#ELSE');
        expect(out).toContain('#SHOWME {poor}');
    });
});

describe('JMC - group', () => {
    it('group enable opens class', () => {
        expect(jmc('#group enable combat')).toContain('#CLASS {combat} {OPEN}');
    });

    it('group disable closes class (not kill)', () => {
        const out = jmc('#group disable combat');
        expect(out).toContain('#CLASS {combat} {CLOSE}');
        expect(out).not.toContain('KILL');
    });

    it('group delete kills class', () => {
        expect(jmc('#group delete combat')).toContain('#CLASS {combat} {KILL}');
    });

    it('group list shows all classes', () => {
        expect(jmc('#group list')).toContain('#CLASS');
    });
});

describe('JMC - highlight', () => {
    it('maps bold color', () => {
        expect(jmc('#highlight {bold} {you hit}')).toContain('#HIGHLIGHT {you hit} {<bold>}');
    });

    it('maps red color', () => {
        expect(jmc('#highlight {red} {you are hit}')).toContain('#HIGHLIGHT {you are hit} {<red>}');
    });

    it('maps light green color', () => {
        expect(jmc('#highlight {light green} {you gain}')).toContain('#HIGHLIGHT {you gain} {<light green>}');
    });

    it('maps reverse color', () => {
        expect(jmc('#highlight {reverse} {[HP:]}')).toContain('#HIGHLIGHT {[HP:]} {<reverse>}');
    });
});

describe('JMC - gag', () => {
    it('converts gag pattern', () => {
        expect(jmc('#gag {You see nothing}')).toContain('#GAG {You see nothing}');
    });
});

describe('JMC - substitute', () => {
    it('converts substitute', () => {
        expect(jmc('#substitute {Orc} {ork}')).toContain('#SUBSTITUTE {Orc} {ork}');
    });

    it('converts unsubstitute', () => {
        expect(jmc('#unsubstitute {Orc}')).toContain('#UNSUB {Orc}');
    });

    it('converts antisubstitute', () => {
        expect(jmc('#antisubstitute {safe}')).toContain('#ANTISUBSTITUTE {safe}');
    });

    it('converts unantisubstitute', () => {
        expect(jmc('#unantisubstitute {safe}')).toContain('#UNANTISUBSTITUTE {safe}');
    });
});

describe('JMC - loop', () => {
    it('converts loop with range', () => {
        const out = jmc('#loop {1,5} {#showme {%0}}');
        expect(out).toContain('#LOOP {1} {5} {v}');
        expect(out).toContain('$v');
    });
});

describe('JMC - tolower/toupper', () => {
    it('converts tolower', () => {
        expect(jmc('#tolower {result} {Hello World}')).toContain('#FORMAT {j_result} {%l} {Hello World}');
    });

    it('converts toupper', () => {
        expect(jmc('#toupper {result} {hello}')).toContain('#FORMAT {j_result} {%u} {hello}');
    });
});

describe('JMC - hotkey', () => {
    it('converts hotkey', () => {
        expect(jmc('#hotkey {F1} {north}')).toContain('#MACRO {F1} {north}');
    });

    it('converts unhotkey', () => {
        expect(jmc('#unhotkey {F1}')).toContain('#UNMACRO');
    });
});

describe('JMC - showme/output', () => {
    it('converts showme', () => {
        expect(jmc('#showme {Hello, world!}')).toContain('#SHOWME {Hello, world!}');
    });

    it('converts output', () => {
        expect(jmc('#output {Hello, world!}')).toContain('#SHOWME {Hello, world!}');
    });
});

describe('JMC - connect', () => {
    it('converts host:port syntax', () => {
        expect(jmc('#connect mume.org:4242')).toContain('#SESSION {jmc} {mume.org} {4242}');
    });

    it('converts host port syntax', () => {
        expect(jmc('#connect mume.org 4242')).toContain('#SESSION {jmc} {mume.org} {4242}');
    });

    it('converts host-only with default port', () => {
        expect(jmc('#connect mume.org')).toContain('#SESSION {jmc} {mume.org} {23}');
    });
});

describe('JMC - tab completion', () => {
    it('converts tabadd', () => {
        expect(jmc('#tabadd {hello}')).toContain('#TAB {hello}');
    });

    it('converts tabdel', () => {
        expect(jmc('#tabdel {hello}')).toContain('#UNTAB {hello}');
    });
});

describe('JMC - ticker', () => {
    it('converts ticksize', () => {
        const out = jmc('#ticksize 60');
        expect(out).toContain('#VARIABLE {j_ticksize} {60}');
        expect(out).toContain('#TICKER');
    });

    it('converts tickon', () => {
        expect(jmc('#tickon')).toContain('#TICKER');
    });

    it('converts tickoff', () => {
        expect(jmc('#tickoff')).toContain('#UNTICKER');
    });
});

describe('JMC - logging', () => {
    it('converts log with append', () => {
        expect(jmc('#log {session.log} {append}')).toContain('#LOG {APPEND} {session.log}');
    });

    it('converts log with overwrite', () => {
        expect(jmc('#log {session.log} {overwrite}')).toContain('#LOG {OVERWRITE} {session.log}');
    });
});

describe('JMC - misc', () => {
    it('converts bell', () => {
        expect(jmc('#bell')).toContain('#BELL');
    });

    it('converts zap', () => {
        expect(jmc('#zap')).toContain('#ZAP');
    });

    it('converts quit', () => {
        expect(jmc('#quit')).toContain('#END');
    });

    it('converts wait/wt', () => {
        expect(jmc('#wait 5')).toContain('#DELAY {5}');
        expect(jmc('#wt 5')).toContain('#DELAY {5}');
    });

    it('converts drop (no args)', () => {
        expect(jmc('#action {^You miss} {#drop}')).toContain('#LINE GAG');
    });

    it('converts nodrop', () => {
        expect(jmc('#nodrop')).toContain('#LINE PRINT');
    });

    it('converts cr', () => {
        expect(jmc('#cr')).toContain('#SEND');
    });

    it('converts ignore', () => {
        expect(jmc('#ignore')).toContain('#IGNORE');
    });

    it('converts comment', () => {
        expect(jmc('#comment This is a comment')).toContain('#NOP This is a comment');
    });

    it('converts ## comment', () => {
        expect(jmc('## This is a comment')).toContain('#NOP');
    });

    it('converts speedwalk on', () => {
        expect(jmc('#speedwalk on')).toContain('#CONFIG {SPEEDWALK} {ON}');
    });

    it('converts run to system', () => {
        expect(jmc('#run notepad.exe')).toContain('#SYSTEM {notepad.exe}');
    });

    it('converts read', () => {
        expect(jmc('#read {myscript.jmc}')).toContain('#READ');
    });

    it('converts write', () => {
        expect(jmc('#write {myscript.jmc}')).toContain('#WRITE');
    });

    it('converts systemexec', () => {
        expect(jmc('#systemexec {ls -la}')).toContain('#SYSTEM {ls -la}');
    });

    it('converts textin', () => {
        expect(jmc('#textin {file.txt}')).toContain('#TEXTIN');
    });

    it('converts unalias', () => {
        expect(jmc('#unalias {k}')).toContain('#UNALIAS {k}');
    });

    it('converts unaction', () => {
        expect(jmc('#unaction {^%0 arrived}')).toContain('#UNACT');
    });

    it('converts unvar', () => {
        expect(jmc('#unvar {gold}')).toContain('#UNVAR {j_gold}');
    });

    it('converts killall', () => {
        expect(jmc('#killall')).toContain('#KILL ALL');
    });

    it('converts kickall alias', () => {
        expect(jmc('#kickall')).toContain('#KILL ALL');
    });

    it('converts char', () => {
        expect(jmc('#char {/}')).toContain('#CONFIG {COMMAND_CHAR} {/}');
    });

    it('converts verbatim on', () => {
        expect(jmc('#verbatim on')).toContain('#CONFIG {VERBATIM} {ON}');
    });

    it('converts message off', () => {
        expect(jmc('#message off')).toContain('#CONFIG {VERBOSE} {OFF}');
    });

    it('converts echo on', () => {
        expect(jmc('#echo on')).toContain('#CONFIG {VERBOSE} {ON}');
    });

    it('converts pathdir', () => {
        expect(jmc('#pathdir {n s}')).toContain('#PATHDIR');
    });

    it('converts break', () => {
        expect(jmc('#break')).toContain('#BREAK');
    });

    it('converts daa', () => {
        expect(jmc('#daa {mypassword}')).toContain('#SEND');
    });

    it('produces NOP for unknown Windows commands', () => {
        expect(jmc('#hidewindow')).toContain('#NOP');
        expect(jmc('#restorewindow')).toContain('#NOP');
        expect(jmc('#winamp {play}')).toContain('#NOP');
    });

    it('produces NOP for path recording commands', () => {
        expect(jmc('#mark start')).toContain('#NOP');
        expect(jmc('#path')).toContain('#NOP');
        expect(jmc('#return')).toContain('#NOP');
    });
});
