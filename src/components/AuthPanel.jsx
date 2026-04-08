import React, { useState, useEffect } from 'react';

export default function AuthPanel({ onAuthenticated }) {
  const [cookie, setCookie] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  // Try auto-login on mount
  useEffect(() => {
    (async () => {
      const result = await window.api.tryAutoLogin();
      if (result.success) {
        setUser(result);
        onAuthenticated(result);
      }
      setLoading(false);
    })();
  }, []);

  const handleValidate = async () => {
    if (!cookie.trim()) return;
    setLoading(true);
    setError('');

    const result = await window.api.validateCookie(cookie.trim());

    if (result.success) {
      setUser(result);
      onAuthenticated(result);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await window.api.logout();
    setCookie('');
    setUser(null);
    setError('');
    onAuthenticated(null);
  };

  if (loading && !user) {
    return (
      <div className="auth-panel">
        <span className="auth-label">Logging in...</span>
      </div>
    );
  }

  if (user) {
    return (
      <div className="auth-panel authenticated">
        <div className="auth-status">
          <div className="auth-avatar">
            <img
              src={`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.userId}&size=100x100&format=Png`}
              alt=""
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <div className="auth-info">
            <span className="auth-label">Logged in as</span>
            <span className="auth-username">{user.displayName}</span>
            <span className="auth-subtext">@{user.username}</span>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  return (
    <div className="auth-panel">
      <h2>Authentication</h2>
      <p className="auth-desc">
        Paste your <code>.ROBLOSECURITY</code> cookie to get started.
        Your session is encrypted and saved locally.
      </p>
      <div className="input-group">
        <input
          type="password"
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          placeholder="Paste .ROBLOSECURITY cookie here..."
          className="input-full"
          onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
        />
      </div>
      {error && <div className="error-msg">{error}</div>}
      <button
        className="btn btn-primary"
        onClick={handleValidate}
        disabled={loading || !cookie.trim()}
      >
        {loading ? 'Validating...' : 'Validate Cookie'}
      </button>
    </div>
  );
}
