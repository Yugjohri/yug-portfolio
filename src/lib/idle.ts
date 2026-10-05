import { afterBoot } from '../boot/boot'

/**
 * Runs `go` once the loading screen has gone and the browser has a quiet
 * moment (at the latest `timeout` ms after that), so work that is not needed
 * for the first picture -- a background video, analytics -- never competes
 * with it. Returns a cancel.
 */
export function whenIdle(go: () => void, timeout = 2500) {
  let live = true
  let handle = 0
  const idle =
    window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 200) as unknown as number)
  const unidle = window.cancelIdleCallback ?? window.clearTimeout
  const cancelBoot = afterBoot(() => {
    if (!live) return
    handle = idle(() => live && go(), { timeout })
  })
  return () => {
    live = false
    cancelBoot()
    if (handle) unidle(handle)
  }
}
