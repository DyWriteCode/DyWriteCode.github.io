import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default ({ mode }) => {
  return defineConfig({
    base: loadEnv(mode, process.cwd()).VITE_BASE_URL,
    plugins: [vue()],
    server: {
      https: true,
      host: '0.0.0.0',
    },
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.vue'],
    },
    define: {
      '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': JSON.stringify(false),
      '__VUE_OPTIONS_API__': JSON.stringify(true),  // 使用选项式 API 就开
      '__VUE_PROD_DEVTOOLS__': JSON.stringify(false) // 生产关闭 devtools
    }
  })
}
