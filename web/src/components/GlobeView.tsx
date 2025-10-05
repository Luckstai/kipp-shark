"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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

const s3Domain = "https://source-bucket-kipp.s3.us-west-2.amazonaws.com";
const s3BucketName = "hackathon-nasa-2025";
const s3Bucket = `${s3Domain}/${s3BucketName}`;

const REMOTE_SOURCES = {
  plankton: `${s3Bucket}/planktons/AQUA_MODIS.20250101_20250131.L3m.MO.CHL.chlor_a.9km.h3r5.csv`,
  sst: `${s3Bucket}/sst/AQUA_MODIS.20250101_20250131.L3m.MO.SST.sst.9km.h3r5.csv`,
  swot: `${s3Bucket}/swot/swot_20251001.csv`,
  sharks: `${s3Bucket}/sharks/shark_full/sharks_h3r5_2015-01-01_2025-01-01.csv`,
  predictions: `${s3Bucket}/sharks-prediction/predictions.csv`,
  sharkCarcharhinusPredictions: `${s3Bucket}/sharks-prediction/predictions_full_Carcharhinus.csv`,
  sharkGaleocerdoPredictions: `${s3Bucket}/sharks-prediction/predictions_full_Galeocerdo.csv`,
  sharkSphyrnaPredictions: `${s3Bucket}/sharks-prediction/predictions_full_Sphyrna.csv`,
  sharkPrionacePredictions: `${s3Bucket}/sharks-prediction/predictions_full_Prionace.csv`,
  sharkCarcharodonPredictions: `${s3Bucket}/sharks-prediction/predictions_full_Carcharodon.csv`,
} as const;

const PREDICTION_SPECIES_SOURCES: Record<string, string> = {
  Carcharhinus: REMOTE_SOURCES.sharkCarcharhinusPredictions,
  Galeocerdo: REMOTE_SOURCES.sharkGaleocerdoPredictions,
  Sphyrna: REMOTE_SOURCES.sharkSphyrnaPredictions,
  Prionace: REMOTE_SOURCES.sharkPrionacePredictions,
  Carcharodon: REMOTE_SOURCES.sharkCarcharodonPredictions,
};

const CORS_PROXY = (import.meta.env.VITE_CORS_PROXY ?? "").trim();

const resolveSourceUrl = (url: string) => {
  if (CORS_PROXY && url.startsWith("http")) {
    const encoded = encodeURIComponent(url);
    return `${CORS_PROXY}${encoded}`;
  }
  return url;
};

const INITIAL_VIEW_STATE: ViewState = {
  longitude: 0,
  latitude: 0,
  zoom: 1.6,
  pitch: 0,
  bearing: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
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
        (clampedT - current.t) /
        (next.t - current.t === 0 ? 1 : next.t - current.t);
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

const getSstElevation = (
  value: number,
  range: { min: number; max: number }
) => {
  if (!Number.isFinite(value)) return 0;
  const span = range.max - range.min;
  const normalized = span === 0 ? 0 : (value - range.min) / span;
  const clamped = clamp(normalized, 0, 1);
  return clamped * 60000;
};

const getPredictionColor = (
  value: number
): [number, number, number, number] => {
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

const parseCsvText = (text: string): DataPoint[] => {
  const { data } = Papa.parse<DataPoint>(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  return Array.isArray(data) ? data : [];
};

const normalizeCsvRows = (rows: DataPoint[]): DataPoint[] =>
  rows
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
        if (h3.isValidCell(h3field)) {
          try {
            const [lat, lon] = h3.cellToLatLng(h3field);
            if (!Number.isFinite(row.latitude)) row.latitude = lat;
            if (!Number.isFinite(row.longitude)) row.longitude = lon;
          } catch (error) {
            // ignore conversion issues but keep row
          }
        } else {
          delete row.h3;
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

      if (
        row.prediction !== undefined &&
        row.probability === undefined &&
        Number.isFinite(Number(row.prediction))
      ) {
        row.probability = Number(row.prediction);
      }

      return row;
    })
    .filter((row) => {
      const hasH3 =
        typeof row.h3 === "string" &&
        row.h3.length > 0 &&
        h3.isValidCell(row.h3);
      const hasCoords =
        Number.isFinite(row.latitude) &&
        Number.isFinite(row.longitude) &&
        Math.abs(Number(row.latitude)) <= 90 &&
        Math.abs(Number(row.longitude)) <= 180;
      return hasH3 || hasCoords;
    });

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
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([]);
  const [isSpeciesModalOpen, setSpeciesModalOpen] = useState(false);
  const [selectedPredictionSpecies, setSelectedPredictionSpecies] = useState<string[]>([]);
  const [isPredictionModalOpen, setPredictionModalOpen] = useState(false);
  const [predictionSpeciesCache, setPredictionSpeciesCache] = useState<
    Record<string, DataPoint[]>
  >({});
  const [predictionSpeciesLoading, setPredictionSpeciesLoading] = useState<
    Record<string, boolean>
  >({});
  const [loadingState, setLoadingState] = useState({
    plankton: false,
    sst: false,
    swot: false,
    sharks: false,
    predictions: false,
  });

  const setDatasetLoading = useCallback(
    (key: keyof typeof loadingState, value: boolean) => {
      setLoadingState((prev) => ({ ...prev, [key]: value }));
    },
    [setLoadingState]
  );

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

  const handleOpacityChange = useCallback(
    (layerId: LayerId, opacity: number) => {
      setLayers((prev) =>
        prev.map((layer) =>
          layer.id === layerId ? { ...layer, opacity } : layer
        )
      );
    },
    []
  );

  const fetchCsvData = useCallback(async (sources: string[]): Promise<DataPoint[]> => {
    for (const source of sources) {
      try {
        const requestUrl = resolveSourceUrl(source);
        const isRemote = requestUrl.startsWith("http");
        const response = await fetch(requestUrl, {
          mode: isRemote ? "cors" : "same-origin",
        });

        if (!response.ok) {
          continue;
        }

        const text = await response.text();
        const parsed = normalizeCsvRows(parseCsvText(text));

        if (parsed.length) {
          return parsed;
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn(`Falha ao carregar CSV de ${source}`, error);
        }
      }
    }

    return [];
  }, []);

  const loadCSV = useCallback(
    async (
      sources: string[],
      setter: (rows: DataPoint[]) => void,
      options?: { loadingKey?: keyof typeof loadingState }
    ) => {
      if (options?.loadingKey) setDatasetLoading(options.loadingKey, true);
      const rows = await fetchCsvData(sources);
      setter(rows);
      if (options?.loadingKey) setDatasetLoading(options.loadingKey, false);
    },
    [fetchCsvData, setDatasetLoading]
  );

  useEffect(() => {
    void loadCSV(
      [REMOTE_SOURCES.plankton, "/data/plancton_20241117.csv"],
      setPlanktonData,
      { loadingKey: "plankton" }
    );
    void loadCSV(
      [REMOTE_SOURCES.sst, "/data/sst_20241117.csv"],
      setSstData,
      { loadingKey: "sst" }
    );
    void loadCSV(
      [REMOTE_SOURCES.swot, "/data/swot_20251001.csv"],
      setSwotData,
      { loadingKey: "swot" }
    );
    void loadCSV(
      [REMOTE_SOURCES.sharks, "/data/sharks_20241117.csv"],
      setSharksData,
      { loadingKey: "sharks" }
    );
    void loadCSV(
      [REMOTE_SOURCES.predictions, "/data/predictions.csv"],
      setPredData,
      { loadingKey: "predictions" }
    );
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

  const sharkSpecies = useMemo(() => {
    const set = new Set<string>();
    sharksData.forEach((row) => {
      if (row.species) {
        set.add(String(row.species));
      }
    });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [sharksData]);

  const predictionSpecies = useMemo(
    () => Object.keys(PREDICTION_SPECIES_SOURCES).sort((a, b) => a.localeCompare(b)),
    []
  );

  useEffect(() => {
    if (!selectedSpecies.length) return;
    const valid = selectedSpecies.filter((species) =>
      sharkSpecies.includes(species)
    );
    if (valid.length !== selectedSpecies.length) {
      setSelectedSpecies(valid);
    }
  }, [selectedSpecies, sharkSpecies]);

  useEffect(() => {
    if (!selectedPredictionSpecies.length) return;
    const valid = selectedPredictionSpecies.filter((species) =>
      predictionSpecies.includes(species)
    );
    if (valid.length !== selectedPredictionSpecies.length) {
      setSelectedPredictionSpecies(valid);
    }
  }, [selectedPredictionSpecies, predictionSpecies]);

  useEffect(() => {
    selectedPredictionSpecies.forEach((species) => {
      if (predictionSpeciesCache[species] || predictionSpeciesLoading[species]) {
        return;
      }

      const source = PREDICTION_SPECIES_SOURCES[species];
      if (!source) return;

      setPredictionSpeciesLoading((prev) => ({ ...prev, [species]: true }));
      fetchCsvData([source]).then((rows) => {
      setPredictionSpeciesCache((prev) => ({ ...prev, [species]: rows }));
      setPredictionSpeciesLoading((prev) => ({ ...prev, [species]: false }));
      if (!rows.length && import.meta.env.DEV) {
        console.warn(`Sem dados retornados para a espécie ${species}`);
      }
    });
    });
  }, [
    selectedPredictionSpecies,
    predictionSpeciesCache,
    predictionSpeciesLoading,
    fetchCsvData,
  ]);

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

  const activePredData = useMemo(() => {
    if (selectedPredictionSpecies.length === 0) {
      return predData;
    }

    const combined: DataPoint[] = [];
    selectedPredictionSpecies.forEach((species) => {
      const rows = predictionSpeciesCache[species];
      if (rows?.length) {
        combined.push(...rows);
      }
    });
    return combined;
  }, [predData, selectedPredictionSpecies, predictionSpeciesCache]);

  const predictionFilterLabel = useMemo(() => {
    if (selectedPredictionSpecies.length === 0) {
      return "Filter species";
    }
    return `${selectedPredictionSpecies.length} species selected`;
  }, [selectedPredictionSpecies]);

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
            typeof d.h3 === "string" && h3.isValidCell(d.h3)
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
      const filtered =
        selectedSpecies.length === 0
          ? sharksData
          : sharksData.filter((row) => selectedSpecies.includes(row.species));
      arr.push(
        new ScatterplotLayer({
          id: "sharks-scatter",
          data: filtered,
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
    if (predCfg?.enabled && activePredData.length) {
      arr.push(
        new H3HexagonLayer({
          id: "predictions-h3",
          data: activePredData,
          opacity: predCfg.opacity,
          pickable: true,
          getHexagon: (d) =>
            typeof d.h3 === "string" && h3.isValidCell(d.h3) ? d.h3 : null,
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
    activePredData,
    sstRange,
    selectedSpecies,
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
        onOpenSpeciesFilter={() => setSpeciesModalOpen(true)}
        hasSpeciesFilter={sharkSpecies.length > 0}
        onOpenPredictionFilter={() => setPredictionModalOpen(true)}
        hasPredictionFilter={predictionSpecies.length > 0}
        predictionFilterLabel={predictionFilterLabel}
        loadingState={loadingState}
      />
      {sharkSpecies.length > 0 && isSpeciesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[90vw] max-w-xl bg-slate-900/95 border border-cyan-500/40 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
              <div>
                <h3 className="text-lg font-semibold text-cyan-300">
                  Filter Shark Species
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Select one or more species to highlight their occurrences on
                  the globe.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSpeciesModalOpen(false)}
                className="text-slate-400 hover:text-cyan-300 transition"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[320px] overflow-y-auto px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/70 border border-slate-700/70 hover:border-cyan-400/60 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSpecies.length === 0}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedSpecies([]);
                    }
                  }}
                  className="accent-cyan-400"
                />
                <span className="text-sm font-medium">All species</span>
              </label>
              {sharkSpecies.map((species) => {
                const checked = selectedSpecies.includes(species);
                return (
                  <label
                    key={species}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer ${
                      checked
                        ? "bg-cyan-500/20 border-cyan-400/60"
                        : "bg-slate-800/70 border-slate-700/70 hover:border-cyan-400/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedSpecies((prev) => [...prev, species]);
                        } else {
                          setSelectedSpecies((prev) =>
                            prev.filter((item) => item !== species)
                          );
                        }
                      }}
                      className="accent-cyan-400"
                    />
                    <span className="text-sm font-medium">{species}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700/60 bg-slate-900/70">
              <button
                type="button"
                onClick={() => {
                  setSelectedSpecies([]);
                  setSpeciesModalOpen(false);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-cyan-200 transition"
              >
                Clear filters
              </button>
              <button
                type="button"
                onClick={() => setSpeciesModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-500/90 text-slate-950 hover:bg-cyan-400 transition"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
      {predictionSpecies.length > 0 && isPredictionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[90vw] max-w-xl bg-slate-900/95 border border-cyan-500/40 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
              <div>
                <h3 className="text-lg font-semibold text-cyan-300">
                  Filter Predicted Zones
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Combine probability grids for selected shark species.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPredictionModalOpen(false)}
                className="text-slate-400 hover:text-cyan-300 transition"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[320px] overflow-y-auto px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/70 border border-slate-700/70 hover:border-cyan-400/60 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPredictionSpecies.length === 0}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedPredictionSpecies([]);
                    }
                  }}
                  className="accent-cyan-400"
                />
                <span className="text-sm font-medium">All species</span>
              </label>
              {predictionSpecies.map((species) => {
                const checked = selectedPredictionSpecies.includes(species);
                const loading = predictionSpeciesLoading[species];
                const hasData = Boolean(predictionSpeciesCache[species]?.length);
                return (
                  <label
                    key={species}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer ${
                      checked
                        ? "bg-cyan-500/20 border-cyan-400/60"
                        : "bg-slate-800/70 border-slate-700/70 hover:border-cyan-400/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedPredictionSpecies((prev) =>
                            prev.includes(species) ? prev : [...prev, species]
                          );
                        } else {
                          setSelectedPredictionSpecies((prev) =>
                            prev.filter((item) => item !== species)
                          );
                        }
                      }}
                      className="accent-cyan-400"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{species}</span>
                      {loading && (
                        <span className="text-xs text-cyan-300">loading…</span>
                      )}
                      {checked && !loading && !hasData && (
                        <span className="text-xs text-red-300">no data</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700/60 bg-slate-900/70">
              <button
                type="button"
                onClick={() => {
                  setSelectedPredictionSpecies([]);
                  setPredictionModalOpen(false);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-cyan-200 transition"
              >
                Clear filters
              </button>
              <button
                type="button"
                onClick={() => setPredictionModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-500/90 text-slate-950 hover:bg-cyan-400 transition"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
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
