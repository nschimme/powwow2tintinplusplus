/**
 * Robust Converter core logic
 */

export class PowwowConverter {
    constructor(options = {}) {
        this.separator = options.separator || ';';
        this.isPowtty = options.isPowtty || false;
    }

    setSeparator(sep) {
        this.separator = sep;
    }

    setPowtty(isPowtty) {
        this.isPowtty = isPowtty;
        if (isPowtty && this.separator === ';') {
            this.separator = '|';
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
     * Converts Powwow syntax to TinTin++ syntax.
     */
    convertSyntax(str) {
        if (str.startsWith('(') && str.endsWith(')')) {
            let inner = str.substring(1, str.length - 1).trim();
            let result = this.processInlineFunctions(inner);
            return this.convertSubstitutions(result);
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
        if (name.startsWith('@')) {
            const numMatch = name.match(/^@(-?\d+)$/);
            if (numMatch) {
                const n = numMatch[1];
                return n.startsWith('-') ? `p_at_m${n.substring(1)}` : `powwow_at[${n}]`;
            }
            return 'p_at_' + name.substring(1);
        } else if (name.startsWith('$')) {
            const numMatch = name.match(/^\$(-?\d+)$/);
            if (numMatch) {
                const n = numMatch[1];
                return n.startsWith('-') ? `p_dollar_m${n.substring(1)}` : `powwow_dollar[${n}]`;
            }
            return 'p_' + name.substring(1);
        }
        return 'p_' + name;
    }

    convertSubstitutions(str) {
        // 1. Delayed parameter substitution: \$1 -> %%1
        str = str.replace(/\\\$(\d+)/g, '%%$1');
        str = str.replace(/\\&(\d+)/g, '%%$1');

        // 2. Named parameters/variables in ${var} or #{expr}
        str = str.replace(/\${([a-zA-Z0-9_-]+)}/g, (match, name) => {
            return `$p_${name}`;
        });
        str = str.replace(/#{([^}]+)}/g, (match, expr) => {
            return `\$math_eval{${this.convertSyntax('(' + expr + ')')}}`;
        });

        // 3. Variables:
        str = str.replace(/@([a-zA-Z_]\w*)/g, (match, name) => `\$${this.convertVarName('@' + name)}`);
        str = str.replace(/@(\d+)/g, (match, num) => `\$${this.convertVarName('@' + num)}`);

        str = str.replace(/(?<![\\%])\$([a-zA-Z_]\w+)/g, (match, name) => `\$${this.convertVarName('$' + name)}`);

        // 4. Standard parameters: $N -> %N, &N -> %N
        str = str.replace(/(?<!\\)\$(\d+)/g, '%$1');
        str = str.replace(/(?<!\\)&(\d+)/g, '%$1');

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

    processPowwowCommands(powwowCommandString) {
        if (!powwowCommandString) return '';
        let commandsStr = powwowCommandString.trim();
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
                // Peek for #else
                if (i + 1 < tokens.length && tokens[i+1].trim().toLowerCase().startsWith('#else')) {
                    t += '; ' + tokens[i+1].trim();
                    i++;
                }
            }

            if (t.startsWith('#')) {
                processed.push(this.convertSinglePowwowCommand(t));
            } else {
                processed.push(this.convertSyntax(t));
            }
        }

        return processed.join('; ');
    }

    convertSinglePowwowCommand(line) {
        line = line.trim();

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
                return `#math {${name}} {${this.convertSyntax('(' + assignMatch[2].trim() + ')')}}`;
            }
            return `#math {p_result} {${this.convertSyntax('(' + expr + ')')}}`;
        }

        // Repeat #5 north
        const repeatMatch = line.match(/^#(\d+)\s+(.*)/s);
        if (repeatMatch) {
            return `#${repeatMatch[1]} {${this.processPowwowCommands(repeatMatch[2])}}`;
        }

        const cmdMatch = line.match(/^#\s*([a-zA-Z_]+)\s*(.*)/s);
        if (!cmdMatch) {
            return this.convertSyntax(line);
        }

        const command = cmdMatch[1].toLowerCase();
        let args = cmdMatch[2].trim();

        switch (command) {
            case 'al':
            case 'alias':
                return this.convertAlias(args);
            case 'ac':
            case 'action':
                return this.convertAction(args);
            case 'var':
                return this.convertVar(args);
            case 'if':
                return this.convertIf(args);
            case 'while':
                return this.convertWhile(args);
            case 'for':
                return this.convertFor(args);
            case 'print':
                return `#SHOWME {${this.convertSyntax(args)}}`;
            case 'send':
                if (args.startsWith('<')) return `#TEXTIN {${args.substring(1).trim()}}`;
                if (args.startsWith('!')) return `#SYSTEM {${args.substring(1).trim()}}`;
                return this.convertSyntax(args);
            case 'in':
            case 'at':
                return this.convertTicker(args);
            case 'prompt':
                return this.convertPrompt(args);
            case 'reset':
                return this.convertReset(args);
            case 'do':
                const doMatch = args.match(/^\((.*)\)\s*(.*)$/s);
                if (doMatch) {
                    return `#math {p_do_cnt} {${this.convertSyntax('(' + doMatch[1] + ')')}}; #$p_do_cnt {${this.processPowwowCommands(doMatch[2])}}`;
                }
                return `#comment UNCONVERTED DO: #do ${args}`;
            case 'nice':
                return `#comment NICE (Priority) ignored: #nice ${args}`;
            case 'identify':
                return `#comment IDENTIFY ignored: #identify ${args}`;
            case 'request':
                return `#comment REQUEST ignored: #request ${args}`;
            case 'option':
                return `#comment OPTION ignored: #option ${args}`;
            case 'sep':
                this.setSeparator(args);
                return `#comment SEPARATOR set to ${args}`;
            case 'quit':
                return `#end`;
            default:
                return `#comment UNSUPPORTED: ${line}`;
        }
    }

    convertAlias(args) {
        const match = args.match(/^(?:([<=>%][+-]?)?([\w_-]+)(?:@([\w_-]+))?\s+)?([^=]+)=(.+)/is);
        if (!match) {
            if (args.trim() === '') return `#ALIAS`;
            const simpleMatch = args.match(/^([^=]+)=(.+)/is);
            if (simpleMatch) {
                return `#ALIAS {${this.convertSubstitutions(simpleMatch[1].trim())}} {${this.processPowwowCommands(simpleMatch[2])}}`;
            }
            return `#comment UNCONVERTED ALIAS ARGS: ${args}`;
        }

        const [, op, label, group, name, cmds] = match;
        const convertedName = this.convertSubstitutions(name.trim());
        const convertedCmds = this.processPowwowCommands(cmds);

        const targetClass = group || label;
        let out = targetClass ? `#CLASS {${targetClass}} {OPEN}\n` : '';
        out += `#ALIAS {${convertedName}} {${convertedCmds}}`;
        if (targetClass) out += `\n#CLASS {${targetClass}} {CLOSE}`;
        return out;
    }

    convertAction(args) {
        if (args.match(/^[+-][\w_-]+$/)) {
            const label = args.substring(1);
            const op = args[0];
            return op === '+' ? `#CLASS {${label}} {OPEN}` : `#CLASS {${label}} {KILL}`;
        }

        const match = args.match(/^(?:([<=>%][+-]?)?([\w_-]+)(?:@([\w_-]+))?\s+)?([^=]+)=(.+)?/is);
        if (!match) {
             const simpleMatch = args.match(/^([^=]+)=(.+)?/is);
             if (simpleMatch) {
                 const ttPattern = this.convertSyntax(simpleMatch[1].trim());
                 const ttCmds = simpleMatch[2] ? this.processPowwowCommands(simpleMatch[2]) : '';
                 return ttCmds === '' ? `#GAG {${ttPattern}}` : `#ACTION {${ttPattern}} {${ttCmds}}`;
             }
             return `#comment UNCONVERTED ACTION ARGS: ${args}`;
        }

        const [, op, label, group, pattern, cmds] = match;
        const ttPattern = this.convertSyntax(pattern.trim());
        const ttCmds = cmds ? this.processPowwowCommands(cmds) : '';

        const targetClass = group || label;
        let out = targetClass ? `#CLASS {${targetClass}} {OPEN}\n` : '';
        if (ttCmds === '') {
            out += `#GAG {${ttPattern}}`;
        } else {
            out += `#ACTION {${ttPattern}} {${ttCmds}}`;
        }
        if (targetClass) out += `\n#CLASS {${targetClass}} {CLOSE}`;
        return out;
    }

    convertVar(args) {
        const parts = args.split(/=(.+)/s);
        if (parts.length < 2) {
            return `#SHOWME {${this.convertVarName(args.trim())} is ${this.convertSyntax(args.trim())}}`;
        }

        let name = this.convertVarName(parts[0].trim());
        const val = parts[1].trim();

        return `#VARIABLE {${name}} {${this.processPowwowCommands(val)}}`;
    }

    convertIf(args) {
        const match = args.match(/^\((.*)\)\s*(.*?)(?:\s*;\s*#else\s*(.*))?$/is);
        if (!match) return `#comment UNCONVERTED IF: #if ${args}`;

        const [, cond, trueBlock, falseBlock] = match;
        let out = `#IF {${this.convertSyntax('(' + cond + ')')}} {${this.processPowwowCommands(trueBlock)}}`;
        if (falseBlock) {
            out += ` {#ELSE} {${this.processPowwowCommands(falseBlock)}}`;
        }
        return out;
    }

    convertWhile(args) {
        const match = args.match(/^\((.*)\)\s*(.*)$/is);
        if (!match) return `#comment UNCONVERTED WHILE: #while ${args}`;
        const [, cond, block] = match;
        return `#WHILE {${this.convertSyntax('(' + cond + ')')}} {${this.processPowwowCommands(block)}}`;
    }

    convertFor(args) {
        const match = args.match(/^\(([^;]*);([^;]*);([^)]*)\)\s*(.*)$/is);
        if (!match) return `#comment UNCONVERTED FOR: #for ${args}`;
        const [, init, check, loop, block] = match;

        let out = '';
        if (init.trim()) {
            const processedInit = this.convertSinglePowwowCommand(`#(${init.trim()})`);
            out += `${processedInit}; `;
        }
        out += `#WHILE {${this.convertSyntax('(' + check + ')')}} {${this.processPowwowCommands(block)}; ${this.convertSinglePowwowCommand(`#(${loop.trim()})`)}}`;
        return out;
    }

    convertTicker(args) {
        const match = args.match(/^(?:([<=>%][+-]?)?([\w_-]+)(?:@([\w_-]+))?\s+)?([\w_-]+)\s*\((.*?)\)\s*(.*)/is);
        if (!match) return `#comment UNCONVERTED TICKER ARGS: ${args}`;

        const [, op, label, group, tickerName, delay, cmds] = match;
        const delayVal = isNaN(delay) ? this.convertSyntax('(' + delay + ')') : (parseInt(delay) / 1000).toFixed(2);

        const targetClass = group || label;
        let out = targetClass ? `#CLASS {${targetClass}} {OPEN}\n` : '';
        out += `#TICKER {${tickerName}} {${this.processPowwowCommands(cmds)}} {${delayVal}}`;
        if (targetClass) out += `\n#CLASS {${targetClass}} {CLOSE}`;
        return out;
    }

    convertPrompt(args) {
        const match = args.match(/^(?:([<=>%][+-]?)?([\w_-]+)(?:@([\w_-]+))?\s+)?([^=]+)=(.+)?/is);
        if (!match) {
             const simpleMatch = args.match(/^([^=]+)=(.+)?/is);
             if (simpleMatch) {
                 const ttPattern = this.convertSyntax(simpleMatch[1].trim());
                 const ttCmds = simpleMatch[2] ? this.processPowwowCommands(simpleMatch[2]) : '';
                 return `#ACTION {${ttPattern}} {${ttCmds}; #line gag} {1}`;
             }
             return `#comment UNCONVERTED PROMPT ARGS: ${args}`;
        }
        const [, op, label, group, pattern, cmds] = match;

        const ttPattern = this.convertSyntax(pattern.trim());
        const ttCmds = cmds ? this.processPowwowCommands(cmds) : '';

        return `#ACTION {${ttPattern}} {${ttCmds}; #line gag} {1}`;
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

    convert(inputScript) {
        if (!inputScript) return '';
        const lines = inputScript.split(/\r?\n/);
        const outputLines = [];
        let buffer = '';
        let braceLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            if (line.trim().endsWith('\\')) {
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
                } else if (trimmed.startsWith('//')) {
                    outputLines.push(`#comment ${trimmed.substring(2).trim()}`);
                } else if (trimmed.startsWith('/*')) {
                    outputLines.push(`#comment ${trimmed.replace(/\/\*|\*\//g, '').trim()}`);
                } else if (trimmed.startsWith('#')) {
                    outputLines.push(this.convertSinglePowwowCommand(trimmed));
                } else {
                    outputLines.push(this.convertSyntax(trimmed));
                }
                buffer = '';
                braceLevel = 0;
            }
        }

        if (buffer.trim()) {
             outputLines.push(this.convertSinglePowwowCommand(buffer.trim()));
        }

        return outputLines.join('\n');
    }
}
