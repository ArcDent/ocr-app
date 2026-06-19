# OCR App - Phase 1: Project Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up Electron + Vite + React development environment with TypeScript, Tailwind CSS, and testing infrastructure.

**Architecture:** Standard electron-vite three-process architecture (Main, Preload, Renderer) with React 18 and Tailwind CSS for UI.

**Tech Stack:** Electron 28, electron-vite 2, React 18, TypeScript 5, Vitest 1, Tailwind CSS 3

---

## Task 1: Initialize Project Structure

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Initialize npm project**

```bash
npm init -y
```

Expected: Creates default package.json

- [ ] **Step 2: Update package.json with project metadata**

Edit `package.json`:
```json
{
  "name": "ocr-app",
  "version": "0.1.0",
  "description": "OCR + LLM structured text extraction desktop app",
  "main": "./out/main/index.js",
  "author": "ArcDent",
  "license": "MIT",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest",
    "test:main": "vitest --project main",
    "test:renderer": "vitest --project renderer",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 3: Create .gitignore**

Create `.gitignore`:
```
node_modules/
out/
dist/
.DS_Store
*.log
.vite
.electron-vite
coverage/
.vitest
```

- [ ] **Step 4: Create initial README**

Create `README.md`:
```markdown
# OCR App

OCR + LLM structured text extraction desktop application.

## Setup

```bash
npm install
npm run dev
```

## Tech Stack

- Electron 28
- React 18
- TypeScript 5
- Tailwind CSS 3
- Vitest

## Project Status

Phase 1: Project scaffolding (in progress)
```

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore README.md
git commit -m "chore: initialize project structure"
```

---

## Task 2: Install Core Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Electron and build tools**

```bash
npm install --save-dev electron@^28.0.0 electron-vite@^2.0.0
```

Expected: Dependencies added to package.json devDependencies

- [ ] **Step 2: Install React dependencies**

```bash
npm install react@^18.2.0 react-dom@^18.2.0
npm install --save-dev @types/react@^18.2.0 @types/react-dom@^18.2.0
```

- [ ] **Step 3: Install Vite and React plugin**

```bash
npm install --save-dev vite@^5.0.0 @vitejs/plugin-react@^4.2.0
```

- [ ] **Step 4: Install TypeScript**

```bash
npm install --save-dev typescript@^5.3.0 @types/node@^20.10.0
```

- [ ] **Step 5: Install Tailwind CSS**

```bash
npm install --save-dev tailwindcss@^3.4.0 postcss@^8.4.32 autoprefixer@^10.4.16
```

- [ ] **Step 6: Install testing dependencies**

```bash
npm install --save-dev vitest@^1.0.0 @testing-library/react@^14.1.0 @testing-library/jest-dom@^6.1.5 jsdom@^23.0.0
```

- [ ] **Step 7: Install production dependencies**

```bash
npm install react-router-dom@^6.20.0 zustand@^4.4.0 sonner@^1.2.0 electron-store@^8.1.0
```

- [ ] **Step 8: Install ESLint and Prettier**

```bash
npm install --save-dev eslint@^8.55.0 prettier@^3.1.0
```

- [ ] **Step 9: Verify installation**

```bash
npm list --depth=0
```

Expected: All packages listed without errors

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install core dependencies"
```

---

## Task 3: Configure TypeScript

**Files:**
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`

- [ ] **Step 1: Create root tsconfig.json**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "paths": {
      "@/*": ["./src/renderer/src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "references": [
    {
      "path": "./tsconfig.node.json"
    }
  ]
}
```

- [ ] **Step 2: Create tsconfig.node.json**

Create `tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "target": "ES2020",
    "lib": ["ES2020"]
  },
  "include": ["electron.vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Test TypeScript configuration**

```bash
npm run typecheck
```

Expected: "Found 0 errors" (no source files yet, but config should be valid)

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json tsconfig.node.json
git commit -m "chore: configure TypeScript"
```

---

## Task 4: Configure Electron Vite

**Files:**
- Create: `electron.vite.config.ts`

- [ ] **Step 1: Create electron.vite.config.ts**

Create `electron.vite.config.ts`:
```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
```

- [ ] **Step 2: Verify configuration syntax**

```bash
npx tsc --noEmit electron.vite.config.ts
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add electron.vite.config.ts
git commit -m "chore: configure electron-vite"
```

---

## Task 5: Configure Tailwind CSS

**Files:**
- Create: `tailwind.config.js`
- Create: `postcss.config.js`

- [ ] **Step 1: Initialize Tailwind config**

```bash
npx tailwindcss init -p
```

Expected: Creates tailwind.config.js and postcss.config.js

- [ ] **Step 2: Update tailwind.config.js**

Edit `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 3: Verify postcss.config.js**

Ensure `postcss.config.js` contains:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.js postcss.config.js
git commit -m "chore: configure Tailwind CSS"
```

---

## Task 6: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `src/renderer/test-setup.ts`

- [ ] **Step 1: Create vitest.config.ts**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    projects: [
      {
        name: 'main',
        testMatch: ['src/main/**/__tests__/**/*.test.ts'],
      },
      {
        name: 'renderer',
        testMatch: ['src/renderer/**/__tests__/**/*.test.tsx', 'src/renderer/**/__tests__/**/*.test.ts'],
        environment: 'jsdom',
        setupFiles: ['src/renderer/test-setup.ts'],
      },
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
    },
  },
})
```

- [ ] **Step 2: Create renderer test setup**

Create `src/renderer/test-setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Verify Vitest configuration**

```bash
npm run test -- --version
```

Expected: Vitest version displayed

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts src/renderer/test-setup.ts
git commit -m "chore: configure Vitest"
```

---

## Task 7: Configure ESLint and Prettier

**Files:**
- Create: `.eslintrc.json`
- Create: `.prettierrc`

- [ ] **Step 1: Create .eslintrc.json**

Create `.eslintrc.json`:
```json
{
  "env": {
    "browser": true,
    "es2021": true,
    "node": true
  },
  "extends": [
    "eslint:recommended"
  ],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "off"
  }
}
```

- [ ] **Step 2: Create .prettierrc**

Create `.prettierrc`:
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

- [ ] **Step 3: Commit**

```bash
git add .eslintrc.json .prettierrc
git commit -m "chore: configure ESLint and Prettier"
```

---

## Task 8: Create Main Process Entry

**Files:**
- Create: `src/main/index.ts`

- [ ] **Step 1: Create main process directory**

```bash
mkdir -p src/main
```

- [ ] **Step 2: Create src/main/index.ts**

Create `src/main/index.ts`:
```typescript
import { app, BrowserWindow } from 'electron'
import path from 'path'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npm run typecheck
```

Expected: No errors in src/main/index.ts

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: add main process entry point"
```

---

## Task 9: Create Preload Script

**Files:**
- Create: `src/preload/index.ts`

- [ ] **Step 1: Create preload directory**

```bash
mkdir -p src/preload
```

- [ ] **Step 2: Create src/preload/index.ts (minimal)**

Create `src/preload/index.ts`:
```typescript
import { contextBridge } from 'electron'

// Placeholder API - will be expanded in Phase 2
const api = {
  version: '0.1.0',
}

contextBridge.exposeInMainWorld('api', api)

export type WindowApi = typeof api
```

- [ ] **Step 3: Create type declaration**

Create `src/preload/index.d.ts`:
```typescript
import type { WindowApi } from './index'

declare global {
  interface Window {
    api: WindowApi
  }
}
```

- [ ] **Step 4: Verify TypeScript compilation**

```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/preload/
git commit -m "feat: add preload script with contextBridge"
```

---

## Task 10: Create Renderer Process

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/src/main.tsx`
- Create: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/index.css`

- [ ] **Step 1: Create renderer directories**

```bash
mkdir -p src/renderer/src
```

- [ ] **Step 2: Create index.html**

Create `src/renderer/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OCR App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create index.css with Tailwind directives**

Create `src/renderer/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

#root {
  width: 100vw;
  height: 100vh;
}
```

- [ ] **Step 4: Create main.tsx**

Create `src/renderer/src/main.tsx`:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 5: Create App.tsx**

Create `src/renderer/src/App.tsx`:
```typescript
import React from 'react'

export default function App() {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">OCR App</h1>
        <p className="text-gray-600">Phase 1: Project scaffolding complete</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify TypeScript compilation**

```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/renderer/
git commit -m "feat: add renderer process with React and Tailwind"
```

---

## Task 11: Verify Development Environment

**Files:**
- None (verification only)

- [ ] **Step 1: Start development server**

```bash
npm run dev
```

Expected: 
- Electron window opens
- Shows "OCR App" title and "Phase 1: Project scaffolding complete"
- Background is gray (Tailwind working)
- DevTools open

- [ ] **Step 2: Test hot reload**

Edit `src/renderer/src/App.tsx`, change text to "Hot reload works!"

Expected: Window automatically refreshes with new text

- [ ] **Step 3: Stop development server**

Press `Ctrl+C` in terminal

- [ ] **Step 4: Test build**

```bash
npm run build
```

Expected: 
- Build completes without errors
- `out/` directory created with compiled files

- [ ] **Step 5: Test production preview**

```bash
npm run preview
```

Expected: Electron window opens with built version

- [ ] **Step 6: Clean build artifacts**

```bash
rm -rf out/
```

- [ ] **Step 7: Run tests (should pass with no tests yet)**

```bash
npm run test -- --run
```

Expected: "No test files found"

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: verify development environment"
```

---

## Phase 1 Complete ✅

**Deliverables:**
- ✅ Electron + Vite + React development environment
- ✅ TypeScript configured
- ✅ Tailwind CSS integrated
- ✅ Vitest testing infrastructure
- ✅ Hot reload working
- ✅ Build system functional

**Next Phase:** Phase 2 - Shared Type Definitions

Run this plan with: `superpowers:subagent-driven-development`
