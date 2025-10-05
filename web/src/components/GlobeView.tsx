"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { Map, useControl } from "react-map-gl/maplibre";
import type { ViewState } from "react-map-gl/maplibre";
import { MapboxOverlay as DeckOverlay } from "@deck.gl/mapbox";

import Papa from "papaparse";
import { HexagonLayer, HeatmapLayer } from "@deck.gl/aggregation-layers";
import { ScatterplotLayer } from "@deck.gl/layers";

// =========================
// Tipos
// =========================
type LayerConfig = {
  id: "plankton" | "sst" | "swot" | "sharks" | "predictions";
  name: string;
  enabled: boolean;
  opacity: number; // 0..1
};

type DataPoint = { [key: string]: any };

// =========================
// Estado inicial do mapa
// =========================
const INITIAL_VIEW_STATE: ViewState = {
  longitude: -60,
  latitude: 15,
  zoom: 1.6,
  pitch: 0,
  bearing: 0,
};

// =========================
// Overlay DeckGL como controle do MapLibre
// =========================
function DeckGLOverlay(props: any) {
  const overlay = useControl(() => new DeckOverlay(props));
  overlay.setProps(props);
  return null;
}

// =========================
// Painel mínimo de controle (inline)
// =========================
function LayerControlPanel({
  layers,
  onToggle,
  onOpacity,
}: {
  layers: LayerConfig[];
  onToggle: (id: LayerConfig["id"]) => void;
  onOpacity: (id: LayerConfig["id"], value: number) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        background: "rgba(5,10,30,0.85)",
        color: "#e2e8f0",
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(0,255,255,0.2)",
        zIndex: 10,
        width: 280,
      }}
    >
      <h3 style={{ margin: "0 0 8px 0", color: "#22d3ee" }}>Layers</h3>
      {layers.map((l) => (
        <div
          key={l.id}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 8,
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={l.enabled}
              onChange={() => onToggle(l.id)}
            />
            {l.name}
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={l.opacity}
            onChange={(e) => onOpacity(l.id, Number(e.target.value))}
            title="Opacity"
          />
        </div>
      ))}
    </div>
  );
}

// =========================
// Componente principal
// =========================
export default function GlobeApp() {
  // dados CSV
  const [planktonData, setPlanktonData] = useState<DataPoint[]>([]);
  const [sstData, setSstData] = useState<DataPoint[]>([]);
  const [swotData, setSwotData] = useState<DataPoint[]>([]);
  const [sharksData, setSharksData] = useState<DataPoint[]>([]);
  const [predData, setPredData] = useState<DataPoint[]>([]);

  // camadas
  const [layers, setLayers] = useState<LayerConfig[]>([
    {
      id: "plankton",
      name: "Plankton (Chlorophyll)",
      enabled: true,
      opacity: 0.85,
    },
    {
      id: "sst",
      name: "Sea Surface Temperature",
      enabled: true,
      opacity: 0.75,
    },
    { id: "swot", name: "Ocean Eddies (SSH)", enabled: false, opacity: 0.85 },
    { id: "sharks", name: "Shark Occurrences", enabled: true, opacity: 1.0 },
    {
      id: "predictions",
      name: "Predicted Zones",
      enabled: false,
      opacity: 0.55,
    },
  ]);

  // util para carregar CSV
  const loadCSV = useCallback(
    (
      path: string,
      setter: (rows: DataPoint[]) => void,
      requiredKeys: string[]
    ) => {
      Papa.parse(path, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: ({ data }) => {
          const rows = (data as DataPoint[]).filter((r) =>
            requiredKeys.every(
              (k) => r[k] !== undefined && r[k] !== null && r[k] !== ""
            )
          );
          setter(rows);
        },
      });
    },
    []
  );

  // carrega seus 5 CSVs (conforme os formatos que você enviou)
  useEffect(() => {
    // plancton: centroid_lat, centroid_lon, chlor_a_mean, ...
    loadCSV("/data/plancton.csv", setPlanktonData, [
      "centroid_lat",
      "centroid_lon",
      "chlor_a_mean",
    ]);

    // sst: latitude, longitude, sst_mean_celsius, ...
    loadCSV("/data/sst.csv", setSstData, [
      "latitude",
      "longitude",
      "sst_mean_celsius",
    ]);

    // swot: latitude, longitude, ssha_karin, ...
    loadCSV("/data/swot.csv", setSwotData, [
      "latitude",
      "longitude",
      "ssha_karin",
    ]);

    // sharks: centroid_lat, centroid_lon, species, date, ...
    loadCSV("/data/sharks.csv", setSharksData, [
      "centroid_lat",
      "centroid_lon",
    ]);

    // predictions(opcional): lat, lon, probability
    loadCSV("/data/predictions.csv", setPredData, ["lat", "lon"]);
  }, [loadCSV]);

  const getLayerCfg = useCallback(
    (id: LayerConfig["id"]) => layers.find((l) => l.id === id),
    [layers]
  );

  // Tooltips (DeckOverlay aceita getTooltip)
  const getTooltip = useCallback(({ object }: any) => {
    if (!object) return null;

    // plâncton
    if ("chlor_a_mean" in object) {
      const lat = object.centroid_lat ?? object.lat ?? object.latitude;
      const lon = object.centroid_lon ?? object.lon ?? object.longitude;
      return {
        html: `<div style="padding:8px;border:1px solid #22d3ee;border-radius:8px;background:#0b1220;color:#e2e8f0">
          <div style="color:#22d3ee;font-weight:600">Plankton</div>
          Chlor_a_mean: ${Number(object.chlor_a_mean).toFixed(2)} mg/m³<br/>
          Lat: ${Number(lat).toFixed(2)}, Lon: ${Number(lon).toFixed(2)}
        </div>`,
      };
    }

    // sst
    if ("sst_mean_celsius" in object) {
      return {
        html: `<div style="padding:8px;border:1px solid #ef4444;border-radius:8px;background:#0b1220;color:#e2e8f0">
          <div style="color:#ef4444;font-weight:600">Sea Surface Temp</div>
          SST mean: ${Number(object.sst_mean_celsius).toFixed(2)} °C<br/>
          Anomaly: ${
            "anomaly_celsius" in object
              ? Number(object.anomaly_celsius).toFixed(2)
              : "—"
          } °C
        </div>`,
      };
    }

    // swot
    if ("ssha_karin" in object) {
      return {
        html: `<div style="padding:8px;border:1px solid #f59e0b;border-radius:8px;background:#0b1220;color:#e2e8f0">
          <div style="color:#f59e0b;font-weight:600">Eddy / SSH</div>
          SSHA: ${Number(object.ssha_karin).toFixed(2)} m
        </div>`,
      };
    }

    // sharks
    if ("species" in object || "n_obs" in object) {
      return {
        html: `<div style="padding:8px;border:1px solid #fbbf24;border-radius:8px;background:#0b1220;color:#e2e8f0">
          <div style="color:#fbbf24;font-weight:600">Shark</div>
          ${object.species ? `Species: ${object.species}<br/>` : ""}
          ${object.date ? `Date: ${object.date}<br/>` : ""}
          ${object.n_obs ? `Observations: ${object.n_obs}` : ""}
        </div>`,
      };
    }

    // predictions
    if ("probability" in object) {
      return {
        html: `<div style="padding:8px;border:1px solid #ef4444;border-radius:8px;background:#0b1220;color:#e2e8f0">
          <div style="color:#ef4444;font-weight:600">Prediction</div>
          Probability: ${(Number(object.probability) * 100).toFixed(0)}%
        </div>`,
      };
    }

    return null;
  }, []);

  // Layers deck.gl (injetadas no Map via DeckOverlay)
  const deckLayers = useMemo(() => {
    const arr: any[] = [];

    // 🟢 Plâncton (HexagonLayer em centroides)
    if (getLayerCfg("plankton")?.enabled && planktonData.length) {
      arr.push(
        new HexagonLayer({
          id: "plankton-hex",
          data: planktonData,
          getPosition: (d: any) => [
            Number(d.centroid_lon),
            Number(d.centroid_lat),
          ],
          getElevationWeight: (d: any) => Number(d.chlor_a_mean) || 0,
          elevationScale: 50000,
          radius: 90000,
          coverage: 0.85,
          opacity: getLayerCfg("plankton")!.opacity,
          pickable: true,
          colorRange: [
            [26, 152, 80],
            [102, 189, 99],
            [166, 217, 106],
            [217, 239, 139],
            [255, 255, 191],
          ],
          parameters: { depthTest: false },
        })
      );
    }

    // 🔥 SST (HexagonLayer em pontos lat/lon)
    if (getLayerCfg("sst")?.enabled && sstData.length) {
      arr.push(
        new HexagonLayer({
          id: "sst-hex",
          data: sstData,
          getPosition: (d: any) => [Number(d.longitude), Number(d.latitude)],
          getElevationWeight: (d: any) => Number(d.sst_mean_celsius) || 0,
          elevationScale: 22000,
          radius: 90000,
          coverage: 0.8,
          opacity: getLayerCfg("sst")!.opacity,
          pickable: true,
          colorRange: [
            [33, 102, 172],
            [67, 147, 195],
            [146, 197, 222],
            [209, 229, 240],
            [253, 219, 199],
            [244, 165, 130],
            [214, 96, 77],
            [178, 24, 43],
          ],
          parameters: { depthTest: false },
        })
      );
    }

    // 🌪️ SWOT (Scatterplot em lat/lon; raio por ssha)
    if (getLayerCfg("swot")?.enabled && swotData.length) {
      arr.push(
        new ScatterplotLayer({
          id: "swot-scatter",
          data: swotData,
          getPosition: (d: any) => [Number(d.longitude), Number(d.latitude)],
          getRadius: (d: any) =>
            Math.max(3_0000, Math.abs(Number(d.ssha_karin) || 0.2) * 70_000),
          getFillColor: (d: any) =>
            d.eddy_type === "Cyclonic"
              ? [255, 140, 0, 200]
              : [255, 200, 120, 200],
          opacity: getLayerCfg("swot")!.opacity,
          pickable: true,
          radiusMinPixels: 2,
          radiusMaxPixels: 32,
        })
      );
    }

    // 🦈 Sharks (Scatter em centroides)
    if (getLayerCfg("sharks")?.enabled && sharksData.length) {
      arr.push(
        new ScatterplotLayer({
          id: "sharks-scatter",
          data: sharksData,
          getPosition: (d: any) => [
            Number(d.centroid_lon),
            Number(d.centroid_lat),
          ],
          getRadius: (d: any) =>
            Math.min(120_000, 40_000 + (Number(d.n_obs) || 1) * 10_000),
          getFillColor: [255, 215, 0, 255],
          opacity: getLayerCfg("sharks")!.opacity,
          pickable: true,
          radiusMinPixels: 4,
          radiusMaxPixels: 18,
          stroked: true,
          lineWidthMinPixels: 1.5,
          getLineColor: [255, 255, 160],
        })
      );
    }

    // 🔮 Predições (Heatmap em lat/lon)
    if (getLayerCfg("predictions")?.enabled && predData.length) {
      arr.push(
        new HeatmapLayer({
          id: "pred-heat",
          data: predData,
          getPosition: (d: any) => [Number(d.lon), Number(d.lat)],
          getWeight: (d: any) => Number(d.probability) || 0.5,
          radiusPixels: 50,
          intensity: 2,
          threshold: 0.05,
          opacity: getLayerCfg("predictions")!.opacity,
          colorRange: [
            [255, 255, 204, 30],
            [255, 237, 160, 80],
            [254, 217, 118, 120],
            [254, 178, 76, 160],
            [253, 141, 60, 220],
            [227, 26, 28, 255],
          ],
        })
      );
    }

    return arr;
  }, [planktonData, sstData, swotData, sharksData, predData, getLayerCfg]);

  // handlers UI
  const handleToggle = useCallback((id: LayerConfig["id"]) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l))
    );
  }, []);

  const handleOpacity = useCallback((id: LayerConfig["id"], value: number) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, opacity: value } : l))
    );
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg,#000,#0a1a2b)",
      }}
    >
      <LayerControlPanel
        layers={layers}
        onToggle={handleToggle}
        onOpacity={handleOpacity}
      />

      <Map
        reuseMaps
        projection="globe"
        initialViewState={INITIAL_VIEW_STATE}
        // Carto Dark Matter estilo GL (funciona com globe)
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        dragRotate={false}
        maxPitch={0}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Deck.gl como overlay do MapLibre (igual ao exemplo que você mandou) */}
        <DeckGLOverlay
          layers={deckLayers}
          getTooltip={getTooltip}
          interleaved
        />
      </Map>
    </div>
  );
}
