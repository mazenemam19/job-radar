import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#090e1a",
          800: "#0d1525",
          700: "#111c30",
          600: "#162238",
          500: "#1e3050",
        },
      },
    },
  },
  plugins: [],
};
export default config;
