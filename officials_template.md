# Excel Import Template for Officials

## Required Format

Your Excel file should have the following columns in the first row (header):

| Name | Email | Phone | License Number |
|------|-------|-------|----------------|
| Janez Novak | <janez.novak@example.com> | 031234567 | LIC-12345 |
| Ana Kovač | <ana.kovac@example.com> | 041234567 | LIC-67890 |

## Column Names (Flexible)

The import function accepts various column name formats:

- **Name/Ime**: Official's full name (REQUIRED)
- **Email/E-mail**: Email address (optional)
- **Phone/Telefon**: Phone number (optional)
- **License Number/Licenca/License**: License number (optional)

## Import Behavior

- **Skips duplicates**: Officials with the same name (case-insensitive) will be skipped
- **Auto-activates**: All imported officials are set to "Active" by default
- **Blank cells**: Optional fields can be left empty
- **Row validation**: Rows without a name will be skipped with an error message

## Example Data

``` zsh
Name                | Email                      | Phone       | License Number
--------------------------------------------------------------------------------
Janez Novak         | janez.novak@gmail.com      | 031123456   | LIC-001
Marija Horvat       | marija.horvat@gmail.com    | 041234567   | LIC-002
Peter Žnidaršič     | peter.znidar@gmail.com     | 051345678   | LIC-003
Ana Krajnc          | ana.krajnc@gmail.com       | 040456789   | LIC-004
```

## Steps to Import

1. Click the **"Uvozi iz Excel"** (Import from Excel) button
2. Select your Excel file (.xlsx, .xls, or .csv)
3. Review the import summary:
   - Number of officials imported
   - Number skipped (duplicates)
   - Any errors encountered

## Tips

- Use the first row for column headers
- Data should start from the second row
- Save your file as .xlsx for best compatibility
- Test with a small file first
