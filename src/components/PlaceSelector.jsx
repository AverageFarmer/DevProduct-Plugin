import React, { useState } from 'react';

export default function PlaceSelector({ onPlaceSelected }) {
  const [placeId, setPlaceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [placeInfo, setPlaceInfo] = useState(null);

  const handleResolve = async () => {
    const id = placeId.trim();
    if (!id || isNaN(id)) {
      setError('Enter a valid Place ID (numbers only)');
      return;
    }

    setLoading(true);
    setError('');

    const result = await window.api.getUniverseId(id);

    if (result.success) {
      setPlaceInfo(result);
      onPlaceSelected({ placeId: id, universeId: result.universeId, gameName: result.gameName });
    } else {
      setError(result.error);
      setPlaceInfo(null);
    }
    setLoading(false);
  };

  const handleClear = () => {
    setPlaceId('');
    setPlaceInfo(null);
    setError('');
    onPlaceSelected(null);
  };

  return (
    <div className="place-selector">
      <h3>Game Selection</h3>
      <div className="input-row">
        <input
          type="text"
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value.replace(/\D/g, ''))}
          placeholder="Enter Place ID..."
          className="input-med"
          onKeyDown={(e) => e.key === 'Enter' && handleResolve()}
          disabled={!!placeInfo}
        />
        {placeInfo ? (
          <button className="btn btn-secondary" onClick={handleClear}>Change</button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handleResolve}
            disabled={loading || !placeId.trim()}
          >
            {loading ? 'Resolving...' : 'Load Game'}
          </button>
        )}
      </div>
      {error && <div className="error-msg">{error}</div>}
      {placeInfo && (
        <div className="place-info">
          <span className="place-name">{placeInfo.gameName || 'Unknown Game'}</span>
          <span className="place-ids">Place: {placeId} | Universe: {placeInfo.universeId}</span>
        </div>
      )}
    </div>
  );
}
