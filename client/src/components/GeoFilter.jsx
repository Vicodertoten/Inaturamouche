import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { MapContainer, TileLayer, Rectangle, useMapEvents, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { autocompletePlaces } from "../services/api";

function BBoxSelector({ value, onChange }) {
  const [bounds, setBounds] = useState(null);
  const [start, setStart] = useState(null);
  const map = useMapEvents({
    mousedown(e) {
      if (e.originalEvent.target.closest(".bbox-handle")) return;
      setStart(e.latlng);
      setBounds([e.latlng, e.latlng]);
      map.dragging.disable();
    },
    mousemove(e) {
      if (!start) return;
      setBounds([start, e.latlng]);
    },
    mouseup(e) {
      if (!start) return;
      map.dragging.enable();
      const b = L.latLngBounds(start, e.latlng);
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      setBounds([sw, ne]);
      setStart(null);
      onChange({
        mode: "map",
        nelat: +ne.lat.toFixed(6), nelng: +ne.lng.toFixed(6),
        swlat: +sw.lat.toFixed(6), swlng: +sw.lng.toFixed(6),
      });
    },
  });

  // Default rectangle when switching to map mode
  useEffect(() => {
    if (!value || value.mode !== "map") {
      const c = map.getCenter();
      const sw = L.latLng(c.lat - 1, c.lng - 1);
      const ne = L.latLng(c.lat + 1, c.lng + 1);
      setBounds([sw, ne]);
      onChange({
        mode: "map",
        nelat: +ne.lat.toFixed(6), nelng: +ne.lng.toFixed(6),
        swlat: +sw.lat.toFixed(6), swlng: +sw.lng.toFixed(6),
      });
    }
  }, []);

  useEffect(() => {
    if (value?.mode === "map") {
      const b = L.latLngBounds(
        L.latLng(value.swlat, value.swlng),
        L.latLng(value.nelat, value.nelng)
      );
      setBounds([b.getSouthWest(), b.getNorthEast()]);
    }
  }, [value]);

  function update(sw, ne) {
    setBounds([sw, ne]);
    onChange({
      mode: "map",
      nelat: +ne.lat.toFixed(6), nelng: +ne.lng.toFixed(6),
      swlat: +sw.lat.toFixed(6), swlng: +sw.lng.toFixed(6),
    });
  }

  if (!bounds) return null;

  const sw = bounds[0];
  const ne = bounds[1];
  const nw = L.latLng(ne.lat, sw.lng);
  const se = L.latLng(sw.lat, ne.lng);
  const nMid = L.latLng(ne.lat, (sw.lng + ne.lng) / 2);
  const sMid = L.latLng(sw.lat, (sw.lng + ne.lng) / 2);
  const eMid = L.latLng((sw.lat + ne.lat) / 2, ne.lng);
  const wMid = L.latLng((sw.lat + ne.lat) / 2, sw.lng);

  const handleIcon = L.divIcon({
    className: "",
    html: '<div class="bbox-handle" style="width:8px;height:8px;background:red;border:2px solid #fff"></div>',
  });

  function dragCorner(which) {
    return e => {
      const p = e.target.getLatLng();
      let newSw = L.latLng(sw.lat, sw.lng);
      let newNe = L.latLng(ne.lat, ne.lng);
      if (which === "sw") {
        newSw = p;
      } else if (which === "nw") {
        newSw = L.latLng(p.lat, sw.lng);
        newNe = L.latLng(ne.lat, p.lng);
      } else if (which === "ne") {
        newNe = p;
      } else if (which === "se") {
        newSw = L.latLng(sw.lat, p.lng);
        newNe = L.latLng(p.lat, ne.lng);
      }
      update(newSw, newNe);
    };
  }

  function dragEdge(which) {
    return e => {
      const p = e.target.getLatLng();
      let newSw = L.latLng(sw.lat, sw.lng);
      let newNe = L.latLng(ne.lat, ne.lng);
      if (which === "n") {
        newNe = L.latLng(p.lat, ne.lng);
      } else if (which === "s") {
        newSw = L.latLng(p.lat, sw.lng);
      } else if (which === "e") {
        newNe = L.latLng(ne.lat, p.lng);
      } else if (which === "w") {
        newSw = L.latLng(sw.lat, p.lng);
      }
      update(newSw, newNe);
    };
  }

  return (
    <>
      <Rectangle bounds={bounds} pathOptions={{ color: "red" }} />
      {[sw, nw, ne, se].map((p, i) => (
        <Marker
          key={i}
          position={p}
          icon={handleIcon}
          draggable
          eventHandlers={{ drag: dragCorner(["sw", "nw", "ne", "se"][i]) }}
        />
      ))}
      {[nMid, sMid, eMid, wMid].map((p, i) => (
        <Marker
          key={`e${i}`}
          position={p}
          icon={handleIcon}
          draggable
          eventHandlers={{ drag: dragEdge(["n", "s", "e", "w"][i]) }}
        />
      ))}
    </>
  );
}

export default function GeoFilter({ value, onChange, initialCenter = [48.85, 2.35], initialZoom = 5 }) {
  const [tab, setTab] = useState(value?.mode || "place");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab !== "place") return;
    if (!query || query.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await autocompletePlaces(query, 15);
        setSuggestions(results);
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
          <MapContainer center={initialCenter} zoom={initialZoom} style={{ height:300, width:"100%", borderRadius:12 }}>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <BBoxSelector value={value} onChange={onChange} />
          </MapContainer>
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
