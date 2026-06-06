#!/bin/bash

# Configuration
BASE_DIR="docs/marketing/prelaunch"
TEMPLATE_DIR="$BASE_DIR/10-production-pipeline/templates"
OUTPUT_DIR="$BASE_DIR/10-production-pipeline/output"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "🤖 Generating HTML posts from templates..."

# Find all .md files in content directories
find "$BASE_DIR" -path "*/content/*.md" | while read -r MD_FILE; do

    FILENAME=$(basename "$MD_FILE" .md)

    # 1. Determine which template to use based on filename
    TEMPLATE=""
    if [[ "$FILENAME" == *"architect"* ]]; then TEMPLATE="architect-log.html"
    elif [[ "$FILENAME" == *"canvas"* ]]; then TEMPLATE="canvas-log.html"
    elif [[ "$FILENAME" == *"diplomat"* ]]; then TEMPLATE="diplomat-log.html"
    elif [[ "$FILENAME" == *"catalyst"* ]]; then TEMPLATE="catalyst-log.html"
    elif [[ "$FILENAME" == *"ghost"* ]]; then TEMPLATE="ghost-log.html"
    elif [[ "$FILENAME" == *"human"* ]]; then TEMPLATE="human-log.html"
    fi

    # If no template matches, skip silently (we don't have Oracle/Leak templates yet)
    if [ -z "$TEMPLATE" ]; then
        continue
    fi

    # Check if template exists
    if [ ! -f "$TEMPLATE_DIR/$TEMPLATE" ]; then
        echo "⚠️ Skipping $FILENAME: Template $TEMPLATE not found in $TEMPLATE_DIR"
        continue
    fi

    # 2. Extract the Day Number (macOS BSD compatible)
    # Looks for "Day XX" anywhere in the file
    DAY=$(grep -o 'Day [0-9]*' "$MD_FILE" | head -1 | grep -o '[0-9]*')
    if [ -z "$DAY" ]; then
        echo "⚠️ Skipping $FILENAME: Could not extract Day number."
        continue
    fi

    # 3. Extract the Body Text
    # - Skips the header line (contains "· Day")
    # - Skips lines that are just the suit symbol (♠, ♥, etc.)
    # - Skips empty lines
    # - Joins remaining lines with \n for the JS string
    # - Escapes double quotes

    BODY_TEXT=$(awk '
    /· Day [0-9]/ { next }
    /^[♠♥♦♣🃏]$/ { next }
    /^$/ { next }
    {
        gsub(/"/, "\\\"")
        if (body != "") body = body "\\n" $0
        else body = $0
    }
    END { print body }
    ' "$MD_FILE")

    if [ -z "$BODY_TEXT" ]; then
        echo "⚠️ Skipping $FILENAME: Could not extract body text."
        continue
    fi

    # 4. Inject data into the template
    OUTPUT_FILE="$OUTPUT_DIR/${FILENAME}.html"

    # Copy template
    cp "$TEMPLATE_DIR/$TEMPLATE" "$OUTPUT_FILE"

    # macOS compatible sed replacement
    sed -i '' "s/%%DAY%%/$DAY/g" "$OUTPUT_FILE"
    sed -i '' "s/%%TEXT%%/$BODY_TEXT/g" "$OUTPUT_FILE"

    echo "✅ Created: $OUTPUT_FILE (Day $DAY | Template: $TEMPLATE)"

done

echo ""
echo "🎬 HTML generation complete! Open the files in $OUTPUT_DIR to record your GIFs."
