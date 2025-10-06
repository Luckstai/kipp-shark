import { useState } from "react";
import {
  Waves,
  BookOpen,
  Globe,
  Cpu,
  LineChart,
  Menu,
  X,
} from "lucide-react";

interface NavbarProps {
  currentSection: string;
  onNavigate: (section: string) => void;
}

export default function Navbar({ currentSection, onNavigate }: NavbarProps) {
  const isScrolled = false;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const sections = [
    { id: "explore", label: "Explore", icon: Globe },
    { id: "learn", label: "Learn", icon: BookOpen },
    { id: "simulator", label: "Prediction Engine", icon: LineChart },
    { id: "innovate", label: "Innovate", icon: Cpu },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
      <div
        className={`backdrop-blur-md transition-all duration-300 ${
          isScrolled ? "bg-slate-900/80 shadow-lg" : "bg-slate-900/40"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Waves className="w-8 h-8 text-cyan-400" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                SharkSense
              </h1>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => onNavigate(section.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                      currentSection === section.id
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                        : "text-slate-300 hover:bg-slate-800/50 hover:text-cyan-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{section.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="md:hidden flex h-11 w-11 items-center justify-center rounded-full border border-cyan-500/40 bg-slate-900/70 text-cyan-200 shadow hover:bg-slate-800/70 transition"
              aria-label="Toggle navigation"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="absolute left-0 top-[72px] w-full rounded-b-3xl border border-cyan-500/30 bg-slate-900/95 backdrop-blur-md shadow-xl">
            <div className="px-6 py-4 grid gap-3">
              {sections.map((section) => {
                const Icon = section.icon;
                const active = currentSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      onNavigate(section.id);
                      setIsMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
                      active
                        ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
                        : "text-slate-200 border border-slate-700/40 hover:border-cyan-400/40"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
