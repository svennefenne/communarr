import {
  Atkinson_Hyperlegible,
  Bebas_Neue,
  Caveat,
  Comfortaa,
  Comic_Neue,
  Inter,
  JetBrains_Mono,
  Lora,
  Nunito,
  Orbitron,
  Playfair_Display,
  Press_Start_2P,
  Righteous,
  Saira,
  Share_Tech_Mono,
  Space_Grotesk,
  Special_Elite,
} from "next/font/google";

/**
 * Every font as a CSS variable on <html> (see fontChoices.ts). Only Saira and the mono are
 * preloaded; browsers fetch the others the first time something uses them. (next/font wants each
 * call's options written out in full.)
 */
const saira = Saira({ subsets: ["latin"], axes: ["wdth"], variable: "--ff-saira", display: "swap" });
const tech = Share_Tech_Mono({ subsets: ["latin"], weight: "400", variable: "--ff-tech", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--ff-inter", display: "swap", preload: false });
const lora = Lora({ subsets: ["latin"], variable: "--ff-lora", display: "swap", preload: false });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--ff-mono", display: "swap", preload: false });
const caveat = Caveat({ subsets: ["latin"], variable: "--ff-caveat", display: "swap", preload: false });
const typewriter = Special_Elite({ subsets: ["latin"], weight: "400", variable: "--ff-typewriter", display: "swap", preload: false });
const comic = Comic_Neue({ subsets: ["latin"], weight: ["400", "700"], variable: "--ff-comic", display: "swap", preload: false });
const pixel = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--ff-pixel", display: "swap", preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--ff-playfair", display: "swap", preload: false });
const comfortaa = Comfortaa({ subsets: ["latin"], variable: "--ff-comfortaa", display: "swap", preload: false });
const orbitron = Orbitron({ subsets: ["latin"], variable: "--ff-orbitron", display: "swap", preload: false });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--ff-bebas", display: "swap", preload: false });
const righteous = Righteous({ subsets: ["latin"], weight: "400", variable: "--ff-righteous", display: "swap", preload: false });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--ff-space", display: "swap", preload: false });
const nunito = Nunito({ subsets: ["latin"], variable: "--ff-nunito", display: "swap", preload: false });
const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--ff-atkinson", display: "swap", preload: false });

export const fontVariables = [saira, tech, inter, lora, mono, caveat, typewriter, comic, pixel, playfair, comfortaa, orbitron, bebas, righteous, space, nunito, atkinson]
  .map((f) => f.variable)
  .join(" ");
