import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function GeoFilter({ value, onChange, initialCenter = [48.85, 2.35], initialZoom = 5 }) {
  const [tab, setTab] = useState(value?.mode || "place");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [map, setMap] = useState(null);

  useEffect(() => {
    if (tab !== "place") return;
    if (!query || query.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/places?q=${encodeURIComponent(query)}&per_page=15`);
        setSuggestions(await r.json());
      } catch (_) {
        /* ignore network errors */
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, tab]);

  const selectedLabel = useMemo(() => {
    if (value?.mode !== "place" || !value.place_id) return "";
    const s = suggestions.find(p => String(p.id) === String(value.place_id));
    return s ? `${s.name} (${s.type || "place"})` : String(value.place_id);
  }, [value, suggestions]);

  function pickPlace(p) { onChange({ mode: "place", place_id: String(p.id) }); }
  function useCurrentBounds() {
    if (!map) return;
    const b = map.getBounds(); const sw = b.getSouthWest(); const ne = b.getNorthEast();
    onChange({
      mode: "map",
      nelat: +ne.lat.toFixed(6), nelng: +ne.lng.toFixed(6),
      swlat: +sw.lat.toFixed(6), swlng: +sw.lng.toFixed(6)
    });
  }

  return (
    <div style={{ display:"grid", gap:12 }}>
      <div style={{ display:"flex", gap:8 }}>
        <button type="button" onClick={() => setTab("place")} className={tab==="place"?"active":""}>Lieu (place_id)</button>
        <button type="button" onClick={() => setTab("map")} className={tab==="map"?"active":""}>Carte (rectangle)</button>
      </div>

      {tab==="place" && (
        <div style={{ display:"grid", gap:8 }}>
          <input placeholder="Tape un pays, une région, un parc…" value={query} onChange={e=>setQuery(e.target.value)} />
          {loading && <div>Recherche…</div>}
          {!!suggestions.length && (
            <ul style={{ border:"1px solid #ccc", borderRadius:8, maxHeight:220, overflow:"auto", margin:0, padding:8 }}>
              {suggestions.map(p => (
                <li key={p.id} style={{ padding:"6px 4px", cursor:"pointer" }} onClick={() => pickPlace(p)}>
                  <strong>{p.name}</strong> <small>— {p.type || "place"}</small>
                </li>
              ))}
            </ul>
          )}
          {selectedLabel && <div style={{ opacity:0.8 }}>Sélection : {selectedLabel}</div>}
        </div>
      )}

      {tab==="map" && (
        <div style={{ display:"grid", gap:8 }}>
          <MapContainer whenCreated={setMap} center={initialCenter} zoom={initialZoom} style={{ height:300, width:"100%", borderRadius:12 }}>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </MapContainer>
          <button type="button" onClick={useCurrentBounds}>Utiliser le cadre actuel</button>
          {value?.mode==="map" && (
            <div style={{ opacity:0.8 }}>
              BBox : NE({value.nelat}, {value.nelng}) — SW({value.swlat}, {value.swlng})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
GeoFilter.propTypes = { value: PropTypes.object, onChange: PropTypes.func.isRequired, initialCenter: PropTypes.array, initialZoom: PropTypes.number };
