# Powwow to TinTin++ Script Converter

## Overview

This tool helps migrate MUD (Multi-User Dungeon) scripts from the Powwow client to the TinTin++ client. It parses Powwow script files and attempts to convert them into TinTin++ compatible commands and syntax. The tool has been significantly enhanced for more accurate and comprehensive conversion, but manual review and adjustment of the output are still highly recommended, especially for complex scripts.

## How to Use

1.  **Open `index.html`** in a modern web browser.
2.  **Paste your Powwow script** content into the "Powwow Script" text area on the left.
3.  **Click the "Convert Script" button.**
4.  The converted TinTin++ script will appear in the "TinTin++ Output" text area on the right.
5.  **Copy the output** using the "Copy Output" button or by manually selecting and copying the text.
6.  **Review and test** the converted script thoroughly in your TinTin++ client. Manual adjustments will likely be necessary.

## Features / Conversion Capabilities

The converter handles a variety of Powwow commands and syntax, including:

*   **Recursive Command Processing:** Powwow commands nested within other commands (e.g., `#print` inside an `#action`'s command block, or commands within an `#alias` definition) are now recursively processed and converted to their TinTin++ equivalents. This significantly improves the accuracy of complex script conversions.
*   **Aliases:**
    *   Basic conversion of `#alias name=commands` to `#ALIAS {name} {commands}`.
    *   Parameter mapping: Powwow `$N` (e.g., `$1`) is converted to TinTin++ `%N` (e.g., `%1`). Powwow `&N` (string match) is also converted to `%N`.
    *   Commands within alias definitions are recursively converted.
    *   Group/Label syntax (`#alias >label@groupname name=commands`) is parsed. Actions and aliases with `@groupname` are wrapped in `#CLASS {groupname} {OPEN/CLOSE}`. The `>label` part is currently ignored for priority.
*   **Actions:**
    *   Basic conversion of `#action {pattern}=commands` to `#ACTION {pattern} {commands}`.
    *   Commands within action definitions (the part after `=`) are recursively converted.
    *   Parameter mapping: Powwow `$N` (word match) and `&N` (string match) are converted to TinTin++ `%N`.
    *   Pattern conversion: Basic attempts are made to convert Powwow patterns.
    *   Gagging: Actions with an empty command part are converted to `#GAG {pattern}`.
    *   Group/Label syntax (`#action >label@groupname {pattern}=commands`) is parsed, with `@groupname` used for `#CLASS` wrapping.
*   **Variables:**
    *   Powwow `@N` (numeric array variable) converted to TinTin++ `$powwow_at[N]`.
    *   Powwow `@varName` (named variable) converted to TinTin++ `$varName`.
    *   Powwow `$varName` (named variable, less common) converted to TinTin++ `$varName`.
    *   Values assigned to variables are processed for nested commands/substitutions.
*   **Control Flow (`#if`, `#while`, `#for`):**
    *   `#if (condition) {true_block} #else {false_block}` is converted to `#IF {condition} {true_block} {#ELSE} {false_block}`. A comment is added to prompt manual verification.
    *   `#while (condition) {command_block}` is converted to `#WHILE {condition} {command_block}`.
    *   `#for (init_expr; condition_expr; loop_expr) {command_block}` is converted to a TinTin++ structure: `init_cmds; #WHILE {condition_expr} {command_block; loop_cmds}`. A comment is added for manual verification.
    *   Command blocks within these structures are recursively processed.
*   **Key Bindings (`#bind`):**
    *   `#bind key=command` is converted to `#KEY {key} {command}`.
    *   Common key names (e.g., 'Up', 'F1', 'Enter') are mapped to TinTin++ equivalents (e.g., '<Up>', '<F1>', '<Enter>').
    *   Basic Emacs-style key prefixes like `C-key` (e.g., `C-c` -> `^c`) and `M-key` (e.g., `M-x` -> `\ex`) are converted. Complex or unrecognized sequences will generate a TODO comment.
    *   Powwow internal functions used in binds (e.g., `&prev-line`) will generate a TODO comment as they require manual reimplementation.
*   **Specific Commands (`#print`, `#emulate`, `#send`):**
    *   `#mark {text}={highlight_options}` (less common) might be partially converted to `#HIGHLIGHT`.
    *   `#print text` is converted to `#SHOWME {text}` (arguments recursively processed).
    *   `#emulate text` is converted to `#SHOWME {text}` (arguments recursively processed).
    *   `#send < filename` is converted to `#TEXTIN {filename}`.
    *   `#send !shell_command` is converted to `#SYSTEM {shell_command}`.
    *   For `#send text_to_mud`, it is processed recursively, converting any embedded Powwow commands.
    *   `#in <label>(delay_ms) {commands}` / `#at <label>(delay_ms) {commands}` (Tickers) are converted to `#TICKER {label} {commands} {delay_sec}` (delay is converted from milliseconds to seconds). Group syntax is also handled.
    *   `#reset <type>` (e.g., `#reset alias`) is converted to TinTin++ equivalents like `#KILL ALIASES {*}*`.
*   **Powwow Expressions & Functions:**
    *   Basic Powwow variable dereferences like `#($foo)` or `#(@bar)` may be converted to TinTin++ equivalents (e.g., `@foo` or `$bar` respectively, with a TODO comment for verification). More complex expressions like `#(...)` or specific functions (e.g., `attr()`, `isprompt()`) are replaced with placeholders like `POWWOW_EXPRESSION_NEEDS_MANUAL_CONVERSION` or `POWWOW_FUNCTION_NEEDS_MANUAL_CONVERSION` and generate a TODO comment.
*   **Command Chaining:** Semicolon-separated commands, often found within Powwow's curly-braced `{}` blocks, are generally handled. The converter attempts to split these and process them individually (recursively).
*   **Escaped Characters:** Basic support for Powwow's escaped characters (`\;`, `\{`, `\}`, `\#`, `\\\\`) is implemented, aiming to treat them as literal characters in the TinTin++ output.
*   **Comments:**
    *   Single-line comments `// comment` are converted to `#comment comment`.
    *   Block comments `/* comment */` are converted to `#comment comment`. (Note: Multi-line content within block comments will be prefixed line by line with `#comment`).
*   **Powwow Group Control:**
    *   Enable (`#=group` or `#+group`): Converted to a comment suggesting manual steps: `#COMMENT TODO: To enable group 'group', ensure its actions/aliases are loaded, e.g., #CLASS {group} {READ} {group.tin}`.
    *   Disable (`#<group` or `#-group`): Converted to `#CLASS {group} {KILL}`.
    *   Toggle (`#%group`): Converted to a comment suggesting manual steps: `#COMMENT TODO: Manual conversion for toggling group 'group'. TinTin++ does not have a direct group toggle.`.

## Known Limitations / Manual Steps

While the converter handles many common Powwow features, some aspects will likely require manual intervention:

*   **Complex Nested Logic:** While recursive processing is implemented, extremely deep or convoluted nesting might still pose challenges and should be reviewed carefully.
*   **Powwow Delayed Substitution (`\$N` and `\$varname`):**
    *   Powwow delayed parameter substitution (e.g., `\$1`) is replaced by a `POWWOW_DELAYED_SUBST_X` placeholder. The generated TODO comment now provides more specific suggestions for manual conversion, such as using an intermediate TinTin++ variable.
    *   **Delayed Variable Substitution (`\$varname`):** Powwow's delayed *variable* substitution (e.g., `\$foo`) is replaced by `POWWOW_DELAYED_VAR_SUBST_foo`. This also requires manual reimplementation, likely involving temporary variables or scripting, as TinTin++ does not have a direct equivalent for this specific type of delayed evaluation. A TODO comment is generated.
*   **Powwow Expressions and Functions:**
    *   Placeholders like `POWWOW_EXPRESSION_NEEDS_MANUAL_CONVERSION` and `POWWOW_FUNCTION_NEEDS_MANUAL_CONVERSION` indicate that Powwow-specific expressions (e.g., `#(...)` syntax for arbitrary calculations) or client functions (e.g., `attr()`, `noattr()`, `isprompt()`) were found. These constructs do not have direct TinTin++ equivalents and must be manually translated into TinTin++ variables, scripting, or built-in functions. The heuristic conversions for simple `#($foo)` or `#(@bar)` should also be verified.
*   **Regular Expressions in Actions/Prompts:**
    *   Powwow's native pattern matching (`$N` for a single word, `&N` for a sequence of characters until end of line or next pattern) and its optional POSIX ERE for actions (using `%label` on the `#action` line) are converted to TinTin++'s PCRE (Perl Compatible Regular Expressions).
    *   While basic parameter substitutions (`$N` -> `%N`) are made, complex regex patterns might need manual fine-tuning to ensure identical behavior due to differences between Powwow's matching and PCRE.
*   **`#prompt` Command:**
    *   The conversion for Powwow's `#prompt` is superficial due to fundamental differences. Powwow `#prompt` is for MUD prompt *recognition* (often using an internal `#isprompt`), while TinTin++ `#prompt` is for *displaying* text on a status line. The converter now adds detailed in-code comments to the output when it encounters a Powwow `#prompt`.
    *   Commands within a Powwow prompt definition are recursively processed, but the fundamental incompatibility of the `#prompt` purpose remains.
    *   These comments clarify this difference and suggest users may need to implement separate TinTin++ `#ACTION` triggers to capture prompt information into variables, then use those variables in a TinTin++ `#PROMPT` command for display, or use `#CONFIG {INPUT PREFIX}` for simple prompt markers.
    *   Users should carefully review and likely rewrite Powwow prompt logic.
*   **Key Bindings (`#bind`):**
    *   While common and basic Emacs-style key bindings are converted, very complex Powwow key sequences, those involving terminal-specific escape codes not automatically recognized, or Powwow internal functions (`&function`) will generate TODO comments and require manual configuration in TinTin++. TinTin++ uses `<0xXX>` for byte codes if needed.
*   **`#exe` and `#send` with Shell/File I/O:**
    *   Basic file sending (`#send <file>` -> `#TEXTIN`) and shell execution (`#send !cmd` -> `#SYSTEM`) are handled.
    *   However, more complex uses of `#exe` or `#send` involving dynamic expression evaluation for filenames or shell commands (e.g., `#send <@filename_var`) might need manual review and adjustment.
*   **`#option` and `#setvar` (and other internal Powwow settings):**
    *   These commands are highly specific to the Powwow client's internal settings and variables.
    *   Powwow `#option` commands will likely need manual mapping to TinTin++ `#config` equivalents or other settings.
    *   Powwow internal variables set via `#setvar` (like `timer`, `buffer`, `scrollback`, `wordwrap`) have different names, mechanisms, or may not have direct equivalents in TinTin++.
*   **Error Handling and Debugging:** The converter translates syntax but does not validate the logical correctness of the scripts. Thorough testing of the converted TinTin++ script is essential.
*   **Contextual Differences:** The overall scripting environment, event handling, and execution flow can differ between Powwow and TinTin++. Some Powwow paradigms or tricks might not translate directly and could require a more idiomatic TinTin++ approach.
*   **Implicit vs. Explicit Bracing:** Powwow is sometimes flexible with braces `{}` for command blocks (e.g., in `#if`). TinTin++ is generally stricter. The converter makes assumptions that might need review.

## Contributing (Placeholder)

Details on how to contribute to the development of this converter will be added here. This could include:
*   Reporting bugs or conversion inaccuracies.
*   Suggesting improvements or new features.
*   Submitting pull requests with enhancements.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
