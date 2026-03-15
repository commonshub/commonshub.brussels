# Report

Generate monthly or yearly reports from local data.

## `chb report`

Produces a formatted summary report from synced data — events, members, Discord activity, and financial transactions.

### Syntax

```bash
chb report <YYYY/MM>    # Monthly report
chb report <YYYY>       # Yearly report
```

### What's Included

**Monthly reports:**
- Event summary (count, total attendees, top events)
- Member statistics (total, active, monthly/yearly split, MRR)
- Discord activity (message counts per channel)
- Financial overview (blockchain + Stripe income/expenses)

**Yearly reports:**
- Month-by-month event counts and attendance
- Year totals and averages
- Financial summaries per month

### Data Sources

Reports read from already-synced data in the `data/` directory. Run sync commands first:

```bash
chb events sync
chb transactions sync
chb bookings sync
chb messages sync
```

### Examples

```bash
# November 2025 report
chb report 2025/11

# Full year 2025 report
chb report 2025
```

### Output

Reports are printed to stdout with formatted tables and colored output. Pipe to a file or use terminal screenshots for sharing.

```bash
# Save report to file (strips ANSI colors)
chb report 2025/11 | cat > report-2025-11.txt
```
