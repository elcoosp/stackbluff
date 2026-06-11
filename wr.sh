#!/usr/bin/env bash
set -uo pipefail

COMPILE_OK=true
INCOMPLETE=false

echo "Removing duplicate Ok(()) in main.rs"

cd tools/sbdc || { echo "ERROR: cannot cd to tools/sbdc"; exit 1; }

# Find and delete the extra Ok(()) line that appears after the match block
# The current structure: match result, then result?; then Ok(()) twice?
# We'll rewrite the tail end of main to ensure only one Ok(()) and proper semicolon.

OLD_TAIL=$(mktemp)
NEW_TAIL=$(mktemp)
cat > "$OLD_TAIL" << 'TAIL_OLD'
    result?;
    Ok(())
    Ok(())
TAIL_OLD

cat > "$NEW_TAIL" << 'TAIL_NEW'
    result?;
    Ok(())
TAIL_NEW

if python3 - "$OLD_TAIL" "$NEW_TAIL" sbdc-cli/src/main.rs << 'PYEOF'
import sys
with open(sys.argv[1], 'r') as f: old = f.read()
with open(sys.argv[2], 'r') as f: new = f.read()
with open(sys.argv[3], 'r') as f: content = f.read()
if old in content:
    content = content.replace(old, new)
else:
    print("Pattern not found, trying more precise fix", file=sys.stderr)
    # Fallback: remove extra Ok(()) line
    lines = content.split('\n')
    new_lines = []
    skip_next = False
    for i, line in enumerate(lines):
        if line.strip() == 'Ok(())' and i > 0 and lines[i-1].strip() == 'Ok(())':
            continue
        new_lines.append(line)
    content = '\n'.join(new_lines)
with open(sys.argv[3], 'w') as f: f.write(content)
PYEOF
then
    echo "Fixed duplicate Ok(())"
    rm "$OLD_TAIL" "$NEW_TAIL"
else
    echo "ERROR: Failed to fix"
    rm -f "$OLD_TAIL" "$NEW_TAIL"
    exit 1
fi

echo "Re-checking compilation"
if ! cargo check --workspace 2>&1; then
    echo "Compilation failed – will skip commit"
    COMPILE_OK=false
fi

if [ "$COMPILE_OK" = true ]; then
    echo "Running tests"
    if ! cargo nextest run --workspace 2>&1; then
        echo "Tests failed. Fix errors then run the next script."
        exit 1
    fi
    echo "All tests passed. Committing."
    git add -A
    git commit -m "fix(cli): remove duplicate Ok(()) in main"
else
    echo "Compilation still failing. Provide error log for surgical fix."
    exit 1
fi
