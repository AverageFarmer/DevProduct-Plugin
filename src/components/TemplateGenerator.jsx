import React, { useState, useMemo, useEffect } from 'react';
import ImagePicker from './ImagePicker';

export default function TemplateGenerator({ onProductsReady }) {
  const [template, setTemplate] = useState('{n} Coins');
  const [rangeStart, setRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState('10');
  const [priceMode, setPriceMode] = useState('fixed'); // fixed | increment | multiply | manual
  const [basePrice, setBasePrice] = useState('25');
  const [priceStep, setPriceStep] = useState('25');
  const [description, setDescription] = useState('');
  const [imagePath, setImagePath] = useState(null);
  const [manualPrices, setManualPrices] = useState({});

  // Generate product names from the template + range
  const generatedNames = useMemo(() => {
    const start = parseInt(rangeStart, 10);
    const end = parseInt(rangeEnd, 10);
    if (isNaN(start) || isNaN(end) || start > end) return [];

    const names = [];
    for (let n = start; n <= end && names.length <= 200; n++) {
      names.push({ n, name: template.replace(/\{n\}/g, String(n)) });
    }
    return names;
  }, [template, rangeStart, rangeEnd]);

  // Reset manual prices when range changes
  useEffect(() => {
    if (priceMode === 'manual') {
      setManualPrices((prev) => {
        const updated = {};
        generatedNames.forEach(({ n }) => {
          updated[n] = prev[n] || '';
        });
        return updated;
      });
    }
  }, [generatedNames.length, priceMode]);

  const updateManualPrice = (n, value) => {
    setManualPrices((prev) => ({ ...prev, [n]: value }));
  };

  const preview = useMemo(() => {
    const start = parseInt(rangeStart, 10);
    const end = parseInt(rangeEnd, 10);
    const base = parseInt(basePrice, 10);
    const step = parseInt(priceStep, 10);

    if (isNaN(start) || isNaN(end) || start > end) return [];
    if (priceMode !== 'manual' && (isNaN(base) || base <= 0)) return [];

    const products = [];
    for (let n = start; n <= end && products.length <= 200; n++) {
      let price;
      if (priceMode === 'fixed') {
        price = base;
      } else if (priceMode === 'increment') {
        price = base + (n - start) * (isNaN(step) ? 0 : step);
      } else if (priceMode === 'multiply') {
        price = base * n;
      } else {
        // manual
        const mp = parseInt(manualPrices[n], 10);
        if (isNaN(mp) || mp <= 0) continue; // skip entries without a valid price
        price = mp;
      }

      products.push({
        name: template.replace(/\{n\}/g, String(n)),
        price: Math.max(1, Math.round(price)),
        description: description
          ? description.replace(/\{n\}/g, String(n))
          : undefined,
        imagePath: imagePath || undefined,
      });
    }

    return products;
  }, [template, rangeStart, rangeEnd, priceMode, basePrice, priceStep, description, manualPrices, imagePath]);

  const handleAdd = () => {
    if (preview.length > 0) {
      onProductsReady(preview);
    }
  };

  return (
    <div className="template-gen">
      <div className="template-config">
        <div className="config-row">
          <div className="config-group" style={{ flex: 1 }}>
            <label>Name Template</label>
            <input
              type="text"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="Use {n} for the number"
              className="input-full"
            />
            <span className="hint">Use <code>{'{n}'}</code> where the number should go</span>
          </div>
          <div className="config-group">
            <label>Product Image</label>
            <ImagePicker
              value={imagePath}
              onChange={setImagePath}
              compact
            />
          </div>
        </div>

        <div className="config-row">
          <div className="config-group">
            <label>Range Start</label>
            <input
              type="number"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              min="0"
            />
          </div>
          <div className="config-group">
            <label>Range End</label>
            <input
              type="number"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              min="0"
            />
          </div>
        </div>

        <div className="config-group">
          <label>Pricing Mode</label>
          <div className="radio-group">
            <label className={priceMode === 'fixed' ? 'active' : ''}>
              <input
                type="radio"
                name="priceMode"
                value="fixed"
                checked={priceMode === 'fixed'}
                onChange={() => setPriceMode('fixed')}
              />
              Fixed Price
            </label>
            <label className={priceMode === 'increment' ? 'active' : ''}>
              <input
                type="radio"
                name="priceMode"
                value="increment"
                checked={priceMode === 'increment'}
                onChange={() => setPriceMode('increment')}
              />
              Increment (+step)
            </label>
            <label className={priceMode === 'multiply' ? 'active' : ''}>
              <input
                type="radio"
                name="priceMode"
                value="multiply"
                checked={priceMode === 'multiply'}
                onChange={() => setPriceMode('multiply')}
              />
              Multiply (base x n)
            </label>
            <label className={priceMode === 'manual' ? 'active' : ''}>
              <input
                type="radio"
                name="priceMode"
                value="manual"
                checked={priceMode === 'manual'}
                onChange={() => setPriceMode('manual')}
              />
              Manual
            </label>
          </div>
        </div>

        {priceMode !== 'manual' && (
          <div className="config-row">
            <div className="config-group">
              <label>Base Price (Robux)</label>
              <input
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                min="1"
              />
            </div>
            {priceMode === 'increment' && (
              <div className="config-group">
                <label>Price Step</label>
                <input
                  type="number"
                  value={priceStep}
                  onChange={(e) => setPriceStep(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <div className="config-group">
          <label>Description Template (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Purchase {n} coins"
            className="input-full"
          />
        </div>
      </div>

      {priceMode === 'manual' && generatedNames.length > 0 && (
        <div className="manual-prices">
          <h4>Set Prices</h4>
          <div className="manual-prices-table">
            <div className="manual-prices-header">
              <span>Name</span>
              <span>Price (Robux)</span>
            </div>
            {generatedNames.map(({ n, name }) => (
              <div key={n} className="manual-prices-row">
                <span>{name}</span>
                <input
                  type="number"
                  min="1"
                  value={manualPrices[n] || ''}
                  onChange={(e) => updateManualPrice(n, e.target.value)}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {priceMode !== 'manual' && preview.length > 0 && (
        <div className="template-preview">
          <h4>Preview ({preview.length} products)</h4>
          <div className="preview-table">
            <div className="preview-header">
              <span>Name</span>
              <span>Price</span>
            </div>
            {preview.slice(0, 8).map((p, i) => (
              <div key={i} className="preview-row">
                <span>{p.name}</span>
                <span>R$ {p.price}</span>
              </div>
            ))}
            {preview.length > 8 && (
              <div className="preview-row more">
                ...and {preview.length - 8} more
              </div>
            )}
          </div>
        </div>
      )}

      <button
        className="btn btn-primary btn-lg"
        onClick={handleAdd}
        disabled={preview.length === 0}
      >
        Add {preview.length} Product{preview.length !== 1 ? 's' : ''} to Queue
      </button>
    </div>
  );
}
