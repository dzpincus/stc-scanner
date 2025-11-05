# Scripts

Utility scripts for the Stage the Change attendance system.

## QR Code Generation

### Setup

Install Python dependencies:

```bash
pip install -r requirements.txt
```

### Usage

Generate QR codes from a CSV file:

```bash
python generate_qr_codes.py <csv_file> [output_dir]
```

**Example:**

```bash
python generate_qr_codes.py sample_students.csv qr_codes/
```

### CSV Format

The CSV file must contain the following column:
- `Registration ID` (required) - The unique identifier for each student

Optional columns that can be included:
- `Student Name`
- `Supervisor Name`
- `Supervisor Email`
- `Workshop Slot 1`
- `Workshop Slot 2`

**Example CSV:**

```csv
Registration ID,Student Name,Supervisor Email
STU001,John Smith,supervisor@school.edu
STU002,Jane Doe,supervisor@school.edu
```

### Output

The script will:
1. Create the output directory if it doesn't exist
2. Generate a PNG image for each registration ID
3. Name files using sanitized registration IDs
4. Print progress every 50 QR codes
5. Show a summary with any errors

**QR Code Settings:**
- Error correction: Medium (M level)
- Box size: 10 pixels
- Border: 4 boxes
- Colors: Black on white

### Testing

Use the included sample CSV to test:

```bash
python generate_qr_codes.py sample_students.csv test_qr/
```

This will generate 5 test QR codes in the `test_qr/` directory.

### Troubleshooting

**"ModuleNotFoundError: No module named 'qrcode'"**
- Run: `pip install -r requirements.txt`

**"Error: CSV must contain 'Registration ID' column"**
- Ensure your CSV has a column header named exactly "Registration ID"
- Check for typos or extra spaces

**"Permission denied"**
- Make sure you have write permissions in the output directory
- Try running with: `chmod +x generate_qr_codes.py`

### Production Workflow

For the actual event:

1. **Export student data** from your registration system as CSV
2. **Verify CSV format** matches requirements
3. **Run the script**:
   ```bash
   python generate_qr_codes.py students_export.csv qr_codes/
   ```
4. **Review the output** - check that all codes generated successfully
5. **Print or email** QR codes to students
6. **Test scanning** a few QR codes with the mobile app

### Advanced Usage

**Custom output directory:**
```bash
python generate_qr_codes.py students.csv ~/Desktop/event_qr_codes/
```

**Processing large files:**
The script shows progress every 50 codes. For 300 students, you'll see:
```
Generated 50 QR codes...
Generated 100 QR codes...
Generated 150 QR codes...
...
```

## Future Scripts

Additional scripts to be added:
- `import_from_sheets.py` - Import data from Google Sheets to Supabase
- `export_attendance.py` - Export attendance reports to CSV
- `send_emails.py` - Send attendance reports to supervisors
