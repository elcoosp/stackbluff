# Migration Requirements

## SQLite Version

This migration uses features that require **SQLite 3.33.0 or later** (released August 2020):
- Correlated subqueries in UPDATE statements
- Common Table Expressions (CTEs)

### Checking Your SQLite Version

```bash
sqlite3 --version
```

### Compatibility

- ✅ SQLite 3.33.0+ (August 2020) - Full support
- ✅ SQLite 3.35.0+ (March 2021) - Recommended
- ❌ SQLite < 3.33.0 - Not supported

### Backfill Strategy

For existing clubs with >500 members, the migration:
1. Creates a temporary table with row numbers based on join order
2. Updates division assignments based on row numbers
3. Cleans up temporary table

This ensures all existing members are properly assigned to divisions.

### Performance

- Migration runs in O(N) time where N is total members
- Uses single UPDATE statement for efficiency
- Safe to run on production databases
