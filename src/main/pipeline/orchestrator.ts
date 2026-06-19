import { TextInClient } from '../ocr/textin-client'
import { LlmClient } from '../llm/llm-client'
import { OcrJob, JobResult, ProcessMode, JobStage } from '../../shared/types'
import { v4 as uuidv4 } from 'uuid'
import * as path from 'path'
import { splitIntoChunks } from '../llm/chunking'
import { assertNoPlaceholder } from '../llm/placeholder-guard'

export class Orchestrator {
  private jobs = new Map<string, OcrJob>()
  private results = new Map<string, JobResult>()
  private isCancelled = false

  constructor(
    private textin: TextInClient,
    private llm: LlmClient,
    private settings: { concurrency: number; chunkThreshold: number }
  ) {}

  public async startBatch(
    paths: string[],
    mode: ProcessMode,
    onProgress: (job: OcrJob) => void
  ): Promise<{ total: number; success: number; failed: number }> {
    this.isCancelled = false
    this.jobs.clear()
    this.results.clear()

    // Initialize jobs
    paths.forEach(p => {
      const jobId = uuidv4()
      this.jobs.set(jobId, {
        jobId,
        filePath: p,
        fileName: path.basename(p),
        stage: 'queued',
      })
    })

    const jobQueue = Array.from(this.jobs.values())
    const stats = { total: jobQueue.length, success: 0, failed: 0 }

    // Emit initial 'queued' state
    for (const job of jobQueue) {
      onProgress({ ...job })
    }

    // Semaphore concurrency
    const executing = new Set<Promise<void>>()

    for (const job of jobQueue) {
      if (this.isCancelled) {
        this.updateJob(job, 'error', onProgress, 'Batch cancelled')
        stats.failed++
        continue
      }

      const p = this.processJob(job, mode, onProgress)
        .then(() => {
          if (job.stage === 'done') stats.success++
          else stats.failed++
        })
        .finally(() => executing.delete(p))

      executing.add(p)

      if (executing.size >= this.settings.concurrency) {
        await Promise.race(executing)
      }
    }

    await Promise.all(executing)

    return stats
  }

  public cancel(): void {
    this.isCancelled = true
  }

  public getJobStatus(jobId: string): OcrJob | undefined {
    return this.jobs.get(jobId)
  }

  public getResult(jobId: string): JobResult | undefined {
    return this.results.get(jobId)
  }

  private updateJob(job: OcrJob, stage: JobStage, onProgress: (job: OcrJob) => void, error?: string) {
    job.stage = stage
    if (error) job.error = error
    onProgress({ ...job })
  }

  private async processJob(job: OcrJob, mode: ProcessMode, onProgress: (job: OcrJob) => void): Promise<void> {
    try {
      if (this.isCancelled) throw new Error('Cancelled')

      const rawText = await this.withRetry(
        () => this.runOcr(job, onProgress),
        (e) => this.textin.isRecoverableError(e)
      )
      
      if (this.isCancelled) throw new Error('Cancelled')
      const structuredResult = await this.withRetry(
        () => this.runStructuring(job, rawText, mode, onProgress),
        (e) => this.llm.isRecoverableError(e)
      )
      
      const hasPlaceholderWarning = !assertNoPlaceholder(structuredResult.text)

      if (this.isCancelled) throw new Error('Cancelled')
      // Note: LLM calls reuse the LLM client recoverable error logic
      const summaryResult = await this.withRetry(
        () => this.runSummarizing(job, structuredResult.text, onProgress),
        (e) => this.llm.isRecoverableError(e)
      )

      this.results.set(job.jobId, {
        jobId: job.jobId,
        fileName: job.fileName,
        rawText,
        structuredText: structuredResult.text,
        structuredThoughts: structuredResult.thoughts,
        summary: summaryResult.text,
        summaryThoughts: summaryResult.thoughts,
        mode,
        hasPlaceholderWarning,
        createdAt: Date.now(),
      })

      this.updateJob(job, 'done', onProgress)
    } catch (error) {
      this.updateJob(job, 'error', onProgress, error instanceof Error ? error.message : String(error))
    }
  }

  private async runOcr(job: OcrJob, onProgress: (job: OcrJob) => void): Promise<string> {
    this.updateJob(job, 'ocr', onProgress)
    return await this.textin.recognizeFile(job.filePath)
  }

  private async runStructuring(job: OcrJob, rawText: string, _mode: ProcessMode, onProgress: (job: OcrJob) => void) {
    this.updateJob(job, 'structuring', onProgress)
    
    // Check if chunking is needed
    if (rawText.length > this.settings.chunkThreshold) {
      const chunks = splitIntoChunks(rawText, this.settings.chunkThreshold)
      let combinedText = ''
      
      for (const chunk of chunks) {
        if (this.isCancelled) throw new Error('Cancelled')
        // Create messages array as expected by LlmClient
        const messages = [
          { role: 'user' as const, content: chunk }
        ]
        // Get raw response
        const rawResponse = await this.llm.callLlm(messages)
        // Extract result and thoughts
        const text = this.llm.extractResult(rawResponse)
        
        combinedText += text + '\n\n'
      }
      return { text: combinedText.trim(), thoughts: undefined }
    } else {
      const messages = [
        { role: 'user' as const, content: rawText }
      ]
      const rawResponse = await this.llm.callLlm(messages)
      return {
        text: this.llm.extractResult(rawResponse),
        thoughts: this.llm.extractThoughts(rawResponse)
      }
    }
  }

  private async runSummarizing(job: OcrJob, structuredText: string, onProgress: (job: OcrJob) => void) {
    this.updateJob(job, 'summarizing', onProgress)
    const messages = [
      { role: 'user' as const, content: `Please summarize the following text:\n\n${structuredText}` }
    ]
    const rawResponse = await this.llm.callLlm(messages)
    return {
      text: this.llm.extractResult(rawResponse),
      thoughts: this.llm.extractThoughts(rawResponse)
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, isRecoverable: (e: unknown) => boolean): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      if (isRecoverable(error)) {
        // Retry once
        return await fn()
      }
      throw error
    }
  }
}
