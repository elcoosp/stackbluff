#!/bin/bash

# Usage: ./script.sh [target_directory]
# Default to current directory if none given
TARGET_DIR="${1:-.}"

# Find all regular files, skipping any path containing node_modules or target
find "$TARGET_DIR" -type d \( -name node_modules -o -name target \) -prune -o \
    -type f -print0 | while IFS= read -r -d '' file; do
    # Optional: print a separator with the filename (comment out if unwanted)
    echo "=== $file ==="
    cat "$file"
    echo  # Add a newline between files
done
