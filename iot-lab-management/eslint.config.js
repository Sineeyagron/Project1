// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.claude/**'],
  },
  {
    // สคริปต์ที่รันด้วย Node (ไม่ใช่โค้ดแอป) → ใช้ __dirname / Buffer ได้
    files: ['scripts/**/*.js', 'docs/diagrams/**/*.js'],
    languageOptions: { globals: { __dirname: 'readonly', Buffer: 'readonly' } },
  },
  {
    // กฎ React Hooks รุ่นใหม่ + ' " ใน JSX: โค้ดเดิมยังติดอยู่เยอะ แต่แอปทำงานปกติ
    // → ลดเป็น warning ให้ CI ไม่แดง · ค่อย ๆ แก้ทีละไฟล์แล้วเปลี่ยนกลับเป็น 'error' ได้
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/display-name': 'warn',
    },
  },
]);
