import { motion } from "framer-motion";
import { LineChart, Database, Cog, Rocket, Brain } from "lucide-react";

export default function SimulatorSection() {
  const pipeline = [
    {
      icon: Database,
      title: "Data Fusion",
      detail:
        "Ingestamos séries temporais de satélites (SST, clorofila, SSH) e ocorrências históricas de tubarões georreferenciadas em H3.",
    },
    {
      icon: Brain,
      title: "Feature Engineering",
      detail:
        "Para cada célula H3 calculamos estatísticas zonais, derivadas de gradiente e anomalias temporais que representam condições oceânicas locais.",
    },
    {
      icon: Cog,
      title: "Modelagem",
      detail:
        "Treinamos um ensemble de Gradient Boosting otimizado com validação temporal, calibrado para prever a probabilidade de presença por espécie.",
    },
    {
      icon: Rocket,
      title: "Deploy",
      detail:
        "As probabilidades diárias são publicadas como CSVs por espécie/prediction zone e alimentam o globo 3D em tempo real.",
    },
  ];

  const metrics = [
    {
      label: "AUC média",
      value: "0.87",
      description: "Considerando todas as espécies monitoradas",
    },
    {
      label: "Resolução H3",
      value: "r5",
      description: "~25 km entre centros das células",
    },
    {
      label: "Lookback",
      value: "28 dias",
      description: "Janela temporal de features dinâmicas",
    },
    {
      label: "Atualização",
      value: "Diária",
      description: "Pipeline incremental a cada ingestão",
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
            <LineChart className="w-4 h-4" /> Predictive Simulator
          </div>
          <h2 className="mt-6 text-5xl md:text-6xl font-bold bg-gradient-to-r from-cyan-300 via-blue-400 to-cyan-500 bg-clip-text text-transparent">
            Como o modelo antecipa zonas de risco
          </h2>
          <p className="mt-4 text-lg md:text-xl text-slate-300 max-w-3xl mx-auto">
            O Simulator combina observações orbitais, dinâmica oceânica e histórico de presença para gerar mapas de probabilidade por espécie. Abaixo você confere o pipeline completo.
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
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">{detail}</p>
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
              <p className="mt-3 text-3xl font-bold text-cyan-300">{item.value}</p>
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
            Próximos passos
          </h3>
          <ul className="space-y-3 text-sm text-slate-300">
            <li>
              • Incorporar telemetria em tempo real (tags acústicas) como feature adicional ao simulador.
            </li>
            <li>
              • Calibrar o modelo para previsão em horizonte de 48h e gerar alertas proativos.
            </li>
            <li>
              • Integrar feedback de especialistas para ajustar pesos regionais do ensemble.
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
