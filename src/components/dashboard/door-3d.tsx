"use client"

import { useEffect, useRef, useState } from "react"
import type * as T from "three"

import type { DoorVisitor } from "@/lib/door-today"

/**
 * The hub's front door at Rue de la Madeleine 51, in 3D (three.js): pale
 * stone blocks, the blue double door with its raised panels and brass
 * letter slots, the fanlight with its radiating bars. Knocking rattles the
 * right leaf; opening turns the knob, swings both leaves inward onto a warm,
 * lit hall, light spills onto the pavement, the camera steps in, and the people
 * already at the hub float up inside as their avatars.
 *
 * Three.js loads only in the browser, once the scene is shown. Without
 * WebGL, or for people who ask for reduced motion, it shows the end state
 * at once (or nothing, and the words around it still say it all).
 */

export type DoorState = "idle" | "knocking" | "open" | "stuck"

const BLUE = 0x194f6e
const BRASS = 0xc9a24a
const ACCENT = "#FF4C02"

// The opening, in metres: leaves from x -0.9 to 0.9, up to 2.8; the fanlight above, under a segmental arch.
const LEAF_W = 0.9
const LEAF_H = 2.75
const SILL = 0.05
const TRANSOM_Y = 2.8
const FAN_Y = 3.0
const ARCH_SIDE_Y = 3.7
const ARCH_TOP_Y = 3.95
const HALF_W = 1.0
const ARCH_R = (HALF_W * HALF_W + (ARCH_TOP_Y - ARCH_SIDE_Y) ** 2) / (2 * (ARCH_TOP_Y - ARCH_SIDE_Y))
const ARCH_CY = ARCH_TOP_Y - ARCH_R
const REVEAL = 0.4
const DOOR_Z = -0.3

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
const easeOutBack = (x: number) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2
const span = (t: number, from: number, to: number) => clamp01((t - from) / (to - from))

export function Door3D({ state, visitors, me, className = "" }: { state: DoorState; visitors: DoorVisitor[]; me: string; className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const live = useRef({ state, since: 0, visitors, me })
  const [failed, setFailed] = useState(false)

  // The animation loop reads the latest state from here.
  useEffect(() => {
    if (live.current.state !== state) live.current.since = performance.now()
    live.current = { ...live.current, state, visitors, me }
  }, [state, visitors, me])

  useEffect(() => {
    const el = host.current
    if (!el) return
    let disposed = false
    let cleanup = () => {}
    ;(async () => {
      try {
        const THREE = await import("three")
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js")
        if (disposed) return
        cleanup = buildScene(THREE, RoomEnvironment, el, live)
      } catch (error) {
        console.error("[door-3d]", error)
        setFailed(true)
      }
    })()
    return () => {
      disposed = true
      cleanup()
    }
  }, [])

  return (
    <div ref={host} className={`relative overflow-hidden ${className}`} aria-hidden>
      {failed && <div className="absolute inset-0 bg-gradient-to-b from-[#1d5878] to-[#0f3347]" />}
    </div>
  )
}

type Live = React.MutableRefObject<{ state: DoorState; since: number; visitors: DoorVisitor[]; me: string }>

function buildScene(THREE: typeof T, RoomEnvironment: new () => T.Scene, el: HTMLDivElement, live: Live): () => void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.9
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.domElement.style.display = "block"
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xb9b0a1)
  scene.fog = new THREE.Fog(0xb9b0a1, 14, 30)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = env

  const disposables: Array<{ dispose(): void }> = [renderer, pmrem, env]
  const keep = <D extends { dispose(): void }>(d: D) => (disposables.push(d), d)

  // ── materials ─────────────────────────────────────────────────────────
  const stoneTex = keep(stoneTexture(THREE))
  const stone = keep(new THREE.MeshStandardMaterial({ map: stoneTex, bumpMap: stoneTex, bumpScale: 3, roughness: 0.95, envMapIntensity: 0.35 }))
  const paint = keep(new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.5, metalness: 0.05, envMapIntensity: 0.45 }))
  const paintDark = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(BLUE).multiplyScalar(0.78), roughness: 0.55, envMapIntensity: 0.4 }))
  const brass = keep(new THREE.MeshStandardMaterial({ color: BRASS, roughness: 0.28, metalness: 1 }))
  const slot = keep(new THREE.MeshStandardMaterial({ color: 0x2a2418, roughness: 0.6 }))
  const steel = keep(new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.9 }))
  const paving = keep(new THREE.MeshStandardMaterial({ color: 0x77736d, roughness: 0.95, envMapIntensity: 0.3 }))
  const sill = keep(new THREE.MeshStandardMaterial({ color: 0xbfbab2, roughness: 0.6 }))
  const glass = keep(new THREE.MeshStandardMaterial({ map: keep(skyTexture(THREE)), roughness: 0.05, metalness: 0.2, envMapIntensity: 1.4 }))

  const mesh = (geo: T.BufferGeometry, mat: T.Material, cast = true, receive = true) => {
    keep(geo)
    const m = new THREE.Mesh(geo, mat)
    m.castShadow = cast
    m.receiveShadow = receive
    return m
  }

  // ── facade: a stone wall with the arched opening cut out, set back by the reveal ──
  /** The opening's outline, from `bottom` up to the arch, `inset` inside it. */
  const archPath = (p: T.Shape | T.Path, inset = 0, bottom = 0) => {
    const hw = HALF_W - inset
    const r = ARCH_R - inset
    const a = Math.asin(hw / r)
    p.moveTo(-hw, bottom + inset)
    p.lineTo(hw, bottom + inset)
    p.lineTo(hw, ARCH_CY + Math.cos(a) * r)
    p.absarc(0, ARCH_CY, r, Math.PI / 2 - a, Math.PI / 2 + a, false)
    p.lineTo(-hw, bottom + inset)
    return p
  }
  const wallShape = new THREE.Shape()
  wallShape.moveTo(-5, -0.01)
  wallShape.lineTo(5, -0.01)
  wallShape.lineTo(5, 7)
  wallShape.lineTo(-5, 7)
  wallShape.lineTo(-5, -0.01)
  wallShape.holes.push(archPath(new THREE.Path()))
  const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: REVEAL, bevelEnabled: false })
  stoneTex.repeat.set(0.5, 0.5)
  const wall = mesh(wallGeo, stone)
  wall.position.z = -REVEAL
  scene.add(wall)

  // A plinth and a pilaster's edge, for depth.
  const plinth = mesh(new THREE.BoxGeometry(10, 0.5, 0.12), stone)
  plinth.position.set(0, 0.25, 0.06)
  scene.add(plinth)
  for (const side of [-1, 1]) {
    const post = mesh(new THREE.BoxGeometry(0.5, 4.6, 0.1), stone)
    post.position.set(side * (HALF_W + 0.25), 2.3, 0.05)
    scene.add(post)
  }

  // Pavement and the sill.
  const ground = mesh(new THREE.PlaneGeometry(30, 20), paving, false, true)
  ground.rotation.x = -Math.PI / 2
  ground.position.z = 6
  scene.add(ground)
  const sillMesh = mesh(new THREE.BoxGeometry(2.1, SILL, REVEAL + 0.2), sill)
  sillMesh.position.set(0, SILL / 2, -REVEAL / 2 + 0.1)
  scene.add(sillMesh)

  // The intercom on the left, and the house number.
  const intercom = mesh(new THREE.BoxGeometry(0.11, 0.42, 0.04), steel)
  intercom.position.set(-HALF_W - 0.14, 1.45, 0.12)
  scene.add(intercom)
  const number = mesh(new THREE.PlaneGeometry(0.28, 0.2), keep(new THREE.MeshStandardMaterial({ map: keep(numberTexture(THREE)), roughness: 0.4, metalness: 0.6 })), false)
  number.position.set(-HALF_W - 0.6, 2.5, 0.101)
  scene.add(number)

  // ── the door frame, transom and fanlight ──────────────────────────────
  for (const side of [-1, 1]) {
    const post = mesh(new THREE.BoxGeometry(0.1, TRANSOM_Y, 0.14), paint)
    post.position.set(side * (HALF_W - 0.05), TRANSOM_Y / 2, DOOR_Z)
    scene.add(post)
  }
  const transom = mesh(new THREE.BoxGeometry(2 * HALF_W, FAN_Y - TRANSOM_Y, 0.2), paint)
  transom.position.set(0, (TRANSOM_Y + FAN_Y) / 2, DOOR_Z + 0.02)
  scene.add(transom)
  const cornice = mesh(new THREE.BoxGeometry(2 * HALF_W + 0.02, 0.05, 0.26), paint)
  cornice.position.set(0, FAN_Y - 0.02, DOOR_Z + 0.03)
  scene.add(cornice)

  const fanFrame = new THREE.Shape()
  archPath(fanFrame, 0, FAN_Y)
  fanFrame.holes.push(archPath(new THREE.Path(), 0.07, FAN_Y))
  const fan = mesh(new THREE.ExtrudeGeometry(fanFrame, { depth: 0.1, bevelEnabled: false }), paint)
  fan.position.z = DOOR_Z - 0.05
  scene.add(fan)
  const fanGlassShape = archPath(new THREE.Shape(), 0.07, FAN_Y) as T.Shape
  const fanGlass = mesh(new THREE.ShapeGeometry(fanGlassShape), glass, false, false)
  fanGlass.position.z = DOOR_Z - 0.04
  scene.add(fanGlass)
  const hub = mesh(new THREE.CircleGeometry(0.13, 32, 0, Math.PI), paint)
  hub.position.set(0, FAN_Y + 0.02, DOOR_Z + 0.01)
  scene.add(hub)
  const bars = [20, 42, 66, 90, 114, 138, 160]
  for (const deg of bars) {
    const a = (deg * Math.PI) / 180
    const len = rayToArch(Math.cos(a), Math.sin(a), FAN_Y + 0.02, 0.07)
    const bar = mesh(new THREE.BoxGeometry(len, 0.035, 0.05), paint)
    bar.geometry.translate(len / 2, 0, 0)
    bar.position.set(0, FAN_Y + 0.02, DOOR_Z)
    bar.rotation.z = a
    scene.add(bar)
  }

  // ── the leaves ────────────────────────────────────────────────────────
  const logoTex = keep(logoTexture(THREE))
  const makeLeaf = (side: -1 | 1) => {
    const pivot = new THREE.Group()
    pivot.position.set(side * LEAF_W, SILL, DOOR_Z)
    const leaf = new THREE.Group()
    leaf.position.x = -side * (LEAF_W / 2)
    pivot.add(leaf)
    const slab = mesh(new THREE.BoxGeometry(LEAF_W - 0.006, LEAF_H, 0.06), paint)
    slab.position.y = LEAF_H / 2
    leaf.add(slab)
    // Upper panel: an arched top, a raised moulding around a sunk field.
    const upper = panel(THREE, 0.62, 1.32, true)
    for (const [geo, mat, z] of [
      [upper.frame, paint, 0.03],
      [upper.field, paintDark, 0.028],
    ] as const) {
      const m = mesh(keep(geo), mat)
      m.position.set(0, 1.62, z)
      leaf.add(m)
    }
    const lower = panel(THREE, 0.62, 0.62, false)
    for (const [geo, mat, z] of [
      [lower.frame, paint, 0.03],
      [lower.field, paintDark, 0.028],
    ] as const) {
      const m = mesh(keep(geo), mat)
      m.position.set(0, 0.6, z)
      leaf.add(m)
    }
    const kick = mesh(new THREE.BoxGeometry(LEAF_W - 0.1, 0.18, 0.025), paint)
    kick.position.set(0, 0.12, 0.04)
    leaf.add(kick)
    const plate = mesh(new THREE.BoxGeometry(0.44, 0.1, 0.02), brass)
    plate.position.set(0, 1.0, 0.04)
    leaf.add(plate)
    const gap = mesh(new THREE.BoxGeometry(0.36, 0.022, 0.01), slot, false)
    gap.position.set(0, 1.0, 0.051)
    leaf.add(gap)
    return { pivot, leaf }
  }
  const left = makeLeaf(-1)
  const right = makeLeaf(1)
  scene.add(left.pivot, right.pivot)
  // The right leaf: the astragal strip over the meeting edge, the knob, the key, the hub's sticker.
  const strip = mesh(new THREE.BoxGeometry(0.05, LEAF_H, 0.025), paint)
  strip.position.set(-LEAF_W / 2 + 0.02, LEAF_H / 2, 0.04)
  right.leaf.add(strip)
  const knob = new THREE.Group()
  knob.position.set(LEAF_W / 2 - 0.12, 1.12, 0.03)
  const rose = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 24), brass)
  rose.rotation.x = Math.PI / 2
  knob.add(rose)
  const ball = mesh(new THREE.SphereGeometry(0.045, 24, 16), brass)
  ball.position.z = 0.05
  ball.scale.set(1.25, 0.9, 0.8)
  knob.add(ball)
  right.leaf.add(knob)
  const key = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 20), brass)
  key.rotation.x = Math.PI / 2
  key.position.set(LEAF_W / 2 - 0.12, 0.98, 0.04)
  right.leaf.add(key)
  const sticker = mesh(new THREE.CircleGeometry(0.04, 32), keep(new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.5 })), false)
  sticker.position.set(LEAF_W / 2 - 0.12, 1.3, 0.031)
  right.leaf.add(sticker)

  // ── inside: a warm hall that only shows once the door opens ───────────
  const hall = mesh(new THREE.BoxGeometry(5, 3.6, 6), keep(new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.9, side: THREE.BackSide })), false, true)
  hall.position.set(0, 1.8, -REVEAL - 3)
  scene.add(hall)
  const floor = mesh(new THREE.PlaneGeometry(5, 6), keep(new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.55 })), false, true)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0.005, -REVEAL - 3)
  scene.add(floor)
  const glow = new THREE.PointLight(0xffb36b, 0, 9, 1.6)
  glow.position.set(0, 2.6, -2.4)
  scene.add(glow)
  // Pendant lamps down the hall.
  const bulb = keep(new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffc070, emissiveIntensity: 0 }))
  const shade = keep(new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6, side: THREE.DoubleSide }))
  for (const z of [-1.4, -3, -4.6]) {
    const cord = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.7, 6), shade, false, false)
    cord.position.set(0, 3.25, z)
    const cone = mesh(new THREE.ConeGeometry(0.16, 0.14, 24, 1, true), shade, false, false)
    cone.position.set(0, 2.86, z)
    const b = mesh(new THREE.SphereGeometry(0.05, 16, 12), bulb, false, false)
    b.position.set(0, 2.8, z)
    scene.add(cord, cone, b)
  }

  // Light spilling onto the pavement, and dust in it.
  const spillMat = keep(new THREE.MeshBasicMaterial({ map: keep(spillTexture(THREE)), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
  const spill = mesh(new THREE.PlaneGeometry(2.6, 3.2), spillMat, false, false)
  spill.rotation.x = -Math.PI / 2
  spill.position.set(0.15, 0.012, 1.5)
  scene.add(spill)
  const dustGeo = keep(new THREE.BufferGeometry())
  const dustCount = 160
  const dustPos = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i++) dustPos.set([(Math.random() - 0.5) * 1.7, Math.random() * 2.6, -0.5 - Math.random() * 2.8], i * 3)
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3))
  const dustMat = keep(new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.018, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }))
  const dust = new THREE.Points(dustGeo, dustMat)
  scene.add(dust)

  // ── daylight ──────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x6f665a, 0.55))
  const sun = new THREE.DirectionalLight(0xfff0d6, 1.7)
  sun.position.set(-4, 7, 6)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -4
  sun.shadow.camera.right = 4
  sun.shadow.camera.top = 5
  sun.shadow.camera.bottom = -1
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  scene.add(sun)

  // ── the people at the hub, as avatars floating up inside ──────────────
  const people = new THREE.Group()
  scene.add(people)
  let shownFor = ""
  const sprites: Array<{ sprite: T.Sprite; base: T.Vector3; delay: number }> = []
  const placePeople = () => {
    const { visitors, me } = live.current
    const key = visitors.map((v) => v.name).join("|")
    if (key === shownFor) return
    shownFor = key
    for (const s of sprites) {
      people.remove(s.sprite)
      s.sprite.material.map?.dispose()
      s.sprite.material.dispose()
    }
    sprites.length = 0
    const list = visitors.slice(0, 9)
    list.forEach((v, i) => {
      const tex = avatarTexture(THREE, v, v.name === me)
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
      const n = list.length
      const row = i % 2
      // Within the doorway, whatever the number of people: two staggered rows.
      const x = (i - (n - 1) / 2) * Math.min(0.42, 1.0 / Math.max(1, n - 1))
      const base = new THREE.Vector3(x, 1.35 + row * 0.38, -1.5 - row * 0.7)
      sprite.position.copy(base)
      sprite.scale.setScalar(0)
      people.add(sprite)
      sprites.push({ sprite, base, delay: 0.12 * i })
    })
  }

  // ── camera: the whole door, then a step towards the light ─────────────
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60)
  const far = new THREE.Vector3()
  const near = new THREE.Vector3()
  const lookFar = new THREE.Vector3(0, 2.05, -0.3)
  const lookNear = new THREE.Vector3(0, 1.55, -1.5)
  const fit = () => {
    const w = el.clientWidth || 1
    const h = el.clientHeight || 1
    renderer.setSize(w, h, false)
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    camera.aspect = w / h
    // Far enough to see the door and its stone surround, whatever the shape of the box.
    const vfov = (camera.fov * Math.PI) / 180
    const needH = 4.7 / (2 * Math.tan(vfov / 2))
    const needW = 3.4 / (2 * Math.tan(vfov / 2) * camera.aspect)
    const d = Math.max(needH, needW)
    far.set(0.25, 1.9, d)
    near.set(0, 1.6, Math.max(3.4, d * 0.5))
    camera.updateProjectionMatrix()
  }
  fit()
  const ro = new ResizeObserver(fit)
  ro.observe(el)

  // ── the loop ──────────────────────────────────────────────────────────
  const clock = new THREE.Clock()
  let raf = 0
  let openAmount = 0 // what the scene last showed, to close smoothly
  const tmp = new THREE.Vector3()
  const frame = () => {
    raf = requestAnimationFrame(frame)
    const now = performance.now()
    const time = clock.getElapsedTime()
    const { state, since } = live.current
    const t = reduced ? 99 : (now - since) / 1000

    // The right leaf.
    let swing = 0
    let knobTurn = 0
    let rattle = 0
    if (state === "open") {
      knobTurn = Math.sin(span(t, 0, 0.5) * Math.PI) * 0.9
      swing = easeOutBack(span(t, 0.35, 1.9)) * 1.5
      openAmount = swing / 1.5
    } else {
      openAmount = Math.max(0, openAmount - 0.03)
      swing = openAmount * 1.5
      if (state === "knocking") {
        // Three knocks, a pause, again.
        const k = (t * 1.6) % 1.6
        const hit = [0, 0.22, 0.44].some((s) => k >= s && k < s + 0.08)
        rattle = hit ? Math.sin(k * 120) * 0.006 : 0
      } else if (state === "stuck") {
        rattle = t < 0.9 ? Math.sin(t * 70) * 0.012 * (1 - t / 0.9) : 0
      }
    }
    const leftSwing = state === "open" ? easeOutBack(span(t, 0.55, 2.1)) * 1.45 : openAmount * 1.45
    right.pivot.rotation.y = -swing + rattle
    left.pivot.rotation.y = leftSwing - rattle * 0.4
    knob.rotation.z = -knobTurn

    // Light: the hall glows, spills out, dust drifts.
    const lit = state === "open" ? easeInOut(span(t, 0.3, 1.6)) : openAmount
    glow.intensity = lit * 40
    bulb.emissiveIntensity = lit * 3
    spillMat.opacity = lit * 0.75
    dustMat.opacity = lit * 0.8
    const pos = dustGeo.attributes.position as T.BufferAttribute
    for (let i = 0; i < dustCount; i++) {
      let y = pos.getY(i) + 0.0016
      if (y > 2.7) y = 0
      pos.setY(i, y)
      pos.setX(i, pos.getX(i) + Math.sin(time * 0.6 + i) * 0.0006)
    }
    pos.needsUpdate = true

    // The camera breathes, and steps in once the door is open.
    const step = state === "open" ? easeInOut(span(t, 0.6, 2.8)) : openAmount
    camera.position.lerpVectors(far, near, step)
    camera.position.x += Math.sin(time * 0.35) * 0.06 * (1 - step * 0.5)
    camera.position.y += Math.sin(time * 0.5) * 0.03
    tmp.lerpVectors(lookFar, lookNear, step)
    camera.lookAt(tmp)

    // People float up, one after another, once the door is open.
    if (state === "open") {
      placePeople()
      for (const s of sprites) {
        const p = easeOutBack(span(t, 1.5 + s.delay, 2.3 + s.delay))
        s.sprite.scale.setScalar(0.4 * Math.max(0, p))
        s.sprite.position.set(s.base.x, s.base.y - (1 - clamp01(p)) * 0.4 + Math.sin(time * 1.3 + s.delay * 9) * 0.03, s.base.z)
      }
    } else {
      for (const s of sprites) s.sprite.scale.multiplyScalar(0.85)
    }

    renderer.render(scene, camera)
  }
  frame()

  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    for (const s of sprites) {
      s.sprite.material.map?.dispose()
      s.sprite.material.dispose()
    }
    for (const d of disposables) d.dispose()
    renderer.domElement.remove()
  }
}

/** How far a ray from (0, y0) goes before it leaves the fanlight's inner edge. */
function rayToArch(dx: number, dy: number, y0: number, inset: number): number {
  let len = 0
  for (; len < 3; len += 0.005) {
    const x = dx * len
    const y = y0 + dy * len
    if (Math.abs(x) > HALF_W - inset || Math.hypot(x, y - ARCH_CY) > ARCH_R - inset) break
  }
  return len
}

/** A raised panel moulding (frame) around a sunk field; the upper ones have the door's shouldered, peaked top. */
function panel(THREE: typeof T, w: number, h: number, arched: boolean) {
  const outline = (p: T.Shape | T.Path, inset: number) => {
    const hw = w / 2 - inset
    const hh = h / 2 - inset
    const r = 0.09
    p.moveTo(-hw, -hh)
    p.lineTo(hw, -hh)
    if (!arched) {
      p.lineTo(hw, hh)
      p.lineTo(-hw, hh)
    } else {
      p.lineTo(hw, hh - r)
      p.absarc(hw, hh, r, -Math.PI / 2, -Math.PI, true)
      p.quadraticCurveTo(hw * 0.5, hh, 0, hh + 0.07)
      p.quadraticCurveTo(-hw * 0.5, hh, -hw + r, hh)
      p.absarc(-hw, hh, r, 0, -Math.PI / 2, true)
    }
    p.lineTo(-hw, -hh)
    return p
  }
  const frameShape = outline(new THREE.Shape(), 0) as T.Shape
  frameShape.holes.push(outline(new THREE.Path(), 0.045) as T.Path)
  const frame = new THREE.ExtrudeGeometry(frameShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 16 })
  const field = new THREE.ExtrudeGeometry(outline(new THREE.Shape(), 0.045) as T.Shape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.03, bevelSegments: 2, curveSegments: 16 })
  return { frame, field }
}

// ── textures drawn on canvases ──────────────────────────────────────────

function canvas(w: number, h: number) {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  return [c, c.getContext("2d")!] as const
}

/** Pale sandstone blocks: 2 m × 2 m of wall, rows of ~45 cm, staggered. */
function stoneTexture(THREE: typeof T) {
  const [c, g] = canvas(1024, 1024)
  g.fillStyle = "#a99c86"
  g.fillRect(0, 0, 1024, 1024)
  const rows = [0, 230, 460, 700, 1024]
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let r = 0; r < rows.length - 1; r++) {
    const y0 = rows[r]
    const y1 = rows[r + 1]
    let x = r % 2 ? -256 : 0
    while (x < 1024) {
      const w = 360 + rnd() * 260
      const l = 70 + rnd() * 8
      g.fillStyle = `hsl(${36 + rnd() * 8}, ${20 + rnd() * 12}%, ${l}%)`
      g.fillRect(x + 4, y0 + 4, w - 8, y1 - y0 - 8)
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(${rnd() > 0.5 ? "255,250,240" : "120,105,85"},${rnd() * 0.08})`
        g.fillRect(x + 4 + rnd() * (w - 8), y0 + 4 + rnd() * (y1 - y0 - 8), 2 + rnd() * 6, 1 + rnd() * 3)
      }
      x += w
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  return t
}

function skyTexture(THREE: typeof T) {
  const [c, g] = canvas(256, 256)
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, "#9fb8d0")
  grad.addColorStop(1, "#d9e3ea")
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 14; i++) {
    g.fillStyle = "rgba(255,255,255,0.35)"
    g.beginPath()
    g.ellipse(Math.random() * 256, 60 + Math.random() * 150, 30 + Math.random() * 40, 10 + Math.random() * 12, 0, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  // The fanlight's UVs are its coordinates in metres (x -1…1, y 3…4).
  t.repeat.set(0.5, 1)
  t.offset.set(0.5, -FAN_Y)
  return t
}

/** The Commons Hub's asterisk, on the round sticker by the knob. */
function logoTexture(THREE: typeof T) {
  const [c, g] = canvas(128, 128)
  g.fillStyle = ACCENT
  g.beginPath()
  g.arc(64, 64, 64, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = "#fff"
  g.lineWidth = 14
  g.lineCap = "round"
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 2
    g.beginPath()
    g.moveTo(64 + Math.cos(a) * 36, 64 + Math.sin(a) * 36)
    g.lineTo(64 - Math.cos(a) * 36, 64 - Math.sin(a) * 36)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function numberTexture(THREE: typeof T) {
  const [c, g] = canvas(256, 180)
  g.fillStyle = "#b8913f"
  g.fillRect(0, 0, 256, 180)
  g.fillStyle = "#3b2c12"
  g.font = "bold 130px Georgia, serif"
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillText("51", 128, 96)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function spillTexture(THREE: typeof T) {
  const [c, g] = canvas(256, 256)
  // Narrow at the door (the top of the texture), widening onto the pavement.
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, "rgba(255,190,120,0.95)")
  grad.addColorStop(1, "rgba(255,190,120,0)")
  g.fillStyle = grad
  g.beginPath()
  g.moveTo(128 - 48, 0)
  g.lineTo(128 + 70, 0)
  g.lineTo(256, 256)
  g.lineTo(20, 256)
  g.closePath()
  g.filter = "blur(10px)"
  g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A round avatar with a white ring (the accent colour for you); the initial when there's no photo. */
function avatarTexture(THREE: typeof T, v: DoorVisitor, isMe: boolean) {
  const [c, g] = canvas(256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const ring = () => {
    g.lineWidth = 12
    g.strokeStyle = isMe ? ACCENT : "#fff"
    g.beginPath()
    g.arc(128, 128, 120, 0, Math.PI * 2)
    g.stroke()
  }
  const initial = () => {
    g.fillStyle = isMe ? ACCENT : "#1d5878"
    g.beginPath()
    g.arc(128, 128, 120, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = "#fff"
    g.font = "bold 120px system-ui, sans-serif"
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.fillText(v.name.charAt(0).toUpperCase(), 128, 136)
    ring()
    t.needsUpdate = true
  }
  initial()
  if (v.avatar) {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      g.clearRect(0, 0, 256, 256)
      g.save()
      g.beginPath()
      g.arc(128, 128, 120, 0, Math.PI * 2)
      g.clip()
      g.drawImage(img, 8, 8, 240, 240)
      g.restore()
      ring()
      t.needsUpdate = true
    }
    img.src = v.avatar
  }
  return t
}
