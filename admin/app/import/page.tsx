/**
 * Data Import Page
 * Upload a CSV, review the diff against the active event, then confirm.
 */

'use client';

import { useState } from 'react';
import { Upload, Download, AlertCircle, CheckCircle, RefreshCw, Lock, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ImportResponse } from '@/app/api/import-csv/route';
import type { StudentPlanItem, WorkshopPlanItem } from '@/lib/csv-import';

export default function ImportPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [markMissing, setMarkMissing] = useState(false);

  const post = async (dryRun: boolean): Promise<ImportResponse | null> => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return null;
    }
    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('dryRun', dryRun ? '1' : '0');
    if (!dryRun && markMissing) formData.append('markMissing', '1');
    const response = await fetch('/api/import-csv', { method: 'POST', body: formData });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || `Import failed (${response.status})`);
    }
    return body as ImportResponse;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvFile(e.target.files?.[0] || null);
    setPreview(null);
    setResult(null);
    setMarkMissing(false);
  };

  const handlePreview = async () => {
    setLoading(true);
    setResult(null);
    setMarkMissing(false);
    try {
      const res = await post(true);
      setPreview(res);
      if (res && res.plan.errors.length) toast.error(`${res.plan.errors.length} row(s) will be skipped`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    const { summary } = preview.plan;
    const toMark = preview.plan.missingFromCsv.filter((m) => !m.not_attending).length;
    const ok = window.confirm(
      `Apply to "${preview.event.name}"?\n\n` +
        `${summary.studentsCreate} students created\n${summary.studentsUpdate} students updated\n` +
        `${summary.workshopsCreate} workshops created\n${summary.roomUpdates} room updates\n\n` +
        (markMissing
          ? `${toMark} student(s) not in this CSV will be marked NOT ATTENDING (not deleted; their badges still scan).`
          : `${summary.missingFromCsv} existing students are not in this CSV and will be left untouched.`)
    );
    if (!ok) return;
    setLoading(true);
    try {
      const res = await post(false);
      setResult(res);
      setPreview(null);
      if (res?.applied?.failures.length) {
        toast.error(`Import finished with ${res.applied.failures.length} failure(s)`);
      } else {
        toast.success('Import applied');
      }
      const fileInput = document.getElementById('csv-upload') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      setCsvFile(null);
      setMarkMissing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `registration_id,student_name,supervisor_name,supervisor_email,workshop_slot1_name,workshop_slot2_name,room_location,notes
ST001,John Doe,Jane Smith,jane.smith@example.com,Intro to Theater,Advanced Acting,Room 101,
ST002,Mary Johnson,Bob Wilson,bob.wilson@example.com,Stage Design,No Workshop,Room 202,Leaves after slot 1`;
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Import Data</h1>
        <p className="text-gray-600">Upload a CSV, review every change, then apply it to the active event.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-start mb-4">
          <Upload className="text-primary mr-3 mt-1" size={24} />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">1. Upload CSV</h2>
            <p className="text-sm text-gray-600">Nothing is written until you confirm the preview.</p>
          </div>
        </div>

        <div className="space-y-4">
          <input
            id="csv-upload"
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            disabled={loading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark"
          />
          <div className="flex items-center gap-4">
            <button
              onClick={handlePreview}
              disabled={loading || !csvFile}
              className="flex items-center space-x-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && !preview ? <RefreshCw size={18} className="animate-spin" /> : <Upload size={18} />}
              <span>Preview changes</span>
            </button>
            <button onClick={downloadTemplate} className="flex items-center space-x-2 text-primary hover:text-primary-dark transition-colors">
              <Download size={18} />
              <span className="text-sm font-medium">Download CSV template</span>
            </button>
          </div>
        </div>
      </div>

      {preview && (
        <PlanReview response={preview} loading={loading} onCommit={handleCommit} markMissing={markMissing} onMarkMissing={setMarkMissing} />
      )}

      {result && <AppliedResult response={result} />}

      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">How re-imports behave</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-4">
          <li>Students are matched by <code className="bg-gray-100 px-1 rounded">registration_id</code> within the active event. Matching students are updated field by field; new ones are added.</li>
          <li>Students in the database but not in the CSV are <strong>listed, never deleted</strong>. Tick the box in the preview to mark them <strong>not attending</strong>: they leave expected counts and emails, and their badges still scan.</li>
          <li>Workshops are matched by name and slot ignoring case and extra spaces. Existing rooms are never blanked; a room in the CSV only applies if it is non-empty.</li>
          <li>A blank workshop cell keeps the student&apos;s current assignment. Write <code className="bg-gray-100 px-1 rounded">No Workshop</code> to clear it.</li>
          <li>Attendance is never touched. Imports are refused while the event is locked.</li>
          <li>Accepted headers: <code className="bg-gray-100 px-1 rounded">Registrant ID</code>, <code className="bg-gray-100 px-1 rounded">Name (First Name)</code>/<code className="bg-gray-100 px-1 rounded">Name (Last Name)</code>, <code className="bg-gray-100 px-1 rounded">Contact Email</code>, <code className="bg-gray-100 px-1 rounded">Breakout Session I/II</code>, or the template&apos;s snake_case names.</li>
        </ul>
      </div>
    </div>
  );
}

function PlanReview({
  response,
  loading,
  onCommit,
  markMissing,
  onMarkMissing,
}: {
  response: ImportResponse;
  loading: boolean;
  onCommit: () => void;
  markMissing: boolean;
  onMarkMissing: (v: boolean) => void;
}) {
  const { plan, event } = response;
  const { summary } = plan;
  const changed = plan.students.filter((s) => s.action !== 'unchanged');
  const toMark = plan.missingFromCsv.filter((m) => !m.not_attending).length;
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">2. Review changes for {event.name}</h2>
          <p className="text-sm text-gray-600">{summary.rows} valid rows parsed.</p>
        </div>
        {event.locked ? (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-medium">
            <Lock size={16} /> Event locked. Imports disabled.
          </span>
        ) : (
          <button
            onClick={onCommit}
            disabled={loading}
            className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {loading ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle size={18} />}
            <span>Apply import</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="New students" value={summary.studentsCreate} tone="green" />
        <Stat label="Updated students" value={summary.studentsUpdate} tone="blue" />
        <Stat label="Unchanged" value={summary.studentsUnchanged} tone="gray" />
        <Stat label={markMissing ? 'Not in CSV (mark not attending)' : 'Not in CSV (kept)'} value={summary.missingFromCsv} tone="yellow" />
        <Stat label="New workshops" value={summary.workshopsCreate} tone="green" />
        <Stat label="Matched workshops" value={summary.workshopsMatch} tone="gray" />
        <Stat label="Room updates" value={summary.roomUpdates} tone="blue" />
        <Stat label="Skipped rows" value={plan.errors.length} tone={plan.errors.length ? 'red' : 'gray'} />
      </div>

      {plan.warnings.length > 0 && (
        <Callout tone="yellow" icon={<ShieldAlert size={18} />} title="Warnings">
          <ul className="list-disc list-inside space-y-1">
            {plan.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Callout>
      )}

      {plan.errors.length > 0 && (
        <Callout tone="red" icon={<AlertCircle size={18} />} title="Rows that will be skipped">
          <ul className="list-disc list-inside space-y-1">
            {plan.errors.map((e, i) => (
              <li key={i}>
                Line {e.line}
                {e.registration_id ? ` (${e.registration_id})` : ''}: {e.message}
              </li>
            ))}
          </ul>
        </Callout>
      )}

      {plan.workshops.some((w) => w.action !== 'match') && (
        <Section title="Workshops to create or update">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Slot</th>
                <th className="py-2 pr-4">Workshop</th>
                <th className="py-2 pr-4">Room</th>
                <th className="py-2 pr-4">Students</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {plan.workshops
                .filter((w) => w.action !== 'match')
                .map((w) => (
                  <WorkshopRow key={w.key} w={w} />
                ))}
            </tbody>
          </table>
        </Section>
      )}

      {changed.length > 0 && (
        <Section title={`Student changes (${changed.length})`}>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">Registration ID</th>
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {changed.map((s) => (
                <StudentRow key={s.registration_id} s={s} />
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {summary.missingFromCsv > 0 && (
        <Section
          title={`Existing students not in this CSV (${summary.missingFromCsv}) — ${markMissing ? 'will be marked not attending' : 'kept as-is'}`}
          toggle={{ open: showMissing, onToggle: () => setShowMissing(!showMissing), labels: ['Show names', 'Hide names'] }}
        >
          {!event.locked && (
            <label className="flex items-start gap-2 text-sm text-gray-800 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={markMissing}
                disabled={loading || toMark === 0}
                onChange={(e) => onMarkMissing(e.target.checked)}
              />
              <span>
                <span className="font-medium">
                  Mark {toMark === 1 ? 'this 1 student' : `these ${toMark} students`} as not attending
                </span>
                {summary.missingFromCsv - toMark > 0 && (
                  <span className="text-gray-600"> ({summary.missingFromCsv - toMark} already marked)</span>
                )}
                <span className="block text-xs text-gray-600">
                  They are not deleted: they drop out of expected counts and supervisor emails, and their badges still scan if
                  they turn up. A later CSV that lists them again marks them attending.
                </span>
              </span>
            </label>
          )}
          {showMissing && (
            <ul className="text-sm text-gray-700 columns-2 md:columns-3">
              {plan.missingFromCsv.map((m) => (
                <li key={m.id}>
                  {m.student_name} <span className="text-gray-400">({m.registration_id})</span>
                  {m.not_attending && <span className="text-yellow-700"> · already not attending</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {summary.studentsUnchanged > 0 && (
        <Section
          title={`Unchanged students (${summary.studentsUnchanged})`}
          toggle={{ open: showUnchanged, onToggle: () => setShowUnchanged(!showUnchanged) }}
        >
          {showUnchanged && (
            <ul className="text-sm text-gray-700 columns-2 md:columns-3">
              {plan.students
                .filter((s) => s.action === 'unchanged')
                .map((s) => (
                  <li key={s.registration_id}>
                    {s.student_name} <span className="text-gray-400">({s.registration_id})</span>
                  </li>
                ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}

function AppliedResult({ response }: { response: ImportResponse }) {
  const a = response.applied!;
  const ok = a.failures.length === 0;
  return (
    <Callout tone={ok ? 'green' : 'yellow'} icon={ok ? <CheckCircle size={18} /> : <AlertCircle size={18} />} title={`Import applied to ${response.event.name}`}>
      <ul className="space-y-1">
        <li>{a.studentsCreated} students created</li>
        <li>{a.studentsUpdated} students updated</li>
        <li>{a.workshopsCreated} workshops created</li>
        <li>{a.roomsUpdated} rooms updated</li>
        {a.markedNotAttending > 0 && <li>{a.markedNotAttending} students marked not attending</li>}
      </ul>
      {a.failures.length > 0 && (
        <div className="mt-3">
          <p className="font-medium">Failures</p>
          <ul className="list-disc list-inside">
            {a.failures.map((f, i) => (
              <li key={i}>
                {f.registration_id || f.workshop || 'General'}: {f.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Callout>
  );
}

function WorkshopRow({ w }: { w: WorkshopPlanItem }) {
  return (
    <tr>
      <td className="py-2 pr-4">
        <Badge tone={w.action === 'create' ? 'green' : 'blue'}>{w.action === 'create' ? 'Create' : 'Update room'}</Badge>
      </td>
      <td className="py-2 pr-4">{w.time_slot}</td>
      <td className="py-2 pr-4 font-medium text-gray-900">{w.name}</td>
      <td className="py-2 pr-4 text-gray-700">
        {w.action === 'update_room' ? (
          <>
            <span className="line-through text-gray-400">{w.room_before || '—'}</span> → {w.room_after}
          </>
        ) : (
          w.room_after || '—'
        )}
      </td>
      <td className="py-2 pr-4">{w.student_count}</td>
    </tr>
  );
}

function StudentRow({ s }: { s: StudentPlanItem }) {
  return (
    <tr>
      <td className="py-2 pr-4 align-top">
        <Badge tone={s.action === 'create' ? 'green' : 'blue'}>{s.action === 'create' ? 'Create' : 'Update'}</Badge>
      </td>
      <td className="py-2 pr-4 align-top">{s.registration_id}</td>
      <td className="py-2 pr-4 align-top font-medium text-gray-900">{s.student_name}</td>
      <td className="py-2 pr-4 text-gray-700">
        {s.action === 'create' ? (
          <span className="text-gray-500">
            {s.values.supervisor_email}
            {s.values.workshop_slot1.workshopKey ? ` · S1: ${s.values.workshop_slot1.workshopKey.split('|')[1]}` : ''}
            {s.values.workshop_slot2.workshopKey ? ` · S2: ${s.values.workshop_slot2.workshopKey.split('|')[1]}` : ''}
          </span>
        ) : (
          <ul className="space-y-0.5">
            {s.changes.map((c) => (
              <li key={c.field}>
                <span className="text-gray-500">{c.field}:</span> <span className="line-through text-gray-400">{c.before ?? '—'}</span> → {c.after ?? '—'}
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}

const tones = {
  green: 'bg-green-50 text-green-800 border-green-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200',
  gray: 'bg-gray-50 text-gray-700 border-gray-200',
  yellow: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  red: 'bg-red-50 text-red-800 border-red-200',
} as const;
type Tone = keyof typeof tones;

function Stat({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${tones[tone]}`}>{children}</span>;
}

function Callout({ tone, icon, title, children }: { tone: Tone; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg border p-4 mb-4 text-sm ${tones[tone]}`}>
      <div className="flex items-center gap-2 font-medium mb-2">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Section({ title, toggle, children }: { title: string; toggle?: { open: boolean; onToggle: () => void; labels?: [string, string] }; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {toggle && (
          <button onClick={toggle.onToggle} className="text-sm text-primary hover:underline">
            {toggle.open ? (toggle.labels?.[1] ?? 'Hide') : (toggle.labels?.[0] ?? 'Show')}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
