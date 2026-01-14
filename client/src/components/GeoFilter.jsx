import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { autocompletePlaces, getPlacesByIds } from "../services/api";
import { useLanguage } from '../context/LanguageContext.jsx';

/* ===== BBoxSelector optimisé (Leaflet impératif, pas de re-render pendant drag) ===== */
function BBoxSelector({ value, onChange }) {
  const map = useMap();
  const rectRef = useRef(null);
  const handlesRef = useRef({});
  const drawingRef = useRef(null);
  const boundsRef = useRef(null);
  const cleanupRef = useRef([]);

  const toBounds = useCallback(
    (sw, ne) =>
      L.latLngBounds(
        L.latLng(Math.min(sw.lat, ne.lat), Math.min(sw.lng, ne.lng)),
        L.latLng(Math.max(sw.lat, ne.lat), Math.max(sw.lng, ne.lng))
      ),
    []
  );

  const emitChangeFromBounds = useCallback((b) => {
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    onChange({
      mode: "map",
      nelat: +ne.lat.toFixed(6),
      nelng: +ne.lng.toFixed(6),
      swlat: +sw.lat.toFixed(6),
      swlng: +sw.lng.toFixed(6),
    });
  }, [onChange]);

  const placeHandles = useCallback((b) => {
    const SW = b.getSouthWest();
    const NE = b.getNorthEast();
    const NW = L.latLng(NE.lat, SW.lng);
    const SE = L.latLng(SW.lat, NE.lng);
    const nMid = L.latLng(NE.lat, (SW.lng + NE.lng) / 2);
    const sMid = L.latLng(SW.lat, (SW.lng + NE.lng) / 2);
    const eMid = L.latLng((SW.lat + NE.lat) / 2, NE.lng);
    const wMid = L.latLng((SW.lat + NE.lat) / 2, SW.lng);
    const center = L.latLng((SW.lat + NE.lat) / 2, (SW.lng + NE.lng) / 2);

    const set = (key, ll) => {
      handlesRef.current[key]?.setLatLng(ll);
    };
    set("sw", SW);
    set("nw", NW);
    set("ne", NE);
    set("se", SE);
    set("n", nMid);
    set("s", sMid);
    set("e", eMid);
    set("w", wMid);
    set("center", center);
  }, []);

  const setBounds = useCallback((b, { commit = false } = {}) => {
    boundsRef.current = b;
    rectRef.current?.setBounds(b);
    placeHandles(b);
    if (commit) emitChangeFromBounds(b);
  }, [emitChangeFromBounds, placeHandles]);

  useEffect(() => {
    if (!map) return;

    const handleIcon = (size = 10, bg = "red") =>
      L.divIcon({
        className: "",
        html: `<div class="bbox-handle" style="width:${size}px;height:${size}px;background:${bg};border:2px solid var(--text-color);border-radius:2px;box-shadow:0 0 2px rgba(0,0,0,.4)"></div>`,

      });
    const centerIcon = L.divIcon({
      className: "",
      html: `<div class="bbox-center" style="width:14px;height:14px;background:rgba(255,0,0,.15);border:2px dashed red;border-radius:4px"></div>`,
    });

    let initialBounds = boundsRef.current;
    if (!initialBounds) {
      if (
        value?.mode === "map" &&
        [value.swlat, value.swlng, value.nelat, value.nelng].every((v) => v != null)
      ) {
        initialBounds = toBounds(
          L.latLng(value.swlat, value.swlng),
          L.latLng(value.nelat, value.nelng)
        );
      } else {
        const c = map.getCenter();
        initialBounds = toBounds(
          L.latLng(c.lat - 0.8, c.lng - 0.8),
          L.latLng(c.lat + 0.8, c.lng + 0.8)
        );
      }
    }

    const rect = L.rectangle(initialBounds, { color: "red", weight: 2, interactive: true }).addTo(map);
    rectRef.current = rect;
    cleanupRef.current.push(() => rect.remove());

    const mk = (pos, icon) => L.marker(pos, { icon, draggable: true, autoPan: true, zIndexOffset: 1000 }).addTo(map);

    const SW = initialBounds.getSouthWest();
    const NE = initialBounds.getNorthEast();
    const NW = L.latLng(NE.lat, SW.lng);
    const SE = L.latLng(SW.lat, NE.lng);
    const nMid = L.latLng(NE.lat, (SW.lng + NE.lng) / 2);
    const sMid = L.latLng(SW.lat, (SW.lng + NE.lng) / 2);
    const eMid = L.latLng((SW.lat + NE.lat) / 2, NE.lng);
    const wMid = L.latLng((SW.lat + NE.lat) / 2, SW.lng);
    const center = L.latLng((SW.lat + NE.lat) / 2, (SW.lng + NE.lng) / 2);

    const h = {
      sw: mk(SW, handleIcon(12)),
      nw: mk(NW, handleIcon(12)),
      ne: mk(NE, handleIcon(12)),
      se: mk(SE, handleIcon(12)),
      n: mk(nMid, handleIcon(10)),
      s: mk(sMid, handleIcon(10)),
      e: mk(eMid, handleIcon(10)),
      w: mk(wMid, handleIcon(10)),
      center: mk(center, centerIcon),
    };
    handlesRef.current = h;
    cleanupRef.current.push(() => Object.values(h).forEach((m) => m.remove()));

    const commit = () => setBounds(boundsRef.current, { commit: true });

    const onDragCorner = (which) => (e) => {
      const p = e.target.getLatLng();
      const b = boundsRef.current;
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      let nsw = L.latLng(sw.lat, sw.lng);
      let nne = L.latLng(ne.lat, ne.lng);
      if (which === "sw") nsw = p;
      if (which === "ne") nne = p;
      if (which === "nw") { nsw = L.latLng(sw.lat, p.lng); nne = L.latLng(p.lat, ne.lng); }
      if (which === "se") { nsw = L.latLng(p.lat, sw.lng); nne = L.latLng(ne.lat, p.lng); }
      setBounds(toBounds(nsw, nne));
    };

    const onDragEdge = (which) => (e) => {
      const p = e.target.getLatLng();
      const b = boundsRef.current;
      const sw = b.getSouthWest();
      const ne = b.getNorthEast();
      let nsw = L.latLng(sw.lat, sw.lng);
      let nne = L.latLng(ne.lat, ne.lng);
      if (which === "n") nne = L.latLng(p.lat, ne.lng);
      if (which === "s") nsw = L.latLng(p.lat, sw.lng);
      if (which === "e") nne = L.latLng(ne.lat, p.lng);
      if (which === "w") nsw = L.latLng(sw.lat, p.lng);
      setBounds(toBounds(nsw, nne));
    };

    let centerPrev = null;
    const onCenterStart = (e) => {
      centerPrev = e.target.getLatLng();
    };
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
    h.n.on("drag", onDragEdge("n")).on("dragend", commit);
    h.s.on("drag", onDragEdge("s")).on("dragend", commit);
    h.e.on("drag", onDragEdge("e")).on("dragend", commit);
    h.w.on("drag", onDragEdge("w")).on("dragend", commit);
    h.center.on("dragstart", onCenterStart).on("drag", onCenterDrag).on("dragend", commit);

    const onMouseDown = (e) => {
      if (!e.originalEvent.shiftKey) return;
      map.dragging.disable();
      drawingRef.current = {
        startLatLng: e.latlng,
        tempRect: L.rectangle(toBounds(e.latlng, e.latlng), {
          color: "var(--text-color-muted)",
          weight: 1,
          dashArray: "4 4",
        }).addTo(map),
      };
    };
    const onMouseMove = (e) => {
      const d = drawingRef.current;
      if (!d) return;
      d.tempRect.setBounds(toBounds(d.startLatLng, e.latlng));
    };
    const onMouseUp = (e) => {
      const d = drawingRef.current;
      if (!d) return;
      map.dragging.enable();
      const b = toBounds(d.startLatLng, e.latlng);
      d.tempRect.remove();
      drawingRef.current = null;
      setBounds(b, { commit: true });
    };

    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);
    cleanupRef.current.push(() => {
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
    });

    setBounds(initialBounds);

    return () => {
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];
      rectRef.current = null;
      handlesRef.current = {};
      drawingRef.current = null;
      boundsRef.current = null;
    };
  }, [map, setBounds, toBounds, value]);

  useEffect(() => {
    if (value?.mode !== "map") return;
    if ([value.swlat, value.swlng, value.nelat, value.nelng].some((v) => v == null)) return;
    const b = toBounds(
      L.latLng(value.swlat, value.swlng),
      L.latLng(value.nelat, value.nelng)
    );
    const cur = boundsRef.current;
    if (cur && cur.equals(b)) return;
    setBounds(b);
  }, [setBounds, toBounds, value?.mode, value?.swlat, value?.swlng, value?.nelat, value?.nelng]);

  return null;
}

/* ===== GeoFilter (onglets) avec multi place_id (chips) ===== */
export default function GeoFilter({
  value,
  onChange,
  initialCenter = [48.85, 2.35],
  initialZoom = 5,
}) {
  const [tab, setTab] = useState(value?.mode || "place");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const { t } = useLanguage();

  // Hydrate places déjà choisis (ex: retour page)
  useEffect(() => {
    if (tab !== "place") return;
    const raw = value?.place_id ? String(value.place_id) : "";
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.length) {
      setSelected([]);
      return;
    }
    const curIds = selected.map((p) => String(p.id));
    if (ids.length === curIds.length && ids.every((id, i) => id === curIds[i])) return;
    (async () => {
      try {
        setSelected(await getPlacesByIds(ids));
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, value?.place_id]);

  // Autocomplete (debounce)
  useEffect(() => {
    if (tab !== "place") return;
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        setSuggestions(await autocompletePlaces(query, 15));
      } catch {
        setSuggestions([]);
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, tab]);

  function commitSelected(next) {
    setSelected(next);
    const ids = next.map((p) => p.id);
    onChange({ mode: "place", place_id: ids.join(",") });
  }
  function addPlace(p) {
    const exists = selected.some((x) => String(x.id) === String(p.id));
    if (exists) return;
    commitSelected([...selected, p]);
    setQuery("");
    setSuggestions([]);
  }
  function removePlace(id) {
    commitSelected(selected.filter((p) => String(p.id) !== String(id)));
  }
  function onEnter(e) {
    if (e.key !== "Enter") return;
    if (suggestions.length) return addPlace(suggestions[0]);
    const trimmed = (query || "").trim();
    if (/^\d+$/.test(trimmed)) {
      getPlacesByIds([trimmed])
        .then((res) => {
          addPlace(res[0] || { id: trimmed, name: `ID ${trimmed}`, type: "place" });
        })
        .catch(() => addPlace({ id: trimmed, name: `ID ${trimmed}`, type: "place" }));
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="geo-tabs">
        <button
          type="button"
          onClick={() => setTab("place")}
          className={tab === "place" ? "active" : ""}
        >
          {t('geo.tab_place')}
        </button>
        <button
          type="button"
          onClick={() => setTab("map")}
          className={tab === "map" ? "active" : ""}
        >
          {t('geo.tab_map')}
        </button>
      </div>

      {tab === "place" && (
        <div style={{ display: "grid", gap: 8 }}>
          <div className="pills-container place-pills">
            {selected.map((p) => (
              <div key={p.id} className="taxon-pill">
                <span>{p.name}</span>
                <button
                  type="button"
                  aria-label={t('geo.remove_place', { name: p.name })}
                  className="remove-btn"
                  onClick={() => removePlace(p.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="autocomplete-container">
            <input
              placeholder={t('geo.place_placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onEnter}
            />
            {loading && <div className="spinner-autocomplete"></div>}

            {!!suggestions.length && (
              <ul className="suggestions-list">
                {suggestions.map((p) => (
                  <li
                    key={p.id}
                    className="place-suggestion"
                    onClick={() => addPlace(p)}
                  >
                    <span>
                      <strong>{p.name}</strong> <small>— {p.type || t('geo.tab_place')}</small>
                    </span>
                    <button type="button">{t('geo.add_place')}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "map" && (
        <div style={{ display: "grid", gap: 8 }}>
          <MapContainer
            center={initialCenter}
            zoom={initialZoom}
            style={{ height: 300, width: "100%", borderRadius: 12 }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <BBoxSelector value={value} onChange={onChange} />
          </MapContainer>
          {value?.mode === "map" && (
            <div style={{ opacity: 0.8 }}>
              {t('geo.bbox_label', {
                nelat: value.nelat,
                nelng: value.nelng,
                swlat: value.swlat,
                swlng: value.swlng,
              })}
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                {t('geo.map_hint')}
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
