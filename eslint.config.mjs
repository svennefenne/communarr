import next from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...next,
  ...nextTs,
  { ignores: [".next/**", "node_modules/**", "public/**", "scripts/**"] },
  {
    rules: {
      "@next/next/no-img-element": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      // Date.now() while rendering is a deliberate snapshot here (is an invite expired, is an event over)
      "react-hooks/purity": "off",
    },
  },
];

export default config;
