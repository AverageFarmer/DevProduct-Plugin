import React, { useState, useEffect, useCallback } from 'react';

const NAV_ITEMS = [
  { id: 'create', label: 'Create Products', icon: '+' },
  { id: 'manage', label: 'Manage Products', icon: '=' },
];

export default function Sidebar({ activeTab, onTabChange, isReady }) {
  const [version, setVersion] = useState('');
  const [mcpStatus, setMcpStatus] = useState({ registered: false, healthy: false, issue: null });
  const [mcpBusy, setMcpBusy] = useState(false);
  const [mcpFlash, setMcpFlash] = useState(null);

  const refreshMcp = useCallback(async () => {
    const status = await window.api.checkMcpStatus();
    setMcpStatus(status);
    return status;
  }, []);

  useEffect(() => {
    window.api.getAppVersion().then((v) => setVersion(v));
    refreshMcp();

    // Re-check when the window regains focus — detects config drift after
    // Claude Desktop updates, manual edits, or app reinstalls.
    const onFocus = () => refreshMcp();
    window.addEventListener('focus', onFocus);

    // Also poll periodically so the indicator stays live.
    const interval = setInterval(refreshMcp, 30000);

    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [refreshMcp]);

  const handleReconnect = async () => {
    setMcpBusy(true);
    setMcpFlash(null);
    const result = await window.api.setupMcp();
    const status = await refreshMcp();
    setMcpBusy(false);

    if (result.success && status.healthy) {
      setMcpFlash({ type: 'success', text: 'MCP reconnected. Restart Claude Desktop to apply.' });
    } else {
      setMcpFlash({ type: 'error', text: result.error || status.issue || 'Reconnect failed.' });
    }
    setTimeout(() => setMcpFlash(null), 5000);
  };

  const renderMcpPanel = () => {
    if (!mcpStatus.registered) {
      return (
        <button className="btn btn-mcp" onClick={handleReconnect} disabled={mcpBusy}>
          {mcpBusy ? 'Setting up...' : 'Setup Claude MCP'}
        </button>
      );
    }

    if (!mcpStatus.healthy) {
      return (
        <>
          <div className="mcp-status broken" title={mcpStatus.issue || ''}>
            <span className="mcp-dot"></span>
            <span className="mcp-label">MCP needs reconnection</span>
          </div>
          {mcpStatus.issue && <div className="mcp-issue">{mcpStatus.issue}</div>}
          <button className="btn btn-mcp" onClick={handleReconnect} disabled={mcpBusy}>
            {mcpBusy ? 'Reconnecting...' : 'Reconnect MCP'}
          </button>
        </>
      );
    }

    return (
      <div className="mcp-status connected">
        <span className="mcp-dot"></span>
        <span className="mcp-label">MCP Connected</span>
        <button
          className="mcp-reconnect"
          onClick={handleReconnect}
          disabled={mcpBusy}
          title="Reconnect MCP"
          aria-label="Reconnect MCP"
        >
          {mcpBusy ? '...' : '\u21bb'}
        </button>
      </div>
    );
  };

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
        {renderMcpPanel()}
        {mcpFlash && (
          <div className={`mcp-flash ${mcpFlash.type}`}>{mcpFlash.text}</div>
        )}
        <span className="version">v{version}</span>
      </div>
    </div>
  );
}
