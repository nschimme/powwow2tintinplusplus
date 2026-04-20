import { ExpressionParser } from './expression.js';

/**
 * Powwow-specific conversion methods
 */
export const powwowMethods = {
    convertAliasPowwow(args, options) {
        const match = args.match(/^(?:([<=>%][+-]?)?([\w_-]+(?:[+-])?)(?:@([\w_-]+))?\s+)?([^=]+?)(?:@([\w_-]+))?=(.*)/is);
        if (!match) {
            if (args.trim() === '') return { text: '#ALIAS' };
            const simpleMatch = args.match(/^([^=]+)=(.*)/is);
            if (simpleMatch) {
                return { text: `#ALIAS {${this.convertSubstitutions(simpleMatch[1].trim(), options)}} {${this.processCommands(simpleMatch[2], options)}}` };
            }
            return { text: `#NOP UNCONVERTED ALIAS ARGS: ${args}` };
        }

        const [, op, label, group1, name, group2, cmds] = match;
        const convertedName = this.convertSubstitutions(name.trim(), options);
        const convertedCmds = this.processCommands(cmds, options);

        const targetClass = group1 || group2 || label;
        let out = '';
        if (targetClass) out += `#CLASS {${targetClass}} {OPEN}\n`;

        // Handle $(0) in Powwow aliases which means all arguments
        if (cmds.includes('$(0)') || cmds.includes('$0')) {
            options.hasAllArgs = true;
        }
        out += `#ALIAS {${convertedName}} {${convertedCmds}}`;
        if (targetClass) out += `\n#CLASS {${targetClass}} {CLOSE}`;
        return { text: out };
    },

    convertActionPowwow(args, options) {
        if (args.match(/^[+-][\w_-]+$/)) {
            const label = args.substring(1);
            const op = args[0];
            return { text: op === '+' ? `#CLASS {${label}} {OPEN}` : `#CLASS {${label}} {KILL}` };
        }

        const match = args.match(/^(?:([<=>%][+-]?)?([\w_-]+(?:[+-])?)(?:@([\w_-]+))?\s+)?([^=]+?)(?:@([\w_-]+))?=(.*)?/is);
        if (!match) {
             const simpleMatch = args.match(/^([^=]+)=(.*)?/is);
             if (simpleMatch) {
                 const ttPattern = this.convertSyntax(simpleMatch[1].trim(), options);
                 const rawCmds = simpleMatch[2] || '';
                 const hasPrint = rawCmds.toLowerCase().includes('#print');
                 const ttCmds = this.processCommands(rawCmds, options);

                 if (rawCmds.trim() === '') return { text: `#GAG {${ttPattern}}` };

                 if (this.state.powwow.autoprint || hasPrint) {
                     return { text: `#ACTION {${ttPattern}} {${ttCmds}}` };
                 } else {
                     return { text: `#ACTION {${ttPattern}} {${ttCmds}${ttCmds ? '; ' : ''}#LINE GAG}` };
                 }
             }
             return { text: `#NOP UNCONVERTED ACTION ARGS: ${args}` };
        }

        const [, op, label, group1, pattern, group2, rawCmdsInput] = match;
        let rawPattern = pattern.trim();

        // Handle Powwow regex with capture groups: $1 becomes %2 in TinTin++
        // if it's a standard regex (%) action.
        if (op === '%') {
             // Protect existing $N that should be %N
             rawPattern = rawPattern.replace(/\$(\d)/g, '___V$1___');
             rawPattern = rawPattern.replace(/\\m/g, '___M___');
        }

        let ttPattern = '';
        let isAnchored = false;

        if (rawPattern.startsWith('^')) {
            rawPattern = rawPattern.substring(1);
            isAnchored = true;
        }

        let leadingVar = null;
        if (rawPattern.startsWith('${')) {
            const varMatch = rawPattern.match(/^\${([^}]+)}/);
            if (varMatch) {
                leadingVar = this.convertVarName(varMatch[1], 'powwow');
                rawPattern = rawPattern.substring(varMatch[0].length);
            }
        } else if (rawPattern.startsWith('$')) {
            const varMatch = rawPattern.match(/^\$([a-zA-Z_]\w*)/);
            if (varMatch && varMatch[1]) {
                leadingVar = this.convertVarName('$' + varMatch[1], 'powwow');
                rawPattern = rawPattern.substring(varMatch[0].length);
            }
        }

        rawPattern = rawPattern.replace(/\\,/g, ',');

        ttPattern = isAnchored ? '^' : '';
        const isRegexAction = (op === '%');
        const newOptions = {
            ...options,
            isRegexAction,
            indexOffset: (options.indexOffset || 0) + (leadingVar ? 1 : 0)
        };
        if (leadingVar) {
            ttPattern += (rawPattern.startsWith(' ') || rawPattern === '') ? '%1' : '{%1}';
        }

        const parts = rawPattern.split(/([&$]\d+)/);
        parts.forEach(part => {
            const m = part.match(/^([&$])(\d+)$/);
            if (m) {
                const val = parseInt(m[2]);
                if (val === 0) {
                    ttPattern += '%0';
                } else {
                    ttPattern += '%' + (val + (leadingVar ? 1 : 0));
                }
            } else {
                // If we have indexOffset, it means we are already in a nested context?
                // Actually leadingVar adds an offset.
                let p = part;
                if (op === '%') {
                    let newP = '';
                    let parenCount = leadingVar ? 1 : 0;
                    for (let i = 0; i < p.length; i++) {
                        if (p[i] === '(' && p[i+1] !== '?') {
                             newP += `(%${++parenCount}`;
                        } else {
                             newP += p[i];
                        }
                    }
                    p = newP.replace(/___V(\d)___/g, '$$$1');
                    p = p.replace(/___M___/g, '\\m');
                }
                ttPattern += this.convertSyntax(p, newOptions);
            }
        });

        const rawCmds = (rawCmdsInput || '').trim();
        const hasPrint = rawCmds.toLowerCase().includes('#print');
        let ttCmds = '';

        if (rawCmds === '') {
            ttCmds = '#LINE GAG';
        } else {
            ttCmds = this.processCommands(rawCmds, newOptions);
        }

        if (leadingVar) {
            const check = isAnchored ? `\"%1\" == \"$${leadingVar}\"` : `\"%1\" ~ \"^$${leadingVar}\"`;
            ttCmds = `#IF {${check}} {${ttCmds}}`;
        }

        const targetClass = group1 || group2 || label;
        let out = '';

        // Split commands by ; to check for #print separately
        const individualCmds = ttCmds.split('; ');
        const filteredCmds = individualCmds.filter(c => c !== '#LINE PRINT').join('; ');

        if (targetClass) out += `#CLASS {${targetClass}} {OPEN}\n`;

        // Final check: if commands were JUST #print, and we filtered them, and it's not a gag...
        let finalCmds = filteredCmds;
        if (finalCmds === '' && rawCmds !== '' && !hasPrint && !this.state.powwow.autoprint) {
             // This might happen if all commands were somehow invalid but they were there originally
             // But if hasPrint is false and autoprint is false, we want to gag.
             finalCmds = '#LINE GAG';
        } else if (finalCmds === '' && rawCmds !== '' && (hasPrint || this.state.powwow.autoprint)) {
             // It had print but nothing else
             finalCmds = '';
        } else if (rawCmds !== '' && !hasPrint && !this.state.powwow.autoprint) {
             if (!finalCmds.includes('#LINE GAG')) {
                 finalCmds = (finalCmds ? finalCmds + '; ' : '') + '#LINE GAG';
             }
        }

        out += `#ACTION {${ttPattern}} {${finalCmds}}`;

        if (targetClass) out += `\n#CLASS {${targetClass}} {CLOSE}`;
        return { text: out };
    },

    convertVarPowwow(args, options) {
        const parts = args.split(/=(.*)/s);
        if (parts.length < 2) {
            const varName = this.convertVarName(parts[0].trim());
            return { text: `#SHOWME {${varName} is $${varName}}` };
        }

        let name = this.convertVarName(parts[0].trim());
        const val = parts[1].trim();

        if (val === '') {
            return { text: `#UNVARIABLE {${name}}` };
        }

        if (val.startsWith('(')) {
            const parser = new ExpressionParser(val, this, options);
            const ast = parser.parse();
            const isString = parser.isStringy(ast);
            const evaled = parser.translate(ast);

            if (isString) {
                // Remove outer parentheses for #VARIABLE but keep for #MATH
                let cleanEvaled = evaled;
                if (cleanEvaled.startsWith('(') && cleanEvaled.endsWith(')')) {
                    cleanEvaled = cleanEvaled.substring(1, cleanEvaled.length - 1);
                }
                return { text: `#VARIABLE {${name}} {${cleanEvaled}}` };
            }
            return { text: `#MATH {${name}} {${evaled}}` };
        }
        return { text: `#VARIABLE {${name}} {${this.processCommands(val, options)}}` };
    },

    convertIfPowwow(args, options) {
        const block = this.extractBlock(args, '(', ')');
        if (!block) return { text: `#NOP UNCONVERTED IF: #if ${args}` };

        const cond = block.inner;
        let rest = block.rest.trim();
        let trueBlock = '';
        let falseBlock = '';

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
            if (trueBlock.endsWith(';') || trueBlock.endsWith('|')) {
                trueBlock = trueBlock.substring(0, trueBlock.length - 1).trim();
            }
            falseBlock = rest.substring(elsePos + 5).trim();
            if (falseBlock.startsWith('{')) {
                const innerBlock = this.extractBlock(falseBlock, '{', '}');
                if (innerBlock) {
                    falseBlock = innerBlock.inner;
                }
            }
        } else {
            trueBlock = rest;
        }

        let out = `#IF {${this.convertSyntax('(' + cond + ')', options).replace(/\s*!=\s*/g, ' != ').replace(/\s*==\s*/g, ' == ')}} {${this.processCommands(trueBlock, options)}}`;
        if (falseBlock) {
            out += `\n#ELSE {${this.processCommands(falseBlock, options)}}`;
        }
        return { text: out };
    },

    convertWhilePowwow(args, options) {
        const block = this.extractBlock(args, '(', ')');
        if (!block) return { text: `#NOP UNCONVERTED WHILE: #while ${args}` };
        return { text: `#WHILE {${this.convertSyntax('(' + block.inner + ')', options)}} {${this.processCommands(block.rest, options)}}` };
    },

    convertForPowwow(args, options) {
        const block = this.extractBlock(args, '(', ')');
        if (!block) return { text: `#NOP UNCONVERTED FOR: #for ${args}` };

        const parts = block.inner.split(';');
        if (parts.length < 3) return { text: `#NOP INVALID FOR: #for (${block.inner}) ${block.rest}` };

        const init = parts[0].trim();
        const check = parts[1].trim();
        const loop = parts[2].trim();
        const body = block.rest.trim();

        let out = '';
        if (init) {
            out += `${this.convertSingleCommand(`#(${init})`, options).text}; `;
        }
        out += `#WHILE {${this.convertSyntax('(' + check + ')', options)}} {${this.processCommands(body, options)}; ${this.convertSingleCommand(`#(${loop})`, options).text}}`;
        return { text: out };
    },

    convertTickerPowwow(args, command, options) {
        if (command === 'at' || command === 'in') {
            const match = args.match(/^\((.*?)\)\s*(.*)/is);
            if (match) {
                const [, delay, cmds] = match;
                let delayVal;
                if (isNaN(delay)) {
                    delayVal = this.convertSyntax('(' + delay + ')', options);
                } else {
                    const d = parseFloat(delay);
                    if (command === 'in') {
                        delayVal = (d / 1000).toFixed(2);
                    } else {
                        delayVal = d.toString();
                    }
                }
                return { text: `#DELAY {${delayVal}} {${this.processCommands(cmds, options)}}` };
            }
        }

        const match = args.match(/^(?:([<=>%][+-]?)?([\w_-]+)(?:@([\w_-]+))?\s+)?([\w_-]+)\s*\((.*?)\)\s*(.*)/is);
        if (!match) return { text: `#NOP UNCONVERTED TICKER ARGS: ${args}` };

        const [, op, label, group, tickerName, delay, cmds] = match;
        const delayVal = isNaN(delay) ? this.convertSyntax('(' + delay + ')', options) : (parseInt(delay) / 1000).toFixed(2);

        const targetClass = group || label;
        let out = '';
        if (targetClass) out += `#CLASS {${targetClass}} {OPEN}\n`;
        out += `#TICKER {${tickerName}} {${this.processCommands(cmds)}} {${delayVal}}`;
        if (targetClass) out += `\n#CLASS {${targetClass}} {CLOSE}`;
        return { text: out };
    },

    convertBindPowwow(args, options) {
        const match = args.match(/^([^= ]+)(?:\s+([^= ]+))?(?:=(.*))?$/s);
        if (match) {
            const name = match[1];
            const seq = match[2];
            const cmd = match[3] || '';
            const macroKey = seq || name;
            const processedCmd = this.processCommands(cmd, options);
            const labelComment = (seq && name && name !== seq) ? `#NOP ORIGINAL BIND LABEL: ${name}\n` : '';
            return { text: `${labelComment}#MACRO {${macroKey}} {${processedCmd}}` };
        }
        return { text: `#NOP UNCONVERTED BIND: #bind ${args}` };
    },

    convertPromptPowwow(args, options) {
        const match = args.match(/^(?:([<=>%][+-]?)?([\w_-]+)(?:@([\w_-]+))?\s+)?([^=]+)=(.+)?/is);
        if (!match) {
             const simpleMatch = args.match(/^([^=]+)=(.*)?/is);
             if (simpleMatch) {
                 const ttPattern = this.convertSyntax(simpleMatch[1].trim(), options);
                 const ttCmds = simpleMatch[2] ? this.processCommands(simpleMatch[2], options) : '';
                 return { text: `#PROMPT {${ttPattern}} {${ttCmds}}` };
             }
             return { text: `#NOP UNCONVERTED PROMPT ARGS: ${args}` };
        }
        const [, op, label, group, pattern, cmds] = match;
        const ttPattern = this.convertSyntax(pattern.trim(), options);
        const ttCmds = cmds ? this.processCommands(cmds, options) : '';

        const targetClass = group || label;
        let out = '';
        if (targetClass) out += `#CLASS {${targetClass}} {OPEN}\n`;
        out += `#PROMPT {${ttPattern}} {${ttCmds}}`;
        if (targetClass) out += `\n#CLASS {${targetClass}} {CLOSE}`;
        return { text: out };
    },

    convertMarkPowwow(args, options) {
        const match = args.match(/^([^=]+)(?:=(.*))?$/is);
        if (match) {
            const pattern = this.convertSyntax(match[1].trim(), options);
            const color = match[2] ? match[2].trim() : 'bold';
            return { text: `#HIGHLIGHT {${pattern}} {${color}}` };
        }
        return { text: `#NOP UNCONVERTED MARK: #mark ${args}` };
    },

    convertReset(args, options) {
        const type = args.toLowerCase().trim();
        if (type === 'alias' || type === 'aliases') return { text: '#KILL ALIASES {*}*' };
        if (type === 'action' || type === 'actions') return { text: '#KILL ACTIONS {*}*' };
        if (type === 'variable' || type === 'var' || type === 'variables') return { text: '#KILL VARIABLES {*}*' };
        if (type === 'mark' || type === 'marks' || type === 'highlight' || type === 'highlights') return { text: '#KILL HIGHLIGHTS {*}*' };
        if (type === 'at' || type === 'in' || type === 'ticker' || type === 'tickers') return { text: '#KILL TICKERS {*}*' };
        if (type === 'bind' || type === 'binds' || type === 'key') return { text: '#KILL MACROS {*}*' };
        if (type === 'all') {
            return { text: '#KILL ALIASES {*}*; #KILL ACTIONS {*}*; #KILL VARIABLES {*}*; #KILL HIGHLIGHTS {*}*; #KILL TICKERS {*}*; #KILL MACROS {*}*; #NOP --- RESET ALL ---' };
        }
        return { text: `#NOP UNCONVERTED RESET: #reset ${args}` };
    }
};
