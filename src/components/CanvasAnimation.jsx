import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const TOTAL_FRAMES = 300
// The footage barely moves for its first ~100 frames (slow push-in towards the door) and
// passes through the door around frames 115-145. Mapping the whole page linearly left the
// hero on frames 1-50, which read as a frozen picture. Instead the hero's fly-through
// ends exactly on the door pass-through, and the rest of the page plays the remainder.
const HERO_END_FRAME = 130

// Safe base URL helper (handles root, subpath, GitHub Pages, etc.)
const BASE = (import.meta.env.BASE_URL || './').endsWith('/')
  ? (import.meta.env.BASE_URL || './')
  : `${import.meta.env.BASE_URL || './'}/`

// Two frame sets, built by scripts/build_sequence.cjs:
// - desktop: full 1280x720 frames, AVIF q45 (~26 KB/frame)
// - mobile:  the centre 405x720 strip, JPEG (~18 KB/frame). With cover-fit a portrait
//   screen only ever shows that strip, and JPEG re-decodes far faster than AVIF when a
//   phone evicts decoded frames mid-scroll.
const FRAME_SETS = {
  desktop: { dir: 'desktop', ext: 'avif' },
  mobile: { dir: 'mobile', ext: 'jpg' },
}

// The strip is 405/720 = 0.5625 wide; up to ~0.6 it still covers the screen with only a
// slight top/bottom trim. Wider (landscape phones, tablets, desktop) needs full frames.
const pickFrameSet = () => (window.innerWidth / window.innerHeight <= 0.6 ? 'mobile' : 'desktop')

const getFrameUrl = (set, frameIndex) => {
  const { dir, ext } = FRAME_SETS[set]
  return `${BASE}sequence/${dir}/frame-${String(frameIndex).padStart(3, '0')}.${ext}`
}

// Persistent module-level caches (one per set) so React StrictMode doesn't discard loaded images
const imageCaches = {
  desktop: new Array(TOTAL_FRAMES),
  mobile: new Array(TOTAL_FRAMES),
}

export default function CanvasAnimation({ scrollContainerRef }) {
  const wrapperRef = useRef(null)
  const canvasRef = useRef(null)
  const imagesRef = useRef(imageCaches.desktop)
  const frameObj = useRef({ frame: 1 })
  const lastRenderedFrame = useRef(-1)
  // Index actually painted on the canvas (may be a nearby stand-in while the target loads)
  const shownFrame = useRef(-1)

  useEffect(() => {
    let isCancelled = false
    let activeSet = pickFrameSet()
    imagesRef.current = imageCaches[activeSet]
    // Frames already requested per set in this run (loaded, in flight or failed)
    const requestedBySet = { desktop: new Set(), mobile: new Set() }

    const drawCoverImage = (ctx, canvas, img) => {
      if (!img) return
      const nw = img.naturalWidth || img.width
      const nh = img.naturalHeight || img.height
      if (!nw || !nh) return

      const cw = canvas.width
      const ch = canvas.height
      if (cw <= 0 || ch <= 0) return

      const imgRatio = nw / nh
      const canvasRatio = cw / ch

      let drawW, drawH, drawX, drawY

      if (canvasRatio > imgRatio) {
        drawW = cw
        drawH = cw / imgRatio
        drawX = 0
        drawY = (ch - drawH) / 2
      } else {
        drawH = ch
        drawW = ch * imgRatio
        drawX = (cw - drawW) / 2
        drawY = 0
      }

      ctx.drawImage(img, drawX, drawY, drawW, drawH)
    }

    const renderCurrentFrame = (frameNum) => {
      const canvas = canvasRef.current
      if (!canvas) return
      // { alpha: false } provides direct hardware overlay composite for maximum GPU fillrate
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx) return

      const idx = Math.min(Math.max(Math.round(frameNum) - 1, 0), TOTAL_FRAMES - 1)

      // Guard: skip repaint if frame hasn't changed (saves 70% of draw calls on scroll)
      if (idx === lastRenderedFrame.current) return

      const img = imagesRef.current[idx]

      if (img) {
        drawCoverImage(ctx, canvas, img)
        lastRenderedFrame.current = idx
        shownFrame.current = idx
        return
      }

      // Fallback to the nearest loaded frame while the target is still downloading
      let nearestIdx = -1
      let minDistance = Infinity

      for (let i = 0; i < TOTAL_FRAMES; i++) {
        if (imagesRef.current[i]) {
          const dist = Math.abs(i - idx)
          if (dist < minDistance) {
            minDistance = dist
            nearestIdx = i
          }
        }
      }

      if (nearestIdx !== -1 && nearestIdx !== shownFrame.current) {
        drawCoverImage(ctx, canvas, imagesRef.current[nearestIdx])
        shownFrame.current = nearestIdx
        // Note: Do NOT set lastRenderedFrame.current = idx here,
        // so that when idx finishes downloading, it draws immediately!
      }
    }

    // The wrapper is sized in lvh (largest viewport), so it does not change when the mobile
    // address bar collapses mid-scroll. Resizing the canvas clears it, and doing that on every
    // toolbar change made the background flash and stutter while scrolling on phones.
    const handleResize = () => {
      const canvas = canvasRef.current
      const wrapper = wrapperRef.current
      if (!canvas || !wrapper) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const nextW = Math.round(wrapper.clientWidth * dpr)
      const nextH = Math.round(wrapper.clientHeight * dpr)
      // Rotating a phone or resizing a window can cross the portrait threshold: switch sets
      const nextSet = pickFrameSet()
      const setChanged = nextSet !== activeSet
      if (setChanged) {
        activeSet = nextSet
        imagesRef.current = imageCaches[activeSet]
      }
      if (canvas.width === nextW && canvas.height === nextH && !setChanged) return
      canvas.width = nextW
      canvas.height = nextH
      lastRenderedFrame.current = -1 // Force redraw on resize
      shownFrame.current = -1
      renderCurrentFrame(frameObj.current.frame)
      if (setChanged) pump()
    }

    window.addEventListener('resize', handleResize, { passive: true })
    handleResize()

    // Scroll-aware loader: a small pool of parallel requests, always picking the missing
    // frame closest to where the viewer currently is. Firing all 300 requests at once made
    // slow (mobile) connections fetch frames in file order, so after the hero the background
    // froze on the last loaded frame until the whole sequence arrived.
    const MAX_PARALLEL = 8
    let inFlight = 0

    const nextFrameToLoad = () => {
      const target = Math.min(Math.max(Math.round(frameObj.current.frame) - 1, 0), TOTAL_FRAMES - 1)
      const cache = imageCaches[activeSet]
      const requested = requestedBySet[activeSet]
      const isMissing = (i) => !cache[i] && !requested.has(i)
      for (let d = 0; d < TOTAL_FRAMES; d++) {
        // Look further ahead than behind: viewers mostly scroll down
        const ahead = target + d
        if (ahead < TOTAL_FRAMES && isMissing(ahead)) return ahead
        const behind = target - Math.ceil(d / 2)
        if (behind >= 0 && isMissing(behind)) return behind
      }
      return -1
    }

    const pump = () => {
      while (!isCancelled && inFlight < MAX_PARALLEL) {
        const idx = nextFrameToLoad()
        if (idx === -1) return
        const set = activeSet
        requestedBySet[set].add(idx)
        inFlight++

        const img = new Image()
        img.src = getFrameUrl(set, idx + 1)

        const done = (ok) => {
          inFlight--
          if (ok) imageCaches[set][idx] = img
          if (isCancelled) return
          // Repaint if this frame is a better match than what is on screen now
          const target = Math.round(frameObj.current.frame) - 1
          if (ok && set === activeSet && Math.abs(idx - target) < Math.abs(shownFrame.current - target)) {
            lastRenderedFrame.current = -1
            renderCurrentFrame(frameObj.current.frame)
          }
          pump()
        }
        // decode() finishes AVIF decoding off the main thread before the frame is used,
        // so drawImage during scroll never stalls on a first-time decode (visible hitching)
        // A browser may hold decode() while the page is not being painted (background tab,
        // hidden webview); never let that stall the queue: after the bytes arrive, wait for
        // the decode at most 300 ms and carry on either way.
        const loaded = new Promise((resolve) => {
          img.onload = () => resolve(true)
          img.onerror = () => resolve(false)
        })
        loaded
          .then((ok) => ok && Promise.race([
            img.decode().then(() => true, () => true),
            new Promise((resolve) => setTimeout(() => resolve(true), 300)),
          ]))
          .then(done)
      }
    }

    // Share of total scroll at which the hero's sticky fly-through ends (hero bottom meets
    // viewport bottom, the same point App's hero timeline finishes). Re-measured on refresh.
    let heroEnd = 0.2
    const measureHeroEnd = (self) => {
      const hero = document.getElementById('section-hero')
      const range = self.end - self.start
      if (!hero || range <= 0) return
      const heroScroll = hero.offsetTop + hero.offsetHeight - window.innerHeight - self.start
      heroEnd = Math.min(Math.max(heroScroll / range, 0.05), 0.9)
    }

    const progressToFrame = (p) => {
      if (p <= heroEnd) return 1 + (p / heroEnd) * (HERO_END_FRAME - 1)
      return HERO_END_FRAME + ((p - heroEnd) / (1 - heroEnd)) * (TOTAL_FRAMES - HERO_END_FRAME)
    }

    const syncToScroll = (self) => {
      const targetFrame = progressToFrame(self.progress)
      frameObj.current.frame = targetFrame
      renderCurrentFrame(targetFrame)
    }

    const trigger = ScrollTrigger.create({
      trigger: scrollContainerRef?.current || document.body,
      start: 'top top',
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onRefresh: (self) => {
        measureHeroEnd(self)
        syncToScroll(self)
      },
      onUpdate: syncToScroll,
    })
    measureHeroEnd(trigger)
    frameObj.current.frame = progressToFrame(trigger.progress)

    // Start loading around the current position (after a reload mid-page too)
    pump()

    return () => {
      isCancelled = true
      window.removeEventListener('resize', handleResize)
      trigger.kill()
    }
  }, [scrollContainerRef])

  return (
    <div className="canvas-wrapper" ref={wrapperRef}>
      <canvas ref={canvasRef} className="kinetic-canvas" />

      {/* Atmospheric dark cinematic vignette for high readability */}
      <div className="canvas-overlay" />
    </div>
  )
}
