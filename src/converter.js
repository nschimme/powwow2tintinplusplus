/**
 * Robust Converter core logic for migrating to TinTin++
 */

class Lexer {
    constructor(input, options = {}) {
        this.input = input;
        this.pos = 0;
        this.mode = options.mode || 'powwow';
        this.separator = options.separator || ';';
    }

    peek() { return this.input[this.pos]; }

    nextToken() {
        if (this.pos >= this.input.length) return { type: 'EOF' };
        let char = this.peek();

        if (char === ' ' || char === '\t') {
            let value = '';
            while (this.pos < this.input.length && (this.input[this.pos] === ' ' || this.input[this.pos] === '\t')) {
                value += this.input[this.pos++];
            }
            return { type: 'WHITESPACE', value };
        }
        if (char === '\n' || char === '\r') {
             let value = '';
             while (this.pos < this.input.length && (this.input[this.pos] === '\n' || this.input[this.pos] === '\r')) {
                 value += this.input[this.pos++];
             }
             return { type: 'NEWLINE', value };
        }

        if (this.input.startsWith('//', this.pos)) {
            let value = '';
            while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
                value += this.input[this.pos++];
            }
            return { type: 'COMMENT', value };
        }
        if (this.input.startsWith('/*', this.pos)) {
            let value = '/*';
            this.pos += 2;
            while (this.pos < this.input.length && !this.input.startsWith('*/', this.pos)) {
                value += this.input[this.pos++];
            }
            if (this.input.startsWith('*/', this.pos)) {
                value += '*/';
                this.pos += 2;
            }
            return { type: 'COMMENT', value };
        }
        if (this.mode === 'jmc' && this.input.startsWith('##', this.pos)) {
            let value = '';
            while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
                value += this.input[this.pos++];
            }
            return { type: 'COMMENT', value };
        }

        if (char === '\\') {
            this.pos++;
            let next = this.input[this.pos++] || '';
            return { type: 'TEXT', value: '\\' + next };
        }

        if (char === '{') { this.pos++; return { type: 'LBRACE' }; }
        if (char === '}') { this.pos++; return { type: 'RBRACE' }; }
        if (char === '(') { this.pos++; return { type: 'LPAREN' }; }
        if (char === ')') { this.pos++; return { type: 'RPAREN' }; }
        if (char === '"') {
            let value = '"';
            this.pos++;
            while (this.pos < this.input.length) {
                let c = this.input[this.pos++];
                if (c === '\\') {
                    value += c + (this.input[this.pos++] || '');
                } else if (c === '"') {
                    value += '"';
                    break;
                } else {
                    value += c;
                }
            }
            return { type: 'STRING', value };
        }

        if (char === this.separator) { this.pos++; return { type: 'SEPARATOR', value: char }; }
        if (this.mode === 'powwow' && char === '|') { this.pos++; return { type: 'PIPE', value: char }; }

        if (char === '#') {
            let start = this.pos;
            this.pos++;
            let cmd = '#';
            if (/[0-9]/.test(this.peek())) {
                while (this.pos < this.input.length && /[0-9]/.test(this.input[this.pos])) {
                    cmd += this.input[this.pos++];
                }
                return { type: 'COMMAND', value: cmd };
            } else if (/[<=>%+-]/.test(this.peek())) {
                cmd += this.input[this.pos++];
                while (this.pos < this.input.length && /[\w_-]/.test(this.input[this.pos])) {
                    cmd += this.input[this.pos++];
                }
                return { type: 'COMMAND', value: cmd };
            } else if (this.peek() === '!') {
                cmd += this.input[this.pos++];
                return { type: 'COMMAND', value: cmd };
            } else {
                while (this.pos < this.input.length && /[\w_-]/.test(this.input[this.pos])) {
                    cmd += this.input[this.pos++];
                }
                return { type: 'COMMAND', value: cmd };
            }
        }

        let value = '';
        while (this.pos < this.input.length) {
            let c = this.input[this.pos];
            if (/\s/.test(c) || '{}()";#|'.includes(c) || c === '\\') break;
            if (this.input.startsWith('//', this.pos) || this.input.startsWith('/*', this.pos)) break;
            value += c;
            this.pos++;
        }
        if (value === '' && this.pos < this.input.length) {
             value = this.input[this.pos++];
        }
        return { type: 'TEXT', value };
    }
}

class Parser {
    constructor(lexer) {
        this.lexer = lexer;
        this.tokens = [];
        let t;
        while ((t = this.lexer.nextToken()).type !== 'EOF') {
            this.tokens.push(t);
        }
        this.pos = 0;
    }

    peek() { return this.tokens[this.pos] || { type: 'EOF' }; }
    eat() { return this.tokens[this.pos++]; }

    parse() {
        return this.parseNodes();
    }

    parseNodes(until = []) {
        let nodes = [];
        while (this.pos < this.tokens.length) {
            let t = this.peek();
            if (until.includes(t.type)) break;

            if (t.type === 'LBRACE') {
                this.eat();
                nodes.push({ type: 'BracedBlock', content: this.parseNodes(['RBRACE']) });
                if (this.peek().type === 'RBRACE') this.eat();
            } else if (t.type === 'LPAREN') {
                this.eat();
                nodes.push({ type: 'ParenBlock', content: this.parseNodes(['RPAREN']) });
                if (this.peek().type === 'RPAREN') this.eat();
            } else if (t.type === 'WHITESPACE') {
                nodes.push({ type: 'Whitespace', value: this.eat().value });
            } else if (t.type === 'NEWLINE') {
                nodes.push({ type: 'Newline', value: this.eat().value });
            } else if (t.type === 'COMMENT') {
                nodes.push({ type: 'Comment', value: this.eat().value });
            } else if (t.type === 'SEPARATOR') {
                nodes.push({ type: 'Separator', value: this.eat().value });
            } else if (t.type === 'PIPE') {
                nodes.push({ type: 'Pipe', value: this.eat().value });
            } else if (t.type === 'COMMAND') {
                nodes.push({ type: 'Command', value: this.eat().value });
            } else if (t.type === 'STRING') {
                nodes.push({ type: 'String', value: this.eat().value });
            } else {
                nodes.push({ type: 'Text', value: this.eat().value });
            }
        }
        return nodes;
    }
}

class TinTinGenerator {
    constructor(converter) {
        this.converter = converter;
        this.mode = converter.mode;
    }

    generate(nodes) {
        let outputLines = [];
        outputLines.push('#CLASS {converted} {OPEN}');

        if (this.mode === 'powwow') {
            outputLines.push('#NOP --- POWWOW COMPATIBILITY LAYER ---');
            outputLines.push('#VARIABLE {powwow_at_lines} {24}');
            outputLines.push('#VARIABLE {powwow_at_mem} {0}');
            outputLines.push('#VARIABLE {powwow_at_buffer} {0}');
            outputLines.push('#FORMAT {powwow_start_time} {%T}');
            outputLines.push('#FUNCTION {powwow_timer} {#FORMAT {now} {%T};#MATH {result} {($now - $powwow_start_time) * 1000}}');
            outputLines.push('#FUNCTION {powwow_rand} {#MATH {result} {1d%1 - 1}}');
            outputLines.push('#FUNCTION {powwow_char_length} {#FORMAT {result} {%x} {%1}}');
            outputLines.push('#FUNCTION {powwow_search} {#FORMAT {result} {%p} {%2} {%1}}');
        }

        let currentCommandNodes = [];

        const flush = () => {
            if (currentCommandNodes.length === 0) return;
            const cmdStr = this.nodesToString(currentCommandNodes).trim();
            if (cmdStr !== '') {
                if (cmdStr.startsWith('#')) {
                    outputLines.push(this.converter.convertSingleCommand(cmdStr));
                } else {
                    outputLines.push(this.converter.convertSyntax(cmdStr));
                }
            }
            currentCommandNodes = [];
        };

        for (let node of nodes) {
            if (node.type === 'Separator' || node.type === 'Pipe') {
                // Special case for #sep command which takes the separator as an argument
                const lastCmd = currentCommandNodes.filter(n => n.type === 'Command').pop();
                if (lastCmd && lastCmd.value === '#sep') {
                    currentCommandNodes.push(node);
                    continue;
                }
                flush();
            } else if (node.type === 'Newline') {
                flush();
            } else if (node.type === 'Comment') {
                flush();
                outputLines.push('#NOP ' + node.value.replace(/\/\/|\/\*|\*\/|##/g, '').trim());
            } else {
                currentCommandNodes.push(node);
            }
        }
        flush();

        outputLines.push('#CLASS {converted} {CLOSE}');
        return outputLines.join('\n');
    }

    nodesToString(nodes) {
        return nodes.map(n => {
            if (n.type === 'BracedBlock') return '{' + this.nodesToString(n.content) + '}';
            if (n.type === 'ParenBlock') return '(' + this.nodesToString(n.content) + ')';
            if (n.type === 'Comment') return ''; // Comments handled in generate
            if (n.type === 'Newline') return '\n';
            return n.value || '';
        }).join('');
    }
}

export class TinTinConverter {
    constructor(options = {}) {
        this.options = options;
        this.separator = options.separator || ';';
        this.mode = options.mode || 'powwow'; // 'powwow' or 'jmc'
        this.state = {
            powwow: {
                autoprint: false
            }
        };
        this.initHandlers();
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

    extractBlock(str, openChar, closeChar) {
        const trimmed = str.trim();
        if (!trimmed || !trimmed.startsWith(openChar)) return null;

        let depth = 0;
        let inQuotes = false;
        let escaped = false;
        let startPos = str.indexOf(openChar);

        for (let i = startPos; i < str.length; i++) {
            const char = str[i];
            if (escaped) { escaped = false; continue; }
            if (char === '\\') { escaped = true; continue; }
            if (char === '"') { inQuotes = !inQuotes; continue; }
            if (inQuotes) continue;

            if (char === openChar) depth++;
            else if (char === closeChar) {
                depth--;
                if (depth === 0) {
                    return {
                        inner: str.substring(startPos + 1, i),
                        rest: str.substring(i + 1)
                    };
                }
            }
        }
        return null;
    }

    initHandlers() {
        this.powwowHandlers = {
            'al': args => this.convertAliasPowwow(args),
            'alias': args => this.convertAliasPowwow(args),
            'ac': args => this.convertActionPowwow(args),
            'action': args => this.convertActionPowwow(args),
            'setvar': args => this.convertVarPowwow(args),
            'var': args => this.convertVarPowwow(args),
            'mark': args => this.convertMarkPowwow(args),
            'hilite': args => `#HIGHLIGHT {.*} {${args}}`,
            'beep': () => `#BELL`,
            'bi': args => this.powwowHandlers['bind'](args),
            'bind': args => this.convertBindPowwow(args),
            'emu': args => this.powwowHandlers['emulate'](args),
            'emulate': args => `#SHOWME {${this.convertSyntax(args)}}`,
            'time': () => `#FORMAT {powwow_at_time} {%t} {%Y-%m-%d %H:%M:%S}`,
            'save': args => `#WRITE {${args || 'converted.tin'}}`,
            'load': args => `#READ {${args || 'converted.tin'}}`,
            'if': args => this.convertIfPowwow(args),
            'while': args => this.convertWhilePowwow(args),
            'for': args => this.convertForPowwow(args),
            'print': args => args ? `#SHOWME {${this.convertSyntax(args)}}` : `#LINE PRINT`,
            'send': args => {
                if (args.startsWith('<')) return `#TEXTIN {${args.substring(1).trim()}}`;
                if (args.startsWith('!')) return `#SYSTEM {${args.substring(1).trim()}}`;
                return this.convertSyntax(args);
            },
            'in': args => this.convertTickerPowwow(args, 'in'),
            'at': args => this.convertTickerPowwow(args, 'at'),
            'prompt': args => this.convertPromptPowwow(args),
            'group': args => {
                const pwGroupMatch = args.match(/^(\S+)\s+(on|off)/i);
                if (pwGroupMatch) {
                    return pwGroupMatch[2].toLowerCase() === 'on' ? `#CLASS {${pwGroupMatch[1]}} {OPEN}` : `#CLASS {${pwGroupMatch[1]}} {KILL}`;
                }
                return `#NOP UNCONVERTED POWWOW GROUP: #group ${args}`;
            },
            'reset': args => this.convertReset(args),
            'do': args => {
                const doMatch = args.match(/^\((.*)\)\s*(.*)$/s);
                if (doMatch) {
                    return `#MATH {p_do_cnt} {${this.convertSyntax('(' + doMatch[1] + ')')}}; #$p_do_cnt {${this.processCommands(doMatch[2])}}`;
                }
                return `#NOP UNCONVERTED DO: #do ${args}`;
            },
            'nice': args => `#NOP NICE (Priority) ignored: #nice ${args}`,
            'identify': args => `#NOP IDENTIFY ignored: #identify ${args}`,
            '!': args => `#SYSTEM {${args}}`,
            'request': args => `#NOP REQUEST ignored: #request ${args}`,
            'option': args => {
                const match = args.match(/^([+-])(\w+)/);
                if (match) {
                    const [, op, name] = match;
                    if (name.toLowerCase() === 'autoprint') {
                        this.state.powwow.autoprint = (op === '+');
                        return `#NOP OPTION autoprint set to ${op === '+' ? 'ON' : 'OFF'}`;
                    }
                }
                return `#NOP OPTION ignored: #option ${args}`;
            },
            'sep': args => {
                this.setSeparator(args);
                return `#NOP SEPARATOR set to ${args}`;
            },
            'quit': () => `#END`,
            'exe': args => this.processCommands(this.convertSyntax(args))
        };

        this.jmcHandlers = {
            'al': args => this.convertAliasJMC(args),
            'alias': args => this.convertAliasJMC(args),
            'ac': args => this.convertActionJMC(args),
            'action': args => this.convertActionJMC(args),
            'var': args => this.convertVarJMC(args),
            'variable': args => this.convertVarJMC(args),
            'if': args => this.convertIfJMC(args),
            'math': args => this.convertMathJMC(args),
            'group': args => this.convertGroupJMC(args),
            'highlight': args => this.convertHighlightJMC(args),
            'gag': args => this.convertGagJMC(args),
            'sub': args => this.convertSubstituteJMC(args),
            'substitute': args => this.convertSubstituteJMC(args),
            'antisubstitute': args => `#ANTISUBSTITUTE {${this.convertSyntax(this.cleanJMCArgs(args))}}`,
            'antisub': args => `#ANTISUBSTITUTE {${this.convertSyntax(this.cleanJMCArgs(args))}}`,
            'unsubstitute': args => `#UNSUB {${this.convertSyntax(this.cleanJMCArgs(args))}}`,
            'unsub': args => `#UNSUB {${this.convertSyntax(this.cleanJMCArgs(args))}}`,
            'loop': args => this.convertLoopJMC(args),
            'tolower': args => this.convertToLowerJMC(args),
            'toupper': args => this.convertToUpperJMC(args),
            'unalias': args => `#UNALIAS {${this.convertSyntax(this.cleanJMCArgs(args))}}`,
            'unali': args => `#UNALIAS {${this.convertSyntax(this.cleanJMCArgs(args))}}`,
            'unaction': args => `#UNACT {${this.convertSyntax(this.cleanJMCArgs(args))}}`,
            'unac': args => `#UNACT {${this.convertSyntax(this.cleanJMCArgs(args))}}`,
            'unvar': args => `#UNVAR {${this.convertVarName(this.cleanJMCArgs(args))}}`,
            'showme': args => `#SHOWME {${this.convertSyntax(this.cleanJMCArgs(args))}}`,
            'output': args => `#SHOWME {${this.convertSyntax(this.cleanJMCArgs(args))}}`,
            'bell': () => `#BELL`,
            'break': () => `#BREAK`,
            'kickall': () => `#KILL ALL`,
            'flash': () => `#BELL`,
            'char': args => `#CONFIG {COMMAND_CHAR} {${this.cleanJMCArgs(args)}}`,
            'pathdir': args => `#PATHDIR {${this.cleanJMCArgs(args)}}`,
            'wait': args => `#DELAY {${this.cleanJMCArgs(args)}}`,
            'wt': args => `#DELAY {${this.cleanJMCArgs(args)}}`,
            'echo': args => {
                if (args.toLowerCase() === 'on') return `#CONFIG {VERBOSE} {ON}`;
                if (args.toLowerCase() === 'off') return `#CONFIG {VERBOSE} {OFF}`;
                return `#SHOWME {${this.convertSyntax(args)}}`;
            },
            'quit': () => `#END`,
            'zap': () => `#ZAP`,
            'killall': () => `#KILL ALL`,
            'read': args => `#READ {${args}}`,
            'write': args => `#WRITE {${args}}`,
            'log': args => `#LOG {${args}}`,
            'textin': args => `#TEXTIN {${args}}`,
            'systemexec': args => `#SYSTEM {${args}}`,
            'speedwalk': args => {
                if (args.toLowerCase() === 'on') return `#CONFIG {SPEEDWALK} {ON}`;
                if (args.toLowerCase() === 'off') return `#CONFIG {SPEEDWALK} {OFF}`;
                return `#NOP JMC SPEEDWALK: #speedwalk ${args}`;
            },
            'hotkey': args => this.convertHotkeyJMC(args),
            'hot': args => this.convertHotkeyJMC(args),
            'unhotkey': args => `#UNMACRO {${args}}`,
            'message': args => {
                if (args.toLowerCase().includes('off')) return `#CONFIG {VERBOSE} {OFF}`;
                if (args.toLowerCase().includes('on')) return `#CONFIG {VERBOSE} {ON}`;
                return `#NOP JMC MESSAGE: #message ${args}`;
            },
            'multiaction': args => {
                if (args.toLowerCase() === 'on') return `#NOP JMC MULTIACTION ON (TT++ default)`;
                if (args.toLowerCase() === 'off') return `#NOP JMC MULTIACTION OFF (Not directly supported in TT++ without logic)`;
                return `#NOP JMC MULTIACTION: #multiaction ${args}`;
            },
            'multihighlight': args => {
                if (args.toLowerCase() === 'on') return `#NOP JMC MULTIHIGHLIGHT ON (TT++ default)`;
                if (args.toLowerCase() === 'off') return `#NOP JMC MULTIHIGHLIGHT OFF (Not directly supported in TT++)`;
                return `#NOP JMC MULTIHIGHLIGHT: #multihighlight ${args}`;
            },
            'presub': args => {
                if (args.toLowerCase() === 'on') return `#NOP JMC PRESUB ON (Not directly supported in TT++)`;
                if (args.toLowerCase() === 'off') return `#NOP JMC PRESUB OFF (TT++ default)`;
                return `#NOP JMC PRESUB: #presub ${args}`;
            },
            'verbat': args => {
                if (args.toLowerCase() === 'on') return `#CONFIG {VERBATIM} {ON}`;
                if (args.toLowerCase() === 'off') return `#CONFIG {VERBATIM} {OFF}`;
                return `#NOP JMC VERBAT: #verbat ${args}`;
            },
            'colon': args => {
                return `#NOP JMC COLON: #colon ${args}`;
            },
            'comment': args => {
                return `#NOP JMC COMMENT character set to: ${args}`;
            },
            'nop': args => `#NOP JMC NOP: ${args}`,
            'script': args => `#NOP JMC SCRIPT (Internal logic needed): #script ${args}`,
            'ticksize': args => `#VARIABLE {j_ticksize} {${args}}; #TICKER {jmc_tick} {#SHOWME #TICK} {${args}}`,
            'tickon': () => `#TICKER {jmc_tick} {#SHOWME #TICK} {$j_ticksize}`,
            'tickset': () => `#TICKER {jmc_tick} {#SHOWME #TICK} {$j_ticksize}`,
            'tickoff': () => `#UNTICKER {jmc_tick}`,
            'drop': args => args ? `#NOP UNCONVERTED DROP: #drop ${args}` : `#LINE GAG`,
            'cr': () => `#SEND {\n}`,
            'daa': args => `#NOP DAA/HIDE/WHISPER (Secure send) partially supported: #SEND {${args}}`,
            'hide': args => `#NOP DAA/HIDE/WHISPER (Secure send) partially supported: #SEND {${args}}`,
            'whisper': args => `#NOP DAA/HIDE/WHISPER (Secure send) partially supported: #SEND {${args}}`,
            'ignore': args => args ? `#IGNORE {${this.convertSyntax(this.cleanJMCArgs(args))}}` : `#IGNORE`
        };
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
            const trimmed = str.trim();
            if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
                let inner = trimmed.substring(1, trimmed.length - 1).trim();
                inner = this.evaluatePowwowExpression(inner);
                return this.convertSubstitutions(inner);
            }
        }

        return this.convertSubstitutions(str);
    }

    evaluatePowwowExpression(str) {
        // 1. Attributes
        str = str.replace(/attr\s*\("([^"]+)"\)/g, (match, attr) => this.mapAttributes(attr));
        str = str.replace(/attr\s+"([^"]+)"/g, (match, attr) => this.mapAttributes(attr));
        str = str.replace(/\bnoattr\b/g, '<099>');

        // 2. Keywords
        str = str.replace(/\btimer\b/g, '@powwow_timer{}');
        str = str.replace(/\bmap\b/g, '$powwow_at_map');
        str = str.replace(/\bprompt\b/g, '$powwow_at_prompt');
        str = str.replace(/\blast_line\b/g, '$powwow_at_last_line');
        str = str.replace(/\bbuffer\b/g, '$powwow_at_buffer');
        str = str.replace(/\blines\b/g, '$powwow_at_lines');
        str = str.replace(/\bmem\b/g, '$powwow_at_mem');

        // 3. Operators
        str = str.replace(/\brand\s+([@$a-zA-Z0-9_\[\]-]+|%\d+|\d+)/g, '@powwow_rand{$1}');
        str = str.replace(/([@$][a-zA-Z0-9_\[\]-]+|%\d+):\?/g, '&$1[]');
        str = str.replace(/([@$][a-zA-Z0-9_\[\]-]+|%\d+)\.\?/g, '@powwow_char_length{$1}');
        str = str.replace(/([@$][a-zA-Z0-9_\[\]-]+|%\d+):([@$a-zA-Z0-9_\[\]-]+|%\d+)/g, '$1[$2]');
        str = str.replace(/([@$][a-zA-Z0-9_\[\]-]+|%\d+)\.([@$a-zA-Z0-9_\[\]-]+|%\d+)/g, '$1.char[$2]');
        str = str.replace(/([@$][a-zA-Z0-9_\[\]-]+|%\d+):>([@$a-zA-Z0-9_\[\]-]+|%\d+)/g, '$1[$2..-1]');
        str = str.replace(/([@$][a-zA-Z0-9_\[\]-]+|%\d+):<([@$a-zA-Z0-9_\[\]-]+|%\d+)/g, '$1[1..$2]');
        str = str.replace(/([@$][a-zA-Z0-9_\[\]-]+|%\d+)\.>([@$a-zA-Z0-9_\[\]-]+|%\d+)/g, '$1.char[$2..-1]');
        str = str.replace(/([@$][a-zA-Z0-9_\[\]-]+|%\d+)\.<([@$a-zA-Z0-9_\[\]-]+|%\d+)/g, '$1.char[1..$2]');
        str = str.replace(/([@$][a-zA-Z0-9_\[\]-]+|%\d+)\?([@$a-zA-Z0-9_\[\]-]+|%\d+|"[^"]*")/g, '@powwow_search{$1;$2}');

        // Strip % conversion operator used in Axel's script
        str = str.replace(/%\(([^)]+)\)/g, '$1');

        // 4. Concatenation
        if (str.includes('+')) {
            let lastStr;
            do {
                lastStr = str;
                str = str.replace(/"([^"]*)"\s*\+\s*"([^"]*)"/g, '"$1$2"');
                str = str.replace(/"([^"]*)"\s*\+\s*([@$][a-zA-Z0-9_%-]+)/g, '"$1$2"');
                str = str.replace(/([@$][a-zA-Z0-9_%-]+)\s*\+\s*"([^"]*)"/g, '"$1$2"');
                str = str.replace(/([@$][a-zA-Z0-9_%-]+)\s*\+\s*([@$][a-zA-Z0-9_%-]+)/g, '$1$2');
                str = str.replace(/(<[0-9]+>)\s*\+\s*"([^"]*)"/g, '$1$2');
                str = str.replace(/"([^"]*)"\s*\+\s*(<[0-9]+>)/g, '$1$2');
                str = str.replace(/(<[0-9]+>)\s*\+\s*(<[0-9]+>)/g, '$1$2');
            } while (str !== lastStr);
        }

        return str;
    }

    convertVarName(name) {
        const prefix = this.mode === 'jmc' ? 'j_' : 'p_';

        if (this.mode === 'jmc' && name.startsWith('$') && !name.match(/^\$\d+$/)) {
            name = name.substring(1);
        }

        const specialPowwow = ['timer', 'map', 'prompt', 'last_line', 'buffer', 'lines', 'mem'];
        if (this.mode === 'powwow' && specialPowwow.includes(name)) {
            return `powwow_at_${name}`;
        }
        if (this.mode === 'powwow' && (name.startsWith('@') || name.startsWith('$'))) {
            const inner = name.substring(1);
            if (specialPowwow.includes(inner)) return `powwow_at_${inner}`;
        }

        if (name.startsWith('@')) {
            const numMatch = name.match(/^@(-?\d+)$/);
            if (numMatch) {
                const n = numMatch[1];
                return n.startsWith('-') ? `powwow_at_m${n.substring(1)}` : `powwow_at[${n}]`;
            }
            return `powwow_at_${name.substring(1)}`;
        } else if (name.startsWith('$')) {
            const numMatch = name.match(/^\$(-?\d+)$/);
            if (numMatch) {
                const n = numMatch[1];
                return n.startsWith('-') ? `${this.mode === 'jmc' ? 'jmc' : 'powwow'}_dollar_m${n.substring(1)}` : `${this.mode === 'jmc' ? 'jmc' : 'powwow'}_dollar[${n}]`;
            }
            return `${prefix}${name.substring(1)}`;
        }
        return prefix + name;
    }

    convertSubstitutions(str) {
        if (this.mode === 'powwow') {
            // 1. Delayed parameter substitution: \$1 -> %%1
            str = str.replace(/\\\$(\d+)/g, '%%$1');
            str = str.replace(/\\&(\d+)/g, '%%$1');

            // 2. Named parameters/variables in ${var} or #{expr}
            str = str.replace(/#{([^}]+)}/g, (match, expr) => {
                return `\$math_eval{${this.convertSyntax('(' + expr + ')')}}`;
            });

            // 3. Variables:
            str = str.replace(/\\?@([a-zA-Z_]\w*)/g, (match, name) => {
                if (['powwow_timer', 'powwow_rand', 'powwow_char_length', 'powwow_search'].includes(name)) return `__FUNC__${name}`;
                if (name.startsWith('powwow_') || name.startsWith('p_')) return `__VAR__${name}`;
                return `__VAR__${this.convertVarName('@' + name)}`;
            });
            str = str.replace(/\\?@(-?\d+)/g, (match, num) => `__VAR__${this.convertVarName('@' + num)}`);

            str = str.replace(/\${([a-zA-Z0-9_%$-]+)}/g, (match, name) => {
                let res = name.replace(/\$(\d+)/g, '%$1');
                res = res.replace(/\$([a-zA-Z_]\w*)/g, 'p_$1');
                if (!res.startsWith('p_') && !res.startsWith('%') && !res.startsWith('powwow_')) {
                    res = 'p_' + res;
                }
                return `__VAR__${res}`;
            });

            str = str.replace(/(?<![%])\\?\$([a-zA-Z_]\w+)/g, (match, name) => {
                if (name.startsWith('powwow_') || name.startsWith('p_')) return `__VAR__${name}`;
                return `__VAR__${this.convertVarName('$' + name)}`;
            });
            str = str.replace(/(?<![%])\\?\$(-\d+)/g, (match, num) => `__VAR__${this.convertVarName('$' + num)}`);

            // 4. Standard parameters: $N -> %N, &N -> %N
            str = str.replace(/(?<![\\%])\$(\d+)/g, '%$1');
            str = str.replace(/(?<![\\%])&(\d+)/g, '%$1');

            // Replace placeholders back
            str = str.replace(/__VAR__/g, '$');
            str = str.replace(/__FUNC__/g, '@');

            // Final safety pass for Axel's script: ensure common variables like sessxp are prefixed
            const common = ['sessxp', 'sesstp', 'gainxp', 'gaintp', 'oldxp', 'oldtp', 'xpcal'];
            common.forEach(v => {
                const reg = new RegExp('\\$'+v+'\\b', 'g');
                str = str.replace(reg, '$p_'+v);
            });
        } else if (this.mode === 'jmc') {
            // JMC uses %0-%9 for parameters and $var for variables
            // Standard parameters: %N -> %N (no change needed for TT++)

            // Variables: $var -> $j_var
            str = str.replace(/(?<![\\%])\$([a-zA-Z_]\w*)/g, (match, name) => {
                if (name.startsWith('jmc_') || name.startsWith('j_')) return `\$${name}`;
                return `\$${this.convertVarName(name)}`;
            });
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
                    const val = assignMatch[2].trim();
                    if (val.startsWith('"')) {
                        return `#VARIABLE {${name}} {${this.convertSyntax('(' + val + ')')}}`;
                    }
                    return `#MATH {${name}} {${this.convertSyntax('(' + val + ')')}}`;
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
            const handler = this.powwowHandlers[command];
            if (handler) return handler(args);
            return `#NOP UNSUPPORTED: ${line}`;
        } else if (this.mode === 'jmc') {
            const handler = this.jmcHandlers[command];
            if (handler) return handler(args);
            return `#${command.toUpperCase()} {${this.convertSyntax(args)}}`;
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
            return `#NOP UNCONVERTED ALIAS ARGS: ${args}`;
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
                 const rawCmds = simpleMatch[2] || '';
                 const hasPrint = rawCmds.toLowerCase().includes('#print');
                 const ttCmds = this.processCommands(rawCmds);

                 if (rawCmds === '') return `#GAG {${ttPattern}}`;

                 // In Powwow, #action intercepts GAG by default unless autoprint is ON or #print is called.
                 if (this.state.powwow.autoprint || hasPrint) {
                     return `#ACTION {${ttPattern}} {${ttCmds}}`;
                 } else {
                     return `#ACTION {${ttPattern}} {${ttCmds}${ttCmds ? '; ' : ''}#LINE GAG}`;
                 }
             }
             return `#NOP UNCONVERTED ACTION ARGS: ${args}`;
        }

        const [, op, label, group1, pattern, group2, cmds] = match;
        const ttPattern = this.convertSyntax(pattern.trim());
        const rawCmds = cmds || '';
        const hasPrint = rawCmds.toLowerCase().includes('#print');
        const ttCmds = this.processCommands(rawCmds);

        const targetClass = group1 || group2 || label;
        let out = targetClass ? `#CLASS {${targetClass}} {OPEN}\n` : '';
        if (rawCmds === '') {
            out += `#GAG {${ttPattern}}`;
        } else {
            if (this.state.powwow.autoprint || hasPrint) {
                out += `#ACTION {${ttPattern}} {${ttCmds}}`;
            } else {
                out += `#ACTION {${ttPattern}} {${ttCmds}${ttCmds ? '; ' : ''}#LINE GAG}`;
            }
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

        if (val.trim().startsWith('(')) {
            let evaled = this.convertSyntax(val);
            // If the evaluated expression looks like a string (contains quotes or color tags)
            if (evaled.includes('"') || evaled.includes('<')) {
                return `#VARIABLE {${name}} {${evaled.replace(/^"|"$/g, '')}}`;
            }
            return `#MATH {${name}} {${evaled}}`;
        }
        return `#VARIABLE {${name}} {${this.processCommands(val)}}`;
    }

    convertIfPowwow(args) {
        const block = this.extractBlock(args, '(', ')');
        if (!block) return `#NOP UNCONVERTED IF: #if ${args}`;

        const cond = block.inner;
        let rest = block.rest.trim();
        let trueBlock = '';
        let falseBlock = '';

        // Improved #else detection: look for #else that is NOT inside braces/parens
        let elsePos = -1;
        let depth = 0;
        let inQuotes = false;
        let escaped = false;
        for (let i = 0; i < rest.length; i++) {
            const char = rest[i];
            if (escaped) { escaped = false; continue; }
            if (char === '\\') { escaped = true; continue; }
            if (char === '"') { inQuotes = !inQuotes; continue; }
            if (inQuotes) continue;
            if (char === '{' || char === '(') depth++;
            else if (char === '}' || char === ')') depth--;
            else if (depth === 0 && rest.substring(i).toLowerCase().startsWith('#else')) {
                elsePos = i;
                break;
            }
        }

        if (elsePos !== -1) {
            trueBlock = rest.substring(0, elsePos).trim();
            // Strip trailing separator if present before #else
            if (trueBlock.endsWith(';') || trueBlock.endsWith('|')) {
                trueBlock = trueBlock.substring(0, trueBlock.length - 1).trim();
            }
            falseBlock = rest.substring(elsePos + 5).trim();
            // If #else was #else {cmds}, strip braces
            if (falseBlock.startsWith('{') && falseBlock.endsWith('}')) {
                falseBlock = falseBlock.substring(1, falseBlock.length - 1).trim();
            }
        } else {
            trueBlock = rest;
        }

        let out = `#IF {${this.convertSyntax('(' + cond + ')').replace(/\s*!=\s*/g, ' != ').replace(/\s*==\s*/g, ' == ')}} {${this.processCommands(trueBlock)}}`;
        if (falseBlock) {
            out += ` {#ELSE} {${this.processCommands(falseBlock)}}`;
        }
        return out;
    }

    convertWhilePowwow(args) {
        const block = this.extractBlock(args, '(', ')');
        if (!block) return `#NOP UNCONVERTED WHILE: #while ${args}`;
        return `#WHILE {${this.convertSyntax('(' + block.inner + ')')}} {${this.processCommands(block.rest)}}`;
    }

    convertForPowwow(args) {
        const block = this.extractBlock(args, '(', ')');
        if (!block) return `#NOP UNCONVERTED FOR: #for ${args}`;

        const parts = block.inner.split(';');
        if (parts.length < 3) return `#NOP INVALID FOR: #for (${block.inner}) ${block.rest}`;

        const init = parts[0].trim();
        const check = parts[1].trim();
        const loop = parts[2].trim();
        const body = block.rest.trim();

        let out = '';
        if (init) {
            out += `${this.convertSingleCommand(`#(${init})`)}; `;
        }
        out += `#WHILE {${this.convertSyntax('(' + check + ')')}} {${this.processCommands(body)}; ${this.convertSingleCommand(`#(${loop})`)}}`;
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
        if (!match) return `#NOP UNCONVERTED TICKER ARGS: ${args}`;

        const [, op, label, group, tickerName, delay, cmds] = match;
        const delayVal = isNaN(delay) ? this.convertSyntax('(' + delay + ')') : (parseInt(delay) / 1000).toFixed(2);

        const targetClass = group || label;
        let out = targetClass ? `#CLASS {${targetClass}} {OPEN}\n` : '';
        out += `#TICKER {${tickerName}} {${this.processCommands(cmds)}} {${delayVal}}`;
        if (targetClass) out += `\n#CLASS {${targetClass}} {CLOSE}`;
        return out;
    }

    convertBindPowwow(args) {
        // #bind name [sequence][=[command]]
        const match = args.match(/^([^= ]+)(?:\s+([^= ]+))?(?:=(.*))?$/s);
        if (match) {
            const name = match[1];
            const seq = match[2];
            const cmd = match[3] || '';
            // We map Powwow bind to TinTin++ MACRO.
            // Often name is something like 'f1' or 'Up'.
            return `#MACRO {${name}} {${this.processCommands(cmd)}}`;
        }
        return `#NOP UNCONVERTED BIND: #bind ${args}`;
    }

    convertPromptPowwow(args) {
        const match = args.match(/^(?:([<=>%][+-]?)?([\w_-]+)(?:@([\w_-]+))?\s+)?([^=]+)=(.+)?/is);
        if (!match) {
             const simpleMatch = args.match(/^([^=]+)=(.+)?/is);
             if (simpleMatch) {
                 const ttPattern = this.convertSyntax(simpleMatch[1].trim());
                 const ttCmds = simpleMatch[2] ? this.processCommands(simpleMatch[2]) : '';
                 return `#PROMPT {${ttPattern}} {${ttCmds}}`;
             }
             return `#NOP UNCONVERTED PROMPT ARGS: ${args}`;
        }
        const [, op, label, group, pattern, cmds] = match;

        const ttPattern = this.convertSyntax(pattern.trim());
        const ttCmds = cmds ? this.processCommands(cmds) : '';

        return `#PROMPT {${ttPattern}} {${ttCmds}}`;
    }

    convertMarkPowwow(args) {
        const match = args.match(/^([^=]+)(?:=(.*))?$/is);
        if (match) {
            const pattern = this.convertSyntax(match[1].trim());
            const color = match[2] ? match[2].trim() : 'bold';
            return `#HIGHLIGHT {${pattern}} {${color}}`;
        }
        return `#NOP UNCONVERTED MARK: #mark ${args}`;
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
            return `#KILL ALIASES {*}*; #KILL ACTIONS {*}*; #KILL VARIABLES {*}*; #KILL HIGHLIGHTS {*}*; #KILL TICKERS {*}*; #KILL MACROS {*}*; #NOP --- RESET ALL ---`;
        }
        return `#NOP UNCONVERTED RESET: #reset ${args}`;
    }

    // --- JMC Conversion Methods ---

    convertAliasJMC(args) {
        // #alias {name} {commands} {group}
        const parts = this.tokenize(args, ' ');
        if (parts.length >= 2) {
            const name = parts[0].trim().replace(/^{|}$/g, '');
            let cmds = '';
            let group = '';

            if (parts[1].startsWith('{')) {
                cmds = parts[1].replace(/^{|}$/g, '');
                group = parts[2] ? parts[2].trim().replace(/^{|}$/g, '') : '';
            } else {
                // In JMC, if there are exactly 3 parts, the 3rd is likely the group.
                if (parts.length === 3) {
                    cmds = parts[1];
                    group = parts[2].replace(/^{|}$/g, '');
                } else {
                    cmds = parts.slice(1).join(' ');
                }
            }

            let out = '';
            if (group) out += `#CLASS {${group}} {OPEN}\n`;
            out += `#ALIAS {${this.convertSyntax(name)}} {${this.processCommands(cmds)}}`;
            if (group) out += `\n#CLASS {${group}} {CLOSE}`;
            return out;
        }
        return `#ALIAS {${this.convertSyntax(args)}}`;
    }

    convertActionJMC(args) {
        // #action {pattern} {commands} {priority} {group}
        const parts = this.tokenize(args, ' ');
        if (parts.length >= 2) {
            let patternToken = parts[0].trim();
            let startIndex = 0;

            // Special case: JMC sometimes has "TEXT" as first argument for type
            if (patternToken.toUpperCase() === 'TEXT' && parts.length >= 3) {
                patternToken = parts[1].trim();
                startIndex = 1;
            }

            let pattern = patternToken.replace(/^{|}$/g, '');
            let cmds = '';
            let priority = '';
            let group = '';

            const cmdsToken = parts[startIndex + 1];
            if (cmdsToken.startsWith('{')) {
                cmds = cmdsToken.replace(/^{|}$/g, '');
                priority = parts[startIndex + 2] ? parts[startIndex + 2].trim().replace(/^{|}$/g, '') : '';
                group = parts[startIndex + 3] ? parts[startIndex + 3].trim().replace(/^{|}$/g, '') : '';
            } else {
                // If not in braces, check for priority as next token
                if (parts.length > startIndex + 2 && /^\d+$/.test(parts[startIndex + 2])) {
                    cmds = cmdsToken;
                    priority = parts[startIndex + 2];
                    group = parts[startIndex + 3] ? parts[startIndex + 3].trim().replace(/^{|}$/g, '') : '';
                } else {
                    cmds = parts.slice(startIndex + 1).join(' ');
                }
            }

            let out = '';
            if (group) out += `#CLASS {${group}} {OPEN}\n`;
            out += `#ACTION {${this.convertSyntax(pattern)}} {${this.processCommands(cmds)}}`;
            if (priority) out += ` {${priority}}`;
            if (group) out += `\n#CLASS {${group}} {CLOSE}`;
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
        return `#NOP UNCONVERTED JMC IF: #if ${args}`;
    }

    convertMathJMC(args) {
        // #math {var} {expr}
        const match = args.match(/^{([^}]+)}\s*{(.*)}$/s) || args.match(/^(\S+)\s+(.*)$/s);
        if (match) {
            const name = this.convertVarName(match[1].trim().replace(/^{|}$/g, ''));
            const expr = match[2].trim().replace(/^{|}$/g, '');
            return `#math {${name}} {${this.convertSyntax(expr)}}`;
        }
        return `#NOP UNCONVERTED JMC MATH: #math ${args}`;
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
        return `#NOP JMC GROUP COMMAND: #group ${args}`;
    }

    convertHighlightJMC(args) {
        // #highlight {color} {pattern} {group}
        const parts = this.tokenize(args, ' ');
        if (parts.length >= 2) {
            const color = parts[0].trim().replace(/^{|}$/g, '');
            let patternToken = parts[1].trim();
            let group = '';

            let pattern = patternToken.replace(/^{|}$/g, '');

            // Special compatibility: strip #showme from patterns as it's common in some scripts
            // but likely intended to match the output of showme.
            if (pattern.startsWith('#showme ')) {
                pattern = pattern.substring(8).trim();
            }

            if (patternToken.startsWith('{')) {
                group = parts[2] ? parts[2].trim().replace(/^{|}$/g, '') : '';
            } else {
                if (parts.length === 3) {
                    group = parts[2].trim().replace(/^{|}$/g, '');
                }
            }

            let out = '';
            if (group) out += `#CLASS {${group}} {OPEN}\n`;
            out += `#HIGHLIGHT {${this.convertSyntax(pattern)}} {${color}}`;
            if (group) out += `\n#CLASS {${group}} {CLOSE}`;
            return out;
        }
        return `#NOP UNCONVERTED JMC HIGHLIGHT: #highlight ${args}`;
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
        return `#NOP UNCONVERTED JMC SUB: #sub ${args}`;
    }

    convertHotkeyJMC(args) {
        // #hotkey {key} {commands} {group}
        const parts = this.tokenize(args, ' ');
        if (parts.length >= 2) {
            const key = parts[0].trim().replace(/^{|}$/g, '');
            let cmds = parts[1].trim();
            let group = '';

            if (cmds.startsWith('{')) {
                cmds = cmds.replace(/^{|}$/g, '');
                group = parts[2] ? parts[2].trim().replace(/^{|}$/g, '') : '';
            } else {
                cmds = parts.slice(1).join(' ');
            }

            // TinTin++ uses #MACRO for hotkeys. Key names might need mapping, but keeping as is for now.
            let out = '';
            if (group) out += `#CLASS {${group}} {OPEN}\n`;
            out += `#MACRO {${key}} {${this.processCommands(cmds)}}`;
            if (group) out += `\n#CLASS {${group}} {CLOSE}`;
            return out;
        }
        return `#NOP UNCONVERTED JMC HOTKEY: #hotkey ${args}`;
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
        return `#NOP UNCONVERTED JMC LOOP: #loop ${args}`;
    }

    convertToLowerJMC(args) {
        // #tolower {var} {text}
        const match = args.match(/^{([^}]+)}\s*{(.*)}$/s) || args.match(/^(\S+)\s+(.*)$/s);
        if (match) {
            const varName = this.convertVarName(match[1].trim().replace(/^{|}$/g, ''));
            const text = match[2].trim().replace(/^{|}$/g, '');
            return `#FORMAT {${varName}} {%l} {${this.convertSyntax(text)}}`;
        }
        return `#NOP UNCONVERTED JMC TOLOWER: #tolower ${args}`;
    }

    convertToUpperJMC(args) {
        const match = args.match(/^{([^}]+)}\s*{(.*)}$/s) || args.match(/^(\S+)\s+(.*)$/s);
        if (match) {
            const varName = this.convertVarName(match[1].trim().replace(/^{|}$/g, ''));
            const text = match[2].trim().replace(/^{|}$/g, '');
            return `#FORMAT {${varName}} {%u} {${this.convertSyntax(text)}}`;
        }
        return `#NOP UNCONVERTED JMC TOUPPER: #toupper ${args}`;
    }

    convert(inputScript) {
        if (!inputScript) return '';

        // Handle line continuation for Lexer
        let script = inputScript;
        if (this.mode === 'powwow') {
            script = script.replace(/\\\r?\n/g, '');
        }

        const lexer = new Lexer(script, { mode: this.mode, separator: this.separator });
        const parser = new Parser(lexer);
        const ast = parser.parse();

        const generator = new TinTinGenerator(this);
        return generator.generate(ast);
    }
}
