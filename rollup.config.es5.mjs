import { defineConfig } from 'rollup'
import typescript from '@rollup/plugin-typescript'
import { babel } from '@rollup/plugin-babel'

export default defineConfig({
  input: 'src/index.ts',
  output: [
    {
      file: 'dist-es5/index.js',
      format: 'cjs',
    },
    {
      file: 'dist-es5/index.esm.js',
      format: 'esm',
    },
    {
      file: 'dist-es5/index.umd.js',
      format: 'umd',
      name: 'AsyncEventChannel',
    },
  ],
  plugins: [
    typescript(),
    babel({
      extensions: ['.ts'],
    }),
  ],
})