import React from 'react'

export default function Collapse({ open, children, duration = 250 }: { open: boolean; children: React.ReactNode; duration?: number }) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = React.useState<string>(open ? 'auto' : '0px')
  const [opacity, setOpacity] = React.useState<number>(open ? 1 : 0)
  const [transform, setTransform] = React.useState<string>(open ? 'translateY(0)' : 'translateY(-4px)')
  const [isAnimating, setIsAnimating] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const currentHeight = el.scrollHeight
    setIsAnimating(true)
    if (open) {
      // from 0 -> content height, then auto
      setHeight(currentHeight + 'px')
      setOpacity(1)
      setTransform('translateY(0)')
      const timer = window.setTimeout(() => {
        setHeight('auto')
        setIsAnimating(false)
      }, duration)
      return () => window.clearTimeout(timer)
    } else {
      // from current height -> 0
      // ensure we have a fixed height before collapsing
      setHeight(currentHeight + 'px')
      // next frame
      requestAnimationFrame(() => {
        setHeight('0px')
        setOpacity(0)
        setTransform('translateY(-4px)')
        const timer = window.setTimeout(() => {
          setIsAnimating(false)
        }, duration)
        const cleanup = () => window.clearTimeout(timer)
        return cleanup
      })
    }
  }, [open, duration])

  return (
    <div
      ref={ref}
      style={{
        height,
        opacity,
        transform,
        overflow: 'hidden',
        transition: `height ${duration}ms ease, opacity ${Math.max(150, duration - 50)}ms ease, transform ${duration}ms ease`,
        willChange: isAnimating ? 'height, opacity, transform' : undefined,
      }}
      aria-hidden={!open}
    >
      {children}
    </div>
  )
}

