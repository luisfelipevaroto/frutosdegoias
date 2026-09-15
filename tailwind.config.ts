import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Extraído da logo oficial (logo-frutos-de-goias-footer.svg):
        // verde em gradiente (#005321 → #007732) como cor principal da marca.
        brand: {
          50: "#e7f4ec",
          100: "#c3e4cf",
          400: "#1f9455",
          600: "#007732", // verde principal do gradiente da logo
          700: "#005321", // verde escuro do gradiente da logo
          900: "#003315",
        },
        // Amarelo de destaque, também extraído da logo (#FFE000)
        accent: {
          400: "#ffe64d",
          DEFAULT: "#FFE000",
          600: "#e0c400",
        },
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
