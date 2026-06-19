# OCR App

OCR + LLM structured text extraction desktop application.

## Features

- High-quality OCR via TextIn API
- Local/Remote LLM structuring via OpenAI-compatible APIs
- Fallback processing modes (Faithful/Enhanced)
- Configurable parallel batch processing with map-reduce summarization
- Comprehensive global configurations management via electron-store

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Usage

```bash
# Run unit tests (uses vitest)
npm run test

# Type checking
npm run typecheck

# Build the application
npm run build
```

## Building for Production

### Windows Portable EXE

To build a portable Windows executable:

```bash
npm run make
```

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

**Note**: If you encounter npm install errors in WSL2 UNC paths (\\wsl.localhost\...), run the build commands from Windows PowerShell or Git Bash on Windows native filesystem instead.

## Project Structure

```
src/
├── main/             # Main process (OCR, LLM, Pipeline orchestration, Config storage)
├── preload/          # Context bridge exposure to Renderer
├── renderer/         # React UI interface
├── shared/           # Cross-process shared types (IPC definitions, configurations)
```

## Requirements

- Node.js 18.x or 20.x
- macOS / Windows / Linux desktop environment capable of running Electron apps

## Project Status

Phase 1-3 Completed: 
- Project Scaffolding
- Shared Type Definitions
- Main Process Core Modules (TextInClient, LlmClient, Orchestrator, ConfigStore)
