# Frontend Redesign - Warm Amber-Honey Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the OCR App frontend from blue theme to warm amber-honey theme, replacing all blue gradients with amber/orange/yellow colors while maintaining functionality.

**Architecture:** Visual-only refactor - modify Tailwind CSS classes in 4 component files (App.tsx, FileQueueList.tsx, ResultDetail.tsx, ConfigDialog.tsx). No logic changes, no test modifications needed.

**Tech Stack:** React 18, TypeScript 5.9, Tailwind CSS

---

## File Structure

**Files to Modify:**
- `src/renderer/src/App.tsx` - Main layout, header, buttons, background
- `src/renderer/src/components/FileQueueList.tsx` - Queue list, progress bars
- `src/renderer/src/components/ResultDetail.tsx` - Result tabs, badges, warnings
- `src/renderer/src/components/ConfigDialog.tsx` - Dialog buttons, inputs

**Files NOT Modified:**
- `src/renderer/src/__tests__/**/*.test.tsx` - Tests remain unchanged (text content unchanged)
- `src/renderer/src/stores/**/*.ts` - State management unchanged
- `src/main/**/*` - Main process unchanged

---
## Task 1: Page Background and Header (App.tsx)

**Files:**
- Modify: `src/renderer/src/App.tsx:76` (page background)
- Modify: `src/renderer/src/App.tsx:80` (logo icon)
- Modify: `src/renderer/src/App.tsx:85` (subtitle)
- Modify: `src/renderer/src/App.tsx:90` (settings button hover)

- [ ] **Step 1: Update page background gradient**

Replace line 76:
```tsx
<div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 overflow-hidden" onDragOver={handleDragOver} onDrop={handleDrop}>
```

With:
```tsx
<div className="h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 overflow-hidden" onDragOver={handleDragOver} onDrop={handleDrop}>
```

- [ ] **Step 2: Update logo icon gradient**

Replace line 80:
```tsx
<div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
```

With:
```tsx
<div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
```

- [ ] **Step 3: Update subtitle text color**

Replace line 85:
```tsx
<p className="text-xs text-slate-500">OCR + AI 结构化处理</p>
```

With:
```tsx
<p className="text-xs text-amber-600">OCR + AI 结构化处理</p>
```

- [ ] **Step 4: Update settings button hover state**

Replace line 90:
```tsx
className="p-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all duration-200"
```

With:
```tsx
className="p-2.5 text-slate-600 hover:text-slate-800 hover:bg-amber-50 rounded-xl transition-all duration-200"
```

- [ ] **Step 5: Verify visual changes**

Run: `npm run dev`
Expected: Page background is amber/orange/yellow gradient, logo is amber/orange, subtitle is amber-600, settings button hovers to amber-50

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "style: update page background and header to amber-honey theme"
```

---
## Task 2: Main Action Buttons (App.tsx)

**Files:**
- Modify: `src/renderer/src/App.tsx:156` (start button)
- Modify: `src/renderer/src/App.tsx:133` (mode switch selected)
- Modify: `src/renderer/src/App.tsx:145` (mode switch unselected hover)

- [ ] **Step 1: Update start processing button**

Replace line 156:
```tsx
className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-400 transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none"
```

With:
```tsx
className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 disabled:from-slate-300 disabled:to-slate-400 transition-all duration-200 shadow-lg shadow-amber-500/20 hover:shadow-xl disabled:shadow-none"
```

- [ ] **Step 2: Update mode switch button selected state (faithful)**

Replace line 131-134:
```tsx
className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${
  mode === 'faithful'
    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
    : 'bg-white text-slate-700 hover:bg-slate-50'
}`}
```

With:
```tsx
className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${
  mode === 'faithful'
    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
    : 'bg-white text-slate-700 hover:bg-amber-50'
}`}
```

- [ ] **Step 3: Update mode switch button selected state (enhanced)**

Replace line 142-145:
```tsx
className={`flex-1 py-2.5 text-sm font-medium border-l border-slate-200 transition-all duration-200 ${
  mode === 'enhanced'
    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
    : 'bg-white text-slate-700 hover:bg-slate-50'
}`}
```

With:
```tsx
className={`flex-1 py-2.5 text-sm font-medium border-l border-slate-200 transition-all duration-200 ${
  mode === 'enhanced'
    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
    : 'bg-white text-slate-700 hover:bg-amber-50'
}`}
```

- [ ] **Step 4: Verify button styles**

Run: `npm run dev`
Expected: Start button is amber/orange with warm shadow glow, mode switches show amber/orange when selected, hover to amber-50 when unselected

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "style: update main action buttons to amber-honey theme"
```

---

## Task 3: File Selection Buttons (App.tsx)

**Files:**
- Modify: `src/renderer/src/App.tsx:107` (select files button)
- Modify: `src/renderer/src/App.tsx:115` (select folder button)

- [ ] **Step 1: Update select files button**

Replace line 107:
```tsx
className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl text-sm font-medium text-blue-700 hover:from-blue-100 hover:to-indigo-100 disabled:opacity-50 transition-all duration-200 shadow-sm"
```

With:
```tsx
className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl text-sm font-medium text-amber-700 hover:from-amber-100 hover:to-orange-100 disabled:opacity-50 transition-all duration-200 shadow-sm"
```

- [ ] **Step 2: Update select folder button**

Replace line 115:
```tsx
className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl text-sm font-medium text-purple-700 hover:from-purple-100 hover:to-pink-100 disabled:opacity-50 transition-all duration-200 shadow-sm"
```

With:
```tsx
className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-300 rounded-xl text-sm font-medium text-orange-700 hover:from-orange-100 hover:to-yellow-100 disabled:opacity-50 transition-all duration-200 shadow-sm"
```

- [ ] **Step 3: Verify file selection buttons**

Run: `npm run dev`
Expected: Select files button is amber/orange, select folder button is orange/yellow

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "style: update file selection buttons to warm theme"
```

---
## Task 4: Queue List Styling (FileQueueList.tsx)

**Files:**
- Modify: `src/renderer/src/components/FileQueueList.tsx:68` (header background)
- Modify: `src/renderer/src/components/FileQueueList.tsx:106` (selected item)
- Modify: `src/renderer/src/components/FileQueueList.tsx:124` (progress bar)
- Modify: `src/renderer/src/components/FileQueueList.tsx:39` (loading icon)

- [ ] **Step 1: Update queue header background**

Replace line 68:
```tsx
<div className="px-5 py-3 border-b border-slate-200/60 flex justify-between items-center bg-gradient-to-r from-slate-50 to-blue-50">
```

With:
```tsx
<div className="px-5 py-3 border-b border-slate-200/60 flex justify-between items-center bg-gradient-to-r from-amber-50 to-orange-50">
```

- [ ] **Step 2: Update selected queue item styling**

Replace line 104-108:
```tsx
className={`p-4 cursor-pointer transition-all duration-150 ${
  selectedJobId === job.jobId
    ? 'bg-gradient-to-r from-blue-100 to-indigo-100 border-l-4 border-blue-600'
    : 'bg-white hover:bg-slate-50'
}`}
```

With:
```tsx
className={`p-4 cursor-pointer transition-all duration-150 ${
  selectedJobId === job.jobId
    ? 'bg-gradient-to-r from-amber-100 to-orange-100 border-l-4 border-amber-500'
    : 'bg-white hover:bg-slate-50'
}`}
```

- [ ] **Step 3: Update progress bar gradient**

Replace line 124:
```tsx
<div
  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1.5 rounded-full transition-all duration-300"
  style={{ width: `${job.progress}%` }}
></div>
```

With:
```tsx
<div
  className="bg-gradient-to-r from-amber-400 to-orange-500 h-1.5 rounded-full transition-all duration-300"
  style={{ width: `${job.progress}%` }}
></div>
```

- [ ] **Step 4: Update loading icon color**

Replace line 39:
```tsx
return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
```

With:
```tsx
return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
```

- [ ] **Step 5: Verify queue list**

Run: `npm run dev`
Expected: Queue header is amber/orange, selected item has amber border and background, progress bar is amber/orange, loading spinner is amber

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/FileQueueList.tsx
git commit -m "style: update queue list to amber-honey theme"
```

---
## Task 5: Result Detail Styling (ResultDetail.tsx)

**Files:**
- Modify: `src/renderer/src/components/ResultDetail.tsx:110` (header background)
- Modify: `src/renderer/src/components/ResultDetail.tsx:118` (enhanced badge)
- Modify: `src/renderer/src/components/ResultDetail.tsx:132` (structured tab)
- Modify: `src/renderer/src/components/ResultDetail.tsx:142` (summary tab)
- Modify: `src/renderer/src/components/ResultDetail.tsx:152` (raw tab)
- Modify: `src/renderer/src/components/ResultDetail.tsx:70` (AI thoughts button)

- [ ] **Step 1: Update result header background**

Replace line 110:
```tsx
<div className="px-6 py-5 border-b border-slate-200/60 bg-gradient-to-r from-slate-50 to-blue-50">
```

With:
```tsx
<div className="px-6 py-5 border-b border-slate-200/60 bg-gradient-to-r from-amber-50 to-orange-50">
```

- [ ] **Step 2: Update mode badges**

Replace line 116-120:
```tsx
<span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
  result.mode === 'enhanced'
    ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border border-purple-300'
    : 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-300'
}`}>
```

With:
```tsx
<span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
  result.mode === 'enhanced'
    ? 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border border-amber-300'
    : 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border border-orange-300'
}`}>
```

- [ ] **Step 3: Update structured tab**

Replace line 130-135:
```tsx
className={`py-3 px-5 text-sm font-bold border-b-4 transition-all duration-200 ${
  activeTab === 'structured'
    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
    : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
}`}
```

With:
```tsx
className={`py-3 px-5 text-sm font-bold border-b-4 transition-all duration-200 ${
  activeTab === 'structured'
    ? 'border-amber-500 text-amber-700 bg-amber-50/50'
    : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-amber-50'
}`}
```

- [ ] **Step 4: Update summary tab**

Replace line 140-145:
```tsx
className={`py-3 px-5 text-sm font-bold border-b-4 transition-all duration-200 ${
  activeTab === 'summary'
    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
    : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
}`}
```

With:
```tsx
className={`py-3 px-5 text-sm font-bold border-b-4 transition-all duration-200 ${
  activeTab === 'summary'
    ? 'border-amber-500 text-amber-700 bg-amber-50/50'
    : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-amber-50'
}`}
```

- [ ] **Step 5: Update raw tab**

Replace line 150-155:
```tsx
className={`py-3 px-5 text-sm font-bold border-b-4 transition-all duration-200 ${
  activeTab === 'raw'
    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
    : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
}`}
```

With:
```tsx
className={`py-3 px-5 text-sm font-bold border-b-4 transition-all duration-200 ${
  activeTab === 'raw'
    ? 'border-amber-500 text-amber-700 bg-amber-50/50'
    : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-amber-50'
}`}
```

- [ ] **Step 6: Update AI thoughts button**

Replace line 70:
```tsx
className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-blue-50 hover:from-slate-100 hover:to-blue-100 text-sm font-semibold text-slate-700 transition-all duration-200"
```

With:
```tsx
className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-sm font-semibold text-slate-700 transition-all duration-200"
```

- [ ] **Step 7: Verify result detail**

Run: `npm run dev`
Expected: Header is amber/orange, badges are amber/yellow, tabs show amber when selected, AI thoughts button is amber/orange

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/ResultDetail.tsx
git commit -m "style: update result detail to amber-honey theme"
```

---
## Task 6: Config Dialog Styling (ConfigDialog.tsx)

**Files:**
- Modify: `src/renderer/src/components/ConfigDialog.tsx:52` (header background)
- Modify: `src/renderer/src/components/ConfigDialog.tsx:125` (OCR test button)
- Modify: `src/renderer/src/components/ConfigDialog.tsx:211` (LLM test button)
- Modify: `src/renderer/src/components/ConfigDialog.tsx:296` (save button)
- Modify: `src/renderer/src/components/ConfigDialog.tsx:287` (footer background)
- Modify: `src/renderer/src/components/ConfigDialog.tsx:84,101,118,170,187,204,258,277` (input focus)

- [ ] **Step 1: Update dialog header background**

Replace line 52:
```tsx
<div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50 to-blue-50">
```

With:
```tsx
<div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-amber-50 to-orange-50">
```

- [ ] **Step 2: Update OCR test button**

Replace line 125:
```tsx
className="w-full py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 text-blue-700 rounded-xl font-semibold hover:from-blue-100 hover:to-indigo-100 disabled:opacity-50 transition-all duration-200"
```

With:
```tsx
className="w-full py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 text-amber-700 rounded-xl font-semibold hover:from-amber-100 hover:to-orange-100 disabled:opacity-50 transition-all duration-200"
```

- [ ] **Step 3: Update LLM test button**

Replace line 211:
```tsx
className="w-full py-2.5 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 text-purple-700 rounded-xl font-semibold hover:from-purple-100 hover:to-pink-100 disabled:opacity-50 transition-all duration-200"
```

With:
```tsx
className="w-full py-2.5 bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-300 text-orange-700 rounded-xl font-semibold hover:from-orange-100 hover:to-yellow-100 disabled:opacity-50 transition-all duration-200"
```

- [ ] **Step 4: Update save button**

Replace line 296:
```tsx
className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-lg transition-all duration-200"
```

With:
```tsx
className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 shadow-lg transition-all duration-200"
```

- [ ] **Step 5: Update footer background**

Replace line 287:
```tsx
<div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-gradient-to-r from-slate-50 to-blue-50">
```

With:
```tsx
<div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-gradient-to-r from-amber-50 to-orange-50">
```

- [ ] **Step 6: Update OCR section input focus borders**

Replace lines 84, 101, 118 `focus:border-blue-500` with `focus:border-amber-500`:
```tsx
className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 transition-colors"
```

- [ ] **Step 7: Update LLM section input focus borders**

Replace lines 170, 187, 204 `focus:border-purple-500` with `focus:border-orange-500`:
```tsx
className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors"
```

- [ ] **Step 8: Update Processing section input focus borders**

Replace lines 258, 277 `focus:border-emerald-500` with `focus:border-amber-500`:
```tsx
className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 transition-colors"
```

- [ ] **Step 9: Verify config dialog**

Run: `npm run dev`
Click settings button, verify: header/footer amber/orange, buttons warm theme, input focus borders amber/orange

- [ ] **Step 10: Commit**

```bash
git add src/renderer/src/components/ConfigDialog.tsx
git commit -m "style: update config dialog to amber-honey theme"
```

---
## Task 7: Final Verification and Testing

**Files:**
- Verify: All 4 modified component files
- Test: `src/renderer/src/__tests__/components/*.test.tsx`

- [ ] **Step 1: Run all tests**

Run: `npm test -- --run`
Expected: 230 passed / 0 failed

- [ ] **Step 2: Visual verification checklist**

Run: `npm run dev`

Verify the following states:
- [ ] Page background is amber/orange/yellow gradient
- [ ] Header logo is amber/orange
- [ ] Start button is amber/orange with warm shadow
- [ ] Mode switches show amber/orange when selected
- [ ] File selection buttons are warm colors
- [ ] Queue selected items have amber border and background
- [ ] Progress bars are amber/orange
- [ ] Result tabs show amber when selected
- [ ] Mode badges are amber/yellow
- [ ] Config dialog buttons are amber/orange
- [ ] All hover states work correctly
- [ ] Export button remains green (emerald)
- [ ] Cancel button remains red/orange (correct)

- [ ] **Step 3: Check for any missed blue colors**

Run:
```bash
grep -n "blue-\|indigo-\|purple-" src/renderer/src/App.tsx src/renderer/src/components/FileQueueList.tsx src/renderer/src/components/ResultDetail.tsx src/renderer/src/components/ConfigDialog.tsx
```

Expected: Only false positives (comments, or intentionally kept like "backdrop-blur")

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "style: complete frontend redesign to amber-honey warm theme

- Replace all blue/indigo/purple gradients with amber/orange/yellow
- Update header, buttons, tabs, badges, and dialogs
- Maintain all functionality and test coverage
- Keep functional colors (green for success, red for error)
"
```

---

## Spec Coverage Self-Review

**Checking spec sections against tasks:**

✅ Section 3.1 Header - Task 1
✅ Section 3.2 Main buttons - Task 2
✅ Section 3.3 Mode switches - Task 2
✅ Section 3.4 File selection - Task 3
✅ Section 3.5 Queue list - Task 4
✅ Section 3.6 Result detail - Task 5
✅ Section 3.7 Config dialog - Task 6
✅ Section 3.8 Page background - Task 1
✅ Section 3.9 Export button - Verified in Task 7 (keep green)

**No gaps found.** All spec requirements covered.

---

## Execution Complete

After completing all tasks, the frontend will be fully migrated to the warm amber-honey theme. All 230 tests should pass, and all visual elements should reflect the new color scheme while maintaining functionality.
