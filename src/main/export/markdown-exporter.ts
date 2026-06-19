import { promises as fs } from 'fs'
import * as path from 'path'
import { JobResult } from '../../shared/types'

export async function exportBatch(
  results: JobResult[],
  outputDir: string
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0
  const generatedFiles: { name: string; summary: string; relativePath: string }[] = []

  try {
    await fs.mkdir(outputDir, { recursive: true })
  } catch (error) {
    throw new Error(`Failed to create output directory: ${error}`)
  }

  for (const result of results) {
    try {
      if (!result.jobId || !result.structuredText?.trim() || !result.summary?.trim()) {
        failed++
        continue
      }

      const baseName = result.fileName || `job-${result.jobId}`
      const baseNameWithoutExt = baseName.replace(/\.[^/.]+$/, '')
      let fileName = `${baseNameWithoutExt}.md`
      let filePath = path.join(outputDir, fileName)

      let counter = 1
      while (true) {
        try {
          await fs.access(filePath)
          fileName = `${baseNameWithoutExt}-${counter}.md`
          filePath = path.join(outputDir, fileName)
          counter++
        } catch {
          break
        }
      }

      const content = `# ${fileName.replace(/\.md$/, '')}\n\n## 摘要\n${result.summary}\n\n## 正文\n${result.structuredText}\n`

      await fs.writeFile(filePath, content, 'utf8')

      generatedFiles.push({
        name: fileName.replace(/\.md$/, ''),
        summary: result.summary,
        relativePath: fileName,
      })

      success++
    } catch (error) {
      console.error(`Failed to export result ${result.jobId}:`, error)
      failed++
    }
  }

  if (success > 0) {
    try {
      const dateStr = new Date().toISOString().split('T')[0]
      let indexContent = `# OCR 批量导出 - ${dateStr}\n\n`
      for (const file of generatedFiles) {
        const firstLineSummary = file.summary.split('\n')[0].trim()
        indexContent += `- [${file.name}](${file.relativePath}): ${firstLineSummary}\n`
      }
      await fs.writeFile(path.join(outputDir, 'index.md'), indexContent, 'utf8')
    } catch (error) {
      console.error('Failed to generate index.md:', error)
    }
  }

  return { success, failed }
}
