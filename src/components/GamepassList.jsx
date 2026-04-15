import React, { useState, useEffect, useCallback } from 'react';

export default function GamepassList({ universeId }) {
  const [gamepasses, setGamepasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nextPage, setNextPage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [showExtract, setShowExtract] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadGamepasses = useCallback(async (pageToken) => {
    setLoading(true);
    setError('');

    const result = await window.api.listGamepasses(universeId, pageToken);

    if (result.success) {
      if (pageToken) {
        setGamepasses((prev) => [...prev, ...result.gamepasses]);
      } else {
        setGamepasses(result.gamepasses);
      }
      setNextPage(result.nextPageToken);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [universeId]);

  useEffect(() => {
    loadGamepasses(null);
  }, [loadGamepasses]);

  const handleEdit = (gamepass) => {
    setEditingId(gamepass.gamepassId);
    setEditValues({
      name: gamepass.name,
      price: gamepass.price || 0,
      description: gamepass.description || '',
      isForSale: gamepass.isForSale,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const fields = {
      name: editValues.name,
      description: editValues.description,
    };
    if (editValues.price != null) fields.price = editValues.price;
    if (editValues.isForSale !== undefined) {
      fields.isForSale = editValues.isForSale ? 'true' : 'false';
    }

    const result = await window.api.updateGamepass(universeId, editingId, fields);

    if (result.success) {
      setGamepasses((prev) =>
        prev.map((g) =>
          g.gamepassId === editingId ? { ...g, ...editValues } : g
        )
      );
      setEditingId(null);
    } else {
      setError(result.error);
    }
    setSaving(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const filtered = gamepasses.filter((g) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      (g.name && g.name.toLowerCase().includes(q)) ||
      (g.gamepassId && String(g.gamepassId).includes(q))
    );
  });

  const extractText = `return {\n${gamepasses
    .map((g) => `\t["${g.name}"] = ${g.gamepassId},`)
    .join('\n')}\n}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(extractText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="product-list">
      <div className="list-header">
        <h2>Existing Gamepasses ({gamepasses.length})</h2>
        <div className="list-actions">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search gamepasses..."
            className="input-search"
          />
          <button
            className="btn btn-secondary"
            onClick={() => setShowExtract(!showExtract)}
            disabled={gamepasses.length === 0}
          >
            {showExtract ? 'Hide Extract' : 'Extract'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => loadGamepasses(null)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {showExtract && gamepasses.length > 0 && (
        <div className="extract-panel">
          <div className="extract-header">
            <span className="extract-title">Lua Table — {gamepasses.length} gamepasses</span>
            <button className="btn btn-small btn-primary" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="extract-code">{extractText}</pre>
        </div>
      )}

      <div className="products-table">
        <div className="products-header">
          <span className="pcol-id">Gamepass ID</span>
          <span className="pcol-name">Name</span>
          <span className="pcol-price">Price</span>
          <span className="pcol-desc">Description</span>
          <span className="pcol-actions">Actions</span>
        </div>

        <div className="products-body">
          {filtered.map((gamepass) => (
            <div key={gamepass.gamepassId} className="product-row">
              {editingId === gamepass.gamepassId ? (
                <>
                  <span className="pcol-id">{gamepass.gamepassId}</span>
                  <input
                    className="pcol-name"
                    value={editValues.name}
                    onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                  />
                  <input
                    className="pcol-price"
                    type="number"
                    min="0"
                    value={editValues.price}
                    onChange={(e) => setEditValues({ ...editValues, price: parseInt(e.target.value, 10) || 0 })}
                  />
                  <input
                    className="pcol-desc"
                    value={editValues.description}
                    onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                  />
                  <span className="pcol-actions">
                    <button className="btn btn-small btn-primary" onClick={handleSave} disabled={saving}>
                      {saving ? '...' : 'Save'}
                    </button>
                    <button className="btn btn-small btn-secondary" onClick={handleCancelEdit}>
                      Cancel
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <span className="pcol-id">{gamepass.gamepassId}</span>
                  <span className="pcol-name">{gamepass.name}</span>
                  <span className="pcol-price">
                    {gamepass.price != null ? `R$ ${gamepass.price}` : <span className="muted">unpublished</span>}
                  </span>
                  <span className="pcol-desc">{gamepass.description || '-'}</span>
                  <span className="pcol-actions">
                    <button className="btn btn-small" onClick={() => handleEdit(gamepass)}>
                      Edit
                    </button>
                  </span>
                </>
              )}
            </div>
          ))}

          {filtered.length === 0 && !loading && (
            <div className="empty-state">
              {filter ? 'No gamepasses match your search' : 'No gamepasses found'}
            </div>
          )}
        </div>
      </div>

      {loading && <div className="loading">Loading gamepasses...</div>}

      {nextPage && !loading && (
        <button
          className="btn btn-secondary load-more"
          onClick={() => loadGamepasses(nextPage)}
        >
          Load More
        </button>
      )}
    </div>
  );
}
