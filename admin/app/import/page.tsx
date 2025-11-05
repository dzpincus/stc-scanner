/**
 * Data Import Page
 * Import student and workshop data from Google Sheets
 */

'use client';

import { useState } from 'react';
import { createServiceClient } from '@/lib/supabase';
import { Upload, Download, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface ImportPreview {
  students: number;
  workshops: number;
  errors: string[];
}

export default function ImportPage() {
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const handleGoogleSheetImport = async () => {
    if (!googleSheetUrl) {
      toast.error('Please enter a Google Sheet URL');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/import-google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: googleSheetUrl }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }

      toast.success(`Imported ${result.students} students and ${result.workshops} workshops`);
      setPreview(null);
      setGoogleSheetUrl('');
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

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

      toast.success(`Imported ${result.students} students successfully`);
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
          Import student and workshop data from Google Sheets or CSV files
        </p>
      </div>

      {/* Google Sheets Import */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-start mb-4">
          <Upload className="text-primary mr-3 mt-1" size={24} />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Import from Google Sheets
            </h2>
            <p className="text-sm text-gray-600">
              Import data directly from a Google Sheet. Make sure the sheet is publicly accessible.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Google Sheet URL
            </label>
            <input
              type="url"
              value={googleSheetUrl}
              onChange={(e) => setGoogleSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={loading}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="text-blue-600 mr-2 mt-0.5" size={18} />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Required Sheet Format:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Sheet must contain columns: registration_id, student_name, supervisor_email</li>
                  <li>Workshop columns: workshop_slot1_name, workshop_slot2_name</li>
                  <li>First row should be headers</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleGoogleSheetImport}
            disabled={loading || !googleSheetUrl}
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
                <span>Import from Google Sheets</span>
              </>
            )}
          </button>
        </div>
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
              Download the CSV template or format your Google Sheet with the required columns.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">2. Required Columns</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><code className="bg-gray-100 px-1 rounded">registration_id</code> - Unique student ID</li>
              <li><code className="bg-gray-100 px-1 rounded">student_name</code> - Full name</li>
              <li><code className="bg-gray-100 px-1 rounded">supervisor_email</code> - Supervisor's email</li>
              <li><code className="bg-gray-100 px-1 rounded">workshop_slot1_name</code> - First workshop name</li>
              <li><code className="bg-gray-100 px-1 rounded">workshop_slot2_name</code> - Second workshop name</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">3. Optional Columns</h3>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><code className="bg-gray-100 px-1 rounded">supervisor_name</code> - Supervisor's name</li>
              <li><code className="bg-gray-100 px-1 rounded">notes</code> - Additional notes</li>
              <li><code className="bg-gray-100 px-1 rounded">time_slot</code> - Workshop time slot (1 or 2)</li>
              <li><code className="bg-gray-100 px-1 rounded">room_location</code> - Room location</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 mb-2">4. Import</h3>
            <p>
              Upload your CSV file or paste your Google Sheet URL. The system will automatically create workshops and link students.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
