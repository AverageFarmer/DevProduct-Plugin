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

export default function BulkGamepassCreator({ universeId, externalQueue, onExternalQueueConsumed }) {
  const [activeTab, setActiveTab] = useState('manual');
  const [queue, setQueue] = useState([]);
  const [showProgress, setShowProgress] = useState(false);
  const [defaultImage, setDefaultImage] = useState(null);

  useEffect(() => {
    if (externalQueue && externalQueue.length > 0) {
      setQueue((prev) => [...prev, ...externalQueue]);
      if (onExternalQueueConsumed) onExternalQueueConsumed();
    }
  }, [externalQueue]);

  useEffect(() => {
    const cleanup = window.api.onExternalGamepassCreateDone(() => {
      setQueue([]);
    });
    return cleanup;
  }, []);

  const addToQueue = (gamepasses) => {
    const withImages = gamepasses.map((g) => ({
      ...g,
      imagePath: g.imagePath || defaultImage,
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
          label="Default Icon"
          value={defaultImage}
          onChange={setDefaultImage}
          compact
        />
        <span className="hint">Applied to all gamepasses without their own icon. Icon is optional — gamepasses can be published without one.</span>
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
        {activeTab === 'manual' && (
          <ManualEntry
            onProductsReady={addToQueue}
            itemLabel="gamepass"
            requirePrice={false}
          />
        )}
        {activeTab === 'csv' && <CsvImport onProductsReady={addToQueue} />}
        {activeTab === 'template' && <TemplateGenerator onProductsReady={addToQueue} />}
      </div>

      {queue.length > 0 && (
        <div className="queue-panel">
          <div className="queue-header">
            <h3>Creation Queue ({queue.length} gamepass{queue.length !== 1 ? 'es' : ''})</h3>
            <button className="btn btn-small btn-secondary" onClick={clearQueue}>Clear All</button>
          </div>
          <div className="queue-list">
            {queue.map((g, i) => (
              <div key={i} className="queue-item">
                {g.imagePath && <img src={'file:///' + g.imagePath.replace(/\\/g, '/')} className="queue-thumb" alt="" />}
                <span className="queue-name">{g.name}</span>
                <span className="queue-price">{g.price ? `R$ ${g.price}` : 'unpublished'}</span>
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
          mode="gamepasses"
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
