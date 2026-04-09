import React, { useState, useEffect } from 'react';
import ManualEntry from './ManualEntry';
import CsvImport from './CsvImport';
import TemplateGenerator from './TemplateGenerator';
import ProgressModal from './ProgressModal';
import ImagePicker from './ImagePicker';

const TABS = [
  { id: 'manual', label: 'Manual Entry' },
  { id: 'csv', label: 'CSV Import' },
  { id: 'template', label: 'Template Generator' },
];

export default function BulkCreator({ universeId, externalQueue, onExternalQueueConsumed }) {
  const [activeTab, setActiveTab] = useState('manual');
  const [queue, setQueue] = useState([]);
  const [showProgress, setShowProgress] = useState(false);
  const [defaultImage, setDefaultImage] = useState(null);

  // Handle products pushed from MCP server
  useEffect(() => {
    if (externalQueue && externalQueue.length > 0) {
      setQueue((prev) => [...prev, ...externalQueue]);
      if (onExternalQueueConsumed) onExternalQueueConsumed();
    }
  }, [externalQueue]);

  // Clear queue when MCP creation finishes
  useEffect(() => {
    const cleanup = window.api.onExternalCreateDone(() => {
      setQueue([]);
    });
    return cleanup;
  }, []);

  const addToQueue = (products) => {
    // Apply default image to products that don't have their own
    const withImages = products.map((p) => ({
      ...p,
      imagePath: p.imagePath || defaultImage,
    }));
    setQueue((prev) => [...prev, ...withImages]);
  };

  const removeFromQueue = (index) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const clearQueue = () => setQueue([]);

  return (
    <div className="bulk-creator">
      <div className="default-image-bar">
        <ImagePicker
          label="Default Image"
          value={defaultImage}
          onChange={setDefaultImage}
          compact
        />
        <span className="hint">Applied to all products without their own image</span>
      </div>

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
                {p.imagePath && <img src={'file:///' + p.imagePath.replace(/\\/g, '/')} className="queue-thumb" alt="" />}
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
