import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { theme } from '../theme';

export interface MapLibreViewProps {
  style?: any;
  center?: [number, number];     // [lng, lat]
  zoom?: number;
  pitch?: number;
  bearing?: number;              // gradi (0=nord) per ruotare verso la marcia
  route?: [number, number][];    // percorso
  destCoord?: [number, number];  // coordinata arrivo (marker bandiera)
  destLabel?: string;            // Etichetta civico/destinazione
  reports?: any[];               // segnalazioni community
  showUserLocation?: boolean;
}

const MAP_STYLES = `
  body { margin: 0; padding: 0; background: #0A0A0A; overflow: hidden; }
  #map { position: absolute; inset: 0; }
  .maplibregl-ctrl-attrib, .maplibregl-ctrl-logo { display: none !important; }
  .user-marker {
    width: 60px; height: 60px;
    display: flex; align-items: center; justify-content: center;
    filter: drop-shadow(0px 8px 16px rgba(108, 43, 255, 0.8));
    transition: transform 0.1s linear;
  }
  .dest-marker-container {
    display: flex; flex-direction: column; align-items: center;
  }
  .dest-label {
    background: rgba(255, 255, 255, 0.95);
    color: #000;
    padding: 6px 12px;
    border-radius: 12px;
    font-family: sans-serif;
    font-weight: 900;
    font-size: 14px;
    margin-bottom: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    white-space: nowrap;
    border: 2px solid #6C2BFF;
  }
  .dest-marker {
    width: 32px; height: 32px;
    background: linear-gradient(135deg, #6C2BFF, #9F5BFF);
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 20px rgba(108, 43, 255, 0.6);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
  }
`;

// ─── HELPERS ─────────────────────────────────────────────────────────────

const SHARED_MAP_SCRIPT = `
  var map;
  var userMarker;
  var accuracyMarker;
  var destMarker;
  var targetPos = null;
  var currentPos = null;
  var targetBearing = 0;
  var currentBearing = 0;
  var targetZoom = 15;
  var currentZoom = 15;
  var targetPitch = 55;
  var currentPitch = 55;
  var currentRoute = [];

  function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
  }

  function lerpBearing(start, end, amt) {
    var diff = ((end - start + 180 + 360) % 360) - 180;
    return (start + diff * amt + 360) % 360;
  }

  function getDistanceSq(p1, p2) {
    return Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2);
  }

  function findClosestPointOnRoute(p, route) {
    if (!route || route.length < 2) return p;
    var minDist = Infinity;
    var closest = p;
    
    var limit = Math.min(route.length - 1, 15);
    for (var i = 0; i < limit; i++) {
      var v = route[i];
      var w = route[i+1];
      var l2 = getDistanceSq(v, w);
      if (l2 === 0) continue;
      var t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
      t = Math.max(0, Math.min(1, t));
      var proj = [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
      var d = getDistanceSq(p, proj);
      if (d < minDist) {
        minDist = d;
        closest = proj;
      }
    }
    return minDist < 0.0000005 ? closest : p;
  }

  var isManual = false;

  function animate() {
    if (targetPos && currentPos) {
      currentPos[0] = lerp(currentPos[0], targetPos[0], 0.15);
      currentPos[1] = lerp(currentPos[1], targetPos[1], 0.15);
      
      var snappedPos = findClosestPointOnRoute(currentPos, currentRoute);
      
      currentBearing = lerpBearing(currentBearing, targetBearing, 0.1);
      currentZoom = lerp(currentZoom, targetZoom, 0.05);
      currentPitch = lerp(currentPitch, targetPitch, 0.05);

      if (userMarker) {
        userMarker.setLngLat(snappedPos);
        userMarker.getElement().style.transform = 'rotate(' + currentBearing + 'deg)';
      }
      if (accuracyMarker) accuracyMarker.setLngLat(snappedPos);
      
      if (!isManual) {
        map.jumpTo({
          center: snappedPos,
          bearing: currentBearing,
          zoom: currentZoom,
          pitch: currentPitch
        });
      }
    }
    requestAnimationFrame(animate);
  }

  function createMarkerIcon() {
    const size = 35;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(0, 122, 255, 0.4)';
    
    ctx.beginPath();
    ctx.moveTo(size/2, 2);
    ctx.lineTo(size - 6, size - 4);
    ctx.lineTo(size/2, size - 12);
    ctx.lineTo(6, size - 4);
    ctx.closePath();
    
    ctx.fillStyle = '#007AFF';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return canvas;
  }

  function initMap(container, center, zoom, pitch, bearing, routeStr, reportsStr, destStr, destLabel) {
    map = new maplibregl.Map({
      container: container,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: center,
      zoom: zoom,
      pitch: pitch,
      bearing: bearing,
      antialias: true,
      interactive: true
    });

    currentPos = [...center];
    targetPos = [...center];
    currentBearing = bearing; targetBearing = bearing;
    currentZoom = zoom; targetZoom = zoom;
    currentPitch = pitch; targetPitch = pitch;

    map.on('dragstart', function() { isManual = true; });
    map.on('pitchevent', function() { isManual = true; });

    window.recenter = function() {
      isManual = false;
      targetPos = [...currentPos];
      targetBearing = currentBearing;
      map.flyTo({ center: currentPos, zoom: 18, pitch: 65, duration: 1000 });
    };

    map.on('load', function() {
      map.addLayer({
        'id': '3d-buildings', 'source': 'openmaptiles', 'source-layer': 'building', 'type': 'fill-extrusion', 'minzoom': 15,
        'paint': { 'fill-extrusion-color': '#333', 'fill-extrusion-height': ['get', 'render_height'], 'fill-extrusion-base': ['get', 'render_min_height'], 'fill-extrusion-opacity': 0.6 }
      });

      var accEl = document.createElement('div');
      accEl.style.width = '100px';
      accEl.style.height = '100px';
      accEl.style.borderRadius = '50%';
      accEl.style.background = 'rgba(108, 43, 255, 0.15)';
      accEl.style.border = '1px solid rgba(108, 43, 255, 0.3)';
      accEl.style.pointerEvents = 'none';
      accuracyMarker = new maplibregl.Marker({ element: accEl }).setLngLat(center).addTo(map);

      var userEl = document.createElement('div');
      userEl.className = 'user-marker';
      userEl.style.width = '35px';
      userEl.style.height = '35px';
      userEl.innerHTML = '<svg width="35" height="35" viewBox="0 0 50 50"><path d="M25 5L42 42L25 34L8 42L25 5Z" fill="#007AFF" stroke="white" stroke-width="2.5"/></svg>';
      userMarker = new maplibregl.Marker({ element: userEl, rotationAlignment: 'viewport' }).setLngLat(center).addTo(map);

      updateRoute(JSON.parse(routeStr || '[]'));
      updateReports(JSON.parse(reportsStr || '[]'));
      updateDest(JSON.parse(destStr || 'null'), destLabel);
      
      animate();
    });
  }

  function updateRoute(route) {
    if (!route) return;
    try {
      if (typeof route === 'string') route = JSON.parse(route);
    } catch(e) { return; }
    currentRoute = route;
    if (!map || !map.isStyleLoaded()) return;
    var data = { type: 'Feature', geometry: { type: 'LineString', coordinates: route } };
    try {
      if (map.getSource('route')) {
        map.getSource('route').setData(data);
      } else if (route.length > 1) {
        map.addSource('route', { type: 'geojson', data: data });
        map.addLayer({ id: 'route-glow', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#007AFF', 'line-width': 10, 'line-blur': 8, 'line-opacity': 0.3 } });
        map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#007AFF', 'line-width': 6 } });
      }
    } catch(e) { console.warn('Route update error:', e); }
  }
  window.updateRoute = updateRoute;

  function updateReports(reports) {
    if (!map || !map.isStyleLoaded()) return;
    var features = reports.map(function(r) { return { type: 'Feature', properties: { type: r.type }, geometry: { type: 'Point', coordinates: [r.lng, r.lat] } }; });
    var data = { type: 'FeatureCollection', features: features };
    if (map.getSource('reports')) {
      map.getSource('reports').setData(data);
    } else if (features.length > 0) {
      map.addSource('reports', { type: 'geojson', data: data });
      map.addLayer({ id: 'reports-point', type: 'circle', source: 'reports', paint: { 'circle-radius': 8, 'circle-color': '#FF7A00', 'circle-stroke-width': 2, 'circle-stroke-color': '#FFF' } });
    }
  }

  function updateDest(dest, label) {
    if (!dest || !map || !map.isStyleLoaded()) { 
      if (destMarker) { destMarker.remove(); destMarker = null; }
      return; 
    }
    
    // Se il marker esiste già, aggiorniamo posizione e label
    if (destMarker) {
      destMarker.setLngLat(dest);
      var el = destMarker.getElement();
      var lbl = el.querySelector('.dest-label');
      if (label) {
        if (lbl) {
          lbl.innerText = label;
        } else {
          var newLbl = document.createElement('div');
          newLbl.className = 'dest-label';
          newLbl.innerText = label;
          el.insertBefore(newLbl, el.firstChild);
        }
      } else if (lbl) {
        lbl.remove();
      }
    } else {
      var container = document.createElement('div');
      container.className = 'dest-marker-container';
      if (label) {
        var lbl = document.createElement('div'); lbl.className = 'dest-label'; lbl.innerText = label;
        container.appendChild(lbl);
      }
      var dot = document.createElement('div'); dot.className = 'dest-marker'; dot.innerText = '🏁';
      container.appendChild(dot);
      destMarker = new maplibregl.Marker({ element: container, anchor: 'bottom' }).setLngLat(dest).addTo(map);
    }
  }

  function updateState(lng, lat, zoom, pitch, bearing) {
    targetPos = [lng, lat]; targetZoom = zoom; targetPitch = pitch; targetBearing = bearing;
  }
`;

// ─── WEB VERSION ─────────────────────────────────────────────────────────

  const MapLibreWebView = React.forwardRef<any, MapLibreViewProps>(({
    center = [12.4964, 41.9028],
    zoom = 18,
    pitch = 60,
    bearing = 0,
    route = [],
    destCoord,
    destLabel,
    reports = [],
  }, ref) => {
    React.useImperativeHandle(ref, () => ({
      recenter: () => {
        if ((window as any).recenter) (window as any).recenter();
      }
    }));
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current || initialized.current) return;

    const loadMap = async () => {
      const ml = (window as any).maplibregl;
      if (!ml) {
        await new Promise<void>(resolve => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js';
          script.onload = () => resolve();
          document.head.appendChild(script);
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css';
          document.head.appendChild(link);
          const s = document.createElement('style');
          s.textContent = MAP_STYLES;
          document.head.appendChild(s);
        });
      }

      if (!(window as any).initMap) {
        const scriptTag = document.createElement('script');
        scriptTag.textContent = SHARED_MAP_SCRIPT;
        document.head.appendChild(scriptTag);
      }

      setTimeout(() => {
        if ((window as any).initMap && containerRef.current) {
          (window as any).initMap(
            containerRef.current,
            center, zoom, pitch, bearing, 
            JSON.stringify(route), 
            JSON.stringify(reports), 
            JSON.stringify(destCoord),
            destLabel
          );
          initialized.current = true;
        }
      }, 150);
    };

    loadMap();
  }, []);

  useEffect(() => {
    if (initialized.current && (window as any).updateState && typeof center?.[0] === 'number') {
      (window as any).updateState(center[0], center[1], zoom, pitch, bearing);
    }
  }, [center, zoom, pitch, bearing]);

  useEffect(() => {
    if (initialized.current && (window as any).updateRoute) {
      (window as any).updateRoute(route);
    }
  }, [route]);

  return (<View style={styles.container}><div id="map" ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute' }} /></View>);
});
MapLibreWebView.displayName = 'MapLibreWebView';

// ─── NATIVE VERSION ──────────────────────────────────────────────────────

let MapLibreNativeView: any = () => null;

if (Platform.OS !== 'web') {
  const { WebView } = require('react-native-webview');

  MapLibreNativeView = React.forwardRef<any, MapLibreViewProps>(({
    center = [12.4964, 41.9028], zoom = 18, pitch = 60, bearing = 0, route = [], destCoord, destLabel, reports = [],
  }, ref) => {
    const webViewRef = useRef<any>(null);

    React.useImperativeHandle(ref, () => ({
      recenter: () => {
        webViewRef.current?.injectJavaScript('if(window.recenter) window.recenter(); true;');
      }
    }));

    useEffect(() => {
      if (typeof center?.[0] === 'number' && typeof center?.[1] === 'number') {
        const script = `if (window.updateState) updateState(${center[0]}, ${center[1]}, ${zoom}, ${pitch}, ${bearing}); true;`;
        webViewRef.current?.injectJavaScript(script);
      }
    }, [center?.[0], center?.[1], zoom, pitch, bearing]);

    useEffect(() => {
      if (Array.isArray(route)) {
        const script = `if (window.updateRoute) updateRoute(${JSON.stringify(route)}); true;`;
        webViewRef.current?.injectJavaScript(script);
      }
    }, [route]);

    const safeRoute = JSON.stringify(route).replace(/'/g, "\\'");
    const safeReports = JSON.stringify(reports).replace(/'/g, "\\'");
    const safeDest = JSON.stringify(destCoord).replace(/'/g, "\\'");
    const safeLabel = (destLabel || "").replace(/'/g, "\\'");

    const html = `
      <!DOCTYPE html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
        <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
        <style>${MAP_STYLES}</style>
      </head><body><div id="map"></div>
      <script>
        ${SHARED_MAP_SCRIPT}
        initMap(
          'map',
          [${center[0]}, ${center[1]}], ${zoom}, ${pitch}, ${bearing}, 
          '${safeRoute}', '${safeReports}', '${safeDest}', '${safeLabel}'
        );
      </script></body></html>
    `;

    return (<View style={styles.container} pointerEvents="auto"><WebView ref={webViewRef} source={{ html }} scrollEnabled={true} style={{ flex: 1, backgroundColor: '#0A0A0A' }} javaScriptEnabled={true} domStorageEnabled={true} startInLoadingState={true} onMessage={(event) => {}} /></View>);
  });
  MapLibreNativeView.displayName = 'MapLibreNativeView';
}

const MapLibreView = React.forwardRef<any, MapLibreViewProps>((props, ref) => {
  const [mounted, setMounted] = React.useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <View style={styles.container} />;
  return Platform.OS === 'web' 
    ? <MapLibreWebView ref={ref} {...props} /> 
    : <MapLibreNativeView ref={ref} {...props} />;
});
MapLibreView.displayName = 'MapLibreView';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
});

export default MapLibreView;

