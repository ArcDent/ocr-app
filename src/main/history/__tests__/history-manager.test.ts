import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { HistoryManager } from '../history-manager';
import { JobResult } from '../types';

// Mock electron-store
const mockStoreGet = vi.fn();
const mockStoreSet = vi.fn();

vi.mock('electron-store', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: mockStoreGet,
      set: mockStoreSet
    }))
  };
});

// Mock fs/promises
vi.mock('fs/promises', () => {
  return {
    access: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    rm: vi.fn()
  };
});

describe('HistoryManager', () => {
  let manager: HistoryManager;
  const userDataPath = '/mock/userData';

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreGet.mockReturnValue([]);
    manager = new HistoryManager(userDataPath);
  });

  describe('saveResult', () => {
    it('should save a full job result and metadata', async () => {
      const mockResult: JobResult = {
        jobId: 'job-1',
        fileName: 'test.pdf',
        fileSize: 1024,
        status: 'success',
        timestamp: 1000,
        rawOutput: 'raw text',
        structuredOutput: '# structured',
        summaryOutput: '# summary',
        structuredThoughts: 'thoughts 1',
        summaryThoughts: 'thoughts 2'
      };

      // Mock access to throw so mkdir gets called
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      
      await manager.saveResult(mockResult);

      // Verify directory creation
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(userDataPath, 'ocr-results'), { recursive: true });
      expect(fs.mkdir).toHaveBeenCalledWith(path.join(userDataPath, 'ocr-results', 'job-1'), { recursive: true });

      // Verify file saving
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(userDataPath, 'ocr-results', 'job-1', 'raw.txt'),
        'raw text',
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(userDataPath, 'ocr-results', 'job-1', 'structured.md'),
        '# structured',
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(userDataPath, 'ocr-results', 'job-1', 'summary.md'),
        '# summary',
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(userDataPath, 'ocr-results', 'job-1', 'structured-thoughts.txt'),
        'thoughts 1',
        'utf-8'
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(userDataPath, 'ocr-results', 'job-1', 'summary-thoughts.txt'),
        'thoughts 2',
        'utf-8'
      );

      // Verify store update
      expect(mockStoreSet).toHaveBeenCalledWith('history', expect.arrayContaining([
        expect.objectContaining({
          jobId: 'job-1',
          fileName: 'test.pdf',
          status: 'success',
          hasRawOutput: true,
          hasStructuredOutput: true,
          hasSummaryOutput: true,
          files: {
            raw: 'raw.txt',
            structured: 'structured.md',
            summary: 'summary.md',
            structuredThoughts: 'structured-thoughts.txt',
            summaryThoughts: 'summary-thoughts.txt'
          }
        })
      ]));
    });

    it('should handle failed jobs with no output', async () => {
      const mockResult: JobResult = {
        jobId: 'job-failed',
        fileName: 'test.pdf',
        status: 'failed',
        errorMessage: 'Something went wrong',
        timestamp: 1000
      };

      await manager.saveResult(mockResult);

      expect(fs.writeFile).not.toHaveBeenCalled();
      
      expect(mockStoreSet).toHaveBeenCalledWith('history', expect.arrayContaining([
        expect.objectContaining({
          jobId: 'job-failed',
          status: 'failed',
          errorMessage: 'Something went wrong',
          hasRawOutput: false,
          hasStructuredOutput: false,
          hasSummaryOutput: false
        })
      ]));
    });

    it('should limit history to 100 items and delete oldest directories', async () => {
      // Create 100 existing items
      const existingHistory = Array.from({ length: 100 }, (_, i) => ({
        jobId: `job-${i}`,
        timestamp: i, // Older items have smaller timestamps
        fileName: 'test.pdf',
        status: 'success',
        hasRawOutput: true,
        hasStructuredOutput: false,
        hasSummaryOutput: false
      }));

      mockStoreGet.mockReturnValue(existingHistory);

      const newResult: JobResult = {
        jobId: 'job-new',
        fileName: 'new.pdf',
        status: 'success',
        timestamp: 1000 // Newest
      };

      await manager.saveResult(newResult);

      // Verify oldest was deleted from store
      const setCall = mockStoreSet.mock.calls[0];
      const savedHistory = setCall[1];
      
      expect(savedHistory.length).toBe(100);
      expect(savedHistory[0].jobId).toBe('job-new'); // Newest first
      expect(savedHistory.find((h: any) => h.jobId === 'job-0')).toBeUndefined(); // Oldest removed

      // Verify directory was deleted
      expect(fs.rm).toHaveBeenCalledWith(
        path.join(userDataPath, 'ocr-results', 'job-0'),
        { recursive: true, force: true }
      );
    });
    
    it('should update existing job if same ID is saved again', async () => {
      const existingHistory = [{
        jobId: 'job-1',
        timestamp: 1000,
        fileName: 'test.pdf',
        status: 'processing',
        hasRawOutput: false,
        hasStructuredOutput: false,
        hasSummaryOutput: false
      }];
      
      mockStoreGet.mockReturnValue(existingHistory);
      
      const newResult: JobResult = {
        jobId: 'job-1',
        fileName: 'test.pdf',
        status: 'success',
        timestamp: 2000,
        rawOutput: 'done'
      };
      
      await manager.saveResult(newResult);
      
      const setCall = mockStoreSet.mock.calls[0];
      const savedHistory = setCall[1];
      
      expect(savedHistory.length).toBe(1);
      expect(savedHistory[0].status).toBe('success');
      expect(savedHistory[0].hasRawOutput).toBe(true);
    });
  });

  describe('listHistory', () => {
    it('should return sorted history from store', () => {
      const mockHistory = [
        { jobId: 'job-1', timestamp: 1000 },
        { jobId: 'job-3', timestamp: 3000 },
        { jobId: 'job-2', timestamp: 2000 }
      ];
      
      mockStoreGet.mockReturnValue(mockHistory);
      
      const result = manager.listHistory();
      
      expect(result).toEqual([
        { jobId: 'job-3', timestamp: 3000 },
        { jobId: 'job-2', timestamp: 2000 },
        { jobId: 'job-1', timestamp: 1000 }
      ]);
      expect(mockStoreGet).toHaveBeenCalledWith('history', []);
    });
  });

  describe('getResult', () => {
    it('should return null if job not found', async () => {
      mockStoreGet.mockReturnValue([]);
      const result = await manager.getResult('non-existent');
      expect(result).toBeNull();
    });

    it('should load job with files from disk
