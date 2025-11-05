#!/usr/bin/env python3
"""
QR Code Generator for Stage the Change
Generates individual QR code images for each student registration ID
"""

import qrcode
import csv
import sys
from pathlib import Path
from typing import List


def generate_qr_codes(csv_path: str, output_dir: str) -> None:
    """
    Generate QR codes for each student in the CSV file.

    Args:
        csv_path: Path to the CSV file containing student data
        output_dir: Directory where QR code images will be saved
    """
    # Create output directory if it doesn't exist
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Track statistics
    generated_count = 0
    errors: List[str] = []

    try:
        with open(csv_path, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)

            # Validate CSV has required column (try multiple possible column names)
            reg_id_column = None
            possible_columns = ['Registration ID', 'Registrant ID', 'registration_id', 'registrant_id']

            for col in possible_columns:
                if col in reader.fieldnames:
                    reg_id_column = col
                    break

            if not reg_id_column:
                print(f"Error: CSV must contain one of these columns: {', '.join(possible_columns)}")
                print(f"Available columns: {', '.join(reader.fieldnames)}")
                sys.exit(1)

            print(f"Using column: '{reg_id_column}' for registration IDs\n")

            for row_num, row in enumerate(reader, start=2):
                try:
                    reg_id = row[reg_id_column].strip()

                    if not reg_id:
                        errors.append(f"Row {row_num}: Empty registration ID")
                        continue

                    # Generate QR code
                    qr = qrcode.QRCode(
                        version=1,
                        error_correction=qrcode.constants.ERROR_CORRECT_M,
                        box_size=10,
                        border=4,
                    )

                    qr.add_data(reg_id)
                    qr.make(fit=True)

                    # Create image
                    img = qr.make_image(fill_color="black", back_color="white")

                    # Save with registration ID as filename
                    # Sanitize filename to remove invalid characters
                    safe_filename = "".join(
                        c for c in reg_id if c.isalnum() or c in ('-', '_')
                    )
                    img_path = output_path / f"{safe_filename}.png"
                    img.save(img_path)

                    generated_count += 1

                    if generated_count % 50 == 0:
                        print(f"Generated {generated_count} QR codes...")

                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")

        # Print summary
        print(f"\n{'='*60}")
        print(f"QR Code Generation Complete")
        print(f"{'='*60}")
        print(f"Total generated: {generated_count}")
        print(f"Output directory: {output_path.absolute()}")

        if errors:
            print(f"\nErrors encountered: {len(errors)}")
            for error in errors[:10]:  # Show first 10 errors
                print(f"  - {error}")
            if len(errors) > 10:
                print(f"  ... and {len(errors) - 10} more")
        else:
            print("\n✓ All QR codes generated successfully!")

    except FileNotFoundError:
        print(f"Error: CSV file not found at {csv_path}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print("Usage: python generate_qr_codes.py <csv_file> [output_dir]")
        print("\nExample:")
        print("  python generate_qr_codes.py students.csv qr_codes/")
        sys.exit(1)

    csv_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "qr_codes"

    generate_qr_codes(csv_path, output_dir)


if __name__ == "__main__":
    main()
