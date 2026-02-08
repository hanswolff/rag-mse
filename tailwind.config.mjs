/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          blue: {
            50: "#f2f5f7",
            100: "#e1e7ec",
            200: "#c6d1db",
            300: "#a4b4c4",
            400: "#7f94ac",
            500: "#5b748f",
            600: "#3f5a74",
            700: "#2d4359",
            800: "#1e2f41",
            900: "#13202d",
            950: "#0b1218",
          },
          red: {
            50: "#fdf2f2",
            100: "#fbe5e6",
            200: "#f6c7cb",
            300: "#ef9aa3",
            400: "#e56b79",
            500: "#d23b4e",
            600: "#c8102e",
            700: "#a10d25",
            800: "#7a0a1c",
            900: "#520613",
            950: "#2d030a",
          },
          gold: {
            50: "#fbf8f0",
            100: "#f2e9d5",
            200: "#e6d6ad",
            300: "#d7bd7c",
            400: "#c9a54b",
            500: "#b78e34",
            600: "#95732a",
            700: "#6f5620",
            800: "#4a3a15",
            900: "#251d0b",
            950: "#120e05",
          },
          black: "#000000",
        },
      },
      zIndex: {
        overlay: 50,
        mapPane: 500,
        mapControl: 600,
        header: 1000,
        dropdown: 1040,
        modal: 1050,
      },
    },
  },
  plugins: [],
};

export default config;
