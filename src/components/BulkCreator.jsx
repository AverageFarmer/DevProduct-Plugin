import React, { useState } from 'react';
import ManualEntry from './ManualEntry';
import CsvImport from './CsvImport';
import TemplateGenerator from './TemplateGenerator';
import ProgressModal from './ProgressModal';

const TABS = [
  { id: 'manual', label: 'Manual Entry' },
  { id: 'csv', label: 'CSV Import' },
  { id: 'template', label: 'Template Generator' },
];

export default function BulkCreator({ universeId }) {
  const [activeTab, setActiveTab] = useState('manual');
  const [queue, setQueue] = useState([]);
  const [showProgress, setShowProgress] = useState(false);

  const addToQueue = (products) => {
    setQueue((prev) => [...prev, ...products]);
  };

  const removeFromQueue = (index) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const clearQueue = () => setQueue([]);

  return (
    <div className="bulk-creator">
      <div className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'manual' && <ManualEntry onProductsReady={addToQueue} />}
        {activeTab === 'csv' && <CsvImport onProductsReady={addToQueue} />}
        {activeTab === 'template' && <TemplateGenerator onProductsReady={addToQueue} />}
      </div>

      {queue.length > 0 && (
        <div className="queue-panel">
          <div className="queue-header">
            <h3>Creation Queue ({queue.length} product{queue.length !== 1 ? 's' : ''})</h3>
            <button className="btn btn-small btn-secondary" onClick={clearQueue}>Clear All</button>
          </div>
          <div className="queue-list">
            {queue.map((p, i) => (
              <div key={i} className="queue-item">
                <span className="queue-name">{p.name}</span>
                <span className="queue-price">R$ {p.price}</span>
                <button className="btn-icon" onClick={() => removeFromQueue(i)}>x</button>
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => setShowProgress(true)}
          >
            Create All ({queue.length})
          </button>
        </div>
      )}

      {showProgress && (
        <ProgressModal
          products={queue}
          universeId={universeId}
          onClose={() => setShowProgress(false)}
          onComplete={() => {
            setQueue([]);
            setShowProgress(false);
          }}
        />
      )}
    </div>
  );
}
