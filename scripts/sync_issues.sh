#!/usr/bin/env bash
set -euo pipefail

# -------------------- Configuration --------------------
ISSUES_DIR="docs/issues"                # Directory containing .md files
MAP_FILE="${ISSUES_DIR}/.issue_map.json" # Stores mapping: filename -> issue number
REPO="${REPO:-}"                         # Optional: "owner/repo", defaults to current repo's origin

# -------------------- Helper Functions --------------------
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" >&2
}

die() {
    log "ERROR: $*"
    exit 1
}

# Parse YAML front matter from a file.
# Extracts title, labels, blocked_by.
# Sets global variables: TITLE, LABELS, BLOCKED_BY, BODY (content after front matter)
parse_frontmatter() {
    local file="$1"
    local frontmatter=""
    local body=""
    local inside_frontmatter=0
    local frontmatter_delim_count=0

    while IFS= read -r line; do
        if [[ "$line" == "---" ]]; then
            ((frontmatter_delim_count++))
            if [[ $frontmatter_delim_count -eq 1 ]]; then
                inside_frontmatter=1
                continue
            elif [[ $frontmatter_delim_count -eq 2 ]]; then
                inside_frontmatter=0
                continue
            fi
        fi

        if [[ $frontmatter_delim_count -eq 1 ]]; then
            frontmatter+="$line"$'\n'
        elif [[ $frontmatter_delim_count -ge 2 ]]; then
            body+="$line"$'\n'
        fi
    done < "$file"

    # Parse fields from frontmatter (naive but works for simple key: value)
    TITLE=$(echo "$frontmatter" | grep -E '^title:' | sed -E 's/^title:\s*//' | sed -E 's/^"(.+)"$/\1/' | sed -E "s/^'(.+)'$/\1/")
    LABELS=$(echo "$frontmatter" | grep -E '^labels:' | sed -E 's/^labels:\s*//' | tr -d ' ' | sed -E 's/^"(.+)"$/\1/' | sed -E "s/^'(.+)'$/\1/")
    BLOCKED_BY=$(echo "$frontmatter" | grep -E '^blocked_by:' | sed -E 's/^blocked_by:\s*//' | tr -d ' ' | sed -E 's/^"(.+)"$/\1/' | sed -E "s/^'(.+)'$/\1/")

    # Remove trailing newline from body
    BODY="${body%$'\n'}"
}

# Convert comma-separated list of issue numbers (e.g., "001,002") into GitHub references "#1, #2"
make_blocked_by_line() {
    local blocked_by="$1"
    if [[ -z "$blocked_by" ]]; then
        echo ""
        return
    fi

    local refs=""
    IFS=',' read -ra nums <<< "$blocked_by"
    for num in "${nums[@]}"; do
        # Remove leading zeros, e.g., "001" -> "1"
        clean_num=$(echo "$num" | sed 's/^0*//')
        if [[ -n "$refs" ]]; then
            refs+=", "
        fi
        refs+="#$clean_num"
    done
    echo "**Blocked by:** $refs"
}

# Remove any existing "**Blocked by:**" line from the body to avoid duplication
remove_existing_blocked_by_line() {
    local body="$1"
    # Remove lines that start with "**Blocked by:**" (may have surrounding whitespace)
    echo "$body" | sed '/^\*\*Blocked by:\*\*/d'
}

# Get the current repository in "owner/name" format from git remote
get_current_repo() {
    gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || die "Not inside a GitHub repository or gh not authenticated"
}

# Extract issue number from `gh issue create` output
extract_issue_number() {
    local output="$1"
    echo "$output" | grep -oE 'github\.com/.*/issues/[0-9]+' | grep -oE '[0-9]+$' | head -1
}

# -------------------- Main Script --------------------

# Determine repository
if [[ -z "$REPO" ]]; then
    REPO=$(get_current_repo)
    log "Using current repository: $REPO"
else
    log "Using user-specified repository: $REPO"
fi

# Ensure issues directory exists
if [[ ! -d "$ISSUES_DIR" ]]; then
    die "Issues directory '$ISSUES_DIR' does not exist."
fi

# Load existing mapping (file -> issue number)
declare -A FILE_TO_ISSUE
if [[ -f "$MAP_FILE" ]]; then
    while IFS= read -r filename && IFS= read -r issue_num; do
        FILE_TO_ISSUE["$filename"]="$issue_num"
    done < <(jq -r 'to_entries[] | "\(.key)\n\(.value)"' "$MAP_FILE")
    log "Loaded mapping for ${#FILE_TO_ISSUE[@]} files."
else
    log "No existing mapping file found. New issues will be created."
fi

# Process each .md file
find "$ISSUES_DIR" -maxdepth 1 -name "*.md" -type f | while read -r md_file; do
    filename=$(basename "$md_file")
    log "Processing: $filename"

    # Parse front matter and body
    parse_frontmatter "$md_file"

    if [[ -z "$TITLE" ]]; then
        log "WARNING: No title found in $filename, skipping."
        continue
    fi

    # Prepare labels (default to empty if missing)
    LABELS="${LABELS:-}"

    # Prepare final body: original body without any existing blocked_by line, plus new blocked_by line
    body_without_blocked=$(remove_existing_blocked_by_line "$BODY")
    blocked_line=$(make_blocked_by_line "${BLOCKED_BY:-}")
    final_body="$body_without_blocked"
    if [[ -n "$blocked_line" ]]; then
        # Add a blank line before blocked_by if body is not empty
        if [[ -n "$final_body" ]]; then
            final_body+=$'\n\n'
        fi
        final_body+="$blocked_line"
    fi

    # Check if we already have an issue for this file
    issue_num="${FILE_TO_ISSUE[$filename]:-}"

    if [[ -z "$issue_num" ]]; then
        # Create new issue
        log "Creating new issue: $TITLE"
        # Build command
        cmd=(gh issue create --repo "$REPO" --title "$TITLE" --body "$final_body")
        if [[ -n "$LABELS" ]]; then
            cmd+=(--label "$LABELS")
        fi
        output=$("${cmd[@]}" 2>&1)
        if [[ $? -ne 0 ]]; then
            log "Failed to create issue for $filename: $output"
            continue
        fi
        issue_num=$(extract_issue_number "$output")
        if [[ -z "$issue_num" ]]; then
            log "Could not extract issue number from output: $output"
            continue
        fi
        log "Created issue #$issue_num"
        # Store mapping
        FILE_TO_ISSUE["$filename"]="$issue_num"
    else
        # Update existing issue
        log "Updating existing issue #$issue_num"
        cmd=(gh issue edit "$issue_num" --repo "$REPO" --title "$TITLE" --body "$final_body")
        if [[ -n "$LABELS" ]]; then
            cmd+=(--labels "$LABELS")
        fi
        if ! "${cmd[@]}" >/dev/null 2>&1; then
            log "Failed to update issue #$issue_num for $filename"
            continue
        fi
        log "Updated issue #$issue_num"
    fi
done

# Save updated mapping
log "Saving mapping to $MAP_FILE"
jq -n --argjson map "$(declare -p FILE_TO_ISSUE | sed -E 's/declare -A FILE_TO_ISSUE=//' | tr '()' '{}' | sed 's/\["/{"' | sed 's/"]=/:/' | sed 's/;/,/g' | sed 's/^.{//' | sed 's/}$//')" '$map' > "$MAP_FILE"
# Note: The above jq line is a simplified version; for robustness we use a more direct approach:
# Instead, we reconstruct the JSON properly.
# Let's rebuild the mapping JSON safely:
map_json="{}"
for filename in "${!FILE_TO_ISSUE[@]}"; do
    map_json=$(echo "$map_json" | jq --arg fn "$filename" --arg num "${FILE_TO_ISSUE[$filename]}" '. + {($fn): ($num | tonumber)}')
done
echo "$map_json" > "$MAP_FILE"

log "Sync completed."
