export type PortfolioMotionProps = {
  accent?: string
  preloader?: boolean
  smoothScroll?: boolean
  cursorFx?: boolean
  tilt?: boolean
  physics?: boolean
  reveals?: boolean
  /** Fired when a sleeve is activated; React owns the modal. */
  onOpenDetail?: (index: number) => void
  onCloseDetail?: () => void
}

export declare class PortfolioMotion {
  constructor(props?: PortfolioMotionProps)
  mount(): void
  unmount(): void
  /** Stops Lenis while a modal is open. */
  lockScroll(on: boolean): void
}
