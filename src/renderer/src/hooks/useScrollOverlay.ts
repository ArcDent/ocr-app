import { useEffect, type RefObject } from 'react'

const IDLE_MS = 800

export function useScrollOverlay(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let timer: ReturnType<typeof setTimeout> | undefined

    const onScroll = () => {
      el.classList.add('is-scrolling')
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        el.classList.remove('is-scrolling')
      }, IDLE_MS)
    }

    el.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      el.removeEventListener('scroll', onScroll)
      if (timer) clearTimeout(timer)
      el.classList.remove('is-scrolling')
    }
  }, [ref])
}
