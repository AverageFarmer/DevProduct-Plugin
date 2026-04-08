import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    const cleanup = window.api.onUpdateStatus((status) => {
      setUpdateStatus(status);
    });
    return cleanup;
  }, []);

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
          {user && <PlaceSelector onPlaceSelected={setPlace} />}
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
          <BulkCreator universeId={place.universeId} />
        )}

        {isReady && activeTab === 'manage' && (
          <ProductList universeId={place.universeId} />
        )}
      </main>
    </div>
  );
}
