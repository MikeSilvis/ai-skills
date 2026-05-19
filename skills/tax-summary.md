---
name: tax-summary
description: Scan tax documents (PDFs in year-organized folders) and generate/update a CSV of per-year earnings and taxes paid. Use when asked to "update tax summary", "generate tax csv", "scan tax documents", or "summarize taxes".
---

# Tax Document Summary Generator

Scan the tax document folder structure and produce `earnings_and_taxes_summary.csv` with per-year earnings and taxes paid.

## Prerequisites

- `pdftotext` must be installed (`brew install poppler`)
- Tax documents are organized in year subfolders (e.g., `2020/`, `2021/`, `2024/Input/`)

## Step 1 — Discover Year Folders

List all year-named subdirectories in the working directory. Each folder represents a tax year.

## Step 2 — Identify Key Documents Per Year

For each year folder, look for these document types (in priority order):

1. **Filed tax returns** — contain the most complete data (1040 summary, state returns)
   - Patterns: `*Tax Return*`, `*Returns*`, `*Filed*`, `*Clnt*`, `*Client*`
2. **W-2 forms** — wage and withholding data
   - Patterns: `*W2*`, `*w2*`, `*W-2*`
3. **8879 e-file authorization** — has AGI, total tax, and withholding on page 1
   - Often embedded in the filed return PDF

Check both the year folder root and common subfolders (`Input/`, `input/`, `pay/`).

## Step 3 — Extract Data from PDFs

Use `pdftotext -layout <file> -` to extract text, then search for these fields:

### From Filed Returns (Two-Year Comparison worksheets are the best source)

Two-year comparison worksheets contain both the current year AND prior year data in a clean columnar format. Search for `Two-Year Comparison` and extract:

| Field | Search pattern |
|-------|---------------|
| Wages | `WAGES, SALARIES, AND TIPS` or `Wages, salaries, and tips` |
| Total Income | `TOTAL INCOME` or `Total income` |
| AGI | `ADJUSTED GROSS INCOME` or `Adjusted gross income` |
| Federal Total Tax | `TOTAL TAX` (under the federal section) |
| Federal Withholding | `FED. INCOME TAX WITHHELD` or `Federal income tax withheld` |
| CA Tax | Under `CALIFORNIA STATE RETURN` → `TAX` line |
| PA Tax | Under `PENNSYLVANIA STATE RETURN` → `TAX` line |

### From Federal Return Summary pages

Look for a clean summary block with:
- `Adjusted gross income`
- `Total tax`
- `Federal income tax withheld`
- `Salaries & wages` or `Wages`

### From 8879 (IRS e-file Signature Authorization)

Lines are numbered 1-5:
- Line 1: Adjusted gross income
- Line 2: Total tax
- Line 3: Federal income tax withheld

### From State 8879s

- **CA 8879**: Line 1 = CA AGI, Line 2 = Amount owed (not total tax)
- **PA 8879**: Line 1 = PA taxable income, Line 2 = PA tax liability

### From State Return Summary pages

- **California Individual Return Summary**: `Income tax` line = CA tax
- **Pennsylvania Individual Return Summary**: `Income tax` line = PA tax

### From W-2 forms

- Box 1: `Wages, tips, other compensation`
- Box 2: `Federal income tax withheld`

## Step 4 — Cross-Reference and Validate

- Two-year comparisons provide data for TWO years — use them to fill in years that lack their own filed return
- Verify AGI and total tax match between 8879 and return summary when both are available
- If multiple W-2s exist for a year, sum them for total wages

## Step 5 — Generate CSV

Write `earnings_and_taxes_summary.csv` in the working directory with these columns:

```
Tax Year,Adjusted Gross Income,Total Income,Wages,Federal Total Tax,Federal Tax Withheld,CA State Tax,PA State Tax,Total Taxes Paid,Notes
```

- `Total Taxes Paid` = Federal Total Tax + CA State Tax + PA State Tax (leave blank if any component is unknown)
- Add notes for missing data, data sources, or caveats
- Sort rows by year ascending
- If the CSV already exists, read it first and update/add years rather than overwriting known-good data

## Important Notes

- Dollar amounts should be whole numbers (no cents, no dollar signs, no commas)
- Some years may only have input documents (W-2s, 1099s) but no filed return — note this
- The 2025 and 2026 folders may only have input documents if returns haven't been filed yet
- If a state return shows $0 tax or wasn't filed, record `0` for that state
- CA tax may be $0 for years where the filer was a nonresident with no CA-source income
