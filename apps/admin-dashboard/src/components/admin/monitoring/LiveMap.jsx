import { useEffect, useMemo, useRef, useState } from 'react';
import { labelFrom, markerTypeLabels } from '../../../utils/labels.js';

function LiveMap({ markers = [] }) {
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const mapElRef = useRef(null);
  const fitRef = useRef({ hasFit: false, count: 0 });
  const [ready, setReady] = useState(false);

  const normalizedMarkers = useMemo(
    () =>
      markers
        .map((marker) => ({
          ...marker,
          lat: Number(marker.lat),
          lng: Number(marker.lng)
        }))
        .filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lng)),
    [markers]
  );

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    if (!window.L) return;

    const map = window.L.map(mapElRef.current, {
      zoomControl: true,
      attributionControl: true
    }).setView([10.77, 106.67], 12);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    mapRef.current = map;
    layerRef.current = window.L.layerGroup().addTo(map);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !layerRef.current || !mapRef.current || !window.L) return;

    layerRef.current.clearLayers();
    normalizedMarkers.forEach((marker) => {
      const label = labelFrom(markerTypeLabels, marker.type);
      window.L.marker([marker.lat, marker.lng]).bindPopup(`${label}: ${marker.id}`).addTo(layerRef.current);
    });

    if (normalizedMarkers.length > 0 && (!fitRef.current.hasFit || fitRef.current.count !== normalizedMarkers.length)) {
      const bounds = window.L.latLngBounds(normalizedMarkers.map((marker) => [marker.lat, marker.lng]));
      mapRef.current.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
      fitRef.current = { hasFit: true, count: normalizedMarkers.length };
    }
  }, [normalizedMarkers, ready]);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Ảnh chụp bản đồ trực tuyến</h3>
      </div>
      {!window.L && <div className="text-muted">Không tải được thư viện bản đồ. Vui lòng kiểm tra kết nối mạng.</div>}
      <div className="map-canvas" ref={mapElRef} />
    </div>
  );
}

export default LiveMap;
