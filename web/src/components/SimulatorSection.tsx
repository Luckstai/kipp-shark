import { motion } from "framer-motion";
import { LineChart, Database, Cog, Radar, Brain } from "lucide-react";

export default function SimulatorSection() {
  const pipeline = [
    {
      icon: Database,
      title: "Data Fusion",
      detail:
        "We ingest satellite time series (SST, chlorophyll, SSH) from the past decade (2015 onward) alongside historical shark encounters georeferenced in H3.",
    },
    {
      icon: Brain,
      title: "Feature Engineering",
      detail:
        "For every H3 cell we compute zonal statistics, gradient derivatives, and temporal anomalies that capture local ocean conditions.",
    },
    {
      icon: Cog,
      title: "Modeling",
      detail:
        "We train a gradient-boosted ensemble with temporal validation, calibrated to estimate per-species presence probability.",
    },
    {
      icon: Radar,
      title: "Predictions",
      detail:
        "We generate global predictions for every H3 cell on the planet, delivering species-specific probability maps that keep the 3D globe alive with fresh intelligence.",
    },
  ];

  const metrics = [
    {
      label: "Mean Average Error",
      value: "0.0767",
      description: "Across all monitored species",
    },
    {
      label: "H3 Resolution",
      value: "r5",
      description: "~25 km between cell centroids",
    },
    {
      label: "Lookback",
      value: "10 years",
      description: "Temporal window for dynamic features",
    },
    {
      label: "Update Frequency",
      value: "Monthly",
      description: "Incremental pipeline upon each ingestion",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-950 to-cyan-950 pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center justify-center gap-3 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-6 py-2 text-cyan-300 text-sm font-semibold uppercase tracking-widest">
            <LineChart className="w-4 h-4" /> Prediction Engine
          </div>
          <h2 className="mt-6 text-5xl md:text-6xl font-bold bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-500 bg-clip-text text-transparent">
            How the model anticipates risk zones
          </h2>
          <p className="mt-4 text-lg md:text-xl text-slate-300 max-w-3xl mx-auto">
            The engine blends orbital observations, ocean dynamics, and
            historical occurrences to generate per-species probability maps.
            The pipeline below shows each stage behind the predictions.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="grid gap-6 md:grid-cols-2"
        >
          {pipeline.map(({ icon: Icon, title, detail }) => (
            <div
              key={title}
              className="backdrop-blur-lg bg-slate-900/70 border border-cyan-500/20 rounded-2xl p-6 shadow-xl"
            >
              <div className="flex items-center gap-3 text-cyan-300">
                <Icon className="w-5 h-5" />
                <h3 className="text-lg font-semibold text-white">{title}</h3>
              </div>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                {detail}
              </p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="mt-16 grid gap-6 md:grid-cols-4"
        >
          {metrics.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-cyan-500/20 bg-slate-900/70 px-6 py-8 text-center shadow-lg"
            >
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {item.label}
              </p>
              <p className="mt-3 text-3xl font-bold text-cyan-300">
                {item.value}
              </p>
              <p className="mt-2 text-xs text-slate-400">{item.description}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.7 }}
          className="mt-16 rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-8 shadow-xl"
        >
          <h3 className="text-2xl font-semibold text-cyan-300 mb-4">
            Next steps
          </h3>
          <ul className="space-y-3 text-sm text-slate-300">
            <li>
              • Integrate live telemetry (acoustic tags) as an additional
              simulator feature.
            </li>
            <li>
              • Calibrate the model for a 48-hour forecast horizon to deliver
              proactive alerts.
            </li>
            <li>
              • Incorporate expert feedback to adjust regional ensemble weights.
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
