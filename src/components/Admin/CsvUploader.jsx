import React, { useState } from 'react';

const TARGET_OPTIONS = [
  { value: 'route_deaths', label: 'Route Deaths' },
  { value: 'war_events', label: 'War Events' },
  { value: 'asy_applications', label: 'Asylum Applications' },
];

function CsvUploader({ token }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [target, setTarget] = useState('route_deaths');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const handlePreview = async () => {
    if (!file) return;
    setStatus('previewing');
    setMessage('');
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/admin/csv/preview', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Preview failed' }));
        throw new Error(err.error || 'Preview failed');
      }
      const data = await res.json();
      setPreview(data);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setStatus('committing');
    setMessage('');
    try {
      const res = await fetch('/admin/csv/commit', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rows: preview.rows, target }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Commit failed' }));
        throw new Error(err.error || 'Commit failed');
      }
      const data = await res.json();
      setStatus('done');
      setMessage(`Inserted ${data.inserted} rows`);
      setPreview(null);
      setFile(null);
    } catch (err) {
      setStatus('error');
      setMessage(`Error: ${err.message}`);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setFile(null);
    setStatus('idle');
    setMessage('');
  };

  const columns = preview && preview.rows && preview.rows.length > 0
    ? Object.keys(preview.rows[0])
    : [];
  const displayRows = preview ? preview.rows.slice(0, 20) : [];
  const extraRows = preview ? Math.max(0, preview.rows.length - 20) : 0;

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="file"
          accept=".csv"
          onChange={e => { setFile(e.target.files[0] || null); setPreview(null); setMessage(''); }}
          style={{ color: '#fff' }}
        />
        <select
          value={target}
          onChange={e => setTarget(e.target.value)}
          style={{ padding: '8px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px' }}
        >
          {TARGET_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={handlePreview}
          disabled={!file || status === 'previewing'}
          style={{ padding: '8px 16px', background: '#4a7cf7', color: '#fff', border: 'none', borderRadius: '4px', cursor: file && status !== 'previewing' ? 'pointer' : 'not-allowed', opacity: !file || status === 'previewing' ? 0.5 : 1 }}
        >
          {status === 'previewing' ? 'Loading...' : 'Preview'}
        </button>
      </div>

      {message && (
        <p style={{ color: status === 'error' ? 'red' : '#4caf50', marginBottom: '12px', fontWeight: 'bold' }}>
          {message}
        </p>
      )}

      {preview && (
        <div>
          <p style={{ color: '#ccc', marginBottom: '8px' }}>Parsed {preview.count} rows</p>
          <div style={{ overflowX: 'auto', marginBottom: '12px', maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th
                      key={col}
                      style={{ background: '#333', color: '#fff', padding: '6px 10px', border: '1px solid #555', textAlign: 'left', whiteSpace: 'nowrap' }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#1e1e1e' : '#252525' }}>
                    {columns.map(col => (
                      <td
                        key={col}
                        style={{ padding: '5px 10px', border: '1px solid #444', color: '#ddd', whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {extraRows > 0 && (
            <p style={{ color: '#888', marginBottom: '12px', fontSize: '13px' }}>...and {extraRows} more rows</p>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleCommit}
              disabled={status === 'committing'}
              style={{ padding: '8px 20px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: status !== 'committing' ? 'pointer' : 'not-allowed', opacity: status === 'committing' ? 0.5 : 1 }}
            >
              {status === 'committing' ? 'Committing...' : `Commit to ${target}`}
            </button>
            <button
              onClick={handleCancel}
              style={{ padding: '8px 20px', background: '#666', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CsvUploader;
