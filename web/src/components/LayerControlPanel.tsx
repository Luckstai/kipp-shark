import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

export interface LayerConfig<T extends string = string> {
  id: T;
  name: string;
  color: string;
  enabled: boolean;
  opacity: number;
}

interface LayerControlPanelProps<T extends string = string> {
  layers: LayerConfig<T>[];
  onToggleLayer: (layerId: T) => void;
  onOpacityChange: (layerId: T, opacity: number) => void;
  onOpenSpeciesFilter?: () => void;
  hasSpeciesFilter?: boolean;
  onOpenPredictionFilter?: () => void;
  hasPredictionFilter?: boolean;
  predictionFilterLabel?: string;
  loadingState?: Partial<Record<T, boolean>>;
}

export default function LayerControlPanel<T extends string>({
  layers,
  onToggleLayer,
  onOpacityChange,
  onOpenSpeciesFilter,
  hasSpeciesFilter,
  onOpenPredictionFilter,
  hasPredictionFilter,
  predictionFilterLabel,
  loadingState,
}: LayerControlPanelProps<T>) {
  return (
    <motion.div
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="absolute left-6 top-24 z-10 w-80"
    >
      <div className="backdrop-blur-md bg-slate-900/90 rounded-2xl border border-cyan-500/30 shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4">
          <h3 className="text-xl font-bold text-white">Data Layers</h3>
          <p className="text-sm text-cyan-100 mt-1">
            Toggle and adjust ocean data
          </p>
        </div>

        <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {layers.map((layer) => (
            <div
              key={layer.id}
              className={`p-4 rounded-xl border transition-all duration-300 ${
                layer.enabled
                  ? "bg-slate-800/50 border-cyan-500/50"
                  : "bg-slate-800/20 border-slate-700/50"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: layer.color }}
                  />
                  <span
                    className={`font-medium ${
                      layer.enabled ? "text-white" : "text-slate-400"
                    }`}
                  >
                    {layer.name}
                  </span>
                </div>
                <button
                  onClick={() => onToggleLayer(layer.id)}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    layer.enabled
                      ? "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                      : "bg-slate-700/50 text-slate-500 hover:bg-slate-700"
                  }`}
                >
                  {layer.enabled ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>

              {layer.enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  {loadingState?.[layer.id] && (
                    <div className="flex items-center gap-2 text-xs text-cyan-300">
                      <span className="animate-spin inline-flex h-3 w-3 rounded-full border border-cyan-400 border-t-transparent" />
                      Loading data…
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Opacity</span>
                    <span className="text-cyan-400 font-medium">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={layer.opacity}
                    onChange={(e) =>
                      onOpacityChange(layer.id, parseFloat(e.target.value))
                    }
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  {layer.id === "sharks" && hasSpeciesFilter && onOpenSpeciesFilter && (
                    <button
                      type="button"
                      onClick={onOpenSpeciesFilter}
                      className="mt-3 w-full text-sm font-medium text-cyan-300 hover:text-cyan-100 hover:bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2 transition"
                    >
                      Filter species
                    </button>
                  )}
                  {layer.id === "predictions" &&
                    hasPredictionFilter &&
                    onOpenPredictionFilter && (
                      <button
                        type="button"
                        onClick={onOpenPredictionFilter}
                        className="mt-3 w-full text-sm font-medium text-cyan-300 hover:text-cyan-100 hover:bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2 transition"
                      >
                        {predictionFilterLabel ?? "Filter species"}
                      </button>
                    )}
                </motion.div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-slate-900/50 px-6 py-3 border-t border-slate-700/50">
          <p className="text-xs text-slate-400 text-center">
            Data from NASA & OBIS satellites
          </p>
        </div>
      </div>
    </motion.div>
  );
}
