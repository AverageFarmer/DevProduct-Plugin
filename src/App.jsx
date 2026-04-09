import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import AuthPanel from './components/AuthPanel';
import PlaceSelector from './components/PlaceSelector';
import BulkCreator from './components/BulkCreator';
import ProductList from './components/ProductList';

export default function App() {
  const [user, setUser] = useState(null);
  const [place, setPlace] = useState(null);
  const [activeTab, setActiveTab] = useState('create');
  const [updateStatus, setUpdateStatus] = useState(null);
  const [externalQueue, setExternalQueue] = useState(null);

  useEffect(() => {
    const cleanups = [
      window.api.onUpdateStatus((status) => setUpdateStatus(status)),

      // External control from MCP server
      window.api.onExternalNavigate((tab) => setActiveTab(tab)),
      window.api.onExternalSetPlace((placeData) => {
        setPlace(placeData);
        // Also save to recent places
        window.api.savePlace(placeData);
      }),
      window.api.onExternalQueue((products) => {
        setActiveTab('create');
        setExternalQueue(products);
      }),
      window.api.onExternalAuthenticated((userData) => {
        setUser(userData);
      }),
    ];

    return () => cleanups.forEach((fn) => fn());
  }, []);

  // Clear external queue after BulkCreator picks it up
  const handleExternalQueueConsumed = () => setExternalQueue(null);

  const isReady = !!(user && place);

  return (
    <div className="app">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} isReady={isReady} />
      <main className="main-content">
        {updateStatus && (
          <div className="update-banner">
            {updateStatus.type === 'available' && (
              <>
                <span>Update v{updateStatus.version} is available!</span>
                <button className="btn btn-small btn-primary" onClick={() => window.api.downloadUpdate()}>
                  Download
                </button>
                <button className="btn-icon" onClick={() => setUpdateStatus(null)}>x</button>
              </>
            )}
            {updateStatus.type === 'progress' && (
              <>
                <span>Downloading update... {updateStatus.percent}%</span>
                <div className="update-progress">
                  <div className="update-progress-bar" style={{ width: `${updateStatus.percent}%` }} />
                </div>
              </>
            )}
            {updateStatus.type === 'ready' && (
              <>
                <span>Update ready! Restart to install.</span>
                <button className="btn btn-small btn-primary" onClick={() => window.api.installUpdate()}>
                  Restart Now
                </button>
                <button className="btn-icon" onClick={() => setUpdateStatus(null)}>x</button>
              </>
            )}
          </div>
        )}

        <div className="top-bar">
          <AuthPanel onAuthenticated={setUser} />
          {user && <PlaceSelector onPlaceSelected={setPlace} externalPlace={place} />}
        </div>

        {!user && (
          <div className="welcome-state">
            <h2>Welcome to DevProduct Bulk Creator</h2>
            <p>Paste your .ROBLOSECURITY cookie above to get started.</p>
          </div>
        )}

        {user && !place && (
          <div className="welcome-state">
            <h2>Select a Game</h2>
            <p>Enter a Place ID above to load your game.</p>
          </div>
        )}

        {isReady && activeTab === 'create' && (
          <BulkCreator
            universeId={place.universeId}
            externalQueue={externalQueue}
            onExternalQueueConsumed={handleExternalQueueConsumed}
          />
        )}

        {isReady && activeTab === 'manage' && (
          <ProductList universeId={place.universeId} />
        )}
      </main>
    </div>
  );
}
