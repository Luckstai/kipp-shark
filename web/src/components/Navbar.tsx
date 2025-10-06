import { Waves, BookOpen, Globe, Cpu, LineChart } from "lucide-react";

interface NavbarProps {
  currentSection: string;
  onNavigate: (section: string) => void;
}

export default function Navbar({ currentSection, onNavigate }: NavbarProps) {
  const isScrolled = false;

  const sections = [
    { id: "learn", label: "Learn", icon: BookOpen },
    { id: "explore", label: "Explore", icon: Globe },
    { id: "simulator", label: "Simulator", icon: LineChart },
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

            <div className="flex items-center gap-2">
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
          </div>
        </div>
      </div>
    </nav>
  );
}
