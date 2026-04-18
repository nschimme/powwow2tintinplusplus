/**
 * JMC-specific conversion methods
 */
export const jmcMethods = {
    convertAliasJMC(args, options) {
        const parts = this.tokenize(args, ' ');
        if (parts.length >= 2) {
            const name = parts[0].trim().replace(/^{|}$/g, '');
            let cmds = '';
            let group = '';
            const cmdsToken = parts[1];
            if (cmdsToken.startsWith('{')) {
                cmds = cmdsToken.replace(/^{|}$/g, '');
                group = parts[2] ? parts[2].trim().replace(/^{|}$/g, '') : '';
            } else {
                // For unbraced commands, everything until the last part might be the command,
                // unless the last part looks like a group (often bracketed or single word)
                if (parts.length > 2 && (parts[parts.length - 1].startsWith('{') || parts.length === 3)) {
                    cmds = parts.slice(1, parts.length - 1).join(' ');
                    group = parts[parts.length - 1].replace(/^{|}$/g, '');
                } else {
                    cmds = parts.slice(1).join(' ');
                }
            }
            let out = '';
            if (group) out += `#CLASS {${group}} {OPEN}\n`;
            out += `#ALIAS {${this.convertSyntax(name, options)}} {${this.processCommands(cmds, options)}}`;
            if (group) out += `\n#CLASS {${group}} {CLOSE}`;
            return { text: out };
        }
        return { text: `#ALIAS {${this.convertSyntax(args, options)}}` };
    },

    convertActionJMC(args, options) {
        const parts = this.tokenize(args, ' ');
        if (parts.length >= 2) {
            let patternToken = parts[0].trim();
            let startIndex = 0;
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
            const actionOptions = { ...options, isTrigger: true };
            out += `#ACTION {${this.convertSyntax(pattern, actionOptions)}} {${this.processCommands(cmds, actionOptions)}}`;
            if (priority) out += ` {${priority}}`;
            if (group) out += `\n#CLASS {${group}} {CLOSE}`;
            return { text: out };
        }
        return { text: `#ACTION {${this.convertSyntax(args, options)}}` };
    },

    convertVarJMC(args, options) {
        const match = args.match(/^{([^}]+)}\s*{(.*)}$/s) || args.match(/^(\S+)\s+(.*)$/s);
        if (match) {
            const name = this.convertVarName(match[1].trim().replace(/^{|}$/g, ''));
            const val = match[2].trim().replace(/^{|}$/g, '');
            return { text: `#VARIABLE {${name}} {${this.processCommands(val, options)}}` };
        }
        const parts = args.split(/[\s=](.*)/s);
        if (parts.length >= 2) {
            const name = this.convertVarName(parts[0].trim());
            const val = parts[1].trim();
            return { text: `#VARIABLE {${name}} {${this.processCommands(val, options)}}` };
        }
        return { text: `#VARIABLE {${this.convertVarName(args.trim())}}` };
    },

    convertIfJMC(args, options) {
        const parts = this.tokenize(args, ' ');
        if (parts.length >= 2) {
            const cond = parts[0].trim().replace(/^{|}$/g, '');
            const trueBlock = parts[1].trim().replace(/^{|}$/g, '');
            const falseBlock = parts[2] ? parts[2].trim().replace(/^{|}$/g, '') : '';
            let out = `#IF {${this.convertSyntax(cond, options)}} {${this.processCommands(trueBlock, options)}}`;
            if (falseBlock) {
                out += ` {#ELSE} {${this.processCommands(falseBlock, options)}}`;
            }
            return { text: out };
        }
        return { text: `#NOP UNCONVERTED JMC IF: #if ${args}` };
    },

    convertMathJMC(args, options) {
        const match = args.match(/^{([^}]+)}\s*{(.*)}$/s) || args.match(/^(\S+)\s+(.*)$/s);
        if (match) {
            const name = this.convertVarName(match[1].trim().replace(/^{|}$/g, ''));
            const expr = match[2].trim().replace(/^{|}$/g, '');
            return { text: `#math {${name}} {${this.convertSyntax(expr, options)}}` };
        }
        return { text: `#NOP UNCONVERTED JMC MATH: #math ${args}` };
    },

    convertGroupJMC(args, options) {
        const match = args.match(/^(enable|disable|list|delete|info|global|local)(?:\s+(\S+))?/i);
        if (match) {
            const op = match[1].toLowerCase();
            const label = match[2];
            if (op === 'enable') return { text: `#CLASS {${label}} {OPEN}` };
            if (op === 'disable') return { text: `#CLASS {${label}} {KILL}` };
            if (op === 'list') return { text: `#CLASS` };
            if (op === 'delete') return { text: `#CLASS {${label}} {KILL}` };
        }
        return { text: `#NOP JMC GROUP COMMAND: #group ${args}` };
    },

    convertHighlightJMC(args, options) {
        const parts = this.tokenize(args, ' ');
        if (parts.length >= 2) {
            const color = parts[0].trim().replace(/^{|}$/g, '');
            let patternToken = parts[1].trim();
            let group = '';
            let pattern = patternToken.replace(/^{|}$/g, '');
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
            const hlOptions = { ...options, isTrigger: true };
            out += `#HIGHLIGHT {${this.convertSyntax(pattern, hlOptions)}} {${color}}`;
            if (group) out += `\n#CLASS {${group}} {CLOSE}`;
            return { text: out };
        }
        return { text: `#NOP UNCONVERTED JMC HIGHLIGHT: #highlight ${args}` };
    },

    convertHotkeyJMC(args, options) {
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
            let out = '';
            if (group) out += `#CLASS {${group}} {OPEN}\n`;
            out += `#MACRO {${key}} {${this.processCommands(cmds, options)}}`;
            if (group) out += `\n#CLASS {${group}} {CLOSE}`;
            return { text: out };
        }
        return { text: `#NOP UNCONVERTED JMC HOTKEY: #hotkey ${args}` };
    },

    convertLoopJMC(args, options) {
        const match = args.match(/^{([^,]+),([^}:]+)(?::([^}]+))?}\s*{(.*)}$/s);
        if (match) {
            const from = match[1].trim();
            const to = match[2].trim();
            const cmds = match[4].trim();
            const processed = this.processCommands(cmds.replace(/%0/g, '___V_VAR___'), options);
            return { text: `#LOOP {${from}} {${to}} {v} {${processed.replace(/___V_VAR___/g, '$v')}}` };
        }
        return { text: `#NOP UNCONVERTED JMC LOOP: #loop ${args}` };
    },

    convertToLowerJMC(args, options) {
        const match = args.match(/^{([^}]+)}\s*{(.*)}$/s) || args.match(/^(\S+)\s+(.*)$/s);
        if (match) {
            const varName = this.convertVarName(match[1].trim().replace(/^{|}$/g, ''));
            const text = match[2].trim().replace(/^{|}$/g, '');
            return { text: `#FORMAT {${varName}} {%l} {${this.convertSyntax(text, options)}}` };
        }
        return { text: `#NOP UNCONVERTED JMC TOLOWER: #tolower ${args}` };
    },

    convertToUpperJMC(args, options) {
        const match = args.match(/^{([^}]+)}\s*{(.*)}$/s) || args.match(/^(\S+)\s+(.*)$/s);
        if (match) {
            const varName = this.convertVarName(match[1].trim().replace(/^{|}$/g, ''));
            const text = match[2].trim().replace(/^{|}$/g, '');
            return { text: `#FORMAT {${varName}} {%u} {${this.convertSyntax(text, options)}}` };
        }
        return { text: `#NOP UNCONVERTED JMC TOUPPER: #toupper ${args}` };
    },

    convertGagJMC(args, options) {
        const pattern = args.trim().replace(/^{|}$/g, '');
        return { text: `#GAG {${this.convertSyntax(pattern, { ...options, isTrigger: true })}}` };
    },

    convertSubstituteJMC(args, options) {
        const parts = this.tokenize(args, ' ');
        if (parts.length >= 2) {
            const pattern = parts[0].trim().replace(/^{|}$/g, '');
            const replacement = parts[1].trim().replace(/^{|}$/g, '');
            const subOptions = { ...options, isTrigger: true };
            return { text: `#SUBSTITUTE {${this.convertSyntax(pattern, subOptions)}} {${this.convertSyntax(replacement, subOptions)}}` };
        }
        return { text: `#NOP UNCONVERTED JMC SUBSTITUTE: #substitute ${args}` };
    }
};
