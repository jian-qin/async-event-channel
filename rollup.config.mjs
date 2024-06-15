import { defineConfig } from 'rollup'
import typescript from '@rollup/plugin-typescript'

export default defineConfig({
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
    },
    {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'AsyncEventChannel',
    },
  ],
  plugins: [
    typescript(),
  ],
})