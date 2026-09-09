import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        jlpt: {
          n5: "#22c55e",
          n4: "#84cc16",
          n3: "#eab308",
          n2: "#f97316",
          n1: "#ef4444",
        },
      },
      fontFamily: {
        sans: [
          "Noto Sans JP",
          "Noto Sans KR",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
