import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/addon.tsx'),
      name: 'WealthfolioPortfolioMetricsAddon',
      fileName: () => 'addon.js',
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@wealthfolio/addon-sdk',
        '@wealthfolio/ui',
        '@tanstack/react-query',
        'lucide-react',
        'recharts',
        'date-fns',
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@wealthfolio/addon-sdk': 'WealthfolioAddonSdk',
          '@wealthfolio/ui': 'WealthfolioUI',
          '@tanstack/react-query': 'TanStackReactQuery',
          'lucide-react': 'LucideReact',
          recharts: 'Recharts',
        },
      },
    },
    minify: true,
  },
});
