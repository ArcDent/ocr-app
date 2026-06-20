import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { useScrollOverlay } from '../../hooks/useScrollOverlay'

describe('useScrollOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds is-scrolling class on scroll and removes after 800ms idle', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null)
      ;(ref as any).current = el
      useScrollOverlay(ref)
      return ref
    })

    el.dispatchEvent(new Event('scroll'))
    expect(el.classList.contains('is-scrolling')).toBe(true)

    vi.advanceTimersByTime(799)
    expect(el.classList.contains('is-scrolling')).toBe(true)

    vi.advanceTimersByTime(2)
    expect(el.classList.contains('is-scrolling')).toBe(false)

    unmount()
    document.body.removeChild(el)
  })

  it('does not throw when ref is null on mount', () => {
    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null)
      useScrollOverlay(ref)
      return ref
    })
    unmount()
  })
})
