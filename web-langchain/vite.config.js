import { defineConfig } from 'vite';

export default defineConfig({
  base: '/readme-generator/',  // GitHub Pages 경로
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'langchain': ['@langchain/google-genai']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['@langchain/google-genai']
  }
});
