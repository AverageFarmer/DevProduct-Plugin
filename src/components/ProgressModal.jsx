import React, { useState, useEffect } from 'react';

export default function ProgressModal({ products, universeId, onClose, onComplete, mode = 'products' }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState([]);

  const isGamepass = mode === 'gamepasses';
  const itemLabel = isGamepass ? 'gamepass' : 'developer product';

  useEffect(() => {
    const subscribe = isGamepass ? window.api.onBulkGamepassProgress : window.api.onBulkProgress;
    const cleanup = subscribe((prog) => {
      setProgress(prog);
      setResults(prog.results || []);

      if (prog.current === prog.total || prog.status === 'cancelled') {
        setRunning(false);
        setDone(true);
      }
    });

    return cleanup;
  }, [isGamepass]);

  const handleStart = async () => {
    setRunning(true);
    setDone(false);
    setResults([]);
    if (isGamepass) {
      await window.api.bulkCreateGamepasses(universeId, products);
    } else {
      await window.api.bulkCreate(universeId, products);
    }
    setDone(true);
    setRunning(false);
  };

  const handleCancel = () => {
    if (isGamepass) {
      window.api.cancelBulkGamepasses();
    } else {
      window.api.cancelBulk();
    }
  };

  const handleDone = () => {
    if (onComplete) onComplete();
    onClose();
  };

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2>{done ? 'Complete' : running ? `Creating ${isGamepass ? 'Gamepasses' : 'Products'}...` : 'Ready to Create'}</h2>
          {!running && <button className="btn-icon" onClick={onClose}>x</button>}
        </div>

        {!running && !done && (
          <div className="modal-body">
            <p>Ready to create <strong>{products.length}</strong> {itemLabel}{products.length !== 1 ? 's' : ''}.</p>
            <p className="hint">Estimated time: ~{Math.ceil(products.length * 0.4)} seconds</p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleStart}>Start Creating</button>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}

        {running && progress && (
          <div className="modal-body">
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${pct}%` }} />
              <span className="progress-text">{progress.current} / {progress.total} ({pct}%)</span>
            </div>
            {progress.lastProduct && (
              <p className="progress-last">
                {progress.status === 'success' ? '  ' : '  '}
                {progress.lastProduct}
                {progress.lastError && <span className="error-inline"> - {progress.lastError}</span>}
              </p>
            )}
            <button className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
          </div>
        )}

        {done && (
          <div className="modal-body">
            <div className="results-summary">
              <div className="result-stat success">
                <span className="stat-num">{successCount}</span>
                <span className="stat-label">Created</span>
              </div>
              <div className="result-stat fail">
                <span className="stat-num">{failCount}</span>
                <span className="stat-label">Failed</span>
              </div>
            </div>

            {failCount > 0 && (
              <div className="results-log">
                <h4>Failed {isGamepass ? 'Gamepasses' : 'Products'}:</h4>
                {results.filter((r) => !r.success).map((r, i) => (
                  <div key={i} className="log-entry error">
                    <span>{r.name}</span>
                    <span>{r.error}</span>
                  </div>
                ))}
              </div>
            )}

            <button className="btn btn-primary" onClick={handleDone}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
