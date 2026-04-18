/**
 * Lexer for MUD scripts (Powwow, JMC)
 */
export class Lexer {
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

        if (char === '{') { this.pos++; return { type: 'LBRACE', value: char }; }
        if (char === '}') { this.pos++; return { type: 'RBRACE', value: char }; }
        if (char === '(') { this.pos++; return { type: 'LPAREN', value: char }; }
        if (char === ')') { this.pos++; return { type: 'RPAREN', value: char }; }

        if (char === this.separator) { this.pos++; return { type: 'SEPARATOR', value: char }; }
        if (this.mode === 'powwow' && char === '|') { this.pos++; return { type: 'PIPE', value: char }; }

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

        if (char === '#') {
            let start = this.pos;
            this.pos++;

            // Check for # (expression) or #!
            if (this.peek() === '(') {
                this.pos++;
                return { type: 'COMMAND', value: '#(' };
            }
            if (this.peek() === '!') {
                this.pos++;
                return { type: 'COMMAND', value: '#!' };
            }

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
            } else {
                let consumed = false;
                while (this.pos < this.input.length && /[\w_-]/.test(this.input[this.pos])) {
                    cmd += this.input[this.pos++];
                    consumed = true;
                }
                if (!consumed) {
                    return { type: 'COMMAND', value: '#' };
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
