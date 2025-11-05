/**
 * Data Import Page
 * Import student and workshop data from CSV files
 */

'use client';

import { useState } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface ImportPreview {
  students: number;
  workshops: number;
  errors: string[];
}

export default function ImportPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);

    // Parse CSV for preview
    const text = await file.text();
    const lines = text.split('\n').filter((line) => line.trim());

    // Simple preview - just show row count
    setPreview({
      students: Math.max(0, lines.length - 1), // -1 for header
      workshops: 0,
      errors: [],
    });
  };

  const handleCsvImport = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch('/api/import-csv', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      toast.success(`Imported ${result.students} students and ${result.workshops} workshops successfully`);
      setPreview(null);
      setCsvFile(null);

      // Reset file input
      const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `registration_id,student_name,supervisor_name,supervisor_email,workshop_slot1_name,workshop_slot2_name,time_slot,room_location
ST001,John Doe,Jane Smith,jane.smith@example.com,Intro to Theater,Advanced Acting,1,Room 101
ST002,Mary Johnson,Bob Wilson,bob.wilson@example.com,Stage Design,Costume Design,2,Room 202`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success('Downloaded CSV template');
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Import Data</h1>
        <p className="text-gray-600">
          Import student and workshop data from CSV files
        </p>
      </div>

      {/* CSV Upload */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-start mb-4">
          <Upload className="text-primary mr-3 mt-1" size={24} />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Upload CSV File
            </h2>
            <p className="text-sm text-gray-600">
              Upload a CSV file with student and workshop data
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CSV File
            </label>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark"
              disabled={loading}
            />
          </div>

          <button
            onClick={downloadTemplate}
            className="flex items-center space-x-2 text-primary hover:text-primary-dark transition-colors"
          >
            <Download size={18} />
            <span className="text-sm font-medium">Download CSV Template</span>
          </button>

          {preview && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <CheckCircle className="text-green-600 mr-2 mt-0.5" size={18} />
                <div className="text-sm text-green-800">
                  <p className="font-medium mb-1">Preview:</p>
                  <ul className="space-y-1 text-green-700">
                    <li>{preview.students} students to import</li>
                    {preview.errors.length > 0 && (
                      <li className="text-red-600">
                        {preview.errors.length} errors found
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleCsvImport}
            disabled={loading || !csvFile}
            className="flex items-center space-x-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <Upload size={18} />
                <span>Import CSV</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Import Instructions
        </h2>
        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">1. Prepare Your Data</h3>
            <p>
              Create a CSV file with your student data, or download the template above.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">2. Required Columns</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><code className="bg-gray-100 px-1 rounded">registration_id</code> or <code className="bg-gray-100 px-1 rounded">Registrant ID</code> - Unique student ID (used in QR codes)</li>
              <li><code className="bg-gray-100 px-1 rounded">student_name</code> - Full name</li>
              <li><code className="bg-gray-100 px-1 rounded">supervisor_email</code> - Supervisor's email for reports</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">3. Optional Columns</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><code className="bg-gray-100 px-1 rounded">supervisor_name</code> - Supervisor's name</li>
              <li><code className="bg-gray-100 px-1 rounded">workshop_slot1_name</code> or <code className="bg-gray-100 px-1 rounded">Breakout Session I</code> - First workshop name</li>
              <li><code className="bg-gray-100 px-1 rounded">workshop_slot2_name</code> or <code className="bg-gray-100 px-1 rounded">Breakout Session II</code> - Second workshop name</li>
              <li><code className="bg-gray-100 px-1 rounded">notes</code> - Additional notes</li>
              <li><code className="bg-gray-100 px-1 rounded">time_slot</code> - Workshop time slot (1 or 2)</li>
              <li><code className="bg-gray-100 px-1 rounded">room_location</code> - Room location</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">4. Import</h3>
            <p>
              Upload your CSV file. The system will automatically create workshops and link students.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">5. Re-importing Data</h3>
            <p className="mb-2">
              You can import the same file multiple times safely:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Existing students</strong> (matching registration_id) will be <strong>updated</strong></li>
              <li><strong>New students</strong> will be <strong>added</strong></li>
              <li><strong>Students not in CSV</strong> will remain <strong>unchanged</strong></li>
              <li><strong>Attendance records</strong> are never deleted or modified</li>
            </ul>
          </div>
        </div>
      </div>

      {/* CSV Format Example */}
      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          CSV Format Example
        </h2>
        <div className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
          <pre className="text-xs text-gray-800">
{`registration_id,student_name,supervisor_email,workshop_slot1_name,workshop_slot2_name
ST001,Alice Anderson,mjohnson@school.com,Introduction to Theater,Advanced Acting
ST002,Bob Baker,rsmith@school.com,Stage Design,Costume Design
ST003,Carol Chen,mjohnson@school.com,Lighting Tech,Sound Engineering`}
          </pre>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <p className="mb-2"><strong>Tips:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>First row must be headers (column names)</li>
            <li>Column names are case-insensitive</li>
            <li>Use quotes for values containing commas</li>
            <li>Export from Excel: File → Save As → CSV</li>
            <li>Export from Google Sheets: File → Download → CSV</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
