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
