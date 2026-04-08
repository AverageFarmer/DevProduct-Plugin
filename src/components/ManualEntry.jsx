import React, { useState } from 'react';
import ImagePicker from './ImagePicker';

const emptyRow = () => ({ name: '', price: '', description: '', imagePath: null, id: Date.now() + Math.random() });

export default function ManualEntry({ onProductsReady }) {
  const [rows, setRows] = useState([emptyRow(), emptyRow(), emptyRow()]);

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
      .filter((r) => r.name.trim() && r.price && !isNaN(r.price) && Number(r.price) > 0)
      .map((r) => ({
        name: r.name.trim(),
        price: parseInt(r.price, 10),
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
        <span className="entry-count">{validCount} valid product{validCount !== 1 ? 's' : ''}</span>
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
                placeholder="Product name"
              />
              <input
                className="col-price"
                type="number"
                min="1"
                value={row.price}
                onChange={(e) => updateRow(i, 'price', e.target.value)}
                placeholder="0"
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
        Add {validCount} Product{validCount !== 1 ? 's' : ''} to Queue
      </button>
    </div>
  );
}
