import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { autocompletePlaces } from "../services/api";

/* =========================================
   BBoxSelector (optimisé, impératif Leaflet)
   ========================================= */
function BBoxSelector({ value, onChange }) {
  const map = useMap();
  const rectRef = useRef(null);
  const handlesRef = useRef({}); // {sw,nw,ne,se,n,s,e,w,center}
  const drawingRef = useRef(null); // {startLatLng, tempRect}
  const boundsRef = useRef(null); // L.LatLngBounds courant
  const cleanupRef = useRef([]);

  // ---- helpers ----
  const toBounds = (sw, ne) => L.latLngBounds(
    L.latLng(Math.min(sw.lat, ne.lat), Math.min(sw.lng, ne.lng)),
    L.latLng(Math.max(sw.lat, ne.lat), Math.max(sw.lng, ne.lng))
  );

  function emitChangeFromBounds(b) {
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    onChange({
      mode: "map",
      nelat: +ne.lat.toFixed(6), nelng: +ne.lng.toFixed(6),
      swlat: +sw.lat.toFixed(6), swlng: +sw.lng.toFixed(6),
    });
  }

  function placeHandles(b) {
    const SW = b.getSouthWest();
    const NE = b.getNorthEast();
    const NW = L.latLng(NE.lat, SW.lng);
    const SE = L.latLng(SW.lat, NE.lng);
    const nMid = L.latLng(NE.lat, (SW.lng + NE.lng) / 2);
    const sMid = L.latLng(SW.lat, (SW.lng + NE.lng) / 2);
    const eMid = L.latLng((SW.lat + NE.lat) / 2, NE.lng);
    const wMid = L.latLng((SW.lat + NE.lat) / 2, SW.lng);
    const center = L.latLng((SW.lat + NE.lat)/2, (SW.lng + NE.lng)/2);

    const set = (key, ll) => { handlesRef.current[key]?.setLatLng(ll); };

    set("sw", SW); set("nw", NW); set("ne", NE); set("se", SE);
    set("n", nMid); set("s", sMid); set("e", eMid); set("w", wMid);
    set("center", center);
  }

  function setBounds(b, { commit=false } = {}) {
    boundsRef.current = b;
    rectRef.current?.setBounds(b);
    placeHandles(b);
    if (commit) emitChangeFromBounds(b);
  }

  // ---- création rectangle + handles ----
  useEffect(() => {
    if (!map) return;

    // Style poignées (divIcon)
    const handleIcon = (size=10, bg="red") =>
      L.divIcon({
        className: "",
        html: `<div class="bbox-handle" style="width:${size}px;height:${size}px;background:${bg};border:2px solid #fff;border-radius:2px;box-shadow:0 0 2px rgba(0,0,0,.4)"></div>`,
      });
    const centerIcon = L.divIcon({
      className: "",
      html: `<div class="bbox-center" style="width:14px;height:14px;background:rgba(255,0,0,.15);border:2px dashed red;border-radius:4px"></div>`,
    });

    // Rectangle par défaut si inexistant
    let initialBounds = boundsRef.current;
    if (!initialBounds) {
      if (value?.mode === "map" && [value.swlat, value.swlng, value.nelat, value.nelng].every(v => v != null)) {
        initialBounds = toBounds(
          L.latLng(value.swlat, value.swlng),
          L.latLng(value.nelat, value.nelng)
        );
      } else {
        const c = map.getCenter();
        initialBounds = toBounds(L.latLng(c.lat - 0.8, c.lng - 0.8), L.latLng(c.lat + 0.8, c.lng + 0.8));
      }
    }

    // Rectangle principal
    const rect = L.rectangle(initialBounds, { color: "red", weight: 2, interactive: true });
    rect.addTo(map);
    rectRef.current = rect;
    cleanupRef.current.push(() => rect.remove());

    // Fonction utilitaire pour fabriquer un marker draggable
    const mk = (pos, icon) =>
      L.marker(pos, { icon, draggable: true, autoPan: true, zIndexOffset: 1000 }).addTo(map);

    // Création des 8 poignées + 1 centre
    const SW = initialBounds.getSouthWest();
    const NE = initialBounds.getNorthEast();
    const NW = L.latLng(NE.lat, SW.lng);
    const SE = L.latLng(SW.lat, NE.lng);
    const nMid = L.latLng(NE.lat, (SW.lng + NE.lng)/2);
    const sMid = L.latLng(SW.lat, (SW.lng + NE.lng)/2);
    const eMid = L.latLng((SW.lat + NE.lat)/2, NE.lng);
    const wMid = L.latLng((SW.lat + NE.lat)/2, SW.lng);
    const center = L.latLng((SW.lat + NE.lat)/2, (SW.lng + NE.lng)/2);

    const h = {
      sw: mk(SW, handleIcon(12)),
      nw: mk(NW, handleIcon(12)),
      ne: mk(NE, handleIcon(12)),
      se: mk(SE, handleIcon(12)),
      n:  mk(nMid, handleIcon(10)),
      s:  mk(sMid, handleIcon(10)),
      e:  mk(eMid, handleIcon(10)),
      w:  mk(wMid, handleIcon(10)),
      center: mk(center, centerIcon),
    };
    handlesRef.current = h;
    cleanupRef.current.push(
      () => Object.values(h).forEach(m => m.remove())
    );

    // --- Drag handlers (réactifs mais sans re-render React) ---
    const commit = () => setBounds(boundsRef.current, { commit: true });

    // Corners
    const onDragCorner = (which) => (e) => {
      const p = e.target.getLatLng();
      const b = boundsRef.current;
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      let nsw = L.latLng(sw.lat, sw.lng);
      let nne = L.latLng(ne.lat, ne.lng);
      if (which === "sw") nsw = p;
      if (which === "ne") nne = p;
      if (which === "nw") { nsw = L.latLng(p.lat, sw.lng); nne = L.latLng(ne.lat, p.lng); }
      if (which === "se") { nsw = L.latLng(sw.lat, p.lng); nne = L.latLng(p.lat, ne.lng); }
      setBounds(toBounds(nsw, nne));
    };

    // Edges
    const onDragEdge = (which) => (e) => {
      const p = e.target.getLatLng();
      const b = boundsRef.current;
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      let nsw = L.latLng(sw.lat, sw.lng);
      let nne = L.latLng(ne.lat, ne.lng);
      if (which === "n")  nne = L.latLng(p.lat, ne.lng);
      if (which === "s")  nsw = L.latLng(p.lat, sw.lng);
      if (which === "e")  nne = L.latLng(ne.lat, p.lng);
      if (which === "w")  nsw = L.latLng(sw.lat, p.lng);
      setBounds(toBounds(nsw, nne));
    };

    // Center (déplacement global)
    let centerPrev = null;
    const onCenterDragStart = (e) => { centerPrev = e.target.getLatLng(); };
    const onCenterDrag = (e) => {
      const now = e.target.getLatLng();
      const dLat = now.lat - centerPrev.lat;
      const dLng = now.lng - centerPrev.lng;
      centerPrev = now;

      const b = boundsRef.current;
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      const nsw = L.latLng(sw.lat + dLat, sw.lng + dLng);
      const nne = L.latLng(ne.lat + dLat, ne.lng + dLng);
      setBounds(toBounds(nsw, nne));
    };

    h.sw.on("drag", onDragCorner("sw")).on("dragend", commit);
    h.nw.on("drag", onDragCorner("nw")).on("dragend", commit);
    h.ne.on("drag", onDragCorner("ne")).on("dragend", commit);
    h.se.on("drag", onDragCorner("se")).on("dragend", commit);
    h.n .on("drag", onDragEdge("n")).on("dragend", commit);
    h.s .on("drag", onDragEdge("s")).on("dragend", commit);
    h.e .on("drag", onDragEdge("e")).on("dragend", commit);
    h.w .on("drag", onDragEdge("w")).on("dragend", commit);
    h.center.on("dragstart", onCenterDragStart).on("drag", onCenterDrag).on("dragend", commit);

    // --- Dessin d’un nouveau rectangle : SHIFT + drag sur la carte ---
    const onMouseDown = (e) => {
      if (!e.originalEvent.shiftKey) return;       // sécurité : seulement avec SHIFT
      // éviter la pan map
      map.dragging.disable();
      drawingRef.current = {
        startLatLng: e.latlng,
        tempRect: L.rectangle(toBounds(e.latlng, e.latlng), { color: "#999", weight: 1, dashArray: "4 4" }).addTo(map),
      };
    };
    const onMouseMove = (e) => {
      const d = drawingRef.current; if (!d) return;
      d.tempRect.setBounds(toBounds(d.startLatLng, e.latlng));
    };
    const onMouseUp = (e) => {
      const d = drawingRef.current; if (!d) return;
      map.dragging.enable();
      const b = toBounds(d.startLatLng, e.latlng);
      d.tempRect.remove();
      drawingRef.current = null;
      setBounds(b, { commit: true }); // repositionne rect + handles et émet le onChange
    };

    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);
    cleanupRef.current.push(() => {
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
    });

    // initial placement
    setBounds(initialBounds);

    return () => {
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];
      rectRef.current = null;
      handlesRef.current = {};
      drawingRef.current = null;
      boundsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Sync externe -> interne (quand value change programmatiquement)
  useEffect(() => {
    if (value?.mode !== "map") return;
    if ([value.swlat, value.swlng, value.nelat, value.nelng].some(v => v == null)) return;
    const b = toBounds(
      L.latLng(value.swlat, value.swlng),
      L.latLng(value.nelat, value.nelng)
    );
    // si pas de différence notable, ne rien faire
    const cur = boundsRef.current;
    if (cur && cur.equals(b)) return;
    setBounds(b); // pas de commit ici (pas besoin d’émettre onChange si ça vient déjà de l’externe)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.mode, value?.swlat, value?.swlng, value?.nelat, value?.nelng]);

  return null; // tout est géré impérativement par Leaflet
}

/* =========================
   GeoFilter (onglets UI)
   ========================= */
export default function GeoFilter({ value, onChange, initialCenter = [48.85, 2.35], initialZoom = 5 }) {
  const [tab, setTab] = useState(value?.mode || "place");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Autocomplétion place_id (debounce)
  useEffect(() => {
    if (tab !== "place") return;
    if (!query || query.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await autocompletePlaces(query, 15);
        setSuggestions(results || []);
      } catch (_) {
        setSuggestions([]);
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

  function pickPlace(p) {
    onChange({ mode: "place", place_id: String(p.id) });
  }

  return (
    <div style={{ display:"grid", gap:12 }}>
      <div style={{ display:"flex", gap:8 }}>
        <button type="button" onClick={() => setTab("place")} className={tab==="place"?"active":""}>Lieu (place_id)</button>
        <button type="button" onClick={() => setTab("map")} className={tab==="map"?"active":""}>Carte (rectangle)</button>
      </div>

      {tab==="place" && (
        <div style={{ display:"grid", gap:8 }}>
          <input
            placeholder="Tape un pays, une région, un parc…"
            value={query}
            onChange={e=>setQuery(e.target.value)}
          />
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
              <div style={{ fontSize:12, opacity:.7, marginTop:4 }}>
                Astuces : drag <b>les coins</b> pour redimensionner, <b>les bords</b> pour étirer, drag le carré <b>central</b> pour déplacer.
                Maintiens <b>Shift</b> et glisse sur la carte pour <b>dessiner un nouveau rectangle</b>.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

GeoFilter.propTypes = {
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  initialCenter: PropTypes.array,
  initialZoom: PropTypes.number,
};
