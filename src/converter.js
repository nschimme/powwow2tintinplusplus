/**
 * Main TinTinConverter class
 */
import { Lexer } from './converter/lexer.js';
import { Parser } from './converter/parser.js';
import { TinTinGenerator } from './converter/generator.js';
import { getPowwowHandlers, getJMCHandlers } from './converter/handlers.js';
import { powwowMethods } from './converter/powwow.js';
import { jmcMethods } from './converter/jmc.js';
import { convertVarName, mapAttributes } from './converter/utils.js';

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

        // Bind specific conversion methods
        Object.assign(this, powwowMethods);
        Object.assign(this, jmcMethods);

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
        this.powwowHandlers = getPowwowHandlers(this);
        this.jmcHandlers = getJMCHandlers(this);
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
    convertSyntax(str, options = {}) {
        if (this.mode === 'powwow') {
            const trimmed = str.trim();
            if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
                let inner = trimmed.substring(1, trimmed.length - 1).trim();
                inner = this.evaluatePowwowExpression(inner);
                return this.convertSubstitutions(inner, options);
            }
        }

        return this.convertSubstitutions(str, options);
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
        str = str.replace(/\brand\s+([@$a-zA-Z0-9_%$-]+|%\d+|\d+)/g, '@powwow_rand{$1}');

        // Handle unary * and %
        str = str.replace(/\*([@$a-zA-Z0-9_%$-]+|%\d+|\\?\$\d+|\\?@\d+|\([^)]+\))/g, (match, expr) => {
            return `@powwow_first_char_ascii{${expr}}`;
        });
        str = str.replace(/%([@$a-zA-Z0-9_%$-]+|%\d+|\\?\$\d+|\\?@\d+|\([^)]+\))/g, (match, expr) => {
            return `(@powwow_to_number{${expr}})`;
        });

        str = str.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+):\?/g, (match, v) => {
            return `@powwow_word_count{${v}}`;
        });
        str = str.replace(/:\?([@$][a-zA-Z0-9_%$-]+|%\d+)/g, (match, v) => {
            return `@powwow_word_count{${v}}`;
        });
        str = str.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+)\.\?/g, '@powwow_char_length{$1}');
        str = str.replace(/\.\?([@$][a-zA-Z0-9_%$-]+|%\d+)/g, '@powwow_char_length{$1}');
        str = str.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+):([@$a-zA-Z0-9_%$-]+|%\d+)/g, (match, v, i) => {
            return `@powwow_word{${v};${i}}`;
        });
        str = str.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+)\.([@$a-zA-Z0-9_%$-]+|%\d+)/g, '$1.char[$2]');
        str = str.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+):>([@$a-zA-Z0-9_%$-]+|%\d+)/g, (match, v, i) => {
            return `@powwow_word_slice_to_end{${v};${i}}`;
        });
        str = str.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+):<([@$a-zA-Z0-9_%$-]+|%\d+)/g, (match, v, i) => {
            return `@powwow_word_slice_from_start{${v};${i}}`;
        });
        str = str.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+)\.>([@$a-zA-Z0-9_%$-]+|%\d+)/g, '$1.char[$2..-1]');
        str = str.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+)\.<([@$a-zA-Z0-9_%$-]+|%\d+)/g, '$1.char[1..$2]');
        str = str.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+)\?([@$a-zA-Z0-9_%$-]+|%\d+|"[^"]*")/g, '@powwow_search{$1;$2}');

        // 4. Concatenation
        if (str.includes('+')) {
            let lastStr;
            do {
                lastStr = str;
                str = str.replace(/"([^"]*)"\s*\+\s*"([^"]*)"/g, '"$1$2"');
                str = str.replace(/"([^"]*)"\s*\+\s*([@$][a-zA-Z0-9_%$-]+)/g, '"$1$2"');
                str = str.replace(/([@$][a-zA-Z0-9_%$-]+)\s*\+\s*"([^"]*)"/g, '"$1$2"');
                str = str.replace(/([@$][a-zA-Z0-9_%$-]+)\s*\+\s*([@$][a-zA-Z0-9_%$-]+)/g, '$1$2');
                str = str.replace(/(<[0-9]+>)\s*\+\s*"([^"]*)"/g, '$1$2');
                str = str.replace(/"([^"]*)"\s*\+\s*(<[0-9]+>)/g, '$1$2');
                str = str.replace(/(<[0-9]+>)\s*\+\s*(<[0-9]+>)/g, '$1$2');
            } while (str !== lastStr);
        }

        return str;
    }

    convertVarName(name) {
        return convertVarName(name, this.mode);
    }

    convertSubstitutions(str, options = {}) {
        const indexOffset = options.indexOffset || 0;

        if (this.mode === 'powwow') {
            // 1. Delayed parameter substitution: \$1 -> %%1
            str = str.replace(/\\\$(\d+)/g, (match, n) => '%%' + (parseInt(n) + indexOffset));
            str = str.replace(/\\&(\d+)/g, (match, n) => '%%' + (parseInt(n) + indexOffset));

            // 2. Named parameters/variables in ${var} or #{expr}
            str = str.replace(/#{([^}]+)}/g, (match, expr) => {
                return `\$math_eval{${this.convertSyntax('(' + expr + ')', options)}}`;
            });

            // 3. Variables:
            str = str.replace(/\\?@([a-zA-Z_]\w+)/g, (match, name) => {
                if (['powwow_timer', 'powwow_rand', 'powwow_char_length', 'powwow_search', 'powwow_word_count', 'powwow_word', 'powwow_word_slice_to_end', 'powwow_word_slice_from_start', 'powwow_first_char_ascii', 'powwow_to_number'].includes(name)) return `__FUNC__${name}`;
                if (name.startsWith('powwow_') || name.startsWith('p_')) return `__VAR__${name}`;
                return `__VAR__${this.convertVarName('@' + name)}`;
            });
            str = str.replace(/\\?@(-?\d+)/g, (match, num) => `__VAR__${this.convertVarName('@' + num)}`);

            str = str.replace(/\${([a-zA-Z0-9_%$-]+)}/g, (match, name) => {
                let res = name;
                if (res.match(/^\d+$/)) {
                   res = '%' + (parseInt(res) + indexOffset);
                } else if (res.match(/^\$\d+$/)) {
                   res = '%' + (parseInt(res.substring(1)) + indexOffset);
                } else if (res.match(/^@\d+$/)) {
                   res = this.convertVarName(res, 'powwow');
                } else {
                   res = this.convertVarName(res, 'powwow');
                }
                return `__VAR__${res}`;
            });

            str = str.replace(/(?<![%])\\?\$([a-zA-Z_]\w+)/g, (match, name) => {
                if (name.startsWith('powwow_') || name.startsWith('p_')) return `__VAR__${name}`;
                return `__VAR__${this.convertVarName('$' + name)}`;
            });
            str = str.replace(/(?<![%])\\?\$(-\d+)/g, (match, num) => `__VAR__${this.convertVarName('$' + num)}`);

            // 4. Standard parameters: $N -> %N, &N -> %N
            str = str.replace(/(?<![\\%])\$(\d+)/g, (match, n) => '%' + (parseInt(n) + indexOffset));
            str = str.replace(/(?<![\\%])&(\d+)/g, (match, n) => '%' + (parseInt(n) + indexOffset));

            // Replace placeholders back
            str = str.replace(/__VAR__/g, '$');
            str = str.replace(/__FUNC__/g, '@');

        } else if (this.mode === 'jmc') {
            // JMC uses %0-%9 for parameters and $var for variables
            // Standard parameters: %N -> %N (no change needed for TT++)

            // Variables: $var -> $j_var
            str = str.replace(/(?<![\\%])\$([a-zA-Z_]\w+)/g, (match, name) => {
                if (name.startsWith('jmc_') || name.startsWith('j_')) return `\$${name}`;
                return `\$${this.convertVarName(name)}`;
            });
        }

        return str;
    }

    mapAttributes(attr) {
        return mapAttributes(attr);
    }

    processCommands(commandString, options = {}) {
        if (!commandString) return '';
        let commandsStr = commandString.trim();
        if (commandsStr.startsWith('{') && commandsStr.endsWith('}')) {
            commandsStr = commandsStr.substring(1, commandsStr.length - 1);
        }
        if (commandsStr === '') return '';

        const lexer = new Lexer(commandsStr, { mode: this.mode, separator: this.separator });
        const parser = new Parser(lexer);
        const nodes = parser.parse();

        const generator = new TinTinGenerator(this);
        generator.options = options;
        return generator.generateNodes(nodes, '; ');
    }

    cleanJMCArgs(args) {
        return args.trim().replace(/^{|}$/g, '').trim();
    }

    convertSingleCommand(line, options = {}) {
        line = line.trim();

        if (this.mode === 'powwow' && line.startsWith('#!')) {
            return { text: `#SYSTEM {${line.substring(2).trim()}}` };
        }

        const cmdMatch = line.match(/^#\s*(\(|[a-zA-Z_!<=>%+\-]+)\s*(.*)/s);
        if (!cmdMatch) {
            return { text: this.convertSyntax(line, options) };
        }

        let command = cmdMatch[1].toLowerCase();
        let args = cmdMatch[2].trim();

        if (this.mode === 'powwow') {
            // Check for direct label commands like #+label
            const directMatch = command.match(/^([<=>%+-])([\w_-]+)$/);
            if (directMatch) {
                const [, op, label] = directMatch;
                if (op === '+' || op === '=') return { text: `#CLASS {${label}} {OPEN}` };
                if (op === '-' || op === '<') return { text: `#CLASS {${label}} {KILL}` };
                if (op === '%') return { text: `#IF {&class_${label}} {#CLASS {${label}} {KILL}} {#ELSE} {#CLASS {${label}} {OPEN}}` };
                if (op === '>') return { text: `#CLASS {${label}} {OPEN}` };
            }

            // Handle # (expression)
            if (command === '(') {
                const exprMatch = line.match(/^#\s*\((.*)\)$/s);
                if (exprMatch) {
                    const expr = exprMatch[1].trim();
                    const assignMatch = expr.match(/^([@$][a-zA-Z0-9_%$-]+)\s*=(.*)$/s);
                    if (assignMatch) {
                        const name = this.convertVarName(assignMatch[1]);
                        const val = assignMatch[2].trim();
                        if (val === '') {
                            return { text: `#UNVARIABLE {${name}}` };
                        }
                        const convertedVal = this.convertSyntax('(' + val + ')', options);
                        if (val.startsWith('"') || convertedVal.includes('<')) {
                            return { text: `#VARIABLE {${name}} {${convertedVal.replace(/^"|"$/g, '')}}` };
                        }
                        return { text: `#MATH {${name}} {${convertedVal}}` };
                    }
                    return { text: `#MATH {p_result} {${this.convertSyntax('(' + expr + ')', options)}}` };
                }
            }

            const handler = this.powwowHandlers[command];
            if (handler) return handler(args, options);
            return { text: `#NOP UNSUPPORTED: ${line}` };
        } else if (this.mode === 'jmc') {
            const handler = this.jmcHandlers[command];
            if (handler) return handler(args, options);
            return { text: `#${command.toUpperCase()} {${this.convertSyntax(args, options)}}` };
        }

        return { text: this.convertSyntax(line, options) };
    }

    convert(inputScript, options = {}) {
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
        if (options.raw) {
            return generator.generateNodes(ast, '\n');
        }
        return generator.generate(ast);
    }
}
