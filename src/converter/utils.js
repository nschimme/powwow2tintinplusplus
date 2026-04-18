/**
 * Utility functions for TinTinConverter
 */

export function mapAttributes(attr) {
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

export const POWWOW_RESERVED_FUNCS = [
    'timer', 'rand', 'char_length', 'search', 'word_count', 'word',
    'word_slice_to_end', 'word_slice_from_start', 'first_char_ascii', 'to_number'
];

export function convertVarName(name, mode) {
    const prefix = mode === 'jmc' ? 'j_' : 'p_';

    if (mode === 'jmc' && name.startsWith('$') && !name.match(/^\$(-?\d+)$/)) {
        name = name.substring(1);
    }

    const specialPowwow = ['timer', 'map', 'prompt', 'last_line', 'buffer', 'lines', 'mem'];
    if (mode === 'powwow' && specialPowwow.includes(name)) {
        return `powwow_at_${name}`;
    }
    if (mode === 'powwow' && (name.startsWith('@') || name.startsWith('$'))) {
        const inner = name.substring(1);
        if (specialPowwow.includes(inner)) return `powwow_at_${inner}`;
    }

    if (name.startsWith('@')) {
        const numMatch = name.match(/^@(-?\d+)$/);
        if (numMatch) {
            const n = numMatch[1];
            return n.startsWith('-') ? `powwow_at_m${n.substring(1)}` : `powwow_at_${n}`;
        }
        return `powwow_at_${name.substring(1)}`;
    } else if (name.startsWith('$')) {
        const numMatch = name.match(/^\$(-?\d+)$/);
        if (numMatch) {
            const n = numMatch[1];
            return n.startsWith('-') ? `${mode === 'jmc' ? 'jmc' : 'powwow'}_dollar_m${n.substring(1)}` : `${mode === 'jmc' ? 'jmc' : 'powwow'}_dollar_${n}`;
        }
        return `${prefix}${name.substring(1)}`;
    }
    return prefix + name;
}
