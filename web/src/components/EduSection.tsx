import { motion } from "framer-motion";
import {
  Fish,
  Droplets,
  Thermometer,
  Wind,
  TrendingDown,
  ArrowRight,
  Globe,
} from "lucide-react";

interface EduSectionProps {
  onNavigate: (section: string) => void;
}

export default function EduSection({ onNavigate }: EduSectionProps) {
  const foodChain = [
    {
      icon: Droplets,
      name: "Plankton",
      color: "text-green-400",
      desc: "Foundation of marine life",
    },
    {
      icon: Fish,
      name: "Small Fish",
      color: "text-blue-400",
      desc: "Primary consumers",
    },
    {
      icon: Fish,
      name: "Medium Fish",
      color: "text-cyan-400",
      desc: "Secondary consumers",
    },
    {
      icon: Fish,
      name: "Sharks",
      color: "text-orange-400",
      desc: "Apex predators",
    },
  ];

  const ecosystemFactors = [
    {
      icon: Thermometer,
      title: "Temperature",
      desc: "Ocean temperature affects species distribution and metabolism",
      color: "from-red-500 to-orange-500",
    },
    {
      icon: Wind,
      title: "Ocean Currents",
      desc: "Currents transport nutrients and regulate marine populations",
      color: "from-cyan-500 to-blue-500",
    },
    {
      icon: Droplets,
      title: "Plankton Blooms",
      desc: "Chlorophyll concentration indicates ocean productivity",
      color: "from-green-500 to-emerald-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-950 to-cyan-950 pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-6xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-500 bg-clip-text text-transparent">
            Dive into the Data
          </h2>
          <p className="text-2xl text-slate-300 max-w-3xl mx-auto">
            Discover how sharks keep our oceans alive and maintain the delicate
            balance of marine ecosystems
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="mb-20"
        >
          <div className="backdrop-blur-md bg-slate-800/40 rounded-2xl p-8 border border-cyan-500/20 shadow-2xl">
            <h3 className="text-3xl font-bold text-cyan-400 mb-8 text-center">
              Why Sharks Are Essential
            </h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <Fish className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-white mb-2">
                      Population Control
                    </h4>
                    <p className="text-slate-300">
                      Sharks regulate prey populations, preventing overgrazing
                      of essential habitats like coral reefs and seagrass beds.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="w-6 h-6 text-orange-400" />
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-white mb-2">
                      Genetic Health
                    </h4>
                    <p className="text-slate-300">
                      By removing weak and sick individuals, sharks ensure
                      stronger, healthier populations throughout the food web.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Droplets className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-white mb-2">
                      Carbon Cycling
                    </h4>
                    <p className="text-slate-300">
                      Sharks influence carbon storage by maintaining healthy
                      phytoplankton populations that absorb CO₂ from the
                      atmosphere.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Wind className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-white mb-2">
                      Ecosystem Balance
                    </h4>
                    <p className="text-slate-300">
                      Without sharks, the entire marine food web becomes
                      unstable, leading to ecosystem collapse.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="mb-20"
        >
          <h3 className="text-3xl font-bold text-cyan-400 mb-8 text-center">
            The Marine Food Chain
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-6">
            {foodChain.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + index * 0.2 }}
                  className="flex items-center gap-4"
                >
                  <div className="backdrop-blur-md bg-slate-800/40 rounded-xl p-6 border border-slate-700/50 text-center min-w-[160px]">
                    <Icon className={`w-12 h-12 ${item.color} mx-auto mb-3`} />
                    <h4 className="text-lg font-semibold text-white mb-1">
                      {item.name}
                    </h4>
                    <p className="text-sm text-slate-400">{item.desc}</p>
                  </div>
                  {index < foodChain.length - 1 && (
                    <ArrowRight className="w-8 h-8 text-cyan-500" />
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="mb-16"
        >
          <h3 className="text-3xl font-bold text-cyan-400 mb-8 text-center">
            Ocean Factors That Shape Marine Life
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            {ecosystemFactors.map((factor, index) => {
              const Icon = factor.icon;
              return (
                <motion.div
                  key={factor.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 + index * 0.2 }}
                  className="backdrop-blur-md bg-slate-800/40 rounded-xl p-6 border border-slate-700/50 hover:border-cyan-500/50 transition-all duration-300"
                >
                  <div
                    className={`w-16 h-16 rounded-full bg-gradient-to-br ${factor.color} bg-opacity-20 flex items-center justify-center mb-4`}
                  >
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="text-xl font-semibold text-white mb-2">
                    {factor.title}
                  </h4>
                  <p className="text-slate-300">{factor.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6, duration: 0.8 }}
          className="text-center"
        >
          <button
            onClick={() => onNavigate("explore")}
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full text-white font-semibold text-lg shadow-lg shadow-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/60 transition-all duration-300 hover:scale-105"
          >
            <Globe className="w-6 h-6" />
            <span>Explore the Ocean Data</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
