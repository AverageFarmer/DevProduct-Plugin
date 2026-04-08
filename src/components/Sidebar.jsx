import React, { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { id: 'create', label: 'Create Products', icon: '+' },
  { id: 'manage', label: 'Manage Products', icon: '=' },
];

export default function Sidebar({ activeTab, onTabChange, isReady }) {
  const [version, setVersion] = useState('');

  useEffect(() => {
    window.api.getAppVersion().then((v) => setVersion(v));
  }, []);

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <h1>DevProduct</h1>
        <span>Bulk Creator</span>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''} ${!isReady ? 'disabled' : ''}`}
            onClick={() => isReady && onTabChange(item.id)}
            disabled={!isReady}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="version">v{version}</span>
      </div>
    </div>
  );
}
