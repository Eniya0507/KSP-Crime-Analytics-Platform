import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MapPoint {
  lat: number;
  lng: number;
  weight?: number; // 0-1 for heatmap intensity
  color?: string;
  label?: string;
  popup?: string;
}

interface MapProps {
  points: MapPoint[];
  center?: [number, number];
  zoom?: number;
  height?: number | string;
  heatmap?: boolean;
  markers?: boolean;
  className?: string;
}

export default function MapView({ points, center = [15.3, 76.0], zoom = 7, height = 420, heatmap = true, markers = false, className = '' }: MapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { center: L.latLng(center[0], center[1]), zoom, zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    if (heatmap) {
      // Custom heatmap via CSS-blurred circles
      for (const p of points) {
        const w = p.weight ?? 0.5;
        const size = 18 + w * 46;
        const color = p.color ?? (w > 0.75 ? 'rgba(239,68,68,0.55)' : w > 0.5 ? 'rgba(249,115,22,0.5)' : w > 0.25 ? 'rgba(245,158,11,0.45)' : 'rgba(59,130,246,0.4)');
        const icon = L.divIcon({
          className: 'heatmap-blob',
          html: `<div style="width:${size}px;height:${size}px;background:radial-gradient(circle, ${color} 0%, transparent 70%);"></div>`,
          iconSize: [size, size],
        });
        const m = L.marker([p.lat, p.lng], { icon });
        if (p.popup) m.bindPopup(p.popup);
        layer.addLayer(m);
      }
    }
    if (markers && !heatmap) {
      for (const p of points) {
        const dotColor = p.color ?? '#3b82f6';
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:12px;height:12px;border-radius:9999px;background:${dotColor};box-shadow:0 0 0 3px rgba(59,130,246,0.25),0 0 8px ${dotColor};border:2px solid #fff;"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        const m = L.marker([p.lat, p.lng], { icon });
        if (p.popup) m.bindPopup(p.popup);
        layer.addLayer(m);
      }
    }
  }, [points, heatmap, markers]);

  return <div ref={elRef} className={`rounded-xl border border-white/5 ${className}`} style={{ height }} />;
}

export type { MapPoint };
