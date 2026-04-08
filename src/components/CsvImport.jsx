import React, { useState, useRef } from 'react';
import { parseCSV } from '../utils/csv-parser';

export default function CsvImport({ onProductsReady }) {
  const [parsed, setParsed] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = parseCSV(e.target.result);
      setParsed(result);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleAdd = () => {
    if (parsed && parsed.products.length > 0) {
      onProductsReady(parsed.products);
    }
  };

  return (
    <div className="csv-import">
      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current.click()}
      >
        <span className="drop-icon">&#128196;</span>
        <span className="drop-text">Drop a CSV file here or click to browse</span>
        <span className="drop-hint">Format: name, price, description (optional)</span>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.tsv"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {parsed && (
        <div className="csv-results">
          {parsed.errors.length > 0 && (
            <div className="csv-errors">
              <h4>Warnings ({parsed.errors.length})</h4>
              <ul>
                {parsed.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {parsed.errors.length > 5 && (
                  <li>...and {parsed.errors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

          {parsed.products.length > 0 && (
            <>
              <div className="csv-preview">
                <h4>Preview ({parsed.products.length} products)</h4>
                <div className="preview-table">
                  <div className="preview-header">
                    <span>Name</span>
                    <span>Price</span>
                    <span>Description</span>
                  </div>
                  {parsed.products.slice(0, 10).map((p, i) => (
                    <div key={i} className="preview-row">
                      <span>{p.name}</span>
                      <span>{p.price}</span>
                      <span>{p.description || '-'}</span>
                    </div>
                  ))}
                  {parsed.products.length > 10 && (
                    <div className="preview-row more">
                      ...and {parsed.products.length - 10} more
                    </div>
                  )}
                </div>
              </div>

              <button className="btn btn-primary btn-lg" onClick={handleAdd}>
                Add {parsed.products.length} Product{parsed.products.length !== 1 ? 's' : ''} to Queue
              </button>
            </>
          )}

          <button className="btn btn-secondary" onClick={() => setParsed(null)}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
