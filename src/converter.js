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
import { ExpressionParser } from './converter/expression.js';

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
                return this.evaluatePowwowExpression(inner, options);
            }
        }

        return this.convertSubstitutions(str, options);
    }

    evaluatePowwowExpression(str, options = {}) {
        const parser = new ExpressionParser(str, this, options);
        return parser.translate();
    }

    convertVarName(name) {
        return convertVarName(name, this.mode);
    }

    convertSubstitutions(str, options = {}) {
        const indexOffset = options.indexOffset || 0;

        if (this.mode === 'powwow') {
            // 1. Delayed parameter substitution: \$1 -> %%1
            str = str.replace(/\\([$&])(\d+)/g, (match, type, n) => {
                const val = parseInt(n);
                if (val === 0) return '%%0';
                return '%%' + (val + indexOffset);
            });

            // 1.5 Regex parameters: if isRegexAction, $1 -> %1, etc.
            if (options.isRegexAction) {
                str = str.replace(/(?<!\\)([$&])(\d+)/g, (match, type, n) => {
                    const val = parseInt(n);
                    if (val === 0) return '%0';
                    return '%' + (val + indexOffset);
                });
            }

            // 2. Named parameters/variables in ${var} or #{expr}
            str = str.replace(/#{([^}]+)}/g, (match, expr) => {
                return `\$math_eval{${this.convertSyntax('(' + expr + ')', options)}}`;
            });

            // 3. Variables:
            const VAR_PLACEHOLDER = '\x01VAR\x01';
            const FUNC_PLACEHOLDER = '\x01FUNC\x01';
            const FUNC_RSVD_PLACEHOLDER = '\x01RSVD\x01';

            str = str.replace(/\\?@(-?\d+)/g, (match, num) => `${VAR_PLACEHOLDER}${this.convertVarName('@' + num)}`);
            str = str.replace(/\\?@([a-zA-Z_]\w*)/g, (match, name) => {
                const lowerName = name.toLowerCase();
                if (POWWOW_RESERVED_FUNCS.includes(lowerName)) return `${FUNC_PLACEHOLDER}powwow_${lowerName}`;
                if (lowerName.startsWith('powwow_')) return `${FUNC_PLACEHOLDER}${lowerName}`;
                if (lowerName === 'echo' || lowerName === 'print') return `${FUNC_RSVD_PLACEHOLDER}${lowerName}`;
                if (name.startsWith('powwow_') || name.startsWith('p_')) return `${VAR_PLACEHOLDER}${name}`;
                return `${VAR_PLACEHOLDER}${this.convertVarName('@' + name)}`;
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
                return `${VAR_PLACEHOLDER}${res}`;
            });

            str = str.replace(/\\?\$([a-zA-Z_]\w*)/g, (match, name) => {
                if (name.startsWith('powwow_') || name.startsWith('p_')) return `${VAR_PLACEHOLDER}${name}`;
                return `${VAR_PLACEHOLDER}${this.convertVarName('$' + name)}`;
            });
            str = str.replace(/\\?\$(-\d+)/g, (match, num) => `${VAR_PLACEHOLDER}${this.convertVarName('$' + num)}`);

            // 4. Standard parameters: $N -> %N, &N -> %N
            str = str.replace(/(?<![\\%])([$&])(\d+)/g, (match, type, n) => {
                const val = parseInt(n);
                if (val === 0) return '%0';
                return '%' + (val + indexOffset);
            });
            str = str.replace(/\$\{(\d+)\}/g, (match, n) => {
                const val = parseInt(n);
                if (val === 0) return '%0';
                return '%' + (val + indexOffset);
            });
            str = str.replace(/(?<!\d)\$0(?!\d)/g, '%0');
            str = str.replace(/(?<!\d)\%\((\d+)\)/g, (match, n) => {
                 return '%' + n;
            });

            // Handle $(0) explicitly
            str = str.replace(/\$\((\d+)\)/g, (match, n) => {
                const val = parseInt(n);
                if (val === 0) return '%0';
                return '%' + (val + indexOffset);
            });

            // Replace placeholders back
            str = str.replace(new RegExp(VAR_PLACEHOLDER, 'g'), '$');
            str = str.replace(new RegExp(FUNC_RSVD_PLACEHOLDER, 'g'), '#powwow_reserved_');
            str = str.replace(new RegExp(FUNC_PLACEHOLDER, 'g'), '@');

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
                        if (val.includes('"') || convertedVal.includes('<') || convertedVal.includes('\x01STR')) {
                            return { text: `#VARIABLE {${name}} {${convertedVal.replace(/^"|"$/g, '')}}` };
                        }
                        return { text: `#MATH {${name}} {${convertedVal}}` };
                    }
                    const resultVal = this.convertSyntax('(' + expr + ')', options);
                    if (expr.includes('"') || resultVal.includes('<') || resultVal.includes('\x01STR')) {
                        return { text: `#SHOWME {${resultVal}}` };
                    }
                    return { text: `#MATH {p_result} {${resultVal}}` };
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
            script = script.replace(/\r/g, '');
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
