import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { assetRoot, dresses, hairstyles, hairColours } from './game'
import type { Place, Player } from './game'

const dressMask = 'polygon(30% 16.3%, 37% 16.3%, 40% 21.8%, 57% 21.8%, 59% 16.3%, 63% 16.3%, 65% 21%, 62% 24%, 59% 24%, 59% 31%, 64% 41%, 67% 49%, 75% 67%, 99% 94%, 93% 100%, 3% 100%, 3% 94%, 24% 69%, 31% 55%, 39% 39%, 41% 31%, 39% 24%, 33% 24%)'
const hairMask = 'polygon(20% 0%, 80% 0%, 80% 24%, 55% 24%, 57% 19%, 58% 13%, 54% 7%, 44% 5%, 40% 8%, 40% 13%, 43% 19%, 40% 24%, 20% 24%)'
export function Character({ player, thumbnail = false }: { player: Pick<Player, 'dress' | 'hair' | 'hairColour' | 'makeup'>; thumbnail?: boolean }) {
  const dress = dresses.find(d => d.id === player.dress) ?? dresses[0]
  const hair = hairstyles.find(h => h.id === player.hair) ?? hairstyles[0]
  const colour = hairColours.find(h => h.id === player.hairColour) ?? hairColours[0]
  const hairStyles = { '--hair-filter': colour.filter } as CSSProperties
  return <span className={`mm-character-art ${thumbnail ? 'thumbnail' : ''}`} style={hairStyles}>
    <img style={{ clipPath: 'inset(23% 0 0 0)' }} src={assetRoot + dress.asset} alt="" draggable={false} />
    {/* Replace the original head rather than drawing through transparent hair. */}
    <img className="mm-head-layer" src={assetRoot + hair.asset} alt="" draggable={false} />
    {colour.filter !== 'none' && <img className="mm-hair-tint" style={{ clipPath: hairMask }} src={assetRoot + hair.asset} alt="" draggable={false} />}
    <img className="mm-dress-tint" style={{ filter: dress.filter, clipPath: dressMask }} src={assetRoot + dress.asset} alt="" draggable={false} />
    {player.makeup !== 'natural' && <span className={`mm-face-detail ${player.makeup}`}><i /><b /><em>✧</em></span>}
  </span>
}

export function Room({ player, place, onVisit, dancing, poseKey, onPose }: {
  player: Player; place: Place; onVisit: (place: Place) => void; dancing: boolean; poseKey: number; onPose: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null), world = useRef<HTMLDivElement>(null), actor = useRef<HTMLButtonElement>(null)
  const shadow = useRef<HTMLDivElement>(null), marker = useRef<HTMLSpanElement>(null)
  const position = useRef({ x: .5, y: .88 }), target = useRef<{ x: number; y: number } | null>(null)
  const keys = useRef(new Set<string>()), held = useRef<string | null>(null), pending = useRef<Place | null>(null)
  const onVisitRef = useRef(onVisit), cameraOffset = useRef(0)
  const [walking, setWalking] = useState(false)
  const walkState = useRef(false)
  const backdrop = place === 'show' || place === 'party' ? 'show-stage.png' : 'dressing-room.png'
  onVisitRef.current = onVisit
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

  function walkTo(destination: Place) {
    if (destination === 'show' || destination === 'party') { target.current = null; pending.current = null; onVisit(destination); return }
    const spots: Record<string, { x: number; y: number }> = { room: { x: .5, y: .88 }, wardrobe: { x: .32, y: .8 }, hair: { x: .69, y: .84 }, makeup: { x: .7, y: .8 } }
    target.current = spots[destination]; pending.current = destination
    if (marker.current) { marker.current.style.left = `${target.current.x * 100}%`; marker.current.style.top = `${target.current.y * 100}%`; marker.current.hidden = false }
  }
  useEffect(() => {
    target.current = null; pending.current = null
    if (marker.current) marker.current.hidden = true
    position.current = place === 'wardrobe' ? { x: .32, y: .8 } : place === 'hair' || place === 'makeup' ? { x: .7, y: .82 } : { x: .5, y: .88 }
  }, [place])
  useEffect(() => {
    const root = viewport.current!, canvas = world.current!
    let frame = 0, last = 0
    const draw = (now: number) => {
      const dt = Math.min(.04, (now - (last || now)) / 1000); last = now
      const p = position.current, key = keys.current
      let dx = Number(key.has('arrowright') || key.has('d') || held.current === 'right') - Number(key.has('arrowleft') || key.has('a') || held.current === 'left')
      let dy = Number(key.has('arrowdown') || key.has('s') || held.current === 'down') - Number(key.has('arrowup') || key.has('w') || held.current === 'up')
      const hasInput = dx !== 0 || dy !== 0
      if (hasInput) { target.current = null; pending.current = null }
      else if (target.current) {
        dx = target.current.x - p.x; dy = (target.current.y - p.y) * 1.5
        if (Math.hypot(dx, dy) < .006) {
          p.x = target.current.x; p.y = target.current.y; target.current = null
          if (pending.current) { const destination = pending.current; pending.current = null; onVisitRef.current(destination) }
          dx = 0; dy = 0
        }
      }
      const length = Math.hypot(dx, dy), moving = length > 0
      if (moving) { p.x = clamp(p.x + dx / length * dt * .23, .25, .76); p.y = clamp(p.y + dy / length * dt * .15, .755, .935) }
      if (moving !== walkState.current) { walkState.current = moving; setWalking(moving) }
      if (marker.current) marker.current.hidden = !target.current
      const scale = .87 + (p.y - .755) * 1.45
      if (actor.current) {
        actor.current.style.left = `${p.x * 100}%`; actor.current.style.top = `${p.y * 100}%`
        actor.current.style.setProperty('--actor-scale', String(scale))
        actor.current.dataset.position = `${p.x.toFixed(3)},${p.y.toFixed(3)}`
      }
      if (shadow.current) { shadow.current.style.left = `${p.x * 100}%`; shadow.current.style.top = `${p.y * 100}%`; shadow.current.style.transform = `translate(-50%,-50%) scale(${scale})` }
      const width = root.clientHeight * 1.5
      canvas.style.width = `${width}px`
      const desired = clamp(root.clientWidth / 2 - p.x * width, Math.min(0, root.clientWidth - width), 0)
      cameraOffset.current += (desired - cameraOffset.current) * Math.min(1, dt * 6)
      canvas.style.transform = `translateX(${cameraOffset.current}px)`
      frame = requestAnimationFrame(draw)
    }
    const down = (event: KeyboardEvent) => {
      if (!root.contains(document.activeElement) || document.querySelector('dialog[open]')) return
      const k = event.key.toLowerCase()
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { event.preventDefault(); keys.current.add(k) }
    }
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase())
    const clear = () => { keys.current.clear(); held.current = null }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear)
    frame = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear) }
  }, [])

  return <section className={`mm-room ${dancing ? 'is-dancing' : ''} ${place === 'party' ? 'is-party' : ''}`} aria-label="Interactive illustrated fashion world">
    <div className="mm-room-viewport" ref={viewport} tabIndex={0} role="group" aria-label="Tap the rug to walk, or use arrow keys" onClick={event => {
      if ((event.target as HTMLElement).closest('button') || !world.current) return
      viewport.current?.focus({ preventScroll: true })
      const r = world.current.getBoundingClientRect(), x = (event.clientX - r.left) / r.width, y = (event.clientY - r.top) / r.height
      if (y < .73) return
      target.current = { x: clamp(x, .25, .76), y: clamp(y, .755, .935) }; pending.current = null
      if (marker.current) { marker.current.style.left = `${target.current.x * 100}%`; marker.current.style.top = `${target.current.y * 100}%` }
    }}>
      <div className="mm-picture-world" ref={world}>
        <img className="mm-room-art" src={assetRoot + backdrop} alt={backdrop === 'dressing-room.png' ? 'An elegant illustrated dressing room with a lavender wardrobe, a glowing mirror, flowers and a makeup vanity' : 'A luminous fashion runway with flowing curtains, golden stars, flowers and a celebration table'} draggable={false} />
        <div className="mm-room-glow" />
        {[0, 1, 2, 3, 4, 5].map(i => <span key={i} className="mm-room-twinkle" style={{ left: `${[40, 61, 72, 27, 81, 52][i]}%`, top: `${[27, 36, 18, 49, 52, 63][i]}%`, animationDelay: `${i * .7}s` }}>✧</span>)}
        <div className="mm-actor-shadow" ref={shadow} /><span className="mm-floor-marker" hidden ref={marker}>✧</span>
        <button className={`mm-actor ${walking ? 'walking' : ''} ${dancing ? 'dancing' : ''}`} ref={actor} aria-label="Pose with your fashion character" onClick={onPose} data-dress={player.dress} data-hair={player.hair} data-makeup={player.makeup}>
          <span key={poseKey} className={`mm-actor-body ${poseKey ? 'pose' : ''}`}><Character player={player} /></span>
          {poseKey > 0 && <span key={`s-${poseKey}`} className="mm-style-sparkles">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties}>✦</i>)}</span>}
        </button>
        {backdrop === 'dressing-room.png' && <>
          <button className="mm-object mm-object-wardrobe" onClick={() => walkTo('wardrobe')} aria-label="Walk to the wardrobe"><span>♧</span> Wardrobe <i>{player.unlocked.includes('wardrobe') ? '✦' : '⌑'}</i></button>
          <button className="mm-object mm-object-makeup" onClick={() => walkTo('makeup')} aria-label="Walk to the makeup vanity"><span>✧</span> Makeup <i>{player.unlocked.includes('makeup') ? '✦' : '⌑'}</i></button>
          <button className="mm-object mm-object-hair" onClick={() => walkTo('hair')} aria-label="Walk to the hair studio"><span>♧</span> Hair studio <i>{player.unlocked.includes('hair') ? '✦' : '⌑'}</i></button>
        </>}
        {dancing && <div className="mm-confetti">{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ left: `${i * 3.6}%`, animationDelay: `${i % 6 * -.4}s`, background: ['#e9b2ca', '#e6c779', '#b4d6c6', '#b1a1d5'][i % 4] }} />)}</div>}
      </div>
    </div>
    <div className="mm-room-name"><span /> {place === 'party' ? 'The celebration ballroom' : place === 'show' ? 'The starlight runway' : 'The dressing room'} <small>MAKEOVER MATHS</small></div>
    <div className="mm-room-controls"><div className="mm-dpad" aria-label="Walking controls">{['up', 'left', 'down', 'right'].map(direction => <button key={direction} className={`mm-dpad-${direction}`} aria-label={`Walk ${direction}`} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); held.current = direction }} onPointerUp={() => { held.current = null }} onPointerCancel={() => { held.current = null }} onLostPointerCapture={() => { held.current = null }} onClick={() => {
      target.current = { x: clamp(position.current.x + (direction === 'left' ? -.055 : direction === 'right' ? .055 : 0), .25, .76), y: clamp(position.current.y + (direction === 'up' ? -.035 : direction === 'down' ? .035 : 0), .755, .935) }; pending.current = null
    }}>⌃</button>)}</div><p>Tap to walk<br /><strong>Touch your character to pose</strong></p><button className="mm-pose-button" onClick={onPose}>✧ Strike a pose</button></div>
  </section>
}
