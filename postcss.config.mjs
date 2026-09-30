// PostCSS transforme notre CSS au moment du build :
// - tailwindcss : génère les classes Tailwind (v3) utilisées dans le code
// - autoprefixer : ajoute les préfixes navigateurs (-webkit-, …) si besoin
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
