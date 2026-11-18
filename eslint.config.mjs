import next from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...next,
  ...nextTs,
  { ignores: [".next/**", "node_modules/**", "public/**", "scripts/**", "desktop/**"] },
  {
    rules: {
      "@next/next/no-img-element": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      // Date.now() while rendering is a deliberate snapshot here (is an invite expired, is an event over)
      "react-hooks/purity": "off",
      // an effect's arrow with braces: whatever it returns is called as its cleanup, and a browser API that
      // starts returning something (scrollIntoView now gives a promise) takes the page down when it goes
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name=/^use(Layout|Insertion)?Effect$/] > ArrowFunctionExpression[body.type!='BlockStatement'][body.type!='ArrowFunctionExpression'][body.type!='FunctionExpression']",
          message: "Give the effect's arrow braces: what it returns is called as its cleanup.",
        },
      ],
    },
  },
];

export default config;
