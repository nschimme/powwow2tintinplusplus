/**
 * Powwow Expression Parser and Generator
 *
 * Handles Powwow's complex inline calculator expressions.
 */

export class ExpressionParser {
    constructor(input, converter, options = {}) {
        this.input = input;
        this.converter = converter;
        this.options = options;
        this.tokens = this.tokenize(input);
        this.pos = 0;
    }

    tokenize(input) {
        const tokens = [];
        let i = 0;

        while (i < input.length) {
            const char = input[i];

            if (/\s/.test(char)) {
                i++;
                continue;
            }

            // Quoted strings
            if (char === '"') {
                let str = '"';
                i++;
                while (i < input.length) {
                    if (input[i] === '\\') {
                        str += input[i++] + (input[i++] || '');
                    } else if (input[i] === '"') {
                        str += '"';
                        i++;
                        break;
                    } else {
                        str += input[i++];
                    }
                }
                tokens.push({ type: 'STRING', value: str });
                continue;
            }

            // Number/Hex/Base
            if (/[0-9#]/.test(char)) {
                let val = '';
                while (i < input.length && /[0-9#A-Fa-f]/.test(input[i])) {
                    val += input[i++];
                }
                tokens.push({ type: 'NUMBER', value: val });
                continue;
            }

            // Variables and Parameters
            // Note: % is only a variable/parameter if followed by a digit
            if (char === '$' || char === '@' || char === '&' || (char === '%' && i + 1 < input.length && /[0-9]/.test(input[i+1]))) {
                let type = char;
                i++;
                let val = '';
                // Handle $2 in @var_$2
                if (input[i] === '(') {
                    i++;
                    let depth = 1;
                    let inner = '';
                    while (i < input.length && depth > 0) {
                        if (input[i] === '(') depth++;
                        else if (input[i] === ')') depth--;
                        if (depth > 0) inner += input[i++];
                    }
                    if (input[i] === ')') i++;
                    tokens.push({ type: 'VAR_EXPR', varType: type, value: inner });
                } else if (input[i] === '{') {
                    i++;
                    let inner = '';
                    while (i < input.length && input[i] !== '}') {
                        inner += input[i++];
                    }
                    if (input[i] === '}') i++;
                    tokens.push({ type: 'VAR_BRACED', varType: type, value: inner });
                } else {
                    while (i < input.length && /[a-zA-Z0-9_-]/.test(input[i])) {
                        val += input[i++];
                    }
                    // Handle variable name containing another variable marker like @autoreplied_$2
                    if (i < input.length && (input[i] === '$' || input[i] === '%' || input[i] === '@' || input[i] === '&')) {
                         // This is a complex variable name.
                         // For now, let's just keep consuming it.
                         val += input[i++];
                         while (i < input.length && /[a-zA-Z0-9_-]/.test(input[i])) {
                             val += input[i++];
                         }
                    }
                    tokens.push({ type: 'VAR', varType: type, value: val });
                }
                continue;
            }

            // Multi-char operators
            const doubleOps = ['++', '--', '==', '!=', '>=', '<=', '&&', '||', '^^', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', ':>', ':<', '.>', '.<', ':?', '.?'];
            let foundDouble = false;
            for (const op of doubleOps) {
                if (input.startsWith(op, i)) {
                    tokens.push({ type: 'OPERATOR', value: op });
                    i += op.length;
                    foundDouble = true;
                    break;
                }
            }
            if (foundDouble) continue;

            // Single char operators / delimiters
            if ('+-*/%><=!&|^?,:().'.includes(char)) {
                tokens.push({ type: 'OPERATOR', value: char });
                i++;
                continue;
            }

            // Word keywords
            if (/[a-zA-Z_]/.test(char)) {
                let word = '';
                while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
                    // Leading underscores are allowed and treated the same as other identifier characters
                    word += input[i++];
                }
                const lower = word.toLowerCase();
                const keywords = ['rand', 'attr', 'noattr', 'timer', 'map', 'prompt', 'last_line', 'buffer', 'lines', 'mem'];
                const colors = [
                    'norm', 'bold', 'dark', 'uline', 'flash',
                    'black', 'white', 'red', 'green', 'blue', 'magenta', 'cyan', 'yellow',
                    'bkblack', 'bkwhite', 'bkblue', 'bkcyan', 'bkgreen', 'bkmagenta', 'bkred', 'bkyellow'
                ];
                if (keywords.includes(lower)) {
                    tokens.push({ type: 'KEYWORD', value: lower });
                } else if (colors.includes(lower)) {
                    tokens.push({ type: 'COLOR', value: word });
                } else {
                    tokens.push({ type: 'TEXT', value: word });
                }
                continue;
            }

            i++;
        }
        return tokens;
    }

    peek() { return this.tokens[this.pos] || { type: 'EOF' }; }
    eat() { return this.tokens[this.pos++]; }

    parse() {
        return this.parseExpression();
    }

    // This is a simplified recursive descent parser for expressions
    parseExpression() {
        return this.parseBinary(0);
    }

    getPrecedence(op) {
        const prec = {
            ',': 1,
            '=': 2, '+=': 2, '-=': 2, '*=': 2, '/=': 2, '%=': 2, '&=': 2, '|=': 2, '^=': 2,
            '||': 3, '^^': 3,
            '&&': 4,
            '|': 5,
            '^': 6,
            '&': 7,
            '==': 8, '!=': 8,
            '>': 9, '>=': 9, '<': 9, '<=': 9,
            '+': 10, '-': 10,
            '*': 11, '/': 11, '%': 11,
            ':': 12, '.': 12, ':>': 12, ':<': 12, '.>': 12, '.<': 12, '?': 12,
            'unary': 13
        };
        return prec[op] || 0;
    }

    parseBinary(minPrec) {
        let left = this.parseUnary();

        while (true) {
            const tok = this.peek();
            if (tok.type !== 'OPERATOR') break;

            const prec = this.getPrecedence(tok.value);
            if (prec <= minPrec) break;

            this.eat();
            const right = this.parseBinary(prec);
            left = { type: 'BinaryExpression', operator: tok.value, left, right };
        }

        return left;
    }

    parseUnary() {
        const tok = this.peek();
        if (tok.type === 'OPERATOR' && ['+', '-', '!', '~', '++', '--', ':', '.', ':?', '.?', '%', '*'].includes(tok.value)) {
            this.eat();
            return { type: 'UnaryExpression', operator: tok.value, argument: this.parseUnary(), prefix: true };
        }
        if (tok.type === 'KEYWORD' && (tok.value === 'rand' || tok.value === 'attr')) {
            const op = this.eat().value;
            return { type: 'UnaryExpression', operator: op, argument: this.parseUnary(), prefix: true };
        }
        return this.parsePrimary();
    }

    parsePrimary() {
        let node;
        const tok = this.eat();
        if (tok.type === 'NUMBER') node = { type: 'Literal', value: tok.value, kind: 'number' };
        else if (tok.type === 'STRING') node = { type: 'Literal', value: tok.value, kind: 'string' };
        else if (tok.type === 'KEYWORD') node = { type: 'Keyword', value: tok.value };
        else if (tok.type === 'COLOR') node = { type: 'Color', value: tok.value };
        else if (tok.type === 'VAR' || tok.type === 'VAR_EXPR' || tok.type === 'VAR_BRACED') {
            node = { type: 'Variable', varType: tok.varType, value: tok.value, kind: tok.type };
        }
        else if (tok.type === 'OPERATOR' && tok.value === '(') {
            const expr = this.parseExpression();
            if (this.peek().value === ')') this.eat();
            node = { type: 'ParenthesizedExpression', expression: expr };
        }
        else if (tok.type === 'TEXT') {
            node = { type: 'Variable', varType: '$', value: tok.value, kind: 'VAR' };
        }
        else {
            node = { type: 'Unknown', value: tok.value };
        }

        // Handle suffix operators
        while (true) {
            const next = this.peek();
            if (next.type === 'OPERATOR' && [':?', '.?'].includes(next.value)) {
                this.eat();
                node = { type: 'UnaryExpression', operator: next.value, argument: node, prefix: false };
            } else {
                break;
            }
        }
        return node;
    }

    isStringy(node) {
        if (!node) return false;
        switch (node.type) {
            case 'Literal':
                return node.kind === 'string';
            case 'Color':
            case 'Keyword':
                return node.value !== 'timer';
            case 'UnaryExpression':
                if (node.operator === 'attr') return true;
                if ([':?', '.?'].includes(node.operator)) return false; // Returns number
                if (['rand', '%', '*'].includes(node.operator)) return false;
                return this.isStringy(node.argument);
            case 'BinaryExpression':
                if (node.operator === '+') {
                    return this.isStringy(node.left) || this.isStringy(node.right);
                }
                if ([':', ':>', ':<', '.', '.>', '.<', '?'].includes(node.operator)) return true;
                return false;
            case 'ParenthesizedExpression':
                return this.isStringy(node.expression);
            case 'Variable':
                // Variables in Powwow are tricky, but $var is usually string, @var is usually number.
                // However, in expressions they are often interchangeable.
                // We'll assume $ prefixed are stringy if not used in math context.
                // UNLESS it's a digit like $1 which might be numeric
                if (node.varType === '$' && /^\d+$/.test(node.value)) return false;
                if (node.varType === '%' && /^\d+$/.test(node.value)) return false;
                if (node.varType === '@' || node.varType === '&') return false;
                return node.varType === '$' || node.varType === '%';
            default:
                return false;
        }
    }

    // Generator logic
    translate(node = this.parse()) {
        if (!node) return '';

        switch (node.type) {
            case 'Literal':
                if (node.kind === 'string') {
                     const content = node.value.substring(1, node.value.length - 1);
                     // Keep quotes for operators used as strings to avoid confusion in some contexts
                     if ([':?', '.?', ':', '.', '>', '<', '+', '-', '*', '/', '%', '==', '!=', '&&', '||'].includes(content)) {
                         return node.value;
                     }
                     // Special case: if it's JUST a space, let's keep it quoted if it's not a concatenation
                     // Actually, if it's a string literal, we usually want to keep it or handle it.
                     return content;
                }
                // Handle hex and other bases
                if (node.kind === 'number' && node.value.includes('#')) {
                     // Powwow #F is hex 15. TinTin++ uses 0x syntax? No, TinTin++ uses & notation for some things or just decimal.
                     // Actually MUME scripts use # for hex.
                     // Let's keep it as is if it's a simple hex or try to convert.
                }
                return node.value;

            case 'Keyword':
                if (node.value === 'timer') return '@powwow_timer{}';
                if (node.value === 'noattr') return '<099>';
                return '$powwow_at_' + node.value;

            case 'Color':
                return '$p_' + node.value;

            case 'Variable': {
                let name = node.value;
                // Handle complex variable names like @autoreplied_$2
                if (name.includes('$') || name.includes('%') || name.includes('@') || name.includes('&')) {
                    name = name.replace(/([$%@&])(\d+)/g, (match, type, n) => {
                         const val = parseInt(n);
                         if (val === 0) return '%0';
                         return '%' + (val + (this.options.indexOffset || 0));
                    });
                }
                if (node.kind === 'VAR_EXPR') {
                    // Handle $(0) $(1) etc.
                    if (node.varType === '$' && name.match(/^\d+$/)) {
                        return '%' + name;
                    }
                    // Recursive translation of inner expression
                    const inner = new ExpressionParser(node.value, this.converter, this.options).translate();
                    // If we have %($var), it means we want to evaluate $var and then treat it as a variable name or number
                    if (node.varType === '%') {
                         // Check if it's a simple variable inside
                         if (node.value.match(/^[a-zA-Z_]\w*$/) || node.value.match(/^\$[a-zA-Z_]\w*$/)) {
                              const varName = this.converter.convertVarName('$' + node.value.replace('$', ''), 'powwow');
                              return `(@powwow_to_number{$${varName}})`;
                         }
                         // If it's %($sessxp), we need to handle it.
                         // node.value is what's inside the parens.
                         // For %($sessxp), node.value is "$sessxp".
                         return `(@powwow_to_number{${inner}})`;
                    }
                    return `\$math_eval{${inner}}`;
                }
                let fullVar = node.varType + name;
                // Special case for % in expressions that are NOT parameters
                if (node.varType === '%' && !/^\d+$/.test(name) && node.kind !== 'VAR_EXPR') {
                     const varName = this.converter.convertVarName('$' + name, 'powwow');
                     return `(@powwow_to_number{$${varName}})`;
                }
                const converted = this.converter.convertVarName(fullVar, 'powwow');
                // If it's a parameter like %1, don't add $
                if (converted.startsWith('%')) return converted;
                if (converted.startsWith('$')) return converted;
                return '$' + converted;
            }

            case 'ParenthesizedExpression': {
                const inner = this.translate(node.expression);
                // If it looks like we already wrapped it in something like @powwow_to_number, avoid double parens if possible
                if (inner.startsWith('(') && inner.endsWith(')')) return inner;
                return `(${inner})`;
            }

            case 'UnaryExpression': {
                const arg = this.translate(node.argument);
                if (node.operator === 'rand') return `@powwow_rand{${arg}}`;
                if (node.operator === 'attr') return this.converter.mapAttributes(arg);
                if (node.operator === ':?') return `@powwow_word_count{${arg}}`;
                if (node.operator === '.?') return `@powwow_char_length{${arg}}`;
                if (node.operator === '%') {
                    // Strip outer parens from arg if any, to avoid (@powwow_to_number{(%var)})
                    let cleanArg = arg;
                    if (cleanArg.startsWith('(') && cleanArg.endsWith(')')) {
                        cleanArg = cleanArg.substring(1, cleanArg.length - 1);
                    }
                    // Avoid double wrapping
                    if (cleanArg.startsWith('@powwow_to_number{')) return cleanArg;
                    return `@powwow_to_number{${cleanArg}}`;
                }
                if (node.operator === '*') return `@powwow_first_char_ascii{${arg}}`;
                return node.prefix === false ? arg + node.operator : node.operator + arg;
            }

            case 'BinaryExpression': {
                const left = this.translate(node.left);
                const right = this.translate(node.right);

                if (node.operator === '+') {
                    // Smart concatenation vs addition
                    // In TinTin++, string concatenation is just $var1$var2
                    // If either side is a string literal or a known string variable, concatenate.
                    const isLeftString = this.isStringy(node.left);
                    const isRightString = this.isStringy(node.right);

                    if (isLeftString || isRightString) {
                        // For concatenation, if it's a string literal, we can omit quotes if it's simple
                        let l = left;
                        let r = right;
                        // Avoid stripping quotes from single spaces or operators
                        if (l.startsWith('"') && l.endsWith('"') && l.length > 2) l = l.substring(1, l.length - 1);
                        if (r.startsWith('"') && r.endsWith('"') && r.length > 2) r = r.substring(1, r.length - 1);
                        return `${l}${r}`;
                    }
                    return `${left} + ${right}`;
                }

                if (node.operator === ':') return `@powwow_word{${left};${right}}`;
                if (node.operator === '.') return `${left}.char[${right}]`;
                if (node.operator === ':>') return `@powwow_word_slice_to_end{${left};${right}}`;
                if (node.operator === ':<') return `@powwow_word_slice_from_start{${left};${right}}`;
                if (node.operator === '.>') return `${left}.char[${right}..-1]`;
                if (node.operator === '.<') return `${left}.char[1..${right}]`;
                if (node.operator === '?') return `@powwow_search{${left};${right}}`;

                return `${left} ${node.operator} ${right}`;
            }

            default:
                return node.value || '';
        }
    }
}
