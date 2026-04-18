/**
 * Parser for MUD scripts
 */
export class Parser {
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
            } else if (t.type === 'RBRACE' || t.type === 'RPAREN') {
                nodes.push({ type: 'Text', value: this.eat().value });
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
