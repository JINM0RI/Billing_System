/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 20px 60px rgba(9, 28, 57, 0.16)',
      },
      backgroundImage: {
        'panel-radial': 'radial-gradient(circle at top left, rgba(251, 191, 36, 0.24), transparent 45%), linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.9))',
      },
    },
  },
  plugins: [],
};
