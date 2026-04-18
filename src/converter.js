/**
 * Main TinTinConverter class
 */
import { Lexer } from './converter/lexer.js';
import { Parser } from './converter/parser.js';
import { TinTinGenerator } from './converter/generator.js';
import { getPowwowHandlers, getJMCHandlers } from './converter/handlers.js';
import { powwowMethods } from './converter/powwow.js';
import { jmcMethods } from './converter/jmc.js';
import { convertVarName, mapAttributes, POWWOW_RESERVED_FUNCS } from './converter/utils.js';

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
        // Protect strings
        const protectedStrings = [];
        let workingStr = str.replace(/"((?:\\.|[^"])*)"/g, (match, content) => {
            protectedStrings.push(match);
            return `__STR${protectedStrings.length - 1}__`;
        });

        // 1. Attributes
        workingStr = workingStr.replace(/attr\s*\("([^"]+)"\)/g, (match, attr) => this.mapAttributes(attr));
        workingStr = workingStr.replace(/attr\s+__STR(\d+)__/g, (match, idx) => {
            const s = protectedStrings[parseInt(idx)];
            return this.mapAttributes(s.substring(1, s.length - 1));
        });
        workingStr = workingStr.replace(/\bnoattr\b/g, '<099>');

        // 2. Keywords
        workingStr = workingStr.replace(/\btimer\b/g, '@powwow_timer{}');
        workingStr = workingStr.replace(/\bmap\b/g, '$powwow_at_map');
        workingStr = workingStr.replace(/\bprompt\b/g, '$powwow_at_prompt');
        workingStr = workingStr.replace(/\blast_line\b/g, '$powwow_at_last_line');
        workingStr = workingStr.replace(/\bbuffer\b/g, '$powwow_at_buffer');
        workingStr = workingStr.replace(/\blines\b/g, '$powwow_at_lines');
        workingStr = workingStr.replace(/\bmem\b/g, '$powwow_at_mem');

        // 3. Operators
        workingStr = workingStr.replace(/\brand\s+([@$a-zA-Z0-9_%$-]+|%\d+|\d+)/g, '@powwow_rand{$1}');

        // Handle unary * and %
        workingStr = workingStr.replace(/\*([@$a-zA-Z0-9_-]+|%\d+|\\?\$[0-9]+|\\?@[0-9]+|\([^)]+\))/g, (match, expr) => {
            return `@powwow_first_char_ascii{${expr}}`;
        });
        workingStr = workingStr.replace(/%([@$a-zA-Z0-9_-]+|(?<!\w)%\d+|\\?\$[0-9]+|\\?@[0-9]+|\([^)]+\))/g, (match, expr) => {
            if (expr.startsWith('__STR') && expr.endsWith('__')) return match;
            return `(@powwow_to_number{${expr}})`;
        });

        workingStr = workingStr.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+):\?/g, (match, v) => {
            return `@powwow_word_count{${v}}`;
        });
        workingStr = workingStr.replace(/:\?([@$][a-zA-Z0-9_%$-]+|%\d+)/g, (match, v) => {
            return `@powwow_word_count{${v}}`;
        });
        workingStr = workingStr.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+)\.\?/g, '@powwow_char_length{$1}');
        workingStr = workingStr.replace(/\.\?([@$][a-zA-Z0-9_%$-]+|%\d+)/g, '@powwow_char_length{$1}');
        workingStr = workingStr.replace(/([@$][a-zA-Z0-9_%$-]+|(?<!\w)%\d+):([@$a-zA-Z0-9_%$-]+|(?<!\w)%\d+)/g, (match, v, i) => {
            return `@powwow_word{${v};${i}}`;
        });
        workingStr = workingStr.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+)\.([@$a-zA-Z0-9_%$-]+|%\d+)/g, '$1.char[$2]');
        workingStr = workingStr.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+):>([@$a-zA-Z0-9_%$-]+|%\d+)/g, (match, v, i) => {
            return `@powwow_word_slice_to_end{${v};${i}}`;
        });
        workingStr = workingStr.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+):<([@$a-zA-Z0-9_%$-]+|%\d+)/g, (match, v, i) => {
            return `@powwow_word_slice_from_start{${v};${i}}`;
        });
        workingStr = workingStr.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+)\.>([@$a-zA-Z0-9_%$-]+|%\d+)/g, '$1.char[$2..-1]');
        workingStr = workingStr.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+)\.<([@$a-zA-Z0-9_%$-]+|%\d+)/g, '$1.char[1..$2]');
        workingStr = workingStr.replace(/([@$][a-zA-Z0-9_%$-]+|%\d+)\?([@$a-zA-Z0-9_%$-]+|%\d+|__STR\d+__)/g, (match, v, search) => {
             return `@powwow_search{${v};${search}}`;
        });

        // 4. Concatenation (only if strings are involved or explicitly requested)
        if (workingStr.includes('+') && workingStr.includes('__STR')) {
            let lastStr;
            do {
                lastStr = workingStr;
                // Merge two protected strings
                workingStr = workingStr.replace(/__STR(\d+)__\s*\+\s*__STR(\d+)__/g, (match, i1, i2) => {
                    const s1 = protectedStrings[parseInt(i1)];
                    const s2 = protectedStrings[parseInt(i2)];
                    protectedStrings.push(s1.substring(0, s1.length - 1) + s2.substring(1));
                    return `__STR${protectedStrings.length - 1}__`;
                });
                // Remove + between string and variables/colors (NOT numbers), and strip quotes
                workingStr = workingStr.replace(/__STR(\d+)__\s*\+\s*([@$a-zA-Z_][\w-]*|<[0-9]+>)/g, (match, idx, rest) => {
                    let s = protectedStrings[parseInt(idx)];
                    if (s.startsWith('"') && s.endsWith('"')) {
                        protectedStrings[parseInt(idx)] = s.substring(1, s.length - 1);
                    }
                    return `__STR${idx}__${rest}`;
                });
                workingStr = workingStr.replace(/([@$a-zA-Z_][\w-]*|<[0-9]+>)\s*\+\s*__STR(\d+)__/g, (match, rest, idx) => {
                    let s = protectedStrings[parseInt(idx)];
                    if (s.startsWith('"') && s.endsWith('"')) {
                        protectedStrings[parseInt(idx)] = s.substring(1, s.length - 1);
                    }
                    return `${rest}__STR${idx}__`;
                });
                // Remove + between color codes and variables (likely string concatenation intent)
                workingStr = workingStr.replace(/(<[0-9]+>)\s*\+\s*([@$a-zA-Z_][\w-]*)/g, '$1$2');
                workingStr = workingStr.replace(/([@$a-zA-Z_][\w-]*)\s*\+\s*(<[0-9]+>)/g, '$1$2');
            } while (workingStr !== lastStr);
        }

        // Restore strings
        workingStr = workingStr.replace(/__STR(\d+)__/g, (match, idx) => {
             const s = protectedStrings[parseInt(idx)];
             // If the string was simplified/merged, it might have + inside now
             return s;
        });

        return workingStr;
    }

    convertVarName(name) {
        return convertVarName(name, this.mode);
    }

    convertSubstitutions(str, options = {}) {
        const indexOffset = options.indexOffset || 0;

        if (this.mode === 'powwow') {
            // 1. Delayed parameter substitution: \$1 -> %%1
            str = str.replace(/\\\$(\d+)/g, (match, n) => {
                const val = parseInt(n);
                if (val === 0) return '%%0';
                return '%%' + (val + indexOffset);
            });
            str = str.replace(/\\&(\d+)/g, (match, n) => {
                const val = parseInt(n);
                if (val === 0) return '%%0';
                return '%%' + (val + indexOffset);
            });

            // 2. Named parameters/variables in ${var} or #{expr}
            str = str.replace(/#{([^}]+)}/g, (match, expr) => {
                return `\$math_eval{${this.convertSyntax('(' + expr + ')', options)}}`;
            });

            // 3. Variables:
            str = str.replace(/\\?@(-?\d+)/g, (match, num) => `__VAR__${this.convertVarName('@' + num)}`);
            str = str.replace(/\\?@(\w+)/g, (match, name) => {
                const lowerName = name.toLowerCase();
                if (POWWOW_RESERVED_FUNCS.includes(lowerName)) return `__FUNC__powwow_${lowerName}`;
                if (lowerName.startsWith('powwow_')) return `__FUNC__${lowerName}`;
                if (lowerName === 'echo' || lowerName === 'print') return `__FUNC__powwow_reserved_${lowerName}`;
                if (name.startsWith('powwow_') || name.startsWith('p_')) return `__VAR__${name}`;
                return `__VAR__${this.convertVarName('@' + name)}`;
            });

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

            str = str.replace(/\\?\$([a-zA-Z_]\w+)/g, (match, name) => {
                if (name.startsWith('powwow_') || name.startsWith('p_')) return `__VAR__${name}`;
                return `__VAR__${this.convertVarName('$' + name)}`;
            });
            str = str.replace(/\\?\$(-\d+)/g, (match, num) => `__VAR__${this.convertVarName('$' + num)}`);

            // 4. Standard parameters: $N -> %N, &N -> %N
            str = str.replace(/(?<![\\%])\$(\d+)/g, (match, n) => {
                const val = parseInt(n);
                if (val === 0) return '%0';
                return '%' + (val + indexOffset);
            });
            str = str.replace(/(?<![\\%])&(\d+)/g, (match, n) => {
                const val = parseInt(n);
                if (val === 0) return '%0';
                return '%' + (val + indexOffset);
            });

            // Replace placeholders back
            str = str.replace(/__VAR__/g, '$');
            str = str.replace(/__FUNC__powwow_reserved_/g, '#powwow_reserved_');
            str = str.replace(/__FUNC__/g, '@');

        } else if (this.mode === 'jmc') {
            // JMC uses %0-%9 for parameters and $var for variables

            if (options.isTrigger) {
                // In triggers: %0 -> %1, %1 -> %2, etc.
                str = str.replace(/(?<!\\)%(\d)/g, (match, n) => '%' + (parseInt(n) + 1));
            } else if (options.isAlias) {
                // In aliases: %0 -> all args (%1 %2 %3 %4 %5 %6 %7 %8 %9)
                str = str.replace(/(?<!\\)%0/g, '%0');
                // %1..%9 remain same
            }

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
