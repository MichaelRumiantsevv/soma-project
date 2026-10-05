import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import CanvasAnimation from './components/CanvasAnimation'
import project1Img from './assets/projects/1_03.jpg'
import project2Img from './assets/projects/2_03.jpg'
import project3Img from './assets/projects/3_03.jpg'

gsap.registerPlugin(ScrollTrigger)

// Up to this width the site uses the touch interaction model (phones and tablets)
const TOUCH_MAX_WIDTH = 1024

export default function App() {
  const containerRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [headerSolid, setHeaderSolid] = useState(false)

  useEffect(() => {
    const cleanupFns = []

    // Reduced motion: no entrances, no fly-through zoom, no reveal travel. Content is
    // simply present; scroll-linked frame playback stays because the viewer drives it.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const ctx = gsap.context(() => {
      // Hero entrance choreography (always define tweens so state is guaranteed)
      const heroTl = gsap.timeline({ defaults: { ease: 'power2.out' } })
      heroTl
        .fromTo('.hero-sub-label',
          { autoAlpha: 0, y: -16 },
          { autoAlpha: 1, y: 0, duration: 0.9, delay: 0.1 }
        )
        .fromTo('.hero-monumental-heading',
          { autoAlpha: 0, y: 40 },
          { autoAlpha: 1, y: 0, duration: 1.2 },
          '-=0.6'
        )
        .fromTo('.hero-microcopy-line',
          { autoAlpha: 0, y: 20 },
          { autoAlpha: 1, y: 0, duration: 0.9 },
          '-=0.8'
        )
        .fromTo('.hero-hud-bottom',
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 1.0 },
          '-=0.5'
        )

      if (window.scrollY > 20 || reduceMotion) {
        heroTl.progress(1)
      }


      // Horizontal top scroll progress bar animation
      gsap.to('.top-scroll-progress-bar', {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current || document.body,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.05,
        },
      })

      const isMobile = window.innerWidth <= 768
      // Phones and tablets (<= 1024px) share the touch interaction model: no hover,
      // cards reveal / focus / unfold as they scroll past the centre. Matches the CSS
      // "TOUCH INTERACTION TIER" block.
      const isTouchLayout = window.innerWidth <= TOUCH_MAX_WIDTH
      const maxHeadingScale = isMobile ? 3.8 : 6.0

      // Cinematic 3D Camera Zoom / Fly-Through on Hero scroll
      // Fix 3: reversible timeline via scrub so scrolling back resets hero elements
      // Ends a little before the sticky stage releases ('bottom 110%' rather than
      // 'bottom bottom') and uses a short scrub lag, so the heading is fully gone before
      // the stage starts scrolling away. Previously the 1s scrub lag plus a y offset
      // eased in at the end made the heading visibly lift upwards just before vanishing.
      const heroZoomTl = gsap.timeline({
        scrollTrigger: {
          trigger: '#section-hero',
          start: 'top top',
          end: 'bottom 110%',
          scrub: 0.4,
          invalidateOnRefresh: true,
          onEnter: () => {
            if (heroTl.isActive()) heroTl.progress(1)
          },
        },
      })

      heroZoomTl
        // 1. Heading scales straight towards the camera (scale only, no vertical travel)
        .to('.hero-monumental-heading', {
          scale: reduceMotion ? 1 : maxHeadingScale,
          ease: 'power1.in',
          duration: 1,
        }, 0)
        // 2. Holds near full opacity, then dissolves as it passes the camera;
        //    fully transparent by 90% of the fly-through
        .to('.hero-monumental-heading', {
          autoAlpha: 0,
          ease: 'power2.in',
          duration: 0.3,
        }, 0.6)
        // The contrast veil lifts with the title so the door pass-through is full brightness
        .to('.hero-veil', {
          autoAlpha: 0,
          ease: 'power1.in',
          duration: 0.35,
        }, 0.55)
        .to('.hero-sub-label', {
          scale: 1.4,
          y: -40,
          autoAlpha: 0,
          ease: 'power1.out',
          duration: 0.55,
        }, 0)
        .to('.hero-microcopy-line', {
          scale: 1.25,
          y: 30,
          autoAlpha: 0,
          ease: 'power1.out',
          duration: 0.55,
        }, 0)
        .to('.hero-hud-bottom', {
          y: 25,
          autoAlpha: 0,
          ease: 'power1.out',
          duration: 0.4,
        }, 0)

      // Animate narrative sections as user scrolls through the 3D space
      const sections = gsap.utils.toArray('.narrative-section')
      sections.forEach((sec) => {
        if (reduceMotion) return
        const panel = sec.querySelector('.glass-floating-panel, .glass-floating-panel-wide')
        if (!panel) return

        // One motion per element: the panel rises in with its content already inside.
        // (Animating the panel and then its contents again read as the card appearing twice.)
        // Triggered on the panel itself: sections are taller than the viewport and centre
        // the panel, so a section-top trigger fired while the panel was still off-screen.
        gsap.fromTo(panel,
          { autoAlpha: 0, y: 32 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.7,
            ease: 'power3.out',
            scrollTrigger: { trigger: panel, start: 'top 88%', once: true },
          }
        )
      })

      if (isTouchLayout && !reduceMotion) {
        // Phones: panels are taller than the screen, so each card also rises in once as it
        // arrives. The motion is pure CSS (.will-reveal → .is-in, on `translate`/`opacity`);
        // GSAP only flips the class. Tweening the card with GSAP rewrote its `transform`
        // and reset `scale`, fighting the CSS focus/unfold transitions: the double motion.
        const revealCard = (card) => {
          card.classList.add('will-reveal')
          ScrollTrigger.create({
            trigger: card,
            start: 'top 92%',
            once: true,
            onEnter: () => card.classList.add('is-in'),
          })
        }

        gsap.utils.toArray('.mechanics-card').forEach(revealCard)
        // Section 03: cards reveal, then unfold when they reach the centre (focus handler below)
        gsap.utils.toArray('.project-row').forEach(revealCard)

        gsap.utils.toArray('.inquiry-capsule').forEach((cta) => {
          gsap.fromTo(cta,
            { autoAlpha: 0, y: 20 },
            {
              autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out',
              scrollTrigger: { trigger: cta, start: 'top 94%', once: true },
            }
          )
        })
      }

      // Mobile header: transparent over the hero, glass bar once the hero is passed
      ScrollTrigger.create({
        trigger: '#section-hero',
        start: 'bottom 60%',
        onEnter: () => setHeaderSolid(true),
        onLeaveBack: () => setHeaderSolid(false),
      })

      // Animate Section 04: The Pipeline Timeline cards (Alternating left/right entrance)
      const timelineSteps = gsap.utils.toArray('.timeline-step')
      timelineSteps.forEach((step, index) => {
        if (reduceMotion) return
        const isLeft = step.classList.contains('step-left') || index % 2 === 0
        const xOffset = isLeft ? -40 : 40
        const card = step.querySelector('.timeline-content')
        const node = step.querySelector('.timeline-node')

        const stepTl = gsap.timeline({
          scrollTrigger: {
            trigger: step,
            start: 'top 88%',
            once: true,
          },
        })

        if (card) {
          stepTl.fromTo(
            card,
            { autoAlpha: 0, x: isTouchLayout ? 0 : xOffset },
            {
              autoAlpha: 1,
              x: 0,
              duration: 0.6,
              ease: 'power2.out',
            },
            0
          )
        }

        if (node) {
          stepTl.fromTo(
            node,
            { autoAlpha: 0, scale: 0.4 },
            {
              autoAlpha: 1,
              scale: 1,
              duration: 0.6,
              ease: 'back.out(1.7)',
            },
            0.1
          )
        }
      })

      // Hover preview image with Newtonian trailing physics & 3D inertia tilt for Section 03 projects
      const projectRows = gsap.utils.toArray('.project-row')

      projectRows.forEach((row) => {
        const img = row.querySelector('.project-cursor-preview-img')
        if (!img) return

        const isMobile = () => window.innerWidth <= TOUCH_MAX_WIDTH

        if (!isMobile()) {
          gsap.set(img, {
            xPercent: -50,
            yPercent: -50,
            autoAlpha: 0,
            scale: 0.85,
            rotation: 0,
            rotateY: 0,
            rotateX: 0,
            skewX: 0,
            transformPerspective: 1000,
          })
        }

        let isHovered = false
        let currentX = 0
        let currentY = 0
        let targetX = 0
        let targetY = 0
        let vx = 0
        let vy = 0
        let currentRot = 0
        let currentRotateY = 0
        let currentRotateX = 0
        let currentSkewX = 0

        // Physical spring parameters:
        const spring = 0.065
        const friction = 0.8

        // Physics ticker loop: Hooke's Law spring-mass simulation
        const tick = () => {
          if (isMobile()) return
          if (!isHovered && Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) return

          // Spring acceleration towards cursor
          const ax = (targetX - currentX) * spring
          const ay = (targetY - currentY) * spring

          vx = (vx + ax) * friction
          vy = (vy + ay) * friction

          currentX += vx
          currentY += vy

          // Velocity-driven physical reaction:
          const targetRot = gsap.utils.clamp(-24, 24, vx * 1.35)
          const targetRotateY = gsap.utils.clamp(-18, 18, vx * 0.95)
          const targetRotateX = gsap.utils.clamp(-16, 16, -vy * 0.95)
          const targetSkewX = gsap.utils.clamp(-10, 10, -vx * 0.35)

          currentRot += (targetRot - currentRot) * 0.16
          currentRotateY += (targetRotateY - currentRotateY) * 0.16
          currentRotateX += (targetRotateX - currentRotateX) * 0.16
          currentSkewX += (targetSkewX - currentSkewX) * 0.16

          const speed = Math.sqrt(vx * vx + vy * vy)
          const stretch = Math.min(speed * 0.0035, 0.14)
          const scaleX = (1 + stretch) * (isHovered ? 1 : 0.85)
          const scaleY = (1 - stretch * 0.45) * (isHovered ? 1 : 0.85)

          gsap.set(img, {
            x: currentX,
            y: currentY,
            rotation: currentRot,
            rotateY: currentRotateY,
            rotateX: currentRotateX,
            skewX: currentSkewX,
            scaleX,
            scaleY,
          })
        }

        gsap.ticker.add(tick)
        cleanupFns.push(() => gsap.ticker.remove(tick))

        let hideTimer = null

        const handleMouseEnter = (e) => {
          if (isMobile()) return
          clearTimeout(hideTimer)
          row.style.zIndex = '30'
          const rect = row.getBoundingClientRect()
          targetX = e.clientX - rect.left
          targetY = e.clientY - rect.top
          currentX = targetX
          currentY = targetY
          vx = 0
          vy = 0
          currentRot = 0
          currentRotateY = 0
          currentRotateX = 0
          currentSkewX = 0
          isHovered = true

          gsap.to(img, {
            autoAlpha: 1,
            duration: 0.32,
            ease: 'power2.out',
            overwrite: 'auto',
          })
        }

        const handleMouseMove = (e) => {
          if (isMobile()) return
          const rect = row.getBoundingClientRect()
          targetX = e.clientX - rect.left
          targetY = e.clientY - rect.top
        }

        const handleMouseLeave = () => {
          if (isMobile()) return
          hideTimer = setTimeout(() => {
            isHovered = false
            gsap.to(img, {
              autoAlpha: 0,
              duration: 0.28,
              ease: 'power2.in',
              overwrite: 'auto',
              onComplete: () => {
                if (!isHovered) {
                  row.style.zIndex = ''
                }
              },
            })
          }, 40)
        }

        const handleResize = () => {
          if (isMobile()) {
            isHovered = false
            row.style.zIndex = ''
            gsap.set(img, { clearProps: 'all' })
          } else {
            gsap.set(img, {
              xPercent: -50,
              yPercent: -50,
              autoAlpha: 0,
              scale: 0.85,
              rotation: 0,
              rotateY: 0,
              rotateX: 0,
              skewX: 0,
              transformPerspective: 1000,
            })
          }
        }

        window.addEventListener('resize', handleResize)
        row.addEventListener('mouseenter', handleMouseEnter)
        row.addEventListener('mousemove', handleMouseMove)
        row.addEventListener('mouseleave', handleMouseLeave)

        cleanupFns.push(() => {
          window.removeEventListener('resize', handleResize)
          row.removeEventListener('mouseenter', handleMouseEnter)
          row.removeEventListener('mousemove', handleMouseMove)
          row.removeEventListener('mouseleave', handleMouseLeave)
        })
      })

      // Touch focus states (phones + tablets): the card closest to the middle of the screen gets a class.
      // Only transforms / clip-path / opacity react to it, never size, so focusing a card
      // cannot move the others and re-trigger the check (the old expand-by-height did).
      const focusClosest = (items, className, onFocus) => {
        if (window.innerWidth > TOUCH_MAX_WIDTH || items.length === 0) return
        const vh = window.innerHeight
        let minDistance = Infinity
        const centres = items.map((item) => {
          const rect = item.getBoundingClientRect()
          // Only candidates reasonably within the screen
          if (rect.bottom <= vh * 0.2 || rect.top >= vh * 0.8) return null
          const centre = rect.top + rect.height * 0.5
          minDistance = Math.min(minDistance, Math.abs(centre - vh * 0.5))
          return centre
        })

        items.forEach((item, i) => {
          // Everything on the closest row is focused: on tablets the mechanics cards sit
          // three across, so a whole row lights up rather than just its first card
          const c = centres[i]
          const isFocused = c !== null && Math.abs(Math.abs(c - vh * 0.5) - minDistance) < 8
          if (isFocused && !item.classList.contains(className)) onFocus?.(item)
          item.classList.toggle(className, isFocused)
        })
      }

      const mechanicsCards = gsap.utils.toArray('.mechanics-card')

      let focusFrame = 0
      const handleMobileScroll = () => {
        if (focusFrame) return
        focusFrame = requestAnimationFrame(() => {
          focusFrame = 0
          // Section 02: focused card grows slightly; the first time, a glint runs once around its border
          focusClosest(mechanicsCards, 'is-focused', (card) => card.classList.add('is-glint'))
          // Section 03: focused card unfolds (artwork opens, card scales up)
          focusClosest(projectRows, 'is-expanded')
          // Section 04: active timeline step
          focusClosest(timelineSteps, 'is-active')
        })
      }

      window.addEventListener('scroll', handleMobileScroll, { passive: true })
      window.addEventListener('resize', handleMobileScroll, { passive: true })
      // Initial check on load
      handleMobileScroll()

      cleanupFns.push(() => {
        cancelAnimationFrame(focusFrame)
        window.removeEventListener('scroll', handleMobileScroll)
        window.removeEventListener('resize', handleMobileScroll)
      })

      // Trigger positions are measured once; anything that changes page height afterwards
      // (web fonts, mobile cards expanding, images) leaves them stale and reveals fire at
      // the wrong scroll offset. Re-measure whenever the page height actually changes.
      let lastHeight = containerRef.current?.offsetHeight || 0
      let refreshTimer = null
      const ro = new ResizeObserver(() => {
        const h = containerRef.current?.offsetHeight || 0
        if (h === lastHeight) return
        lastHeight = h
        clearTimeout(refreshTimer)
        refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150)
      })
      if (containerRef.current) ro.observe(containerRef.current)
      document.fonts?.ready.then(() => ScrollTrigger.refresh())

      cleanupFns.push(() => {
        ro.disconnect()
        clearTimeout(refreshTimer)
      })
    }, containerRef)

    return () => {
      cleanupFns.forEach((fn) => fn())
      ctx.revert()
    }
  }, [])

  // Lock body scroll and intercept all scroll inputs when menu is open
  useEffect(() => {
    if (!menuOpen) return

    const originalOverflow = document.body.style.overflow
    const originalHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    const preventScroll = (e) => {
      // If event originated inside the menu drawer and the drawer itself overflows, let it scroll internally
      const drawer = document.querySelector('.minimal-menu-drawer')
      if (drawer && drawer.contains(e.target) && drawer.scrollHeight > drawer.clientHeight) {
        return
      }
      e.preventDefault()
    }

    const preventKeyScroll = (e) => {
      const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']
      if (scrollKeys.includes(e.key)) {
        e.preventDefault()
      }
      if (e.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    window.addEventListener('wheel', preventScroll, { passive: false })
    window.addEventListener('touchmove', preventScroll, { passive: false })
    window.addEventListener('keydown', preventKeyScroll)

    return () => {
      document.body.style.overflow = originalOverflow
      document.documentElement.style.overflow = originalHtmlOverflow
      window.removeEventListener('wheel', preventScroll)
      window.removeEventListener('touchmove', preventScroll)
      window.removeEventListener('keydown', preventKeyScroll)
    }
  }, [menuOpen])

  const scrollBehavior = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

  const scrollTo = (id) => {
    setMenuOpen(false)
    const el = document.getElementById(id)
    if (el) {
      if (id === 'section-contact') {
        el.scrollIntoView({ behavior: scrollBehavior(), block: 'end' })
      } else {
        el.scrollIntoView({ behavior: scrollBehavior() })
      }
    }
  }

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev)
  }

  // Keyboard parity for the non-button rows: Enter / Space act like a click
  const onActivateKey = (e, action) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }

  const handleProjectClick = (e, targetId) => {
    // On mobile the cards are static showcase cards, not links
    if (window.innerWidth <= TOUCH_MAX_WIDTH) return
    scrollTo(targetId)
  }

  return (
    <div className="page-container" ref={containerRef}>
      {/* Ultra-thin Horizontal Top Scroll Progress Indicator */}
      <div className="top-scroll-progress-bar" />

      {/* 3D Kinetic Canvas Background — driven untouched by GSAP ScrollTrigger */}
      <CanvasAnimation scrollContainerRef={containerRef} />

      {/* Minimalist Floating Header */}
      <header className={`minimal-header${headerSolid ? ' is-solid' : ''}${menuOpen ? ' is-menu-open' : ''}`}>
        <button 
          className="logo-link" 
          onClick={() => scrollTo('section-hero')}
          aria-label="Scroll to top"
        >
          <span className="logo-text">SOMA // PROJECT</span>
          <span className="logo-sub">DOCUMENTARY // 2026</span>
        </button>

        {/* Single toggle for the drawer: the header sits above the drawer, so this
            button morphs into the close control instead of a second button overlapping it */}
        <button
          className={`menu-btn ${menuOpen ? 'is-open' : ''}`}
          onClick={toggleMenu}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="site-menu"
        >
          <span className="menu-label-text">{menuOpen ? '[ CLOSE ]' : '[ MENU ]'}</span>
          <span className="burger-icon" aria-hidden="true">
            <span className="burger-line" />
            <span className="burger-line" />
            <span className="burger-line" />
          </span>
        </button>
      </header>

      {/* Minimal Fullscreen Menu Overlay Drawer */}
      <nav
        id="site-menu"
        className={`minimal-menu-drawer ${menuOpen ? 'is-open' : ''}`}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <ul className="drawer-nav-list">
          <li>
            <button className="drawer-nav-item" onClick={() => scrollTo('section-hero')}>
              <span className="drawer-item-index">00</span>
              <span className="drawer-item-title">The Origin</span>
            </button>
          </li>
          <li>
            <button className="drawer-nav-item" onClick={() => scrollTo('section-illusion')}>
              <span className="drawer-item-index">01</span>
              <span className="drawer-item-title">The Illusion</span>
            </button>
          </li>
          <li>
            <button className="drawer-nav-item" onClick={() => scrollTo('section-mechanics')}>
              <span className="drawer-item-index">02</span>
              <span className="drawer-item-title">Mechanics</span>
            </button>
          </li>
          <li>
            <button className="drawer-nav-item" onClick={() => scrollTo('section-playground')}>
              <span className="drawer-item-index">03</span>
              <span className="drawer-item-title">Sensory Artifacts</span>
            </button>
          </li>
          <li>
            <button className="drawer-nav-item" onClick={() => scrollTo('section-pipeline')}>
              <span className="drawer-item-index">04</span>
              <span className="drawer-item-title">The Pipeline</span>
            </button>
          </li>
          <li>
            <button className="drawer-nav-item" onClick={() => scrollTo('section-contact')}>
              <span className="drawer-item-index">05</span>
              <span className="drawer-item-title">The Void</span>
            </button>
          </li>
        </ul>

        <div className="drawer-bottom">
          <span>SOMA // HUMAN PERCEPTION</span>
          <div className="drawer-bottom-links">
            <a href="#credits" className="drawer-bottom-link">CREDITS</a>
            <a href="#press" className="drawer-bottom-link">PRESS KIT</a>
            <a href="#screenings" className="drawer-bottom-link">SCREENINGS</a>
          </div>
        </div>
      </nav>

      <main className="content-flow">
        {/* ===================================================================
            HERO SECTION: "ESCAPE THE ORDINARY"
            =================================================================== */}
        <section id="section-hero" className="hero-full-section">
          <div className="hero-sticky-stage">
            <div className="hero-veil" aria-hidden="true" />
            <div className="hero-content-box">
              <div className="hero-sub-label">
                ARCHIVE // VOL. 04
              </div>

              <h1 className="hero-monumental-heading">
                ESCAPE THE <br />
                <span className="serif-italic-accent">ORDINARY</span>
              </h1>

              <p className="hero-microcopy-line">
                AN INTERACTIVE DOCUMENTARY ON HUMAN PERCEPTION // AN IMMERSIVE EXPLORATION
              </p>
            </div>

            {/* Sparse corner data elements */}
            <div className="hero-hud-bottom">
              <span className="hud-item hero-hud-pulse">PULSE // 72 BPM</span>

              <button 
                className="scroll-indicator-minimal" 
                onClick={() => scrollTo('section-illusion')}
                aria-label="Scroll to explore"
              >
                <div className="scroll-pulse-track">
                  <div className="scroll-pulse-runner" />
                </div>
                <span className="hud-item">[ SCROLL TO EXPLORE ]</span>
              </button>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 01: "01 / THE ILLUSION" (Frames ~86 - 165)
            =================================================================== */}
        <section id="section-illusion" className="scroll-section narrative-section section-layout-left">
          <div className="glass-floating-panel">
            <span className="section-index-tag">01 / THE ILLUSION</span>

            <h2 className="cinematic-serif-heading">
              Perception is an <br />
              <span className="italic-word">Architecture of Light.</span>
            </h2>

            <p className="editorial-body-copy">
              A collaborative research project exploring the boundary between physical sensation and digital response. This is a visual journey into human cognition, where every scroll materializes invisible psychological processes into a tangible sensory experience.
            </p>

            <div className="telemetry-strip">
              <div className="telemetry-item">
                <span className="telemetry-label">NEURAL SYNC</span>
                <span className="telemetry-val">CORTEX_SYNC // STABLE</span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">RESPONSE</span>
                <span className="telemetry-val">STIMULUS // DETECTED</span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">COGNITION</span>
                <span className="telemetry-val">AWARENESS // EXPANDED</span>
              </div>
              <div className="telemetry-item">
                <span className="telemetry-label">FIELD</span>
                <span className="telemetry-val">SOMATIC // ACTIVE</span>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 02: "02 / MECHANICS" (Frames ~166 - 235)
            =================================================================== */}
        <section id="section-mechanics" className="scroll-section narrative-section section-layout-right">
          <div className="glass-floating-panel glass-floating-panel-wide">
            <span className="section-index-tag">02 / MECHANICS</span>

            <h2 className="cinematic-serif-heading">
              Engineering the <br />
              <span className="italic-word">Subconscious</span>
            </h2>

            <p className="editorial-body-copy">
              Behind visual serenity lies a rigorous kinetic engine. High-frequency 
              delta clamping, interpolation curves, and memory-safe frame swapping 
              coalesce into an unbroken tactile continuum.
            </p>

            <div className="mechanics-grid">
              <div className="mechanics-card">
                <span className="mechanics-num">SYS. 01</span>
                <h3 className="mechanics-title">Sensory Input</h3>
                <p className="mechanics-desc">
                  Mapping non-linear cognitive architectures to translate tactile and psychological sensations through spatial light.
                </p>
              </div>

              <div className="mechanics-card">
                <span className="mechanics-num">SYS. 02</span>
                <h3 className="mechanics-title">Visual Cortex</h3>
                <p className="mechanics-desc">
                  Generating complex 3D environments that simulate the mechanics of the human eye and cognitive light refraction.
                </p>
              </div>

              <div className="mechanics-card">
                <span className="mechanics-num">SYS. 03</span>
                <h3 className="mechanics-title">Neural Pathways</h3>
                <p className="mechanics-desc">
                  Calibrating somatic kinetics to seamlessly synchronize sensory resonance with human physical interaction.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 03: "03 / THE PLAYGROUND" (Frames ~236 - 300)
            =================================================================== */}
        <section id="section-playground" className="scroll-section narrative-section section-layout-center">
          <div className="glass-floating-panel glass-floating-panel-wide">
            <span className="section-index-tag">03 / THE PLAYGROUND</span>

            <h2 className="cinematic-serif-heading">
              Sensory <br />
              <span className="italic-word">Artifacts</span>
            </h2>

            <p className="editorial-body-copy">
              An archive of interactive chapters exploring cognitive responses and visual stimuli.
            </p>

            <div className="projects-list">
              <div
                className="project-row"
                role="button"
                tabIndex={0}
                onClick={(e) => handleProjectClick(e, 'section-hero')}
                onKeyDown={(e) => onActivateKey(e, () => handleProjectClick(e, 'section-hero'))}
              >
                <div className="project-name-group">
                  <div className="project-title-subgroup">
                    <span className="project-idx">01</span>
                    <span className="project-name">Somatic Embodiment</span>
                  </div>
                </div>
                <span className="project-meta-tag">CHAPTER I // PHYSICAL RESPONSE</span>
                <img 
                  src={project1Img} 
                  alt="Somatic Embodiment" 
                  className="project-cursor-preview-img" 
                />
              </div>

              <div
                className="project-row"
                role="button"
                tabIndex={0}
                onClick={(e) => handleProjectClick(e, 'section-illusion')}
                onKeyDown={(e) => onActivateKey(e, () => handleProjectClick(e, 'section-illusion'))}
              >
                <div className="project-name-group">
                  <div className="project-title-subgroup">
                    <span className="project-idx">02</span>
                    <span className="project-name">Cognitive Prism</span>
                  </div>
                </div>
                <span className="project-meta-tag">CHAPTER II // LIGHT DISPERSION</span>
                <img 
                  src={project2Img} 
                  alt="Cognitive Prism" 
                  className="project-cursor-preview-img" 
                />
              </div>

              <div
                className="project-row"
                role="button"
                tabIndex={0}
                onClick={(e) => handleProjectClick(e, 'section-mechanics')}
                onKeyDown={(e) => onActivateKey(e, () => handleProjectClick(e, 'section-mechanics'))}
              >
                <div className="project-name-group">
                  <div className="project-title-subgroup">
                    <span className="project-idx">03</span>
                    <span className="project-name">Auditory Synthesis</span>
                  </div>
                </div>
                <span className="project-meta-tag">CHAPTER III // FREQUENCY</span>
                <img 
                  src={project3Img} 
                  alt="Auditory Synthesis" 
                  className="project-cursor-preview-img" 
                />
              </div>
            </div>

            <a 
              href="mailto:ACCESS@SOMA-DOCUMENTARY.COM" 
              className="inquiry-capsule"
            >
              <span>BEGIN THE EXPERIENCE</span>
              <span className="arrow-bracket">→</span>
            </a>
          </div>
        </section>

        {/* ===================================================================
            SECTION 04: "04 / THE PIPELINE" (Vertical Timeline)
            =================================================================== */}
        <section id="pipeline-section" className="pipeline-section">
          <div id="section-pipeline" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
          <div className="pipeline-inner">
            <div className="pipeline-header">
              <span className="section-index-tag">04 / THE PIPELINE</span>
              <h2 className="cinematic-serif-heading">
                Anatomy of a <br />
                <span className="italic-word">Sensation</span>
              </h2>
              <p className="editorial-body-copy pipeline-lead">
                Deconstructing the human experience from external stimulus to conscious reality.
              </p>
            </div>

            <div className="vertical-timeline">
              <div className="timeline-spine" />

              {/* Step 01: Left */}
              <div className="timeline-step step-left">
                <div className="timeline-node">
                  <span className="node-glow" />
                  <span className="node-pulse" />
                </div>
                <div className="timeline-content">
                  <div className="timeline-meta">
                    <span className="step-badge">PHASE // 01</span>
                  </div>
                  <h3 className="timeline-title">Stimulus</h3>
                  <p className="timeline-desc">
                    The initial contact. Light and sound waves enter the sensory organs, breaking the threshold of the physical world.
                  </p>
                </div>
              </div>

              {/* Step 02: Right */}
              <div className="timeline-step step-right">
                <div className="timeline-node">
                  <span className="node-glow" />
                  <span className="node-pulse" />
                </div>
                <div className="timeline-content">
                  <div className="timeline-meta">
                    <span className="step-badge">PHASE // 02</span>
                  </div>
                  <h3 className="timeline-title">Transmission</h3>
                  <p className="timeline-desc">
                    Raw data travels through neural pathways, pure and unfiltered, waiting for cognitive interpretation.
                  </p>
                </div>
              </div>

              {/* Step 03: Left */}
              <div className="timeline-step step-left">
                <div className="timeline-node">
                  <span className="node-glow" />
                  <span className="node-pulse" />
                </div>
                <div className="timeline-content">
                  <div className="timeline-meta">
                    <span className="step-badge">PHASE // 03</span>
                  </div>
                  <h3 className="timeline-title">Synthesis</h3>
                  <p className="timeline-desc">
                    The mental architecture assembles the fragments. Memories and emotions blend with new physical signals.
                  </p>
                </div>
              </div>

              {/* Step 04: Right */}
              <div className="timeline-step step-right">
                <div className="timeline-node">
                  <span className="node-glow" />
                  <span className="node-pulse" />
                </div>
                <div className="timeline-content">
                  <div className="timeline-meta">
                    <span className="step-badge">PHASE // 04</span>
                  </div>
                  <h3 className="timeline-title">Perception</h3>
                  <p className="timeline-desc">
                    The final conscious artifact is formed. A subjective, ephemeral reality, unique to the observer, is born.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Full-Screen Footer Section */}
      <footer id="section-contact" className="fullscreen-footer-section">
        <div className="fullscreen-footer-content">
          <div className="footer-tagline-meta">
            <span className="footer-meta-pill">EXHIBITION ACTIVE // 2026</span>
          </div>

          <h2 className="footer-massive-heading">
            ENTER THE VOID
          </h2>

          <div className="footer-email-container">
            <a 
              href="mailto:ACCESS@SOMA-DOCUMENTARY.COM" 
              className="footer-email-link"
              data-text="ACCESS@SOMA-DOCUMENTARY.COM"
            >ACCESS@SOMA-DOCUMENTARY.COM</a>
          </div>
        </div>

        {/* Absolute Bottom Minimal Nav Links */}
        <div className="footer-bottom-bar">
          <a 
            href="#credits" 
            className="footer-bottom-nav-link"
          >
            CREDITS
          </a>
          <a 
            href="#press" 
            className="footer-bottom-nav-link"
          >
            PRESS KIT
          </a>
          <a 
            href="#screenings" 
            className="footer-bottom-nav-link"
          >
            SCREENINGS
          </a>
        </div>
      </footer>
    </div>
  )
}
