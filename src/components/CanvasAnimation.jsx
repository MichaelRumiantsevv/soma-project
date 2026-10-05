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
//   screen only ever shows that strip, and JPEG decodes far faster than AVIF on phones.
const FRAME_SETS = {
  desktop: { dir: 'desktop', ext: 'avif', width: 1280, height: 720 },
  mobile: { dir: 'mobile', ext: 'jpg', width: 405, height: 720 },
}

// The strip is 405/720 = 0.5625 wide; up to ~0.6 it still covers the screen with only a
// slight top/bottom trim. Wider (landscape phones, tablets, desktop) needs full frames.
const pickFrameSet = () => (window.innerWidth / window.innerHeight <= 0.6 ? 'mobile' : 'desktop')

const getFrameUrl = (set, frameIndex) => {
  const { dir, ext } = FRAME_SETS[set]
  return `${BASE}sequence/${dir}/frame-${String(frameIndex).padStart(3, '0')}.${ext}`
}

// Download order. Every KEYFRAME_STRIDE-th frame is pulled forward (it counts as being
// KEYFRAME_BOOST times closer), so on a slow connection the whole scroll range gets coarse
// coverage early and the background keeps moving instead of freezing on the last frame
// that arrived; the gaps fill in around the viewer afterwards.
const KEYFRAME_STRIDE = 16
const KEYFRAME_BOOST = 8
const MAX_PARALLEL_FETCHES = 6
const MAX_FETCH_RETRIES = 3

// Decoded frames are kept as ImageBitmaps only around the current position (plus the
// keyframes). Holding all 300 decoded (~1.1 GB on desktop) made the browser evict them
// and re-decode AVIF synchronously inside drawImage while scrolling: the stutter.
// createImageBitmap decodes off the main thread, so drawing a bitmap never blocks.
const DECODE_AHEAD = 18
const DECODE_BEHIND = 8
const MAX_PARALLEL_DECODES = 4

// Compressed frames, per set, kept across StrictMode remounts (~8 MB for a whole set)
const blobCaches = {
  desktop: new Array(TOTAL_FRAMES),
  mobile: new Array(TOTAL_FRAMES),
}

const isKeyframe = (i) => i % KEYFRAME_STRIDE === 0

export default function CanvasAnimation({ scrollContainerRef }) {
  const wrapperRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    let isCancelled = false
    let activeSet = pickFrameSet()
    // Current scroll position in frames (1-based, fractional)
    let currentFrame = 1
    // Index painted on the canvas (may be a nearby stand-in while the target loads)
    let shownIdx = -1
    let shownExact = false

    // Frames requested from the network per set (loaded, in flight or failed)
    const requestedBySet = { desktop: new Set(), mobile: new Set() }
    const failedAttempts = new Map()
    let fetchesInFlight = 0

    // Decoded frames for the active set only
    let bitmaps = new Map()
    let decoding = new Set()
    let decodesInFlight = 0

    const targetIdx = () => Math.min(Math.max(Math.round(currentFrame) - 1, 0), TOTAL_FRAMES - 1)

    const getContext = () => canvasRef.current?.getContext('2d', { alpha: false }) || null

    const drawCover = (bitmap) => {
      const canvas = canvasRef.current
      const ctx = getContext()
      if (!canvas || !ctx) return
      const cw = canvas.width
      const ch = canvas.height
      if (cw <= 0 || ch <= 0) return
      const scale = Math.max(cw / bitmap.width, ch / bitmap.height)
      const w = bitmap.width * scale
      const h = bitmap.height * scale
      ctx.drawImage(bitmap, (cw - w) / 2, (ch - h) / 2, w, h)
    }

    const render = () => {
      const idx = targetIdx()
      const exact = bitmaps.get(idx)
      if (exact) {
        if (shownIdx === idx && shownExact) return
        drawCover(exact)
        shownIdx = idx
        shownExact = true
        return
      }
      // Nearest decoded frame as a stand-in until the target is ready
      let nearest = -1
      let best = Infinity
      for (const i of bitmaps.keys()) {
        const d = Math.abs(i - idx)
        if (d < best) {
          best = d
          nearest = i
        }
      }
      if (nearest !== -1 && nearest !== shownIdx) {
        drawCover(bitmaps.get(nearest))
        shownIdx = nearest
        shownExact = false
      }
    }

    // --- Decoding window -------------------------------------------------------------

    const wantsBitmap = (i, target) =>
      isKeyframe(i) || (i >= target - DECODE_BEHIND && i <= target + DECODE_AHEAD)

    const updateDecodes = () => {
      if (isCancelled) return
      const target = targetIdx()
      const blobs = blobCaches[activeSet]

      // Free decoded frames that fell out of the window
      for (const [i, bitmap] of bitmaps) {
        if (!wantsBitmap(i, target)) {
          bitmap.close()
          bitmaps.delete(i)
        }
      }

      // Decode the closest missing frames first (ahead before behind)
      const order = [target]
      for (let d = 1; d <= DECODE_AHEAD; d++) {
        order.push(target + d)
        if (d <= DECODE_BEHIND) order.push(target - d)
      }
      for (const i of order) {
        if (decodesInFlight >= MAX_PARALLEL_DECODES) return
        if (i < 0 || i >= TOTAL_FRAMES) continue
        if (blobs[i] && !bitmaps.has(i) && !decoding.has(i)) decode(i)
      }
      // Keyframes anywhere on the page, nearest first
      const keys = []
      for (let i = 0; i < TOTAL_FRAMES; i += KEYFRAME_STRIDE) {
        if (blobs[i] && !bitmaps.has(i) && !decoding.has(i)) keys.push(i)
      }
      keys.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))
      for (const i of keys) {
        if (decodesInFlight >= MAX_PARALLEL_DECODES) return
        decode(i)
      }
    }

    const decode = (i) => {
      const set = activeSet
      const setBitmaps = bitmaps
      const setDecoding = decoding
      setDecoding.add(i)
      decodesInFlight++
      createImageBitmap(blobCaches[set][i])
        .then((bitmap) => {
          // Discard if the set switched or the viewer has moved on meanwhile
          if (isCancelled || set !== activeSet || !wantsBitmap(i, targetIdx())) {
            bitmap.close()
            return
          }
          setBitmaps.set(i, bitmap)
          render()
        })
        .catch(() => {
          // Undecodable frame: drop the bytes so it is not retried in a loop
          blobCaches[set][i] = undefined
        })
        .finally(() => {
          setDecoding.delete(i)
          decodesInFlight--
          updateDecodes()
        })
    }

    // --- Network ---------------------------------------------------------------------

    const nextFrameToFetch = () => {
      const target = targetIdx()
      const blobs = blobCaches[activeSet]
      const requested = requestedBySet[activeSet]
      let pick = -1
      let bestScore = Infinity
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        if (blobs[i] || requested.has(i)) continue
        // Viewers mostly scroll down: frames behind count double
        let score = i >= target ? i - target : (target - i) * 2
        if (isKeyframe(i)) score /= KEYFRAME_BOOST
        if (score < bestScore) {
          bestScore = score
          pick = i
        }
      }
      return pick
    }

    const pumpFetches = () => {
      while (!isCancelled && fetchesInFlight < MAX_PARALLEL_FETCHES) {
        const i = nextFrameToFetch()
        if (i === -1) return
        const set = activeSet
        requestedBySet[set].add(i)
        fetchesInFlight++
        fetch(getFrameUrl(set, i + 1), { priority: i === targetIdx() ? 'high' : 'auto' })
          .then((res) => (res.ok ? res.blob() : null))
          .catch(() => null)
          .then((blob) => {
            fetchesInFlight--
            if (blob) blobCaches[set][i] = blob
            if (isCancelled) return
            // Transient errors (a 503 from the host, a dropped connection): put the frame
            // back in the queue after a pause instead of leaving a permanent gap
            if (!blob) {
              const attempts = (failedAttempts.get(`${set}:${i}`) || 0) + 1
              failedAttempts.set(`${set}:${i}`, attempts)
              if (attempts <= MAX_FETCH_RETRIES) {
                setTimeout(() => {
                  if (isCancelled) return
                  requestedBySet[set].delete(i)
                  pumpFetches()
                }, 1000 * attempts)
              }
            }
            if (blob && set === activeSet) updateDecodes()
            pumpFetches()
          })
      }
    }

    // Start from whatever this set already has in memory (StrictMode remount, set switch)
    const resetSet = () => {
      for (const bitmap of bitmaps.values()) bitmap.close()
      bitmaps = new Map()
      decoding = new Set()
      shownIdx = -1
      shownExact = false
    }

    // --- Canvas size -----------------------------------------------------------------

    // The wrapper is sized in lvh (largest viewport), so it does not change when the mobile
    // address bar collapses mid-scroll. Resizing the canvas clears it, and doing that on every
    // toolbar change made the background flash and stutter while scrolling on phones.
    //
    // The backing store never exceeds the frame's own resolution: on a 2x display a
    // full-DPR canvas was 4K for 720p footage, drawing four times the pixels for no extra
    // detail. CSS stretches the canvas to the screen instead.
    const handleResize = () => {
      const canvas = canvasRef.current
      const wrapper = wrapperRef.current
      if (!canvas || !wrapper) return
      const nextSet = pickFrameSet()
      const setChanged = nextSet !== activeSet
      if (setChanged) {
        activeSet = nextSet
        resetSet()
      }
      const { width: fw, height: fh } = FRAME_SETS[activeSet]
      const cssW = wrapper.clientWidth
      const cssH = wrapper.clientHeight
      if (!cssW || !cssH) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const coverScale = Math.max(cssW / fw, cssH / fh)
      const k = Math.min(dpr, 1 / coverScale)
      const nextW = Math.round(cssW * k)
      const nextH = Math.round(cssH * k)
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW
        canvas.height = nextH
        shownIdx = -1 // resizing cleared the canvas
      }
      if (setChanged) {
        updateDecodes()
        pumpFetches()
      }
      render()
    }

    window.addEventListener('resize', handleResize, { passive: true })
    handleResize()

    // --- Scroll ----------------------------------------------------------------------

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

    let lastWindowTarget = -1
    const syncToScroll = (self) => {
      currentFrame = progressToFrame(self.progress)
      render()
      // Slide the decode window only when the target frame actually changes
      const target = targetIdx()
      if (target !== lastWindowTarget) {
        lastWindowTarget = target
        updateDecodes()
      }
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
    currentFrame = progressToFrame(trigger.progress)

    // Start loading around the current position (after a reload mid-page too)
    updateDecodes()
    pumpFetches()

    return () => {
      isCancelled = true
      window.removeEventListener('resize', handleResize)
      trigger.kill()
      for (const bitmap of bitmaps.values()) bitmap.close()
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
