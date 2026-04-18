/**
 * TinTin++ Code Generator
 */
export class TinTinGenerator {
    constructor(converter) {
        this.converter = converter;
        this.mode = converter.mode;
        this.indentLevel = 0;
        this.options = {};
    }

    indent() {
        return '    '.repeat(this.indentLevel);
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
            outputLines.push('#FUNCTION {powwow_word_count} {#LIST {p_words} {EXPLODE} { }; #LIST {p_words} {FILTER} {{.+}}; #RETURN &p_words[]}');
            outputLines.push('#FUNCTION {powwow_word} {#LIST {p_words} {EXPLODE} { }; #LIST {p_words} {FILTER} {{.+}}; #RETURN $p_words[%2]}');
            outputLines.push('#FUNCTION {powwow_word_slice_to_end} {#LIST {p_words} {EXPLODE} { }; #LIST {p_words} {FILTER} {{.+}}; #LIST {p_slice} {CREATE} {$p_words[%2..-1]}; #LIST {p_slice} {COLLAPSE} { }; #RETURN $p_slice}');
            outputLines.push('#FUNCTION {powwow_word_slice_from_start} {#LIST {p_words} {EXPLODE} { }; #LIST {p_words} {FILTER} {{.+}}; #LIST {p_slice} {CREATE} {$p_words[1..%2]}; #LIST {p_slice} {COLLAPSE} { }; #RETURN $p_slice}');
            outputLines.push('#FUNCTION {powwow_first_char_ascii} {#FORMAT {result} {%a} {%1}}');
            outputLines.push('#FUNCTION {powwow_to_number} {#MATH {result} {%1}}');
            outputLines.push('#ALIAS {powwow_reserved_echo} {#IF {"%1" == ""} {#LINE PRINT} {#ELSE} {#SHOWME {%1}}}');
            outputLines.push('#ALIAS {powwow_reserved_print} {#IF {"%1" == ""} {#LINE PRINT} {#ELSE} {#SHOWME {%1}}}');
        }

        this.indentLevel = 0;
        const generatedContent = this.generateNodes(nodes, '\n');
        if (generatedContent) {
            outputLines.push(generatedContent);
        }

        outputLines.push('#CLASS {converted} {CLOSE}');
        return outputLines.join('\n');
    }

    generateNodes(nodes, separator = '\n') {
        let outputLines = [];
        let commands = [];
        let currentCommandNodes = [];

        const handlers = this.mode === 'jmc' ? this.converter.jmcHandlers : this.converter.powwowHandlers;
        const allCommands = Object.keys(handlers).map(k => '#' + k);

        const controlCommands = ['#if', '#else', '#while', '#for', '#at', '#in', '#do'];

        for (let node of nodes) {
            if (node.type === 'Separator' || node.type === 'Pipe' || node.type === 'Newline') {
                if (currentCommandNodes.length > 0) {
                    // Special case for #sep: it might take the separator as an argument
                    const firstCmdNode = currentCommandNodes.find(n => n.type === 'Command');
                    if (firstCmdNode && firstCmdNode.value.toLowerCase() === '#sep' && node.type === 'Separator' && !currentCommandNodes.some(n => n.type === 'Separator' || n.type === 'Pipe')) {
                        currentCommandNodes.push(node);
                    } else {
                        commands.push(currentCommandNodes);
                        currentCommandNodes = [];
                    }
                }
            } else if (node.type === 'Command') {
                if (currentCommandNodes.length > 0) {
                    const firstCmdNode = currentCommandNodes.find(n => n.type === 'Command');
                    const newCmdName = node.value.toLowerCase();

                    let shouldSplit = false;
                    if (newCmdName !== '#else') {
                        if (!firstCmdNode) {
                            shouldSplit = true;
                        } else {
                            const firstCmdName = firstCmdNode.value.toLowerCase();
                            if (!allCommands.includes(firstCmdName)) {
                                shouldSplit = true;
                            } else if (currentCommandNodes.some(n => n.type === 'BracedBlock')) {
                                shouldSplit = true;
                            }
                        }
                    }
                    if (shouldSplit) {
                        commands.push(currentCommandNodes);
                        currentCommandNodes = [];
                    }
                }
                currentCommandNodes.push(node);
            } else if (node.type === 'Comment') {
                if (currentCommandNodes.length > 0) {
                    commands.push(currentCommandNodes);
                    currentCommandNodes = [];
                }
                commands.push([node]);
            } else if (node.type === 'Whitespace') {
                if (currentCommandNodes.length > 0) {
                    currentCommandNodes.push(node);
                }
            } else {
                currentCommandNodes.push(node);
            }
        }
        if (currentCommandNodes.length > 0) commands.push(currentCommandNodes);

        for (let i = 0; i < commands.length; i++) {
            let cmdNodes = commands[i];

            if (cmdNodes.length === 1 && cmdNodes[0].type === 'Comment') {
                let val = cmdNodes[0].value;
                val = val.replace(/^(\/\/|##|\/\*)/, '').replace(/\*\/$/, '').trim();
                if (val) {
                    val.split('\n').forEach(line => {
                        outputLines.push(this.indent() + `#NOP ${line.trim()}`);
                    });
                }
                continue;
            }

            let cmdStr = this.nodesToStringSimple(cmdNodes).trim();

            // Handle Powwow #if...#else concatenation for single-line processing
            if (this.mode === 'powwow' && cmdStr.toLowerCase().startsWith('#if') && i + 1 < commands.length) {
                let j = i + 1;
                while (j < commands.length && this.nodesToStringSimple(commands[j]).trim() === '') j++;
                if (j < commands.length) {
                    let nextCmdStr = this.nodesToStringSimple(commands[j]).trim();
                    if (nextCmdStr.toLowerCase().startsWith('#else')) {
                        cmdStr += '; ' + nextCmdStr;
                        i = j;
                    }
                }
            }

            if (cmdStr !== '') {
                let convertedResult;
                if (cmdStr.startsWith('#')) {
                    convertedResult = this.converter.convertSingleCommand(cmdStr, this.options);
                } else {
                    convertedResult = { text: this.converter.convertSyntax(cmdStr, this.options).trim() };
                }

                if (convertedResult && convertedResult.text) {
                    const lines = convertedResult.text.trim().split('\n');
                    lines.forEach(line => {
                        outputLines.push(this.indent() + line);
                    });
                }
            }
        }
        return outputLines.join(separator);
    }

    nodesToStringSimple(nodes) {
        return nodes.map(n => {
            if (n.type === 'BracedBlock') return '{' + this.nodesToStringSimple(n.content) + '}';
            if (n.type === 'ParenBlock') return '(' + this.nodesToStringSimple(n.content) + ')';
            if (n.type === 'Comment') return n.value;
            return n.value || '';
        }).join('');
    }

    nodesToString(nodes) {
        return nodes.map(n => {
            if (n.type === 'BracedBlock') {
                this.indentLevel++;
                const inner = this.generateNodes(n.content, '\n');
                this.indentLevel--;
                if (inner.includes('\n')) {
                   return '{\n' + inner + '\n' + this.indent() + '}';
                }
                return '{' + inner.trim() + '}';
            }
            if (n.type === 'ParenBlock') return '(' + this.nodesToStringSimple(n.content) + ')';
            if (n.type === 'Comment') {
                let val = n.value.replace(/^(\/\/|##|\/\*)/, '').replace(/\*\/$/, '').trim();
                return val ? `#NOP ${val}` : '';
            }
            return n.value || '';
        }).join('');
    }
}
