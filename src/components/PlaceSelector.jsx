import React, { useState, useEffect } from 'react';

export default function PlaceSelector({ onPlaceSelected }) {
  const [placeId, setPlaceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [placeInfo, setPlaceInfo] = useState(null);
  const [savedPlaces, setSavedPlaces] = useState([]);

  useEffect(() => {
    window.api.getSavedPlaces().then(setSavedPlaces);
  }, []);

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
      // Auto-save the place
      const updated = await window.api.savePlace({
        placeId: id,
        universeId: result.universeId,
        gameName: result.gameName,
      });
      setSavedPlaces(updated);
    } else {
      setError(result.error);
      setPlaceInfo(null);
    }
    setLoading(false);
  };

  const handleSelectSaved = (place) => {
    setPlaceId(place.placeId);
    setPlaceInfo({ universeId: place.universeId, gameName: place.gameName });
    onPlaceSelected(place);
  };

  const handleRemoveSaved = async (e, placeId) => {
    e.stopPropagation();
    const updated = await window.api.removeSavedPlace(placeId);
    setSavedPlaces(updated);
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

      {!placeInfo && savedPlaces.length > 0 && (
        <div className="saved-places">
          <span className="saved-places-label">Recent Games</span>
          {savedPlaces.map((p) => (
            <div
              key={p.placeId}
              className="saved-place-item"
              onClick={() => handleSelectSaved(p)}
            >
              <div className="saved-place-info">
                <span className="saved-place-name">{p.gameName || 'Unknown Game'}</span>
                <span className="saved-place-id">{p.placeId}</span>
              </div>
              <button
                className="btn-icon saved-place-remove"
                onClick={(e) => handleRemoveSaved(e, p.placeId)}
                title="Remove"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
