import React, { useState } from 'react';

function LoginForm({ onLogin }) {
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    onLogin(secret, setError);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <form
        onSubmit={handleSubmit}
        style={{ maxWidth: '400px', width: '100%', padding: '20px', border: '1px solid #444', borderRadius: '8px', background: '#1a1a1a' }}
      >
        <h2 style={{ marginBottom: '16px', color: '#fff' }}>Admin Login</h2>
        <input
          type="password"
          placeholder="Enter admin secret"
          value={secret}
          onChange={e => setSecret(e.target.value)}
          style={{ width: '100%', padding: '10px', marginBottom: '12px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', boxSizing: 'border-box' }}
        />
        <button
          type="submit"
          style={{ width: '100%', padding: '10px', background: '#4a7cf7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}
        >
          Login
        </button>
        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
      </form>
    </div>
  );
}

export default LoginForm;
