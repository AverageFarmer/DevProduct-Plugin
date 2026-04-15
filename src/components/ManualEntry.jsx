import React, { useState } from 'react';
import ImagePicker from './ImagePicker';

const emptyRow = () => ({ name: '', price: '', description: '', imagePath: null, id: Date.now() + Math.random() });

export default function ManualEntry({ onProductsReady, itemLabel = 'product', requirePrice = true }) {
  const [rows, setRows] = useState([emptyRow(), emptyRow(), emptyRow()]);
  const plural = itemLabel === 'gamepass' ? 'gamepasses' : `${itemLabel}s`;

  const updateRow = (index, field, value) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  };

  const addRows = (count) => {
    const newRows = Array.from({ length: count }, () => emptyRow());
    setRows([...rows, ...newRows]);
  };

  const removeRow = (index) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const getValidProducts = () => {
    return rows
      .filter((r) => {
        if (!r.name.trim()) return false;
        if (requirePrice) {
          return r.price && !isNaN(r.price) && Number(r.price) > 0;
        }
        // Gamepasses: price is optional, but if provided must be a valid number
        if (r.price && (isNaN(r.price) || Number(r.price) < 0)) return false;
        return true;
      })
      .map((r) => ({
        name: r.name.trim(),
        price: r.price ? parseInt(r.price, 10) : undefined,
        description: r.description.trim() || undefined,
        imagePath: r.imagePath || undefined,
      }));
  };

  const validCount = getValidProducts().length;

  const handleAdd = () => {
    onProductsReady(getValidProducts());
  };

  return (
    <div className="manual-entry">
      <div className="entry-header">
        <span className="entry-count">{validCount} valid {validCount === 1 ? itemLabel : plural}</span>
        <div className="entry-actions">
          <button className="btn btn-small" onClick={() => addRows(1)}>+ Add Row</button>
          <button className="btn btn-small" onClick={() => addRows(10)}>+ Add 10</button>
        </div>
      </div>

      <div className="entry-table">
        <div className="entry-table-header">
          <span className="col-img">Image</span>
          <span className="col-num">#</span>
          <span className="col-name">Name</span>
          <span className="col-price">Price</span>
          <span className="col-desc">Description (optional)</span>
          <span className="col-action"></span>
        </div>
        <div className="entry-table-body">
          {rows.map((row, i) => (
            <div key={row.id} className="entry-row">
              <span className="col-img">
                <ImagePicker
                  value={row.imagePath}
                  onChange={(path) => updateRow(i, 'imagePath', path)}
                  compact
                />
              </span>
              <span className="col-num">{i + 1}</span>
              <input
                className="col-name"
                type="text"
                value={row.name}
                onChange={(e) => updateRow(i, 'name', e.target.value)}
                placeholder={`${itemLabel[0].toUpperCase()}${itemLabel.slice(1)} name`}
              />
              <input
                className="col-price"
                type="number"
                min={requirePrice ? '1' : '0'}
                value={row.price}
                onChange={(e) => updateRow(i, 'price', e.target.value)}
                placeholder={requirePrice ? '0' : 'optional'}
              />
              <input
                className="col-desc"
                type="text"
                value={row.description}
                onChange={(e) => updateRow(i, 'description', e.target.value)}
                placeholder="Optional description"
              />
              <button
                className="col-action btn-icon"
                onClick={() => removeRow(i)}
                title="Remove row"
              >
                x
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        className="btn btn-primary btn-lg"
        onClick={handleAdd}
        disabled={validCount === 0}
      >
        Add {validCount} {validCount === 1 ? itemLabel[0].toUpperCase() + itemLabel.slice(1) : plural[0].toUpperCase() + plural.slice(1)} to Queue
      </button>
    </div>
  );
}
