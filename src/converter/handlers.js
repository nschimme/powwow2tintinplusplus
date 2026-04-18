/**
 * Command Handlers for Powwow and JMC
 */

export function getPowwowHandlers(converter) {
    const handlers = {
        'alias': (args, options) => converter.convertAliasPowwow(args, options),
        'action': (args, options) => converter.convertActionPowwow(args, options),
        'var': (args, options) => converter.convertVarPowwow(args, options),
        'mark': (args, options) => converter.convertMarkPowwow(args, options),
        'hilite': (args, options) => ({ text: `#HIGHLIGHT {.*} {${args}}` }),
        'beep': () => ({ text: `#BELL` }),
        'bind': (args, options) => converter.convertBindPowwow(args, options),
        'emulate': (args, options) => ({ text: `#SHOWME {${converter.convertSyntax(args, options)}}` }),
        'temp': (args, options) => {
            const match = args.match(/^{([^}]+)}\s*(.*)/s) || args.match(/^(\S+)\s*(.*)/s);
            if (match) {
                const pattern = converter.convertSyntax(match[1].trim().replace(/^{|}$/g, ''), options);
                const cmds = match[2].trim();
                return { text: `#LINE ONESHOT #ACTION {${pattern}} {${converter.processCommands(cmds, options)}}` };
            }
            return { text: `#NOP UNCONVERTED TEMP: #temp ${args}` };
        },
        'time': () => ({ text: `#FORMAT {powwow_at_time} {%t} {%Y-%m-%d %H:%M:%S}` }),
        'save': (args, options) => ({ text: `#WRITE {${args || 'converted.tin'}}` }),
        'load': (args, options) => ({ text: `#READ {${args || 'converted.tin'}}` }),
        'if': (args, options) => converter.convertIfPowwow(args, options),
        'else': (args, options) => ({ text: `#ELSE {${converter.processCommands(args, options)}}` }),
        'while': (args, options) => converter.convertWhilePowwow(args, options),
        'for': (args, options) => converter.convertForPowwow(args, options),
        'print': (args, options) => ({ text: args ? `#SHOWME {${converter.convertSyntax(args, options)}}` : `#LINE PRINT` }),
        'send': (args, options) => {
            if (args.startsWith('<')) return { text: `#TEXTIN {${args.substring(1).trim()}}` };
            if (args.startsWith('!')) return { text: `#SYSTEM {${args.substring(1).trim()}}` };
            return { text: converter.convertSyntax(args, options) };
        },
        'in': (args, options) => converter.convertTickerPowwow(args, 'in', options),
        'at': (args, options) => converter.convertTickerPowwow(args, 'at', options),
        'prompt': (args, options) => converter.convertPromptPowwow(args, options),
        'group': (args, options) => {
            const pwGroupMatch = args.match(/^(\S+)\s+(on|off)/i);
            if (pwGroupMatch) {
                return { text: pwGroupMatch[2].toLowerCase() === 'on' ? `#CLASS {${pwGroupMatch[1]}} {OPEN}` : `#CLASS {${pwGroupMatch[1]}} {KILL}` };
            }
            return { text: `#NOP UNCONVERTED POWWOW GROUP: #group ${args}` };
        },
        'reset': (args, options) => converter.convertReset(args, options),
        'do': (args, options) => {
            const doMatch = args.match(/^\((.*)\)\s*(.*)$/s);
            if (doMatch) {
                return { text: `#MATH {p_do_cnt} {${converter.convertSyntax('(' + doMatch[1] + ')', options)}}; #$p_do_cnt {${converter.processCommands(doMatch[2], options)}}` };
            }
            return { text: `#NOP UNCONVERTED DO: #do ${args}` };
        },
        'nice': (args, options) => ({ text: `#NOP NICE (Priority) ignored: #nice ${args}` }),
        'identify': (args, options) => ({ text: `#NOP IDENTIFY ignored: #identify ${args}` }),
        '!': (args, options) => ({ text: `#SYSTEM {${args}}` }),
        'request': (args, options) => ({ text: `#NOP REQUEST ignored: #request ${args}` }),
        'option': (args, options) => {
            const match = args.match(/^([+-])(\w+)/);
            if (match) {
                const [, op, name] = match;
                if (name.toLowerCase() === 'autoprint') {
                    converter.state.powwow.autoprint = (op === '+' || op === '=');
                    return { text: `#NOP OPTION autoprint set to ${op === '-' ? 'OFF' : 'ON'}` };
                }
            }
            return { text: `#NOP OPTION ignored: #option ${args}` };
        },
        'sep': (args, options) => {
            converter.setSeparator(args);
            return { text: `#NOP SEPARATOR set to ${args}` };
        },
        'quit': () => ({ text: `#END` }),
        'exe': (args, options) => {
            if (args.startsWith('!')) return { text: `#SCRIPT {${args.substring(1).trim()}}` };
            if (args.startsWith('<')) return { text: `#READ {${args.substring(1).trim()}}` };
            if (args.startsWith('(')) {
                const expr = args.substring(1, args.lastIndexOf(')')).trim();
                return { text: `#MATH {p_exe_tmp} {${converter.convertSyntax('(' + expr + ')', options)}}; #$p_exe_tmp` };
            }
            return { text: converter.processCommands(converter.convertSyntax(args, options), options) };
        }
    };

    const aliases = {
        'al': 'alias',
        'ac': 'action',
        'setvar': 'var',
        'bi': 'bind',
        'emu': 'emulate',
        'ex': 'exe'
    };

    for (const [alias, target] of Object.entries(aliases)) {
        handlers[alias] = handlers[target];
    }

    return handlers;
}

export function getJMCHandlers(converter) {
    const handlers = {
        'alias': (args, options) => converter.convertAliasJMC(args, options),
        'action': (args, options) => converter.convertActionJMC(args, options),
        'variable': (args, options) => converter.convertVarJMC(args, options),
        'if': (args, options) => converter.convertIfJMC(args, options),
        'else': (args, options) => ({ text: `#ELSE {${converter.processCommands(args, options)}}` }),
        'math': (args, options) => converter.convertMathJMC(args, options),
        'group': (args, options) => converter.convertGroupJMC(args, options),
        'highlight': (args, options) => converter.convertHighlightJMC(args, options),
        'gag': (args, options) => converter.convertGagJMC(args, options),
        'substitute': (args, options) => converter.convertSubstituteJMC(args, options),
        'antisubstitute': (args, options) => ({ text: `#ANTISUBSTITUTE {${converter.convertSyntax(converter.cleanJMCArgs(args), options)}}` }),
        'unsubstitute': (args, options) => ({ text: `#UNSUB {${converter.convertSyntax(converter.cleanJMCArgs(args), options)}}` }),
        'loop': (args, options) => converter.convertLoopJMC(args, options),
        'tolower': (args, options) => converter.convertToLowerJMC(args, options),
        'toupper': (args, options) => converter.convertToUpperJMC(args, options),
        'unalias': (args, options) => ({ text: `#UNALIAS {${converter.convertSyntax(converter.cleanJMCArgs(args), options)}}` }),
        'unaction': (args, options) => ({ text: `#UNACT {${converter.convertSyntax(converter.cleanJMCArgs(args), options)}}` }),
        'unvar': (args, options) => ({ text: `#UNVAR {${converter.convertVarName(converter.cleanJMCArgs(args))}}` }),
        'showme': (args, options) => {
            const cleaned = converter.cleanJMCArgs(args);
            if (!cleaned) return { text: `#LINE PRINT` };
            return { text: `#SHOWME {${converter.convertSyntax(cleaned, options)}}` };
        },
        'output': (args, options) => {
            const cleaned = converter.cleanJMCArgs(args);
            if (!cleaned) return { text: `#LINE PRINT` };
            return { text: `#SHOWME {${converter.convertSyntax(cleaned, options)}}` };
        },
        'bell': () => ({ text: `#BELL` }),
        'break': () => ({ text: `#BREAK` }),
        'kickall': () => ({ text: `#KILL ALL` }),
        'killall': () => ({ text: `#KILL ALL` }),
        'flash': () => ({ text: `#BELL` }),
        'char': (args, options) => ({ text: `#CONFIG {COMMAND_CHAR} {${converter.cleanJMCArgs(args)}}` }),
        'pathdir': (args, options) => ({ text: `#PATHDIR {${converter.cleanJMCArgs(args)}}` }),
        'wait': (args, options) => ({ text: `#DELAY {${converter.cleanJMCArgs(args)}}` }),
        'echo': (args, options) => {
            const cleaned = converter.cleanJMCArgs(args);
            if (!cleaned) return { text: `#LINE PRINT` };
            const lower = cleaned.toLowerCase();
            if (lower === 'on') return { text: `#CONFIG {VERBOSE} {ON}` };
            if (lower === 'off') return { text: `#CONFIG {VERBOSE} {OFF}` };
            return { text: `#SHOWME {${converter.convertSyntax(cleaned, options)}}` };
        },
        'quit': () => ({ text: `#END` }),
        'zap': () => ({ text: `#ZAP` }),
        'read': (args, options) => ({ text: `#READ {${args}}` }),
        'write': (args, options) => ({ text: `#WRITE {${args}}` }),
        'log': (args, options) => {
            const parts = converter.tokenize(args, ' ');
            if (parts.length >= 2) {
                const file = parts[0].trim().replace(/^{|}$/g, '');
                const mode = parts[1].trim().toLowerCase() === 'overwrite' ? 'OVERWRITE' : 'APPEND';
                return { text: `#LOG {${mode}} {${file}}` };
            }
            if (args.trim() === '') return { text: `#LOG OFF` };
            return { text: `#LOG APPEND {${args}}` };
        },
        'textin': (args, options) => ({ text: `#TEXTIN {${args}}` }),
        'systemexec': (args, options) => ({ text: `#SYSTEM {${args}}` }),
        'speedwalk': (args, options) => {
            const cleaned = converter.cleanJMCArgs(args);
            const lower = cleaned.toLowerCase();
            if (lower === 'on') return { text: `#CONFIG {SPEEDWALK} {ON}` };
            if (lower === 'off') return { text: `#CONFIG {SPEEDWALK} {OFF}` };
            return { text: `#NOP JMC SPEEDWALK: #speedwalk ${args}` };
        },
        'hotkey': (args, options) => converter.convertHotkeyJMC(args, options),
        'unhotkey': (args, options) => ({ text: `#UNMACRO {${args}}` }),
        'message': (args, options) => {
            if (args.toLowerCase().includes('off')) return { text: `#CONFIG {VERBOSE} {OFF}` };
            if (args.toLowerCase().includes('on')) return { text: `#CONFIG {VERBOSE} {ON}` };
            return { text: `#NOP JMC MESSAGE: #message ${args}` };
        },
        'multiaction': (args, options) => {
            if (args.toLowerCase() === 'on') return { text: `#NOP JMC MULTIACTION ON (TT++ default)` };
            if (args.toLowerCase() === 'off') return { text: `#NOP JMC MULTIACTION OFF (Not directly supported in TT++ without logic)` };
            return { text: `#NOP JMC MULTIACTION: #multiaction ${args}` };
        },
        'multihighlight': (args, options) => {
            if (args.toLowerCase() === 'on') return { text: `#NOP JMC MULTIHIGHLIGHT ON (TT++ default)` };
            if (args.toLowerCase() === 'off') return { text: `#NOP JMC MULTIHIGHLIGHT OFF (Not directly supported in TT++)` };
            return { text: `#NOP JMC MULTIHIGHLIGHT: #multihighlight ${args}` };
        },
        'presub': (args, options) => {
            if (args.toLowerCase() === 'on') return { text: `#NOP JMC PRESUB ON (Not directly supported in TT++)` };
            if (args.toLowerCase() === 'off') return { text: `#NOP JMC PRESUB OFF (TT++ default)` };
            return { text: `#NOP JMC PRESUB: #presub ${args}` };
        },
        'verbatim': (args, options) => {
            if (args.toLowerCase() === 'on') return { text: `#CONFIG {VERBATIM} {ON}` };
            if (args.toLowerCase() === 'off') return { text: `#CONFIG {VERBATIM} {OFF}` };
            return { text: `#NOP JMC VERBATIM: #verbatim ${args}` };
        },
        'colon': (args, options) => {
            return { text: `#NOP JMC COLON: #colon ${args}` };
        },
        'comment': (args, options) => ({ text: `#NOP ${args}` }),
        'nope': (args, options) => ({ text: `#NOP ${args}` }),
        'script': (args, options) => ({ text: `#NOP JMC SCRIPT (Internal logic needed): #script ${args}` }),
        'tick': () => ({ text: `#NOP JMC TICK (Display remaining time): #TICK` }),
        'ticksize': (args, options) => ({ text: `#VARIABLE {j_ticksize} {${args}}; #TICKER {jmc_tick} {#SHOWME #TICK} {${args}}` }),
        'tickon': () => ({ text: `#TICKER {jmc_tick} {#SHOWME #TICK} {$j_ticksize}` }),
        'tickset': () => ({ text: `#TICKER {jmc_tick} {#SHOWME #TICK} {$j_ticksize}` }),
        'tickoff': () => ({ text: `#UNTICKER {jmc_tick}` }),
        'drop': (args, options) => ({ text: args ? `#NOP UNCONVERTED DROP: #drop ${args}` : `#LINE GAG` }),
        'cr': () => ({ text: `#SEND {\n}` }),
        'daa': (args, options) => ({ text: `#SEND {${args}}; #LINE GAG; #NOP DAA/HIDE/WHISPER (Secure send)` }),
        'hide': (args, options) => ({ text: `#SEND {${args}}; #LINE GAG; #NOP DAA/HIDE/WHISPER (Secure send)` }),
        'whisper': (args, options) => ({ text: `#SEND {${args}}; #LINE GAG; #NOP DAA/HIDE/WHISPER (Secure send)` }),
        'ignore': (args, options) => ({ text: args ? `#IGNORE {${converter.convertSyntax(converter.cleanJMCArgs(args), options)}}` : `#IGNORE` })
    };

    const aliases = {
        'al': 'alias',
        'ac': 'action',
        'act': 'action',
        'var': 'variable',
        'va': 'variable',
        'sub': 'substitute',
        'antisub': 'antisubstitute',
        'unsub': 'unsubstitute',
        'unali': 'unalias',
        'unac': 'unaction',
        'unact': 'unaction',
        'wt': 'wait',
        'hot': 'hotkey',
        'verbat': 'verbatim'
    };

    for (const [alias, target] of Object.entries(aliases)) {
        handlers[alias] = handlers[target];
    }

    return handlers;
}
