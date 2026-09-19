import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'

export default [
  { ignores: ['dist/', 'node_modules/', 'public/', '.workbuddy/'] },

  // 让 eslint 能读 .vue 单文件组件（只提供解析器，不开任何风格规则）
  ...pluginVue.configs['flat/base'],

  {
    files: ['**/*.{js,mjs,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // <script setup> 的编译器宏，由 Vue 在编译时注入
        defineProps: 'readonly',
        defineEmits: 'readonly',
        defineExpose: 'readonly',
        defineModel: 'readonly',
        defineOptions: 'readonly',
        defineSlots: 'readonly',
        withDefaults: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
    },
  },

  // 构建脚本跑在 node 里
  {
    files: ['scripts/**/*.{js,mjs}', 'vite.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
]
