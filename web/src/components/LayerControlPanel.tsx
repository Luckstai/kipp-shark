import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

export interface LayerConfig {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
  opacity: number;
}

interface LayerControlPanelProps {
  layers: LayerConfig[];
  onToggleLayer: (layerId: string) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
}

export default function LayerControlPanel({
  layers,
  onToggleLayer,
  onOpacityChange,
}: LayerControlPanelProps) {
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
