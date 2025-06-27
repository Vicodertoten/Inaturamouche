import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Circle, useMapEvents } from 'react-leaflet';

// Ce sous-composant gère les interactions avec la carte
function MapLogic({ center, radius, dispatch }) {
  useMapEvents({
    click(e) {
      // Quand on clique, on met à jour le centre et on garde le rayon actuel
      dispatch({ type: 'SET_AREA', payload: { lat: e.latlng.lat, lng: e.latlng.lng, radius } });
    },
  });

  // Le cercle à afficher, basé sur les props reçues
  const circleMemo = useMemo(
    () => (center.lat ? <Circle center={[center.lat, center.lng]} pathOptions={{ color: 'blue' }} radius={radius * 1000} /> : null),
    [center, radius]
  );
  
  return circleMemo;
}

// Le composant principal du filtre de carte
function MapFilter({ filters, dispatch }) {
  const { lat, lng, radius } = filters;
  const center = { lat, lng };

  const handleRadiusChange = (e) => {
    const newRadius = Number(e.target.value);
    if (newRadius > 0) {
      // On met à jour le rayon et on garde le centre actuel
      dispatch({ type: 'SET_AREA', payload: { lat, lng, radius: newRadius } });
    }
  };

  return (
    <>
      <div className="map-controls">
        <label htmlFor="radius">Rayon (km):</label>
        <input 
          id="radius" 
          type="number" 
          value={radius} 
          onChange={handleRadiusChange}
          min="1"
        />
        <p>Cliquez sur la carte pour définir le centre de la zone.</p>
      </div>
      <div style={{ height: '400px', width: '100%', marginBottom: '1rem', position: 'relative' }}>
        <MapContainer center={[lat, lng]} zoom={5} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapLogic center={center} radius={radius} dispatch={dispatch} />
        </MapContainer>
      </div>
    </>
  );
}

export default MapFilter;
