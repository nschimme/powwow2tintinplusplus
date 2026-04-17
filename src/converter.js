/**
 * Robust Converter core logic for migrating to TinTin++
 */

export class TinTinConverter {
    constructor(options = {}) {
        this.separator = options.separator || ';';
        this.mode = options.mode || 'powwow'; // 'powwow' or 'jmc'
    }

    setSeparator(sep) {
        this.separator = sep;
    }

    setMode(mode) {
        this.mode = mode;
        if (this.mode === 'jmc') {
            this.separator = ';';
        }
    }

    /**
     * Tokenizes a string into a list of commands, respecting braces, parentheses and quotes.
     */
    tokenize(str, separator = this.separator) {
        const commands = [];
        let current = '';
        let braceLevel = 0;
        let parenLevel = 0;
        let inQuotes = false;
        let escaped = false;

        for (let i = 0; i < str.length; i++) {
            const char = str[i];

            if (escaped) {
                current += char;
                escaped = false;
                continue;
            }

            if (char === '\\') {
                current += char;
                escaped = true;
                continue;
            }

            if (char === '"') {
                inQuotes = !inQuotes;
                current += char;
            } else if (char === '{' && !inQuotes) {
                braceLevel++;
                current += char;
            } else if (char === '}' && !inQuotes) {
                braceLevel--;
                current += char;
            } else if (char === '(' && !inQuotes) {
                parenLevel++;
                current += char;
            } else if (char === ')' && !inQuotes) {
                parenLevel--;
                current += char;
            } else if (char === separator && braceLevel === 0 && parenLevel === 0 && !inQuotes) {
                commands.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            commands.push(current.trim());
        }

        return commands;
    }

    /**
     * Converts Source syntax to TinTin++ syntax.
     */
    convertSyntax(str) {
        if (this.mode === 'powwow') {
            if (str.startsWith('(') && str.endsWith(')')) {
                let inner = str.substring(1, str.length - 1).trim();
                let result = this.processInlineFunctions(inner);
                return this.convertSubstitutions(result);
            }
        }

        return this.convertSubstitutions(str);
    }

    processInlineFunctions(str) {
        // 1. Handle attr and noattr
        str = str.replace(/attr\s*\("([^"]+)"\)/g, (match, attr) => this.mapAttributes(attr));
        str = str.replace(/attr\s+"([^"]+)"/g, (match, attr) => this.mapAttributes(attr));
        str = str.replace(/noattr/g, '<099>');

        // 2. Concatenation
        let lastStr;
        do {
            lastStr = str;
            str = str.replace(/"([^"]*)"\s*\+\s*"([^"]*)"/g, '"$1$2"');
            str = str.replace(/"([^"]*)"\s*\+\s*([@$][a-zA-Z0-9_-]+)/g, '"$1$2"');
            str = str.replace(/([@$][a-zA-Z0-9_-]+)\s*\+\s*"([^"]*)"/g, '"$1$2"');
            str = str.replace(/([@$][a-zA-Z0-9_-]+)\s*\+\s*([@$][a-zA-Z0-9_-]+)/g, '$1$2');
            str = str.replace(/(<[0-9]+>)\s*\+\s*"([^"]*)"/g, '$1$2');
            str = str.replace(/"([^"]*)"\s*\+\s*(<[0-9]+>)/g, '$1$2');
            str = str.replace(/(<[0-9]+>)\s*\+\s*(<[0-9]+>)/g, '$1$2');
            str = str.replace(/\s*\+\s*/g, '');
        } while (str !== lastStr);

        str = str.replace(/^"/, '').replace(/"$/, '');

        return str;
    }

    convertVarName(name) {
        const prefix = this.mode === 'jmc' ? 'j_' : 'p_';
        const arrayPrefix = this.mode === 'jmc' ? 'jmc' : 'powwow';
        const namedPrefix = this.mode === 'jmc' ? 'j_' : 'p_';

        if (name.startsWith('@')) {
            const numMatch = name.match(/^@(-?\d+)$/);
            if (numMatch) {
                const n = numMatch[1];
                return n.startsWith('-') ? `${prefix}at_m${n.substring(1)}` : `${arrayPrefix}_at[${n}]`;
            }
            return `${arrayPrefix}_at_${name.substring(1)}`;
        } else if (name.startsWith('$')) {
            const numMatch = name.match(/^\$(-?\d+)$/);
            if (numMatch) {
                const n = numMatch[1];
                return n.startsWith('-') ? `${prefix}dollar_m${n.substring(1)}` : `${arrayPrefix}_dollar[${n}]`;
            }
            return `${namedPrefix}${name.substring(1)}`;
        }
        return prefix + name;
    }

    convertSubstitutions(str) {
        if (this.mode === 'powwow') {
            // 1. Delayed parameter substitution: \$1 -> %%1
            str = str.replace(/\\\$(\d+)/g, '%%$1');
            str = str.replace(/\\&(\d+)/g, '%%$1');

            // 2. Named parameters/variables in ${var} or #{expr}
            str = str.replace(/\${([a-zA-Z0-9_-]+)}/g, (match, name) => {
                return `__VAR__p_${name}`;
            });
            str = str.replace(/#{([^}]+)}/g, (match, expr) => {
                return `\$math_eval{${this.convertSyntax('(' + expr + ')')}}`;
            });

            // 3. Variables:
            str = str.replace(/@([a-zA-Z_]\w*)/g, (match, name) => `__VAR__${this.convertVarName('@' + name)}`);
            str = str.replace(/@(\d+)/g, (match, num) => `__VAR__${this.convertVarName('@' + num)}`);

            str = str.replace(/(?<![\\%])\$([a-zA-Z_]\w+)/g, (match, name) => `__VAR__${this.convertVarName('$' + name)}`);

            // 4. Standard parameters: $N -> %N, &N -> %N
            str = str.replace(/(?<!\\)\$(\d+)/g, '%$1');
            str = str.replace(/(?<!\\)&(\d+)/g, '%$1');

            // Replace placeholders back with $ prefix
            str = str.replace(/__VAR__/g, '$');
        } else if (this.mode === 'jmc') {
            // JMC uses %0-%9 for parameters and $var for variables
            // Standard parameters: %N -> %N (no change needed for TT++)

            // Variables: $var -> $j_var
            str = str.replace(/(?<![\\%])\$([a-zA-Z_]\w*)/g, (match, name) => `\$${this.convertVarName(name)}`);
        }

        return str;
    }

    mapAttributes(attr) {
        const parts = attr.toLowerCase().split(/\s+/);
        let vt100 = '0';
        if (parts.includes('bold')) vt100 = '1';
        if (parts.includes('blink')) vt100 = '5';
        if (parts.includes('underline')) vt100 = '4';
        if (parts.includes('inverse') || parts.includes('reverse')) vt100 = '7';

        const colors = {
            'black': '0', 'red': '1', 'green': '2', 'yellow': '3',
            'blue': '4', 'magenta': '5', 'cyan': '6', 'white': '7'
        };

        let fg = '7';
        for (const [name, val] of Object.entries(colors)) {
            if (parts.includes(name)) {
                fg = val;
                break;
            }
        }

        return `<${vt100}${fg}9>`;
    }

    processCommands(commandString) {
        if (!commandString) return '';
        let commandsStr = commandString.trim();
        if (commandsStr.startsWith('{') && commandsStr.endsWith('}')) {
            commandsStr = commandsStr.substring(1, commandsStr.length - 1).trim();
        }
        if (commandsStr === '') return '';

        const tokens = this.tokenize(commandsStr);
        const processed = [];
        for (let i = 0; i < tokens.length; i++) {
            let t = tokens[i].trim();
            if (t === '') continue;

            if (t.toLowerCase().startsWith('#if')) {
                // Peek for #else (Powwow specific or JMC if it follows that pattern)
                if (this.mode === 'powwow') {
                    if (i + 1 < tokens.length && tokens[i+1].trim().toLowerCase().startsWith('#else')) {
                        t += '; ' + tokens[i+1].trim();
                        i++;
                    }
                }
            }

            if (t.startsWith('#')) {
                processed.push(this.convertSingleCommand(t));
            } else {
                processed.push(this.convertSyntax(t));
            }
        }

        return processed.join('; ');
    }

    cleanJMCArgs(args) {
        return args.trim().replace(/^{|}$/g, '').trim();
    }

    convertSingleCommand(line) {
        line = line.trim();

        if (this.mode === 'powwow' && line.startsWith('#!')) {
            return `#SYSTEM {${line.substring(2).trim()}}`;
        }

        if (this.mode === 'powwow') {
            // Group toggle or label direct commands: #+label, #-label, #>label, #<label, #=label, #%label
            const toggleMatch = line.match(/^#\s*([<=>%+-])([\w_-]+)\s*$/);
            if (toggleMatch) {
                const [, op, label] = toggleMatch;
                if (op === '+' || op === '=') return `#CLASS {${label}} {OPEN}`;
                if (op === '-' || op === '<') return `#CLASS {${label}} {KILL}`;
                if (op === '%') return `#IF {&class_${label}} {#CLASS {${label}} {KILL}} {#ELSE} {#CLASS {${label}} {OPEN}}`;
                if (op === '>') return `#CLASS {${label}} {OPEN}`;
            }

            // Handle # (expression) or #(expression)
            const exprMatch = line.match(/^#\s*\((.*)\)$/s);
            if (exprMatch) {
                const expr = exprMatch[1].trim();
                const assignMatch = expr.match(/^([@$][a-zA-Z0-9_-]+)\s*=(.*)$/s);
                if (assignMatch) {
                    const name = this.convertVarName(assignMatch[1]);
                    return `#MATH {${name}} {${this.convertSyntax('(' + assignMatch[2].trim() + ')')}}`;
                }
                return `#MATH {p_result} {${this.convertSyntax('(' + expr + ')')}}`;
            }
        }

        // Repeat #5 north
        const repeatMatch = line.match(/^#(\d+)\s+(.*)/s);
        if (repeatMatch) {
            return `#${repeatMatch[1]} {${this.processCommands(repeatMatch[2])}}`;
        }

        const cmdMatch = line.match(/^#\s*([a-zA-Z_]+)\s*(.*)/s);
        if (!cmdMatch) {
            return this.convertSyntax(line);
        }

        const command = cmdMatch[1].toLowerCase();
        let args = cmdMatch[2].trim();

        if (this.mode === 'powwow') {
            switch (command) {
                case 'al':
                case 'alias':
                    return this.convertAliasPowwow(args);
                case 'ac':
                case 'action':
                    return this.convertActionPowwow(args);
                case 'setvar':
                case 'var':
                    return this.convertVarPowwow(args);
                case 'mark':
                    return this.convertMarkPowwow(args);
                case 'hilite':
                    return `#HIGHLIGHT {.*} {${args}}`;
                case 'beep':
                    return `#BELL`;
                case 'time':
                    return `#FORMAT {powwow_at_time} {%t} {%Y-%m-%d %H:%M:%S}`;
                case 'save':
                    return `#WRITE {${args || 'converted.tin'}}`;
                case 'load':
                    return `#READ {${args || 'converted.tin'}}`;
                case 'if':
                    return this.convertIfPowwow(args);
                case 'while':
                    return this.convertWhilePowwow(args);
                case 'for':
                    return this.convertForPowwow(args);
                case 'print':
                    return `#SHOWME {${this.convertSyntax(args)}}`;
                case 'send':
                    if (args.startsWith('<')) return `#TEXTIN {${args.substring(1).trim()}}`;
                    if (args.startsWith('!')) return `#SYSTEM {${args.substring(1).trim()}}`;
                    return this.convertSyntax(args);
                case 'in':
                case 'at':
                    return this.convertTickerPowwow(args, command);
                case 'prompt':
                    return this.convertPromptPowwow(args);
                case 'group':
                    const pwGroupMatch = args.match(/^(\S+)\s+(on|off)/i);
                    if (pwGroupMatch) {
                        return pwGroupMatch[2].toLowerCase() === 'on' ? `#CLASS {${pwGroupMatch[1]}} {OPEN}` : `#CLASS {${pwGroupMatch[1]}} {KILL}`;
                    }
                    return `#COMMENT UNCONVERTED POWWOW GROUP: #group ${args}`;
                case 'reset':
                    return this.convertReset(args);
                case 'do':
                    const doMatch = args.match(/^\((.*)\)\s*(.*)$/s);
                    if (doMatch) {
                        return `#MATH {p_do_cnt} {${this.convertSyntax('(' + doMatch[1] + ')')}}; #$p_do_cnt {${this.processCommands(doMatch[2])}}`;
                    }
                    return `#COMMENT UNCONVERTED DO: #do ${args}`;
                case 'nice':
                    return `#COMMENT NICE (Priority) ignored: #nice ${args}`;
                case 'identify':
                    return `#COMMENT IDENTIFY ignored: #identify ${args}`;
                case '!':
                    return `#SYSTEM {${args}}`;
                case 'request':
                    return `#COMMENT REQUEST ignored: #request ${args}`;
                case 'option':
                    return `#COMMENT OPTION ignored: #option ${args}`;
                case 'sep':
                    this.setSeparator(args);
                    return `#COMMENT SEPARATOR set to ${args}`;
                case 'quit':
                    return `#END`;
                default:
                    return `#COMMENT UNSUPPORTED: ${line}`;
            }
        } else if (this.mode === 'jmc') {
            switch (command) {
                case 'al':
                case 'alias':
                    return this.convertAliasJMC(args);
                case 'ac':
                case 'action':
                    return this.convertActionJMC(args);
                case 'var':
                case 'variable':
                    return this.convertVarJMC(args);
                case 'if':
                    return this.convertIfJMC(args);
                case 'math':
                    return this.convertMathJMC(args);
                case 'group':
                    return this.convertGroupJMC(args);
                case 'highlight':
                    return this.convertHighlightJMC(args);
                case 'gag':
                    return this.convertGagJMC(args);
                case 'sub':
                case 'substitute':
                    return this.convertSubstituteJMC(args);
                case 'antisubstitute':
                case 'antisub':
                    return `#ANTISUBSTITUTE {${this.convertSyntax(this.cleanJMCArgs(args))}}`;
                case 'unsubstitute':
                case 'unsub':
                    return `#UNSUB {${this.convertSyntax(this.cleanJMCArgs(args))}}`;
                case 'loop':
                    return this.convertLoopJMC(args);
                case 'tolower':
                    return this.convertToLowerJMC(args);
                case 'toupper':
                    return this.convertToUpperJMC(args);
                case 'unalias':
                    return `#UNALIAS {${this.convertSyntax(this.cleanJMCArgs(args))}}`;
                case 'unaction':
                    return `#UNACT {${this.convertSyntax(this.cleanJMCArgs(args))}}`;
                case 'unvar':
                    return `#UNVAR {${this.convertVarName(this.cleanJMCArgs(args))}}`;
                case 'showme':
                case 'output':
                    return `#SHOWME {${this.convertSyntax(this.cleanJMCArgs(args))}}`;
                case 'bell':
                    return `#BELL`;
                case 'break':
                    return `#BREAK`;
                case 'pathdir':
                    return `#PATHDIR {${this.cleanJMCArgs(args)}}`;
                case 'wait':
                case 'wt':
                    return `#DELAY {${this.cleanJMCArgs(args)}}`;
                case 'echo':
                    if (args.toLowerCase() === 'on') return `#CONFIG {VERBOSE} {ON}`;
                    if (args.toLowerCase() === 'off') return `#CONFIG {VERBOSE} {OFF}`;
                    return `#SHOWME {${this.convertSyntax(args)}}`;
                case 'quit':
                    return `#END`;
                case 'zap':
                    return `#ZAP`;
                case 'killall':
                    return `#KILL ALL`;
                case 'read':
                    return `#READ {${args}}`;
                case 'write':
                    return `#WRITE {${args}}`;
                case 'log':
                    return `#LOG {${args}}`;
                case 'textin':
                    return `#TEXTIN {${args}}`;
                case 'systemexec':
                    return `#SYSTEM {${args}}`;
                case 'speedwalk':
                    if (args.toLowerCase() === 'on') return `#CONFIG {SPEEDWALK} {ON}`;
                    if (args.toLowerCase() === 'off') return `#CONFIG {SPEEDWALK} {OFF}`;
                    return `#COMMENT JMC SPEEDWALK: #speedwalk ${args}`;
                case 'hotkey':
                    return this.convertHotkeyJMC(args);
                case 'unhotkey':
                    return `#UNMACRO {${args}}`;
                case 'message':
                    if (args.toLowerCase().includes('off')) return `#CONFIG {VERBOSE} {OFF}`;
                    if (args.toLowerCase().includes('on')) return `#CONFIG {VERBOSE} {ON}`;
                    return `#COMMENT JMC MESSAGE: #message ${args}`;
                case 'ticksize':
                    return `#VARIABLE {j_ticksize} {${args}}; #TICKER {jmc_tick} {#SHOWME #TICK} {${args}}`;
                case 'tickon':
                case 'tickset':
                    return `#TICKER {jmc_tick} {#SHOWME #TICK} {$j_ticksize}`;
                case 'tickoff':
                    return `#UNTICKER {jmc_tick}`;
                case 'drop':
                    return args ? `#COMMENT UNCONVERTED DROP: #drop ${args}` : `#LINE GAG`;
                case 'cr':
                    return `#SEND {\n}`;
                case 'daa':
                case 'hide':
                case 'whisper':
                    return `#COMMENT DAA/HIDE/WHISPER (Secure send) partially supported: #SEND {${args}}`;
                case 'bell':
                    return `#BELL`;
                case 'ignore':
                    return args ? `#IGNORE {${this.convertSyntax(this.cleanJMCArgs(args))}}` : `#IGNORE`;
                default:
                    return `#${command.toUpperCase()} {${this.convertSyntax(args)}}`;
            }
        }
    }

    // --- Powwow Conversion Methods ---

    convertAliasPowwow(args) {
        const match = args.match(/^(?:([<=>%][+-]?)?([\w_-]+(?:[+-])?)(?:@([\w_-]+))?\s+)?([^=]+?)(?:@([\w_-]+))?=(.+)/is);
        if (!match) {
            if (args.trim() === '') return `#ALIAS`;
            const simpleMatch = args.match(/^([^=]+)=(.+)/is);
            if (simpleMatch) {
                return `#ALIAS {${this.convertSubstitutions(simpleMatch[1].trim())}} {${this.processCommands(simpleMatch[2])}}`;
            }
            return `#comment UNCONVERTED ALIAS ARGS: ${args}`;
        }

        const [, op, label, group1, name, group2, cmds] = match;
        const convertedName = this.convertSubstitutions(name.trim());
        const convertedCmds = this.processCommands(cmds);

        const targetClass = group1 || group2 || label;
        let out = targetClass ? `#CLASS {${targetClass}} {OPEN}\n` : '';
        out += `#ALIAS {${convertedName}} {${convertedCmds}}`;
        if (targetClass) out += `\n#CLASS {${targetClass}} {CLOSE}`;
        return out;
    }

    convertActionPowwow(args) {
        if (args.match(/^[+-][\w_-]+$/)) {
            const label = args.substring(1);
            const op = args[0];
            return op === '+' ? `#CLASS {${label}} {OPEN}` : `#CLASS {${label}} {KILL}`;
        }

        const match = args.match(/^(?:([<=>%][+-]?)?([\w_-]+(?:[+-])?)(?:@([\w_-]+))?\s+)?([^=]+?)(?:@([\w_-]+))?=(.+)?/is);
        if (!match) {
             const simpleMatch = args.match(/^([^=]+)=(.+)?/is);
             if (simpleMatch) {
                 const ttPattern = this.convertSyntax(simpleMatch[1].trim());
                 const ttCmds = simpleMatch[2] ? this.processCommands(simpleMatch[2]) : '';
                 return ttCmds === '' ? `#GAG {${ttPattern}}` : `#ACTION {${ttPattern}} {${ttCmds}}`;
             }
             return `#comment UNCONVERTED ACTION ARGS: ${args}`;
        }

        const [, op, label, group1, pattern, group2, cmds] = match;
        const ttPattern = this.convertSyntax(pattern.trim());
        const ttCmds = cmds ? this.processCommands(cmds) : '';

        const targetClass = group1 || group2 || label;
        let out = targetClass ? `#CLASS {${targetClass}} {OPEN}\n` : '';
        if (ttCmds === '') {
            out += `#GAG {${ttPattern}}`;
        } else {
            out += `#ACTION {${ttPattern}} {${ttCmds}}`;
        }
        if (targetClass) out += `\n#CLASS {${targetClass}} {CLOSE}`;
        return out;
    }

    convertVarPowwow(args) {
        const parts = args.split(/=(.+)/s);
        if (parts.length < 2) {
            return `#SHOWME {${this.convertVarName(args.trim())} is ${this.convertSyntax(args.trim())}}`;
        }

        let name = this.convertVarName(parts[0].trim());
        const val = parts[1].trim();

        return `#VARIABLE {${name}} {${this.processCommands(val)}}`;
    }

    convertIfPowwow(args) {
        const match = args.match(/^\((.*)\)\s*(.*?)(?:\s*;\s*#else\s*(.*))?$/is);
        if (!match) return `#comment UNCONVERTED IF: #if ${args}`;

        const [, cond, trueBlock, falseBlock] = match;
        let out = `#IF {${this.convertSyntax('(' + cond + ')')}} {${this.processCommands(trueBlock)}}`;
        if (falseBlock) {
            out += ` {#ELSE} {${this.processCommands(falseBlock)}}`;
        }
        return out;
    }

    convertWhilePowwow(args) {
        const match = args.match(/^\((.*)\)\s*(.*)$/is);
        if (!match) return `#comment UNCONVERTED WHILE: #while ${args}`;
        const [, cond, block] = match;
        return `#WHILE {${this.convertSyntax('(' + cond + ')')}} {${this.processCommands(block)}}`;
    }

    convertForPowwow(args) {
        const match = args.match(/^\(([^;]*);([^;]*);([^)]*)\)\s*(.*)$/is);
        if (!match) return `#comment UNCONVERTED FOR: #for ${args}`;
        const [, init, check, loop, block] = match;

        let out = '';
        if (init.trim()) {
            const processedInit = this.convertSingleCommand(`#(${init.trim()})`);
            out += `${processedInit}; `;
        }
        out += `#WHILE {${this.convertSyntax('(' + check + ')')}} {${this.processCommands(block)}; ${this.convertSingleCommand(`#(${loop.trim()})`)}}`;
        return out;
    }

    convertTickerPowwow(args, command) {
        // #at (delay) {cmds} or #in (delay) {cmds}
        if (command === 'at' || command === 'in') {
            const match = args.match(/^\((.*?)\)\s*(.*)/is);
            if (match) {
                const [, delay, cmds] = match;
                let delayVal;
                if (isNaN(delay)) {
                    delayVal = this.convertSyntax('(' + delay + ')');
                } else {
                    const d = parseFloat(delay);
                    // In Powwow, #at is usually seconds, #in is milliseconds.
                    // But some versions use milliseconds for both if it's a large number.
                    // For now, let's assume if it's > 100 it's likely ms, otherwise s.
                    // Actually, let's check the test expectation.
                    // Test says #in (1000) -> 1.00, #at (5.5) -> 5.5
                    if (command === 'in') {
                        delayVal = (d / 1000).toFixed(2);
                    } else {
                        delayVal = d.toString();
                    }
                }
                return `#DELAY {${delayVal}} {${this.processCommands(cmds)}}`;
            }
        }

        const match = args.match(/^(?:([<=>%][+-]?)?([\w_-]+)(?:@([\w_-]+))?\s+)?([\w_-]+)\s*\((.*?)\)\s*(.*)/is);
        if (!match) return `#comment UNCONVERTED TICKER ARGS: ${args}`;

        const [, op, label, group, tickerName, delay, cmds] = match;
        const delayVal = isNaN(delay) ? this.convertSyntax('(' + delay + ')') : (parseInt(delay) / 1000).toFixed(2);

        const targetClass = group || label;
        let out = targetClass ? `#CLASS {${targetClass}} {OPEN}\n` : '';
        out += `#TICKER {${tickerName}} {${this.processCommands(cmds)}} {${delayVal}}`;
        if (targetClass) out += `\n#CLASS {${targetClass}} {CLOSE}`;
        return out;
    }

    convertPromptPowwow(args) {
        const match = args.match(/^(?:([<=>%][+-]?)?([\w_-]+)(?:@([\w_-]+))?\s+)?([^=]+)=(.+)?/is);
        if (!match) {
             const simpleMatch = args.match(/^([^=]+)=(.+)?/is);
             if (simpleMatch) {
                 const ttPattern = this.convertSyntax(simpleMatch[1].trim());
                 const ttCmds = simpleMatch[2] ? this.processCommands(simpleMatch[2]) : '';
                 return `#ACTION {${ttPattern}} {${ttCmds}; #line gag} {1}`;
             }
             return `#comment UNCONVERTED PROMPT ARGS: ${args}`;
        }
        const [, op, label, group, pattern, cmds] = match;

        const ttPattern = this.convertSyntax(pattern.trim());
        const ttCmds = cmds ? this.processCommands(cmds) : '';

        return `#ACTION {${ttPattern}} {${ttCmds}; #line gag} {1}`;
    }

    convertMarkPowwow(args) {
        const match = args.match(/^([^=]+)(?:=(.*))?$/is);
        if (match) {
            const pattern = this.convertSyntax(match[1].trim());
            const color = match[2] ? match[2].trim() : 'bold';
            return `#HIGHLIGHT {${pattern}} {${color}}`;
        }
        return `#COMMENT UNCONVERTED MARK: #mark ${args}`;
    }

    convertReset(args) {
        const type = args.toLowerCase().trim();
        if (type === 'alias' || type === 'aliases') return `#KILL ALIASES {*}*`;
        if (type === 'action' || type === 'actions') return `#KILL ACTIONS {*}*`;
        if (type === 'variable' || type === 'var' || type === 'variables') return `#KILL VARIABLES {*}*`;
        if (type === 'mark' || type === 'marks' || type === 'highlight' || type === 'highlights') return `#KILL HIGHLIGHTS {*}*`;
        if (type === 'at' || type === 'in' || type === 'ticker' || type === 'tickers') return `#KILL TICKERS {*}*`;
        if (type === 'bind' || type === 'binds' || type === 'key') return `#KILL MACROS {*}*`;
        if (type === 'all') {
            return `#KILL ALIASES {*}*; #KILL ACTIONS {*}*; #KILL VARIABLES {*}*; #KILL HIGHLIGHTS {*}*; #KILL TICKERS {*}*; #KILL MACROS {*}*; #COMMENT --- RESET ALL ---`;
        }
        return `#comment UNCONVERTED RESET: #reset ${args}`;
    }

    // --- JMC Conversion Methods ---

    convertAliasJMC(args) {
        // #alias {name} {commands}
        const match = args.match(/^{([^}]+)}\s*{(.*)}$/s) || args.match(/^(\S+)\s+(.*)$/s);
        if (match) {
            const name = match[1].trim().replace(/^{|}$/g, '');
            const cmds = match[2].trim().replace(/^{|}$/g, '');
            return `#ALIAS {${this.convertSyntax(name)}} {${this.processCommands(cmds)}}`;
        }
        return `#ALIAS {${this.convertSyntax(args)}}`;
    }

    convertActionJMC(args) {
        // #action {pattern} {commands} {priority}
        const parts = this.tokenize(args, ' ');
        if (parts.length >= 2) {
            const pattern = parts[0].trim().replace(/^{|}$/g, '');
            const cmds = parts[1].trim().replace(/^{|}$/g, '');
            const priority = parts[2] ? parts[2].trim().replace(/^{|}$/g, '') : '';
            let out = `#ACTION {${this.convertSyntax(pattern)}} {${this.processCommands(cmds)}}`;
            if (priority) out += ` {${priority}}`;
            return out;
        }
        return `#ACTION {${this.convertSyntax(args)}}`;
    }

    convertVarJMC(args) {
        // #var {name} {value}
        const match = args.match(/^{([^}]+)}\s*{(.*)}$/s) || args.match(/^(\S+)\s+(.*)$/s);
        if (match) {
            const name = this.convertVarName(match[1].trim().replace(/^{|}$/g, ''));
            const val = match[2].trim().replace(/^{|}$/g, '');
            return `#VARIABLE {${name}} {${this.processCommands(val)}}`;
        }
        // Handle #var $1 22 or #var $1=22
        const parts = args.split(/[\s=](.*)/s);
        if (parts.length >= 2) {
            const name = this.convertVarName(parts[0].trim());
            const val = parts[1].trim();
            return `#VARIABLE {${name}} {${this.processCommands(val)}}`;
        }
        return `#VARIABLE {${this.convertVarName(args.trim())}}`;
    }

    convertIfJMC(args) {
        // #if {cond} {then} {else}
        const parts = this.tokenize(args, ' ');
        if (parts.length >= 2) {
            const cond = parts[0].trim().replace(/^{|}$/g, '');
            const trueBlock = parts[1].trim().replace(/^{|}$/g, '');
            const falseBlock = parts[2] ? parts[2].trim().replace(/^{|}$/g, '') : '';
            let out = `#IF {${this.convertSyntax(cond)}} {${this.processCommands(trueBlock)}}`;
            if (falseBlock) {
                out += ` {#ELSE} {${this.processCommands(falseBlock)}}`;
            }
            return out;
        }
        return `#comment UNCONVERTED JMC IF: #if ${args}`;
    }

    convertMathJMC(args) {
        // #math {var} {expr}
        const match = args.match(/^{([^}]+)}\s*{(.*)}$/s) || args.match(/^(\S+)\s+(.*)$/s);
        if (match) {
            const name = this.convertVarName(match[1].trim().replace(/^{|}$/g, ''));
            const expr = match[2].trim().replace(/^{|}$/g, '');
            return `#math {${name}} {${this.convertSyntax(expr)}}`;
        }
        return `#comment UNCONVERTED JMC MATH: #math ${args}`;
    }

    convertGroupJMC(args) {
        // #group {enable|disable|list|delete|info|global|local} [name]
        const match = args.match(/^(enable|disable|list|delete|info|global|local)(?:\s+(\S+))?/i);
        if (match) {
            const op = match[1].toLowerCase();
            const label = match[2];
            if (op === 'enable') return `#CLASS {${label}} {OPEN}`;
            if (op === 'disable') return `#CLASS {${label}} {KILL}`;
            if (op === 'list') return `#CLASS`;
            if (op === 'delete') return `#CLASS {${label}} {KILL}`;
        }
        return `#comment JMC GROUP COMMAND: #group ${args}`;
    }

    convertHighlightJMC(args) {
        // #highlight {color} {pattern}
        const match = args.match(/^{([^}]+)}\s*{(.*)}$/s) || args.match(/^(\S+)\s+(.*)$/s);
        if (match) {
            const color = match[1].trim().replace(/^{|}$/g, '');
            const pattern = match[2].trim().replace(/^{|}$/g, '');
            return `#HIGHLIGHT {${this.convertSyntax(pattern)}} {${color}}`;
        }
        return `#comment UNCONVERTED JMC HIGHLIGHT: #highlight ${args}`;
    }

    convertGagJMC(args) {
        // #gag {pattern}
        const match = args.match(/^{([^}]+)}/s) || [null, args.trim()];
        const pattern = match[1].trim();
        return `#GAG {${this.convertSyntax(pattern)}}`;
    }

    convertSubstituteJMC(args) {
        // #sub {pattern} {replacement}
        const match = args.match(/^{([^}]+)}\s*{(.*)}$/s) || args.match(/^(\S+)\s+(.*)$/s);
        if (match) {
            const pattern = match[1].trim().replace(/^{|}$/g, '');
            const replacement = match[2].trim().replace(/^{|}$/g, '');
            return `#SUBSTITUTE {${this.convertSyntax(pattern)}} {${this.convertSyntax(replacement)}}`;
        }
        return `#comment UNCONVERTED JMC SUB: #sub ${args}`;
    }

    convertHotkeyJMC(args) {
        // #hotkey {key} {commands} {group}
        const match = args.match(/^{([^}]+)}\s*{(.*)}(?:\s*{(.*)})?/s);
        if (match) {
            const key = match[1].trim();
            const cmds = match[2].trim();
            // TinTin++ uses #MACRO for hotkeys. Key names might need mapping, but keeping as is for now.
            return `#MACRO {${key}} {${this.processCommands(cmds)}}`;
        }
        return `#comment UNCONVERTED JMC HOTKEY: #hotkey ${args}`;
    }

    convertLoopJMC(args) {
        // #loop {from,to[:delay]} {commands}
        const match = args.match(/^{([^,]+),([^}:]+)(?::([^}]+))?}\s*{(.*)}$/s);
        if (match) {
            const from = match[1].trim();
            const to = match[2].trim();
            const cmds = match[4].trim();
            // Protect $v from being prefixed by temporarily using a placeholder
            const processed = this.processCommands(cmds.replace(/%0/g, '___V_VAR___'));
            return `#LOOP {${from}} {${to}} {v} {${processed.replace(/___V_VAR___/g, '$v')}}`;
        }
        return `#COMMENT UNCONVERTED JMC LOOP: #loop ${args}`;
    }

    convertToLowerJMC(args) {
        // #tolower {var} {text}
        const match = args.match(/^{([^}]+)}\s*{(.*)}$/s) || args.match(/^(\S+)\s+(.*)$/s);
        if (match) {
            const varName = this.convertVarName(match[1].trim().replace(/^{|}$/g, ''));
            const text = match[2].trim().replace(/^{|}$/g, '');
            return `#FORMAT {${varName}} {%l} {${this.convertSyntax(text)}}`;
        }
        return `#COMMENT UNCONVERTED JMC TOLOWER: #tolower ${args}`;
    }

    convertToUpperJMC(args) {
        const match = args.match(/^{([^}]+)}\s*{(.*)}$/s) || args.match(/^(\S+)\s+(.*)$/s);
        if (match) {
            const varName = this.convertVarName(match[1].trim().replace(/^{|}$/g, ''));
            const text = match[2].trim().replace(/^{|}$/g, '');
            return `#FORMAT {${varName}} {%u} {${this.convertSyntax(text)}}`;
        }
        return `#COMMENT UNCONVERTED JMC TOUPPER: #toupper ${args}`;
    }

    convert(inputScript) {
        if (!inputScript) return '';
        const lines = inputScript.split(/\r?\n/);
        const outputLines = [];
        let buffer = '';
        let braceLevel = 0;

        outputLines.push('#CLASS {converted} {OPEN}');

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            if (line.trim().endsWith('\\') && this.mode === 'powwow') {
                buffer += (buffer ? '\n' : '') + line.trim().slice(0, -1);
                continue;
            }

            buffer += (buffer ? '\n' : '') + line;

            braceLevel += (line.match(/{/g) || []).length;
            braceLevel -= (line.match(/}/g) || []).length;

            if (braceLevel <= 0) {
                const trimmed = buffer.trim();
                if (trimmed === '') {
                    outputLines.push('');
                } else if (trimmed.startsWith('//') || (this.mode === 'jmc' && trimmed.startsWith('##'))) {
                    const commentText = trimmed.substring(2);
                    outputLines.push(`#COMMENT ${commentText.trim()}`);
                } else if (trimmed.startsWith('/*')) {
                    outputLines.push(`#COMMENT ${trimmed.replace(/\/\*|\*\//g, '').trim()}`);
                } else if (trimmed.startsWith('#')) {
                    outputLines.push(this.convertSingleCommand(trimmed));
                } else {
                    outputLines.push(this.convertSyntax(trimmed));
                }
                buffer = '';
                braceLevel = 0;
            }
        }

        if (buffer.trim()) {
             outputLines.push(this.convertSingleCommand(buffer.trim()));
        }

        outputLines.push('#CLASS {converted} {CLOSE}');

        return outputLines.join('\n');
    }
}
