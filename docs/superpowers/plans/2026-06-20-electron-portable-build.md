# Electron Portable EXE Build Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure electron-forge + squirrel.windows to build a portable Windows executable for the OCR App

**Architecture:** Add electron-forge as packaging layer on top of existing electron-vite build system. electron-vite compiles TypeScript/React to JavaScript, electron-forge packages the compiled output into a portable exe using Squirrel.Windows.

**Tech Stack:** electron-forge v7+, @electron-forge/maker-squirrel, Node.js 16+, Windows 10/11 x64

---

## File Structure

**Files to Create:**
- `forge.config.js` - electron-forge configuration (packager + maker settings)
- `resources/icon.ico` - Windows application icon (optional, can use Electron default)

**Files to Modify:**
- `package.json` - Add productName, forge config reference, new scripts, dev dependencies

**Files NOT Modified:**
- `electron.vite.config.ts` - Build configuration remains unchanged
- `src/**/*` - No source code changes needed
- `.gitignore` - forge output directory `dist/` will be added

---

## Task 1: Install electron-forge Dependencies

**Files:**
- Modify: `package.json` (devDependencies section)

- [ ] **Step 1: Install forge packages**

Run:
```bash
npm install --save-dev @electron-forge/cli@^7.5.0 @electron-forge/maker-squirrel@^7.5.0 @electron-forge/plugin-auto-unpack-natives@^7.5.0
```

Expected: Installation completes successfully, package.json updated with 3 new devDependencies

- [ ] **Step 2: Verify installation**

Run:
```bash
npx electron-forge --version
```

Expected: Output shows version 7.5.x

- [ ] **Step 3: Commit dependency changes**

```bash
git add package.json package-lock.json
git commit -m "build: add electron-forge dependencies for portable exe"
```

---

## Task 2: Create forge.config.js Configuration

**Files:**
- Create: `forge.config.js`

- [ ] **Step 1: Create forge configuration file**

Create `forge.config.js` with the following content:

```javascript
module.exports = {
  packagerConfig: {
    name: 'OCR-App',
    executableName: 'ocr-app',
    asar: true,
    icon: './resources/icon',
    ignore: [
      /^\/src/,
      /^\/docs/,
      /^\/\.git/,
      /^\/\.claude/,
      /^\/\.serena/,
      /^\/\.superpowers/,
      /^\/node_modules\/(?!.*\.node$)/
    ]
  },
  
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'OCR-App',
        authors: 'ArcDent',
        exe: 'ocr-app.exe',
        setupExe: 'OCR-App-Setup.exe',
        setupIcon: './resources/icon.ico',
        noMsi: true
      }
    }
  ],
  
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    }
  ]
}
```

- [ ] **Step 2: Verify configuration syntax**

Run:
```bash
node -e "require('./forge.config.js')"
```

Expected: No errors, configuration loads successfully

- [ ] **Step 3: Commit forge configuration**

```bash
git add forge.config.js
git commit -m "build: add electron-forge configuration for Windows portable exe"
```

---

## Task 3: Update package.json with Forge Integration

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add productName field**

Add after the `name` field in package.json:

```json
"productName": "OCR App",
```

- [ ] **Step 2: Add forge config reference**

Add to package.json (after `directories` or before closing brace):

```json
"config": {
  "forge": "./forge.config.js"
},
```

- [ ] **Step 3: Add build scripts**

Modify the `scripts` section in package.json:

```json
"scripts": {
  "dev": "electron-vite dev",
  "build": "electron-vite build",
  "preview": "electron-vite preview",
  "test": "vitest",
  "test:main": "vitest --project main",
  "test:renderer": "vitest --project renderer",
  "lint": "eslint src --ext .ts,.tsx",
  "typecheck": "tsc --noEmit",
  "make": "npm run build && electron-forge make",
  "package": "npm run build && electron-forge package"
},
```

- [ ] **Step 4: Verify JSON syntax**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))"
```

Expected: No errors, JSON is valid

- [ ] **Step 5: Commit package.json changes**

```bash
git add package.json
git commit -m "build: configure package.json for electron-forge integration"
```

---

## Task 4: Prepare Application Icon

**Files:**
- Create: `resources/icon.ico` (optional)

- [ ] **Step 1: Create resources directory**

Run:
```bash
mkdir -p resources
```

Expected: Directory created successfully

- [ ] **Step 2: Copy Electron default icon as placeholder**

Run (in WSL/Git Bash):
```bash
if [ -f node_modules/electron/dist/resources/default_app.asar ]; then
  echo "Using Electron default icon temporarily (icon.ico will be extracted or you can skip this step)"
  echo "Note: Electron may not ship a standalone .ico file - the build will use the default if resources/icon.ico is missing"
fi
touch resources/.gitkeep
```

Expected: resources directory exists with .gitkeep

Note: If `resources/icon.ico` is not present, electron-forge will use Electron's default icon. This is acceptable for initial testing.

- [ ] **Step 3: Update .gitignore for resources**

Add to `.gitignore`:

```
# Build outputs
dist/
out/

# Keep resources directory but ignore large assets temporarily
resources/*.ico
!resources/.gitkeep
```

- [ ] **Step 4: Commit resources directory setup**

```bash
git add resources/.gitkeep .gitignore
git commit -m "build: prepare resources directory for application icon"
```

---

## Task 5: Test Build Pipeline

**Files:**
- Verify: All configuration files work together

- [ ] **Step 1: Clean previous build outputs**

Run:
```bash
rm -rf out dist
```

Expected: Directories removed

- [ ] **Step 2: Run electron-vite build**

Run:
```bash
npm run build
```

Expected: 
- No errors
- `out/main/index.js` exists
- `out/preload/index.js` exists
- `out/renderer/` directory exists

- [ ] **Step 3: Run electron-forge make**

Run:
```bash
npm run make
```

Expected:
- Build process completes (may take 5-10 minutes first time)
- No fatal errors
- Output shows: "Making for target: squirrel"
- File created: `dist/make/squirrel.windows/x64/OCR-App-Setup.exe`

Note: If running in WSL2 without Windows access, this step may fail at the final packaging stage. That's expected - the configuration is correct, but Squirrel.Windows requires Windows.

- [ ] **Step 4: Check output file size**

Run:
```bash
ls -lh dist/make/squirrel.windows/x64/ 2>/dev/null || echo "Build output directory not found (expected in WSL2)"
```

Expected (if on Windows): File size approximately 150-200MB

- [ ] **Step 5: Commit build configuration verification**

```bash
git add -A
git commit -m "build: verify electron-forge build pipeline configuration"
```

---

## Task 6: Document Build Process

**Files:**
- Modify: `README.md` (add build section)

- [ ] **Step 1: Add build instructions to README**

Add the following section to `README.md` (after installation instructions):

```markdown
## Building for Production

### Windows Portable EXE

To build a portable Windows executable:

\`\`\`bash
npm run make
\`\`\`

This will:
1. Compile TypeScript/React source code via electron-vite
2. Package the compiled code into a portable exe using electron-forge
3. Output the installer to: `dist/make/squirrel.windows/x64/OCR-App-Setup.exe`

**First build takes 5-10 minutes** (downloads Electron binaries). Subsequent builds are faster (~1-2 minutes).

### Build Requirements

- Node.js 16+ 
- Windows 10/11 x64 (or WSL2 with Windows filesystem access)
- ~500MB free disk space

### Using the Portable EXE

Double-click `OCR-App-Setup.exe` to install and launch. The app will:
- Auto-extract to `%LOCALAPPDATA%\OCR-App\`
- Run without administrator privileges
- Appear in Windows "Apps & features" for uninstallation

\`\`\`

- [ ] **Step 2: Commit README updates**

```bash
git add README.md
git commit -m "docs: add Windows portable exe build instructions"
```

---

## Task 7: Final Verification and Cleanup

**Files:**
- Verify: Complete build system integration

- [ ] **Step 1: Verify all configuration files exist**

Run:
```bash
ls -la forge.config.js package.json resources/.gitkeep
```

Expected: All files exist

- [ ] **Step 2: Verify scripts are callable**

Run:
```bash
npm run build --if-present && echo "✓ build script OK"
npm run make --dry-run 2>&1 | head -5 || echo "make script configured"
```

Expected: build script works, make script is recognized

- [ ] **Step 3: Verify package.json structure**

Run:
```bash
node -e "const pkg = require('./package.json'); console.log('productName:', pkg.productName); console.log('config.forge:', pkg.config.forge); console.log('make script:', pkg.scripts.make)"
```

Expected output:
```
productName: OCR App
config.forge: ./forge.config.js
make script: npm run build && electron-forge make
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "build: complete electron-forge portable exe configuration

- Configure electron-forge with Squirrel.Windows maker
- Add build scripts (make, package) to package.json
- Set up resources directory for application icon
- Integrate with existing electron-vite build system
- Document build process in README

The app can now be built as a Windows portable exe via npm run make.
"
```

---

## Spec Coverage Self-Review

**Checking spec sections against tasks:**

✅ Section 4.1 (Install dependencies) → Task 1
✅ Section 4.2 (Create forge.config.js) → Task 2
✅ Section 4.3 (Modify package.json) → Task 3
✅ Section 4.4 (Prepare icon resources) → Task 4
✅ Section 4.5 (Build testing) → Task 5
✅ Section 6 (Verification) → Task 7
✅ Documentation → Task 6

**No gaps found.** All spec requirements covered.

---

## Execution Complete

After completing all tasks, the project will have a complete electron-forge configuration integrated with the existing electron-vite build system. Running `npm run make` will produce a portable Windows executable at `dist/make/squirrel.windows/x64/OCR-App-Setup.exe`.

**Note for WSL2 users:** The final `npm run make` command requires Windows filesystem access to execute Squirrel.Windows packaging. If running in pure WSL2, the configuration will be correct but the final exe generation may fail. Run the command from Windows PowerShell or Git Bash on Windows to complete the build.
