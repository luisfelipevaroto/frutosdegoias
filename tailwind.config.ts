import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Ajuste estes tons para bater com o logo/identidade real da unidade
        // (extrair do site frutosdegoias.com.br ou do material de marca do dono)
        brand: {
          50: "#fef3ea",
          100: "#fbdfc2",
          400: "#f0994f",
          600: "#d9721f",
          700: "#a8551a",
          900: "#5c2d0e",
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
