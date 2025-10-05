import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "./components/Navbar";
import EduSection from "./components/EduSection";
import GlobeView from "./components/GlobeView";
import Shark3DView from "./components/Shark3DView";

function App() {
  const [currentSection, setCurrentSection] = useState("learn");

  const handleNavigate = (section: string) => {
    setCurrentSection(section);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white overflow-x-hidden">
      <Navbar currentSection={currentSection} onNavigate={handleNavigate} />

      <AnimatePresence mode="wait">
        {currentSection === "learn" && (
          <motion.div
            key="learn"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.5 }}
          >
            <EduSection onNavigate={handleNavigate} />
          </motion.div>
        )}

        {currentSection === "explore" && (
          <motion.div
            key="explore"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.5 }}
          >
            <GlobeView />
          </motion.div>
        )}

        {currentSection === "innovate" && (
          <motion.div
            key="innovate"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.5 }}
          >
            <Shark3DView />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
