import React, { useState, useEffect, useCallback } from 'react';

export default function ProductList({ universeId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nextPage, setNextPage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [showExtract, setShowExtract] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadProducts = useCallback(async (pageToken) => {
    setLoading(true);
    setError('');

    const result = await window.api.listProducts(universeId, pageToken);

    if (result.success) {
      if (pageToken) {
        setProducts((prev) => [...prev, ...result.products]);
      } else {
        setProducts(result.products);
      }
      setNextPage(result.nextPageToken);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [universeId]);

  useEffect(() => {
    loadProducts(null);
  }, [loadProducts]);

  const handleEdit = (product) => {
    setEditingId(product.productId);
    setEditValues({
      name: product.name,
      price: product.price,
      description: product.description || '',
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await window.api.updateProduct(universeId, editingId, editValues);

    if (result.success) {
      setProducts((prev) =>
        prev.map((p) =>
          p.productId === editingId ? { ...p, ...editValues } : p
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

  const filtered = products.filter((p) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.productId && String(p.productId).includes(q))
    );
  });

  // Build the Lua-style extract table
  const extractText = `return {\n${products
    .map((p) => {
      return `\t["${p.name}"] = ${p.productId},`;
    })
    .join('\n')}\n}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(extractText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="product-list">
      <div className="list-header">
        <h2>Existing Products ({products.length})</h2>
        <div className="list-actions">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search products..."
            className="input-search"
          />
          <button
            className="btn btn-secondary"
            onClick={() => setShowExtract(!showExtract)}
            disabled={products.length === 0}
          >
            {showExtract ? 'Hide Extract' : 'Extract'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => loadProducts(null)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {showExtract && products.length > 0 && (
        <div className="extract-panel">
          <div className="extract-header">
            <span className="extract-title">Lua Table — {products.length} products</span>
            <button className="btn btn-small btn-primary" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="extract-code">{extractText}</pre>
        </div>
      )}

      <div className="products-table">
        <div className="products-header">
          <span className="pcol-id">Product ID</span>
          <span className="pcol-name">Name</span>
          <span className="pcol-price">Price</span>
          <span className="pcol-desc">Description</span>
          <span className="pcol-actions">Actions</span>
        </div>

        <div className="products-body">
          {filtered.map((product) => (
            <div key={product.productId} className="product-row">
              {editingId === product.productId ? (
                <>
                  <span className="pcol-id">{product.productId}</span>
                  <input
                    className="pcol-name"
                    value={editValues.name}
                    onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                  />
                  <input
                    className="pcol-price"
                    type="number"
                    min="1"
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
                  <span className="pcol-id">{product.productId}</span>
                  <span className="pcol-name">{product.name}</span>
                  <span className="pcol-price">R$ {product.price}</span>
                  <span className="pcol-desc">{product.description || '-'}</span>
                  <span className="pcol-actions">
                    <button className="btn btn-small" onClick={() => handleEdit(product)}>
                      Edit
                    </button>
                  </span>
                </>
              )}
            </div>
          ))}

          {filtered.length === 0 && !loading && (
            <div className="empty-state">
              {filter ? 'No products match your search' : 'No developer products found'}
            </div>
          )}
        </div>
      </div>

      {loading && <div className="loading">Loading products...</div>}

      {nextPage && !loading && (
        <button
          className="btn btn-secondary load-more"
          onClick={() => loadProducts(nextPage)}
        >
          Load More
        </button>
      )}
    </div>
  );
}
