/**
 * Command Handlers for Powwow and JMC
 */

export function getPowwowHandlers(converter) {
    const handlers = {
        'alias': (args, options) => converter.convertAliasPowwow(args, options),
        'action': (args, options) => converter.convertActionPowwow(args, options),
        'add': (args, options) => ({ text: `#TAB {${converter.convertSyntax(args, options)}}` }),
        'addstatic': (args, options) => ({ text: `#TAB {${converter.convertSyntax(args, options)}}` }),
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
        'isprompt': (args, options) => ({ text: `#NOP ISPROMPT (TT++ #PROMPT handles prompt detection)` }),
        'module': (args, options) => ({ text: `#NOP MODULE not supported: #module ${args}` }),
        'perl': (args, options) => ({ text: `#NOP PERL not supported: #perl ${args}` }),
        'speed': (args, options) => {
            const seq = args.trim().replace(/^{|}$/g, '').trim();
            return { text: `#SEND {${seq}}` };
        },
        'write': (args, options) => {
            const overwrite = args.trimStart().startsWith('>');
            const rest = overwrite ? args.trimStart().substring(1).trim() : args.trim();
            const block = converter.extractBlock(rest, '(', ')');
            if (block) {
                const semi = block.inner.indexOf(';');
                if (semi !== -1) {
                    const rawData = block.inner.substring(0, semi).trim();
                    const rawFile = block.inner.substring(semi + 1).trim();
                    const data = converter.convertSyntax(rawData, options);
                    const file = converter.convertSyntax(rawFile, options).replace(/^"|"$/g, '');
                    const redirect = overwrite ? '>' : '>>';
                    return { text: `#SYSTEM {printf '%s\\n' "${data}" ${redirect} ${file}}` };
                }
            }
            return { text: `#NOP WRITE not directly supported: #write ${args}` };
        },
        'rawsend': (args, options) => {
            const inner = args.trim();
            if (inner.startsWith('(') && inner.endsWith(')')) {
                const val = converter.convertSyntax(inner, options);
                return { text: `#SEND {${val.replace(/^\(|\)$/g, '')}}` };
            }
            return { text: `#SEND {${converter.convertSyntax(inner, options)}}` };
        },
        'zap': (args, options) => {
            const name = args.trim();
            return { text: name ? `#CLOSE {${name}}` : `#ZAP` };
        },
        'connect': (args, options) => {
            const parts = args.trim().split(/\s+/);
            if (parts.length >= 3) {
                const [name, host, port] = parts;
                return { text: `#SESSION {${name}} {${host}} {${port}}` };
            }
            return { text: `#NOP UNCONVERTED CONNECT: #connect ${args}` };
        },
        'delim': (args, options) => ({ text: `#NOP DELIM ignored (TT++ uses ; by default): #delim ${args}` }),
        'file': (args, options) => ({ text: `#NOP FILE ignored: #file ${args}` }),
        'savefile-version': (args, options) => ({ text: `#NOP savefile-version ${args}` }),
        'option': (args, options) => {
            const OPTION_MAP = {
                'compact': ['#CONFIG {COMPACT} {ON}', '#CONFIG {COMPACT} {OFF}'],
                'echo': ['#CONFIG {VERBOSE} {ON}', '#CONFIG {VERBOSE} {OFF}'],
                'speedwalk': ['#CONFIG {SPEEDWALK} {ON}', '#CONFIG {SPEEDWALK} {OFF}'],
                'wrap': ['#CONFIG {WORDWRAP} {ON}', '#CONFIG {WORDWRAP} {OFF}'],
            };
            const tokens = args.trim().split(/\s+/);
            const lines = [];
            for (const token of tokens) {
                const match = token.match(/^([+-=])(\w+)/);
                if (!match) continue;
                const [, op, name] = match;
                const lower = name.toLowerCase();
                if (lower === 'autoprint') {
                    converter.state.powwow.autoprint = (op === '+' || op === '=');
                    lines.push(`#NOP OPTION autoprint set to ${op === '-' ? 'OFF' : 'ON'}`);
                } else if (OPTION_MAP[lower]) {
                    lines.push(op === '-' ? OPTION_MAP[lower][1] : OPTION_MAP[lower][0]);
                } else {
                    lines.push(`#NOP OPTION ignored: ${token}`);
                }
            }
            return { text: lines.length ? lines.join('\n') : `#NOP OPTION ignored: #option ${args}` };
        },
        'sep': (args, options) => {
            converter.setSeparator(args);
            return { text: `#NOP SEPARATOR set to ${args}` };
        },
        'quit': () => ({ text: `#END` }),
        'exe': (args, options) => {
            if (args.startsWith('!')) return { text: `#SCRIPT {${args.substring(1).trim()}}` };
            if (args.startsWith('<')) {
                const file = args.substring(1).trim().replace(/\.pow$/i, '.tin');
                return { text: `#READ {${file}}` };
            }
            if (args.startsWith('(')) {
                const lastParen = args.lastIndexOf(')');
                if (lastParen !== -1) {
                    const expr = args.substring(1, lastParen).trim();
                    return { text: `#MATH {p_exe_tmp} {${converter.convertSyntax('(' + expr + ')', options)}}; #$p_exe_tmp` };
                }
            }
            return { text: converter.processCommands(converter.convertSyntax(args, options), options) };
        }
    };

    // True synonyms (non-prefix): these cannot be resolved by prefix matching alone
    const aliases = {
        'setvar': 'var'  // setvar is not a prefix of var
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
        'showme': (args, options) => convertDisplayJMC(converter, args, options),
        'output': (args, options) => convertDisplayJMC(converter, args, options),
        'bell': () => ({ text: `#BELL` }),
        'break': () => ({ text: `#BREAK` }),
        'kickall': () => ({ text: `#KILL ALL` }),
        'killall': () => ({ text: `#KILL ALL` }),
        'flash': () => ({ text: `#BELL` }),
        'char': (args, options) => ({ text: `#CONFIG {COMMAND_CHAR} {${converter.cleanJMCArgs(args)}}` }),
        'pathdir': (args, options) => ({ text: `#PATHDIR {${converter.cleanJMCArgs(args)}}` }),
        'wait': (args, options) => ({ text: `#DELAY {${converter.cleanJMCArgs(args)}}` }),
        'echo': (args, options) => {
            const cleaned = converter.cleanJMCArgs(args).toLowerCase();
            if (cleaned === 'on') return { text: `#CONFIG {VERBOSE} {ON}` };
            if (cleaned === 'off') return { text: `#CONFIG {VERBOSE} {OFF}` };
            return convertDisplayJMC(converter, args, options);
        },
        'quit': () => ({ text: `#END` }),
        'zap': () => ({ text: `#ZAP` }),
        'read': (args, options) => ({ text: `#READ {${args}}` }),
        'write': (args, options) => ({ text: `#WRITE {${args}}` }),
        'log': (args, options) => {
            const parts = converter.tokenize(args, ' ');
            if (parts.length >= 2) {
                const file = parts[0].trim().replace(/^{|}$/g, '');
                const mode = parts[1].trim().replace(/^{|}$/g, '').toLowerCase() === 'overwrite' ? 'OVERWRITE' : 'APPEND';
                return { text: `#LOG {${mode}} {${file}}` };
            }
            if (args.trim() === '') return { text: `#LOG OFF` };
            return { text: `#LOG APPEND {${converter.cleanJMCArgs(args)}}` };
        },
        'textin': (args, options) => ({ text: `#TEXTIN {${converter.cleanJMCArgs(args)}}` }),
        'systemexec': (args, options) => ({ text: `#SYSTEM {${converter.cleanJMCArgs(args)}}` }),
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
            const cleaned = converter.cleanJMCArgs(args).toLowerCase();
            // #message all off/on -> map to TT++ VERBOSE config
            if (cleaned === 'off' || cleaned === 'all off') return { text: `#CONFIG {VERBOSE} {OFF}` };
            if (cleaned === 'on' || cleaned === 'all on') return { text: `#CONFIG {VERBOSE} {ON}` };
            // #message alias/action/subst/hotkey off/on -> NOP (TT++ verbose is all-or-nothing)
            if (cleaned.includes('off')) return { text: `#NOP JMC MESSAGE OFF: ${args} (TT++ verbose is global)` };
            if (cleaned.includes('on')) return { text: `#NOP JMC MESSAGE ON: ${args} (TT++ verbose is global)` };
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
        'daa': (args, options) => convertSecureSendJMC(args),
        'hide': (args, options) => convertSecureSendJMC(args),
        'whisper': (args, options) => convertSecureSendJMC(args),
        'ignore': (args, options) => {
            const v = converter.cleanJMCArgs(args).toLowerCase();
            if (v === 'on') return { text: `#NOP JMC IGNORE ON (triggers disabled; TT++ has no global trigger toggle)` };
            if (v === 'off') return { text: `#NOP JMC IGNORE OFF (triggers enabled; TT++ default)` };
            return { text: args ? `#IGNORE {${converter.convertSyntax(v, options)}}` : `#IGNORE` };
        },

        // Tab completion
        'tabadd': (args, options) => ({ text: `#TAB {${converter.convertSyntax(converter.cleanJMCArgs(args), options)}}` }),
        'tabdel': (args, options) => ({ text: `#UNTAB {${converter.convertSyntax(converter.cleanJMCArgs(args), options)}}` }),

        // Antisubstitute management
        'unantisubstitute': (args, options) => ({ text: `#UNANTISUBSTITUTE {${converter.convertSyntax(converter.cleanJMCArgs(args), options)}}` }),

        // Line display control
        'nodrop': () => ({ text: `#LINE PRINT` }),

        // External execution
        'run': (args, options) => ({ text: `#SYSTEM {${converter.cleanJMCArgs(args)}}` }),

        // Path/movement saving
        'savepath': (args, options) => {
            const parts = converter.tokenize(args, ' ');
            const name = parts[0] ? parts[0].trim().replace(/^{|}$/g, '') : '';
            const reverse = parts[1] && parts[1].trim().toLowerCase() === 'reverse';
            if (name) return { text: `#SAVEPATH {${name}}${reverse ? ' {REVERSE}' : ''}` };
            return { text: `#NOP JMC SAVEPATH: missing alias name` };
        },

        // Connection
        'connect': (args, options) => {
            const cleaned = converter.cleanJMCArgs(args).trim();
            const colonMatch = cleaned.match(/^(\S+):(\d+)$/);
            const spaceMatch = cleaned.match(/^(\S+)\s+(\d+)$/);
            if (colonMatch) return { text: `#SESSION {jmc} {${colonMatch[1]}} {${colonMatch[2]}}` };
            if (spaceMatch) return { text: `#SESSION {jmc} {${spaceMatch[1]}} {${spaceMatch[2]}}` };
            if (cleaned) return { text: `#SESSION {jmc} {${cleaned}} {23}` };
            return { text: `#NOP JMC CONNECT: missing address` };
        },

        // Substitution toggles (no direct TT++ equivalent)
        'multisubstitute': (args, options) => {
            const v = converter.cleanJMCArgs(args).toLowerCase();
            if (v === 'on') return { text: `#NOP JMC MULTISUBSTITUTE ON (TT++ default: multiple substitutions apply)` };
            if (v === 'off') return { text: `#NOP JMC MULTISUBSTITUTE OFF (not directly supported in TT++)` };
            return { text: `#NOP JMC MULTISUBSTITUTE: #multisubstitute ${args}` };
        },
        'togglesubs': () => ({ text: `#NOP JMC TOGGLESUBS (toggle substitutions on/off)` }),

        // Auto reconnect
        'autoreconnect': (args, options) => {
            const v = converter.cleanJMCArgs(args).toLowerCase();
            if (v === 'on') return { text: `#NOP JMC AUTORECONNECT ON (consider a #ACTION {^} reconnect trigger)` };
            if (v === 'off') return { text: `#NOP JMC AUTORECONNECT OFF` };
            return { text: `#NOP JMC AUTORECONNECT: #autoreconnect ${args}` };
        },

        // Sound
        'play': (args, options) => ({ text: `#NOP JMC PLAY: play sound ${converter.cleanJMCArgs(args)}` }),

        // Logging extras
        'logadd': (args, options) => ({ text: `#NOP JMC LOGADD (manually add line to log)` }),
        'logpass': () => ({ text: `#NOP JMC LOGPASS (prevent line from being logged)` }),

        // File sending to MUD
        'spit': (args, options) => ({ text: `#NOP JMC SPIT (send file to MUD): #spit ${args}` }),

        // Trigger control
        'next': () => ({ text: `#NOP JMC NEXT (allow one more trigger iteration)` }),

        // Info/status display
        'info': () => ({ text: `#NOP JMC INFO (display trigger/alias/variable counts)` }),
        'status': (args, options) => ({ text: `#NOP JMC STATUS: #status ${args}` }),

        // Prefix for all MUD sends
        'prefix': (args, options) => ({ text: `#NOP JMC PREFIX: #prefix ${converter.cleanJMCArgs(args)}` }),

        // Loop management
        'llist': () => ({ text: `#NOP JMC LLIST (list active loops)` }),
        'tmlist': () => ({ text: `#NOP JMC TMLIST (list active loop timers)` }),
        'pinch': () => ({ text: `#NOP JMC PINCH (resume paused loop)` }),
        'resume': () => ({ text: `#NOP JMC RESUME (resume paused loop)` }),

        // Template management
        'sos': (args, options) => ({ text: `#NOP JMC SOS (template management): #sos ${args}` }),

        // Speedwalk formatting
        'race': (args, options) => ({ text: `#NOP JMC RACE (speedwalk formatting): #race ${args}` }),

        // File line reading
        'grab': (args, options) => ({ text: `#NOP JMC GRAB (read line from file): #grab ${args}` }),

        // Internal/undocumented
        'clean': () => ({ text: `#NOP JMC CLEAN (internal WM_USER+600 message)` }),

        // Scripting (JScript/VBScript)
        'scriptlet': (args, options) => ({ text: `#NOP JMC SCRIPTLET (external script engine): #scriptlet ${args}` }),
        'use': (args, options) => ({ text: `#NOP JMC USE (load script file): #use ${args}` }),
        'unuse': (args, options) => ({ text: `#NOP JMC UNUSE (remove script file): #unuse ${args}` }),
        'reloadscripts': () => ({ text: `#NOP JMC RELOADSCRIPTS (reload active script files)` }),

        // Window management (Windows-specific)
        'hidewindow': () => ({ text: `#NOP JMC HIDEWINDOW (minimize to taskbar)` }),
        'restorewindow': () => ({ text: `#NOP JMC RESTOREWINDOW (restore from minimized)` }),
        'tray': (args, options) => ({ text: `#NOP JMC TRAY (system tray): #tray ${args}` }),

        // Output window commands (Windows-specific)
        'woutput': (args, options) => ({ text: `#NOP JMC WOUTPUT (output window): #woutput ${args}` }),
        'wlog': (args, options) => ({ text: `#NOP JMC WLOG (output window log): #wlog ${args}` }),
        'wname': (args, options) => ({ text: `#NOP JMC WNAME (output window name): #wname ${args}` }),
        'wpos': (args, options) => ({ text: `#NOP JMC WPOS (output window position): #wpos ${args}` }),
        'wshow': (args, options) => ({ text: `#NOP JMC WSHOW (output window visibility): #wshow ${args}` }),
        'wdock': (args, options) => ({ text: `#NOP JMC WDOCK (output window docking): #wdock ${args}` }),

        // WinAMP control (Windows-specific)
        'winamp': (args, options) => ({ text: `#NOP JMC WINAMP (WinAMP control): #winamp ${args}` }),

        // Path recording
        'mark': (args, options) => ({ text: `#NOP JMC MARK (path recording): #mark ${args}` }),
        'map': (args, options) => ({ text: `#NOP JMC MAP (add to path buffer): #map ${args}` }),
        'path': () => ({ text: `#NOP JMC PATH (display path buffer)` }),
        'return': () => ({ text: `#NOP JMC RETURN (reverse last recorded direction)` }),
        'unpath': () => ({ text: `#NOP JMC UNPATH (remove last path entry)` }),

        // Help
        'help': (args, options) => ({ text: `#HELP${args ? ' ' + converter.cleanJMCArgs(args) : ''}` }),

        // Process management (systemexec processes)
        'terminate': (args, options) => ({ text: `#NOP JMC TERMINATE (kill systemexec process): #terminate ${args}` }),
        'ps': () => ({ text: `#NOP JMC PS (list systemexec processes)` })
    };

    // True synonyms (non-prefix): these cannot be resolved by prefix matching alone
    const aliases = {
        'wt': 'wait',       // wt is not a prefix of wait (starts with wa-)
        'feed': 'spit',     // synonym, not a prefix
        'lick': 'spit',     // synonym, not a prefix
        'stick': 'spit',    // synonym, not a prefix
        'wamp': 'winamp',   // wamp != prefix of winamp (wi-)
        'tskill': 'terminate',  // tskill != prefix of terminate
        'tslist': 'ps',         // tslist != prefix of ps
        'kickall': 'killall'    // kickall != prefix of killall
    };

    for (const [alias, target] of Object.entries(aliases)) {
        handlers[alias] = handlers[target];
    }

    return handlers;
}

function convertDisplayJMC(converter, args, options) {
    const cleaned = converter.cleanJMCArgs(args);
    if (!cleaned) return { text: `#LINE PRINT` };
    return { text: `#SHOWME {${converter.convertSyntax(cleaned, options)}}` };
}

function convertSecureSendJMC(args) {
    return { text: `#SEND {${args}}; #LINE GAG; #NOP DAA/HIDE/WHISPER (Secure send)` };
}
