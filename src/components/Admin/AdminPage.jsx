import React, { useState } from 'react';
import LoginForm from './LoginForm';
import CsvUploader from './CsvUploader';

function AdminPage() {
  const [token, setToken] = useState(null);
  const [authError, setAuthError] = useState('');

  const handleLogin = async (secret, setError) => {
    // Test auth by sending a POST to /admin/csv/preview with no file.
    // 400 (missing file) means auth passed. 401 means wrong secret.
    try {
      const res = await fetch('/admin/csv/preview', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (res.status === 401) {
        if (setError) setError('Invalid admin secret');
        setAuthError('Invalid admin secret');
        return;
      }
      // 400 = missing file = auth passed
      setToken(secret);
      setAuthError('');
    } catch (err) {
      const msg = 'Network error — could not reach server';
      if (setError) setError(msg);
      setAuthError(msg);
    }
  };

  if (!token) {
    return (
      <div style={{ background: '#111', minHeight: '100vh', padding: '20px' }}>
        <LoginForm onLogin={handleLogin} />
        {authError && !token && (
          <p style={{ color: 'red', textAlign: 'center' }}>{authError}</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: '#111', minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h1 style={{ color: '#fff', marginBottom: '8px' }}>Admin Panel</h1>
        <p style={{ color: '#888', marginBottom: '32px', fontSize: '14px' }}>
          Upload CSV data to the database. Select the target table, preview the parsed rows, then commit.
        </p>
        <CsvUploader token={token} />
      </div>
    </div>
  );
}

export default AdminPage;
