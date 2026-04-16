import { PowwowConverter } from './converter.js';

const powwowInput = document.getElementById('powwow-input');
const tintinOutput = document.getElementById('tintin-output');
const convertBtn = document.getElementById('convert-btn');
const copyTooltip = document.getElementById('copy-tooltip');
const pipeSeparatorCheckbox = document.getElementById('pipe-separator');
const exampleButtonsContainer = document.getElementById('example-buttons');

const converter = new PowwowConverter();

const EXAMPLES = {
    'Combat': `#alias >combat ks=kill $1\n#action >combat ^You parry.=say Nice parry!`,
    'Variables': `#var @7=22\n#var name="Legolas"\n#print ("Hello " + $name)`,
    'Conditionals': `#if ($score > 100) {say I am strong} #else {say I am weak}`,
    'Tickers': `#in attack (2000) {kill orc; kick}`,
    'PowTTY (Pipe)': `#sep |\n#var $xpcal=0 | #al xp=info XPCOUNTER: %x %t %X %T.`
};

function initExamples() {
    if (!exampleButtonsContainer) return;
    Object.keys(EXAMPLES).forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition border border-gray-600';
        btn.textContent = name;
        btn.onclick = () => {
            powwowInput.value = EXAMPLES[name];
            if (name.includes('Pipe')) {
                if (pipeSeparatorCheckbox) pipeSeparatorCheckbox.checked = true;
            } else {
                if (pipeSeparatorCheckbox) pipeSeparatorCheckbox.checked = false;
            }
            convertScript();
        };
        exampleButtonsContainer.appendChild(btn);
    });
}

function convertScript() {
    const isPipe = pipeSeparatorCheckbox && pipeSeparatorCheckbox.checked;
    converter.setSeparator(isPipe ? '|' : ';');

    const inputScript = powwowInput.value;
    tintinOutput.value = converter.convert(inputScript);
}

function copyToClipboard() {
    tintinOutput.select();
    try {
        document.execCommand('copy');
        if (copyTooltip) copyTooltip.textContent = 'Copied!';
    } catch (err) {
        if (copyTooltip) copyTooltip.textContent = 'Failed to copy!';
        console.error('Fallback: Oops, unable to copy', err);
    }
    setTimeout(() => {
        if (copyTooltip) copyTooltip.textContent = 'Copy to clipboard';
    }, 2000);
}

if (convertBtn) {
    convertBtn.addEventListener('click', convertScript);
}

if (pipeSeparatorCheckbox) {
    pipeSeparatorCheckbox.addEventListener('change', convertScript);
}

window.copyToClipboard = copyToClipboard;

initExamples();

// Initial sample
powwowInput.value = EXAMPLES['Combat'];
convertScript();
