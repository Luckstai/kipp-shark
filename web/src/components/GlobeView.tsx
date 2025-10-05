"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { Map, useControl } from "react-map-gl/maplibre";
import type { ViewState } from "react-map-gl/maplibre";
import { MapboxOverlay as DeckOverlay } from "@deck.gl/mapbox";
import Papa from "papaparse";
import { ScatterplotLayer, PolygonLayer } from "@deck.gl/layers";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import * as h3 from "h3-js";
import LayerControlPanel from "./LayerControlPanel";

type LayerId = "plankton" | "sst" | "swot" | "sharks" | "predictions";

type LayerConfig = {
  id: LayerId;
  name: string;
  color: string;
  enabled: boolean;
  opacity: number;
};

type DataPoint = { [key: string]: any };

const INITIAL_VIEW_STATE: ViewState = {
  longitude: 0,
  latitude: 0,
  zoom: 1.6,
  pitch: 0,
  bearing: 0,
};

const hexToRgb = (hex: string): [number, number, number] => {
  const sanitized = hex.replace("#", "").trim();
  if (sanitized.length === 3) {
    const r = parseInt(sanitized[0] + sanitized[0], 16);
    const g = parseInt(sanitized[1] + sanitized[1], 16);
    const b = parseInt(sanitized[2] + sanitized[2], 16);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return [r, g, b];
    }
  }

  if (sanitized.length === 6) {
    const bigint = parseInt(sanitized, 16);
    if (Number.isFinite(bigint)) {
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return [r, g, b];
    }
  }

  return [255, 255, 255];
};

type GradientStop = {
  t: number;
  color: [number, number, number];
  hex: string;
};

const SST_GRADIENT: GradientStop[] = [
  { t: 0, color: [33, 102, 172], hex: "#2166ac" },
  { t: 0.25, color: [67, 147, 195], hex: "#4393c3" },
  { t: 0.5, color: [146, 197, 222], hex: "#92c5de" },
  { t: 0.75, color: [253, 219, 199], hex: "#fddbc7" },
  { t: 1, color: [215, 48, 39], hex: "#d73027" },
];

const PREDICTION_GRADIENT: GradientStop[] = [
  { t: 0, color: [17, 94, 89], hex: "#115e59" },
  { t: 0.25, color: [13, 148, 136], hex: "#0d9488" },
  { t: 0.5, color: [45, 212, 191], hex: "#2dd4bf" },
  { t: 0.75, color: [250, 204, 21], hex: "#facc15" },
  { t: 1, color: [220, 38, 38], hex: "#dc2626" },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const interpolateGradientColor = (
  t: number,
  stops: GradientStop[]
): [number, number, number] => {
  const clampedT = clamp(t, 0, 1);

  for (let i = 0; i < stops.length - 1; i += 1) {
    const current = stops[i];
    const next = stops[i + 1];
    if (clampedT >= current.t && clampedT <= next.t) {
      const localT =
        (clampedT - current.t) / (next.t - current.t === 0 ? 1 : next.t - current.t);
      const r = Math.round(
        current.color[0] + (next.color[0] - current.color[0]) * localT
      );
      const g = Math.round(
        current.color[1] + (next.color[1] - current.color[1]) * localT
      );
      const b = Math.round(
        current.color[2] + (next.color[2] - current.color[2]) * localT
      );
      return [r, g, b];
    }
  }

  return stops[stops.length - 1].color;
};

const getSstColor = (
  value: number,
  range: { min: number; max: number }
): [number, number, number, number] => {
  if (!Number.isFinite(value)) {
    return [67, 147, 195, 180];
  }
  const span = range.max - range.min;
  const normalized = span === 0 ? 0 : (value - range.min) / span;
  const [r, g, b] = interpolateGradientColor(normalized, SST_GRADIENT);
  return [r, g, b, 220];
};

const getSstElevation = (value: number, range: { min: number; max: number }) => {
  if (!Number.isFinite(value)) return 0;
  const span = range.max - range.min;
  const normalized = span === 0 ? 0 : (value - range.min) / span;
  const clamped = clamp(normalized, 0, 1);
  return clamped * 60000;
};

const getPredictionColor = (value: number): [number, number, number, number] => {
  if (!Number.isFinite(value)) {
    return [13, 148, 136, 200];
  }
  const normalized = clamp(value, 0, 1);
  const [r, g, b] = interpolateGradientColor(normalized, PREDICTION_GRADIENT);
  return [r, g, b, 220];
};

const getPredictionElevation = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  const clamped = clamp(value, 0, 1);
  return clamped * 50000;
};

function DeckGLOverlay(props: any) {
  const overlay = useControl(() => new DeckOverlay(props));
  overlay.setProps(props);
  return null;
}

export default function GlobeApp() {
  const [planktonData, setPlanktonData] = useState<DataPoint[]>([]);
  const [sstData, setSstData] = useState<DataPoint[]>([]);
  const [swotData, setSwotData] = useState<DataPoint[]>([]);
  const [sharksData, setSharksData] = useState<DataPoint[]>([]);
  const [predData, setPredData] = useState<DataPoint[]>([]);
  const [sstRange, setSstRange] = useState({ min: 0, max: 1 });

  const [layers, setLayers] = useState<LayerConfig[]>([
    {
      id: "plankton",
      name: "Plankton (Chlorophyll)",
      color: "#1a9850",
      enabled: true,
      opacity: 0.85,
    },
    {
      id: "sst",
      name: "Sea Surface Temperature",
      color: "#d73027",
      enabled: true,
      opacity: 0.75,
    },
    {
      id: "swot",
      name: "Ocean Eddies (SSH)",
      color: "#fdae61",
      enabled: false,
      opacity: 0.85,
    },
    {
      id: "sharks",
      name: "Shark Occurrences",
      color: "#f1c40f",
      enabled: true,
      opacity: 1.0,
    },
    {
      id: "predictions",
      name: "Predicted Zones",
      color: "#4575b4",
      enabled: false,
      opacity: 0.55,
    },
  ]);

  const handleToggleLayer = useCallback((layerId: LayerId) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, enabled: !layer.enabled } : layer
      )
    );
  }, []);

  const handleOpacityChange = useCallback((layerId: LayerId, opacity: number) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, opacity } : layer
      )
    );
  }, []);

  const loadCSV = useCallback(
    (path: string, setter: (rows: DataPoint[]) => void) => {
      Papa.parse(path, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: ({ data }) => {
          const rows = (data as DataPoint[])
            .map((entry) => {
              const row: DataPoint = { ...entry };

              const h3field =
                row.h3 ||
                row.h3_index ||
                row.h3_cell ||
                row.h3_id ||
                row.h3Index ||
                row.h;

              if (typeof h3field === "string" && h3field.length) {
                row.h3 = h3field;
                try {
                  const [lat, lon] = h3.cellToLatLng(h3field);
                  // deck/gl usa [lon, lat]
                  if (!Number.isFinite(row.latitude)) row.latitude = lat;
                  if (!Number.isFinite(row.longitude)) row.longitude = lon;
                } catch (error) {
                  // ignora h3 inválido sem interromper o fluxo
                }
              }

              const latCandidate =
                row.latitude ??
                row.centroid_lat ??
                row.lat ??
                row.Latitude ??
                row.LAT ??
                row.centroidLat;
              const lonCandidate =
                row.longitude ??
                row.centroid_lon ??
                row.lon ??
                row.Longitude ??
                row.LON ??
                row.centroidLon;

              if (latCandidate !== undefined && lonCandidate !== undefined) {
                const lat = Number(latCandidate);
                const lon = Number(lonCandidate);
                if (Number.isFinite(lat) && Number.isFinite(lon)) {
                  row.latitude = lat;
                  row.longitude = lon;
                }
              }

              return row;
            })
            .filter((row) => {
              const hasH3 = typeof row.h3 === "string" && row.h3.length > 0;
              const hasCoords =
                Number.isFinite(row.latitude) &&
                Number.isFinite(row.longitude) &&
                Math.abs(Number(row.latitude)) <= 90 &&
                Math.abs(Number(row.longitude)) <= 180;
              return hasH3 || hasCoords;
            });

          const normalized = rows.map((row) => {
            if (
              row.prediction !== undefined &&
              row.probability === undefined &&
              Number.isFinite(Number(row.prediction))
            ) {
              row.probability = Number(row.prediction);
            }
            return row;
          });

          setter(normalized);
        },
      });
    },
    []
  );

  useEffect(() => {
    loadCSV("/data/plancton_20241117.csv", setPlanktonData);
    loadCSV("/data/sst_20241117.csv", setSstData);
    loadCSV("/data/swot_20251001.csv", setSwotData);
    loadCSV("/data/sharks_20241117.csv", setSharksData);
    loadCSV("/data/predictions.csv", setPredData);
  }, [loadCSV]);

  useEffect(() => {
    if (!sstData.length) {
      setSstRange({ min: 0, max: 1 });
      return;
    }

    const values = sstData
      .map((row) => Number(row.sst_mean_celsius))
      .filter((value) => Number.isFinite(value));

    if (!values.length) {
      setSstRange({ min: 0, max: 1 });
      return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      setSstRange({ min, max });
    }
  }, [sstData]);

  const getLayerCfg = useCallback(
    (id: LayerConfig["id"]) => layers.find((l) => l.id === id),
    [layers]
  );

  const getTooltip = useCallback(({ object }: any) => {
    if (!object) return null;
    if ("chlor_a_mean" in object)
      return { html: `<b>Plankton</b><br>Chlorophyll: ${object.chlor_a_mean}` };
    if ("sst_mean_celsius" in object)
      return { html: `<b>SST</b><br>${object.sst_mean_celsius} °C` };
    if ("ssha_karin" in object)
      return { html: `<b>SSH</b><br>${object.ssha_karin}` };
    if ("species" in object)
      return { html: `<b>${object.species}</b><br>${object.date}` };
    if ("probability" in object || "prediction" in object) {
      const value = Number(object.probability ?? object.prediction ?? 0);
      if (Number.isFinite(value)) {
        return {
          html: `<b>Prediction</b><br>${(value * 100).toFixed(0)}%`,
        };
      }
    }
    return null;
  }, []);

  const deckLayers = useMemo(() => {
    const arr: any[] = [];

    const planktonCfg = getLayerCfg("plankton");
    if (planktonCfg?.enabled && planktonData.length) {
      const [r, g, b] = hexToRgb(planktonCfg.color);
      arr.push(
        new PolygonLayer({
          id: "plankton-h3",
          data: planktonData,
          getPolygon: (d) =>
            d.h3
              ? h3.cellToBoundary(d.h3, true).map(([lat, lon]) => [lon, lat])
              : null,
          getFillColor: [r, g, b, 200],
          getLineColor: [r, g, b, 220],
          lineWidthMinPixels: 1,
          stroked: true,
          filled: true,
          opacity: planktonCfg.opacity,
          pickable: true,
        })
      );
    }

    const sstCfg = getLayerCfg("sst");
    if (sstCfg?.enabled && sstData.length) {
      arr.push(
        new H3HexagonLayer({
          id: "sst-h3",
          data: sstData,
          opacity: sstCfg.opacity,
          pickable: true,
          getHexagon: (d) => d.h3,
          getFillColor: (d) =>
            getSstColor(Number(d.sst_mean_celsius), sstRange),
          getElevation: (d) =>
            getSstElevation(Number(d.sst_mean_celsius), sstRange),
          extruded: true,
        })
      );
    }

    const swotCfg = getLayerCfg("swot");
    if (swotCfg?.enabled && swotData.length) {
      arr.push(
        new ScatterplotLayer({
          id: "swot-scatter",
          data: swotData,
          getPosition: (d) => [d.longitude, d.latitude],
          getRadius: 70000,
          radiusScale: 1,
          radiusMinPixels: 2,
          radiusMaxPixels: 30,
          getFillColor: (d) => {
            const ssh = Number(d.ssha_karin) || 0;
            return ssh >= 0 ? [253, 174, 97, 220] : [49, 54, 149, 220];
          },
          opacity: swotCfg.opacity,
          stroked: false,
          pickable: true,
        })
      );
    }

    const sharksCfg = getLayerCfg("sharks");
    if (sharksCfg?.enabled && sharksData.length) {
      const [r, g, b] = hexToRgb(sharksCfg.color);
      arr.push(
        new ScatterplotLayer({
          id: "sharks-scatter",
          data: sharksData,
          getPosition: (d) => [d.longitude, d.latitude],
          getRadius: 80000,
          radiusMinPixels: 3,
          getFillColor: [r, g, b, 240],
          opacity: sharksCfg.opacity,
          pickable: true,
        })
      );
    }

    const predCfg = getLayerCfg("predictions");
    if (predCfg?.enabled && predData.length) {
      arr.push(
        new H3HexagonLayer({
          id: "predictions-h3",
          data: predData,
          opacity: predCfg.opacity,
          pickable: true,
          getHexagon: (d) => d.h3,
          getFillColor: (d) =>
            getPredictionColor(Number(d.probability ?? d.prediction)),
          getElevation: (d) =>
            getPredictionElevation(Number(d.probability ?? d.prediction)),
          extruded: true,
        })
      );
    }

    return arr;
  }, [
    planktonData,
    sstData,
    swotData,
    sharksData,
    predData,
    sstRange,
    getLayerCfg,
  ]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg,#000,#0a1a2b)",
        overflow: "hidden",
      }}
    >
      <LayerControlPanel
        layers={layers}
        onToggleLayer={handleToggleLayer}
        onOpacityChange={handleOpacityChange}
      />
      <Map
        reuseMaps
        projection="globe"
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        style={{ width: "100%", height: "100%" }}
      >
        <DeckGLOverlay
          layers={deckLayers}
          getTooltip={getTooltip}
          interleaved
        />
      </Map>
    </div>
  );
}
