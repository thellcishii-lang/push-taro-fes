'use client';

// components/VenueMap.tsx
// 会場マップ（OpenStreetMap + Leaflet）。土台は本物の地図で、主催者が
// 置いたピン（ステージ等）と、来場者本人の現在地だけを出す。
// 現在地はこの端末の中だけで使い、サーバーには送らない。
// Leaflet はブラウザ専用なので、初期化時に動的 import する（SSR 回避）。
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';

export interface VenueMapPin {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

export interface VenueMapLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

interface VenueMapProps {
  center: { lat: number; lng: number; zoom: number };
  pins: VenueMapPin[];
  /** 編集モード（主催者設定）: 地図クリックで onMapClick が呼ばれる */
  editable?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  /** 現在地（来場者本人の端末で取得したもの） */
  myLocation?: VenueMapLocation | null;
  height?: number;
}

const PIN_STYLE = `
  .venue-pin { background: transparent; border: none; }
  .venue-pin-inner { display: flex; flex-direction: column; align-items: center; transform: translateY(-6px); }
  .venue-pin-dot { width: 16px; height: 16px; border-radius: 999px; background: #0e7fc4; border: 3px solid #ffffff; box-shadow: 0 1px 6px rgba(0,0,0,0.4); }
  .venue-pin-label { margin-top: 3px; padding: 1px 7px; border-radius: 999px; background: rgba(255,255,255,0.92); border: 1px solid #cbd5e1; font-size: 11px; font-weight: 700; color: #0f172a; white-space: nowrap; }
  .venue-me { background: transparent; border: none; }
  .venue-me-dot { width: 18px; height: 18px; border-radius: 999px; background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 0 0 6px rgba(37,99,235,0.25), 0 1px 6px rgba(0,0,0,0.4); }
`;

export function VenueMap({
  center,
  pins,
  editable = false,
  onMapClick,
  myLocation,
  height = 340,
}: VenueMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const pinsLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const meLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const centerRef = useRef(center);
  centerRef.current = center;
  const [ready, setReady] = useState(false);

  // 地図の初期化（1回だけ）。中心の初期値は最初の props を使う。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const initial = centerRef.current;
      const map = L.map(containerRef.current, {
        center: [initial.lat, initial.lng],
        zoom: initial.zoom,
        scrollWheelZoom: true,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      pinsLayerRef.current = L.layerGroup().addTo(map);
      meLayerRef.current = L.layerGroup().addTo(map);
      map.on('click', (e: Leaflet.LeafletMouseEvent) => {
        clickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 中心の変更（検索ジャンプ等）に追従する
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.setView([center.lat, center.lng], center.zoom, { animate: true });
  }, [center, ready]);

  // ピンの描き直し
  useEffect(() => {
    const L = leafletRef.current;
    const layer = pinsLayerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();
    for (const pin of pins) {
      const icon = L.divIcon({
        className: 'venue-pin',
        html: `<div class="venue-pin-inner"><div class="venue-pin-dot"></div><div class="venue-pin-label"></div></div>`,
        iconSize: [0, 0],
      });
      const marker = L.marker([pin.lat, pin.lng], { icon });
      // ラベルは textContent で入れる（主催者の入力を HTML として解釈しない）
      marker.on('add', () => {
        const el = marker.getElement()?.querySelector('.venue-pin-label');
        if (el) el.textContent = pin.label;
      });
      marker.addTo(layer);
    }
  }, [pins, ready]);

  // 現在地の描き直し
  useEffect(() => {
    const L = leafletRef.current;
    const layer = meLayerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();
    if (myLocation) {
      L.circle([myLocation.lat, myLocation.lng], {
        radius: Math.max(myLocation.accuracy, 10),
        color: '#2563eb',
        weight: 1,
        fillColor: '#2563eb',
        fillOpacity: 0.12,
      }).addTo(layer);
      const icon = L.divIcon({
        className: 'venue-me',
        html: '<div class="venue-me-dot"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      L.marker([myLocation.lat, myLocation.lng], { icon, interactive: false }).addTo(layer);
    }
  }, [myLocation, ready]);

  return (
    <>
      <style>{PIN_STYLE}</style>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height,
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
          backgroundColor: '#e2e8f0',
          zIndex: 0,
        }}
      />
    </>
  );
}

