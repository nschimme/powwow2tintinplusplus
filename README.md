# TinTin++ Script Converter

A robust tool to migrate MUD scripts from legacy clients (Powwow/PowTTY, JMC) to TinTin++.

## Features

- **Robust Parsing:** Uses a sophisticated tokenizer to handle nested braces, parentheses, and line continuations reliably.
- **Multiple Client Support:** Migrate scripts from Powwow, PowTTY, and JMC.
- **Complex Expressions:** Automates conversion of Powwow inline calculator expressions and JMC math/if structures.
- **Variable Mapping:** Intelligent mapping of legacy variables to TinTin++ equivalents.
- **Recursive Conversion:** Deeply nested commands within aliases, actions, and control structures are recursively processed.
- **Modern Architecture:** Built with ESM, Vite, and Tailwind CSS.
- **Validated:** Tested against real-world MUME script benchmarks from ElvenRunes.

## Getting Started

### Web Interface

1. Open the [converter](https://nschimme.github.io/tintin-script-converter/) in your browser.
2. Select your source client (Powwow, PowTTY, or JMC).
3. Paste your script into the input area.
4. Use the **Example** buttons to see how different script patterns are handled.
5. Review the converted TinTin++ output.

### Local Development

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Run tests:
   ```bash
   npm test
   ```

## Technical Details

- **Tokenizer:** Handles nested structures by tracking brace and parenthesis depth.
- **Expression Engine:** Partially emulates legacy inline calculator logic during translation.
- **Attribute Mapping:** Translates color attributes to TinTin++ `<XYZ>` color codes.
- **CI/CD:** Automated testing and deployment via GitHub Actions.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
