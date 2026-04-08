import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import AuthPanel from './components/AuthPanel';
import PlaceSelector from './components/PlaceSelector';
import BulkCreator from './components/BulkCreator';
import ProductList from './components/ProductList';

export default function App() {
  const [user, setUser] = useState(null);
  const [place, setPlace] = useState(null);
  const [activeTab, setActiveTab] = useState('create');

  const isReady = !!(user && place);

  return (
    <div className="app">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} isReady={isReady} />
      <main className="main-content">
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
