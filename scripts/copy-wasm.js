const fs = require('fs');
const path = require('path');

// Create directories if they don't exist
const publicDir = path.join(process.cwd(), 'public');
const sqlJsDir = path.join(publicDir, 'sql.js');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

if (!fs.existsSync(sqlJsDir)) {
  fs.mkdirSync(sqlJsDir);
}

// Copy SQL.js WebAssembly file
const sourceWasm = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const targetWasm = path.join(sqlJsDir, 'sql-wasm.wasm');

try {
  fs.copyFileSync(sourceWasm, targetWasm);
  console.log('Successfully copied sql-wasm.wasm to public/sql.js/');
} catch (error) {
  console.error('Error copying sql-wasm.wasm:', error);
  process.exit(1);
} 