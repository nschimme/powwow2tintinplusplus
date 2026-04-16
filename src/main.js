import { TinTinConverter } from './converter.js';

const powwowInput = document.getElementById('powwow-input');
const tintinOutput = document.getElementById('tintin-output');
const convertBtn = document.getElementById('convert-btn');
const copyTooltip = document.getElementById('copy-tooltip');
const pipeSeparatorCheckbox = document.getElementById('pipe-separator');
const modeSelect = document.getElementById('mode-select');
const pipeSeparatorLabel = document.getElementById('pipe-separator-label');
const sourceTitle = document.getElementById('source-title');
const exampleButtonsContainer = document.getElementById('example-buttons');

const converter = new TinTinConverter();

const EXAMPLES = {
    'Combat (Powwow)': {
        mode: 'powwow',
        text: `#alias >combat ks=kill $1\n#action >combat ^You parry.=say Nice parry!`
    },
    'Variables (Powwow)': {
        mode: 'powwow',
        text: `#var @7=22\n#var name="Legolas"\n#print ("Hello " + $name)`
    },
    'JMC Alias': {
        mode: 'jmc',
        text: `#alias {k} {kill %1}\n#alias {putex} {put %1 into %2; #showme {done: %0}}`
    },
    'JMC Action': {
        mode: 'jmc',
        text: `#action {^%0 arrived from the %1} {kill %0} {0}\n#action {^You are hungry.} {eat bread} {2}`
    },
    'JMC If/Math': {
        mode: 'jmc',
        text: `#var {hp} {100}\n#action {HP:%1} {#var {hp} {%1}; #if {%1 < 50} {flee}}\n#math {double_hp} {$hp * 2}`
    },
    'PowTTY (Pipe)': {
        mode: 'powwow',
        isPipe: true,
        text: `#sep |\n#var $xpcal=0 | #al xp=info XPCOUNTER: %x %t %X %T.`
    }
};

function initExamples() {
    if (!exampleButtonsContainer) return;
    exampleButtonsContainer.innerHTML = '';
    Object.keys(EXAMPLES).forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition border border-gray-600';
        btn.textContent = name;
        btn.onclick = () => {
            const example = EXAMPLES[name];
            if (modeSelect) modeSelect.value = example.mode;
            updateUIForMode();
            powwowInput.value = example.text;
            if (example.isPipe) {
                if (pipeSeparatorCheckbox) pipeSeparatorCheckbox.checked = true;
            } else {
                if (pipeSeparatorCheckbox) pipeSeparatorCheckbox.checked = false;
            }
            convertScript();
        };
        exampleButtonsContainer.appendChild(btn);
    });
}

function updateUIForMode() {
    const mode = modeSelect ? modeSelect.value : 'powwow';
    if (sourceTitle) {
        sourceTitle.textContent = mode === 'jmc' ? 'JMC' : 'Powwow';
    }
    if (pipeSeparatorLabel) {
        pipeSeparatorLabel.style.display = mode === 'jmc' ? 'none' : 'flex';
    }
}

function convertScript() {
    const mode = modeSelect ? modeSelect.value : 'powwow';
    const isPipe = pipeSeparatorCheckbox && pipeSeparatorCheckbox.checked;

    converter.setMode(mode);
    if (mode === 'powwow') {
        converter.setSeparator(isPipe ? '|' : ';');
    }

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

if (modeSelect) {
    modeSelect.addEventListener('change', () => {
        updateUIForMode();
        convertScript();
    });
}

window.copyToClipboard = copyToClipboard;

initExamples();
updateUIForMode();

// Initial sample
powwowInput.value = EXAMPLES['Combat (Powwow)'].text;
convertScript();
