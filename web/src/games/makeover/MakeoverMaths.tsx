import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Character, Room } from './Room'
import { answerQuestion, assetRoot, buyItem, decodeSave, difficulty, dresses, enterParty, enterShow, hairColours, hairstyles, makeQuestion, makeups, newPlayer, studioCosts, themeFor, topics, unlockStudio } from './game'
import type { Dress, Place, Player, Question, Studio, Topic } from './game'
import './makeover.css'

type IconName = 'star' | 'dress' | 'hair' | 'makeup' | 'home' | 'close' | 'sound' | 'mute' | 'save' | 'help' | 'maths' | 'arrow' | 'lock' | 'check' | 'map'
function Icon({ name, size = 21 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    star: <><path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8Z" /><path d="m21 2 .5 1.5L23 4l-1.5.5L21 6l-.5-1.5L19 4l1.5-.5Z" /></>,
    dress: <><path d="M8 3h3v4h2V3h3l-1 6 5 12H4L9 9Z" /><path d="M9 10h6M8 16l1 5m7-5-1 5" /></>,
    hair: <><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="m8 15 10-12M16 15 6 3" /></>,
    makeup: <><path d="M5 14h7v7H5Zm1-1V6l5-3v10M16 12h5v9h-5Z" /><path d="M16 9c0-4 5-4 5 0v3h-5Z" /></>,
    home: <><path d="m3 10 9-7 9 7M5 9v12h14V9M10 21v-7h4v7" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    sound: <><path d="M4 9h4l5-4v14l-5-4H4Z" /><path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    mute: <><path d="M4 9h4l5-4v14l-5-4H4Z" /><path d="m17 9 5 6m0-6-5 6" /></>,
    save: <><path d="M5 3h12l4 4v14H3V3Zm2 0v7h10V3M7 21v-7h10v7" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01" /></>,
    maths: <><rect x="4" y="2" width="16" height="20" rx="3" /><path d="M8 6h8M8 11h2m4 0h2M8 15h2m4 0h2M8 19h2m4 0h2" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    lock: <><rect x="5" y="10" width="14" height="12" rx="3" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    map: <><path d="m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3Zm6-3v17m6-14v17" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
const money = (n: number) => `$${n.toLocaleString('en-GB')}`
const places: { id: Place; title: string; icon: IconName }[] = [
  { id: 'room', title: 'Explore', icon: 'home' }, { id: 'wardrobe', title: 'Wardrobe', icon: 'dress' },
  { id: 'hair', title: 'Hair studio', icon: 'hair' }, { id: 'makeup', title: 'Makeup', icon: 'makeup' },
  { id: 'show', title: 'Fashion show', icon: 'star' }, { id: 'party', title: 'Party', icon: 'star' },
]
type Modal = 'maths' | 'help' | 'players' | 'map' | 'complete' | null

function QuestionVisual({ visual }: { visual: Question['visual'] }) {
  if (!visual) return null
  if (visual.kind === 'clock') {
    const hand = (angle: number, length: number) => ({ x: 90 + Math.sin(angle * Math.PI / 180) * length, y: 90 - Math.cos(angle * Math.PI / 180) * length })
    const hour = hand(visual.hour * 30 + visual.minute / 2, 37), minute = hand(visual.minute * 6, 57)
    return <svg className="mm-clock" viewBox="0 0 180 180" role="img" aria-label="An analogue clock. Read its hour and minute hands."><circle cx="90" cy="90" r="82" fill="#fffaf1" stroke="#d8c59d" strokeWidth="5" />{Array.from({ length: 12 }, (_, i) => { const p = hand((i + 1) * 30, 66); return <text key={i} x={p.x} y={p.y + 5} textAnchor="middle" fill="#61516e" fontSize="15">{i + 1}</text> })}<path d={`M90 90L${hour.x} ${hour.y}`} stroke="#634c7a" strokeWidth="7" strokeLinecap="round" /><path d={`M90 90L${minute.x} ${minute.y}`} stroke="#b08dba" strokeWidth="4" strokeLinecap="round" /><circle cx="90" cy="90" r="6" fill="#634c7a" /></svg>
  }
  if (visual.kind === 'chart') return <div className="mm-chart" role="img" aria-label={visual.bars.map(b => `${b.name}: ${b.value}`).join(', ')}>{visual.bars.map(b => <div key={b.name}><span>{b.name}</span><i style={{ width: `${b.value / 12 * 70}%`, background: b.colour }} /><b>{b.value}</b></div>)}</div>
  if (visual.kind === 'sum') return <div className="mm-written-sum" aria-label="Numbers lined up in columns"><span>{visual.a}</span><span><i>{visual.operation}</i>{visual.b}</span><b>?</b></div>
  if (visual.kind === 'fraction') return <div className="mm-fraction" aria-label={`${visual.numerator} of ${visual.denominator} equal parts shaded`}>{Array.from({ length: visual.denominator }, (_, i) => <i key={i} className={i < visual.numerator ? 'filled' : ''} />)}</div>
  const shape = visual.shape
  return <svg className="mm-shape" viewBox="0 0 220 130" role="img" aria-label={shape}>{shape === 'triangle' ? <path d="M110 15 185 112H35Z" /> : shape === 'pentagon' ? <path d="m110 12 63 44-24 72H71L47 56Z" /> : <rect x={shape === 'square' ? 65 : 35} y="25" width={shape === 'square' ? 90 : 150} height="90" rx="3" />}{visual.width && <text x="110" y="18" textAnchor="middle">{visual.width}m</text>}{visual.height && <text x="205" y="75" textAnchor="middle">{visual.height}m</text>}</svg>
}

export function MakeoverMaths() {
  const [players, setPlayers] = useState<Player[]>(() => [newPlayer('Player 1', 'year1'), newPlayer('Player 2', 'year3')])
  const playersRef = useRef(players), activeRef = useRef(0)
  const [active, setActive] = useState(0), [place, setPlace] = useState<Place>('room')
  const [modal, setModal] = useState<Modal>(null), dialog = useRef<HTMLDialogElement>(null)
  const [topic, setTopic] = useState<Topic>('mixed'), [question, setQuestion] = useState<Question | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null), [hint, setHint] = useState(false)
  const [message, setMessage] = useState('Welcome, designer! Explore your room, then earn your first $1,000.')
  const [poseKey, setPoseKey] = useState(0), [sound, setSound] = useState(false), soundRef = useRef(false)
  const audio = useRef<AudioContext | null>(null), showTimer = useRef<ReturnType<typeof setTimeout>>()
  const [dancing, setDancing] = useState(false), [showResult, setShowResult] = useState<ReturnType<typeof enterShow>['result']>(null)
  const fileInput = useRef<HTMLInputElement>(null), [collection, setCollection] = useState('all'), [selectedFood, setSelectedFood] = useState('')
  const [imageError, setImageError] = useState(false)
  const player = players[active]
  useEffect(() => {
    const title = document.title; document.title = 'Makeover Maths · Solve. Style. Shine.'
    const images = ['dressing-room.png', 'show-stage.png', 'teen-lavender.png', 'teen-rose.png', 'teen-teal.png', 'hair-bun.png', 'hair-pony.png'].map(file => { const img = new Image(); img.onerror = () => setImageError(true); img.src = assetRoot + file; return img })
    return () => { document.title = title; clearTimeout(showTimer.current); void audio.current?.close(); images.forEach(i => { i.onerror = null }) }
  }, [])
  useEffect(() => { if (modal && !dialog.current?.open) dialog.current?.showModal(); else if (!modal && dialog.current?.open) dialog.current.close() }, [modal])
  function commit(next: Player) { const copy = [...playersRef.current]; copy[activeRef.current] = next; playersRef.current = copy; setPlayers(copy) }
  function chime(melody = false) {
    if (!soundRef.current) return
    try {
      audio.current ??= new AudioContext(); const context = audio.current; void context.resume()
      ;(melody ? [523, 659, 784, 880, 784, 659] : [659, 880]).forEach((note, i) => {
        const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + i * .14
        oscillator.frequency.value = note; gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.04, start + .015); gain.gain.exponentialRampToValueAtTime(.001, start + .25)
        oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + .3)
      })
    } catch { /* Sound is optional. */ }
  }
  function openMaths() {
    const p = playersRef.current[activeRef.current]
    setQuestion(makeQuestion(p, p.correct === 0 && topic === 'mixed' ? 'addition' : topic)); setFeedback(null); setHint(false); setModal('maths')
  }
  function answer(value: string) {
    if (!question || feedback === 'correct') return
    const before = playersRef.current[activeRef.current], result = answerQuestion(before, question, value)
    commit(result.player); setFeedback(result.correct ? 'correct' : 'wrong')
    if (result.correct && !result.duplicate) { chime(); setPoseKey(n => n + 1); setMessage(result.player.completed ? 'You completed all 50 levels! Take a bow, maths superstar.' : result.player.level > before.level ? `Level ${result.player.level} unlocked! Your next adventure is ready.` : 'Lovely thinking! $1,000 added to your play-money purse.') }
  }
  function nextQuestion() {
    const p = playersRef.current[activeRef.current]
    if (p.completed) { setModal('complete'); return }
    setQuestion(makeQuestion(p, topic)); setFeedback(null); setHint(false)
  }
  function visit(next: Place) {
    clearTimeout(showTimer.current); setDancing(false); setShowResult(null)
    if (next === 'party') {
      const p = playersRef.current[activeRef.current], entered = enterParty(p)
      if (entered === p) { setMessage('Win three fashion shows in a row to earn a party invitation.'); setPlace('show'); return }
      commit(entered); setSelectedFood(''); setDancing(true); chime(true); setMessage('Your party invitation is here! Pick a treat and dance.')
    } else setMessage({ room: 'Tap the rug to walk. Touch a studio to start styling.', wardrobe: 'Find a long gown you love. Bought gowns are yours to wear again.', hair: 'Choose a hairstyle and a colour spray.', makeup: 'A fresh face or a little shimmer — choose your favourite.', show: 'Dress for the theme, solve a question, then take the stage.' }[next])
    setPlace(next)
  }
  function unlock(studio: Studio) {
    const p = playersRef.current[activeRef.current], next = unlockStudio(p, studio)
    if (next === p) { openMaths(); return }
    commit(next); chime(); setMessage(`${places.find(s => s.id === studio)!.title} unlocked! Choose your first style.`)
  }
  function buy(category: 'dress' | 'hair' | 'colour' | 'makeup', id: string) {
    const p = playersRef.current[activeRef.current], next = buyItem(p, category, id)
    if (next === p) { setMessage('Earn a little more play money for this style.'); openMaths(); return }
    const owned = p.owned.includes(`${category}:${id}`); commit(next); setPoseKey(n => n + 1); chime(); setMessage(owned ? 'A favourite style, worn again for free.' : 'It’s yours! Your new style is ready to wear.')
  }
  function startShow() {
    const { player: next, result } = enterShow(playersRef.current[activeRef.current])
    if (!result) { setMessage('Solve one new question before your next fashion show.'); openMaths(); return }
    commit(next); setShowResult(null); setDancing(true); chime(true)
    clearTimeout(showTimer.current)
    showTimer.current = setTimeout(() => { setDancing(false); setShowResult(result); setMessage(result.won ? `You won! ${money(2000)} bonus. ${next.partyTickets ? 'A party invitation is waiting!' : 'Keep shining for three wins in a row.'}` : 'A lovely debut! $500 for taking part. Try a new style or build your maths streak.') }, 3800)
  }
  function switchPlayer(index: number) {
    if (index === activeRef.current) return
    clearTimeout(showTimer.current); activeRef.current = index; setActive(index); setPlace('room'); setQuestion(null); setShowResult(null); setDancing(false); setModal(null); setPoseKey(0)
    setMessage(`Welcome back, ${playersRef.current[index].name}! Your own wardrobe and progress are ready.`)
  }
  function saveGame() {
    const blob = new Blob([JSON.stringify({ version: 1, players: playersRef.current, active: activeRef.current }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'makeover-maths-save.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage('Save file downloaded. Use Load game to continue after closing or refreshing.'); chime()
  }
  async function loadGame(file: File | undefined) {
    if (!file) return
    try {
      const data = decodeSave(await file.text()); clearTimeout(showTimer.current); playersRef.current = data.players; activeRef.current = data.active; setPlayers(data.players); setActive(data.active)
      setPlace('room'); setQuestion(null); setShowResult(null); setDancing(false); setModal(null); setPoseKey(0); setMessage(`Save loaded. Welcome back, ${data.players[data.active].name}!`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'We could not open that save file.') }
    if (fileInput.current) fileInput.current.value = ''
  }
  function pose() { setPoseKey(n => n + 1); chime() }
  const studio = ['wardrobe', 'hair', 'makeup'].includes(place) ? place as Studio : null
  const locked = studio && !player.unlocked.includes(studio), theme = themeFor(player)
  const currentDress = dresses.find(d => d.id === player.dress)!
  const visibleDresses = dresses.filter(d => collection === 'all' || d.id.startsWith(collection))

  return <main className="mm-app">
    <header className="mm-header"><a className="mm-brand" href="/games/makeover-maths"><span className="mm-brand-mark"><Icon name="star" size={28} /></span><span>makeover<span className="mm-brand-maths">maths</span><small>A LITTLE THINKING. A LOT OF MAGIC.</small></span></a>
      <div className="mm-player-switch" aria-label="Choose a player">{players.map((p, i) => <button key={i} className={i === active ? 'active' : ''} onClick={() => switchPlayer(i)} aria-pressed={i === active}><span className="mm-avatar">{i ? '✿' : '✦'}</span><span>{p.name}<small>{p.track === 'year1' ? 'Year 1' : 'Year 3'}</small></span></button>)}</div>
      <div className="mm-header-tools"><div className="mm-wallet"><span>✦</span><div><small>PLAY MONEY</small><strong aria-label={`${player.coins} play dollars`}>{money(player.coins)}</strong></div></div><button className="mm-icon-button" onClick={saveGame} aria-label="Save game" title="Save game"><Icon name="save" /></button><button className="mm-icon-button" aria-label={sound ? 'Turn sound off' : 'Turn sound on'} onClick={() => { soundRef.current = !sound; setSound(!sound); if (!sound) chime() }} title={sound ? 'Sound on' : 'Sound off'}><Icon name={sound ? 'sound' : 'mute'} /></button><button className="mm-icon-button" onClick={() => setModal('help')} aria-label="How to play"><Icon name="help" /></button></div>
    </header>
    <div className="mm-intro"><div><p className="mm-eyebrow">SOLVE. STYLE. SHINE.</p><h1>Your imagination starts here<span> ✧</span></h1><p>Every little answer opens a beautiful new possibility.</p></div><button className="mm-level-badge" onClick={() => setModal(player.completed ? 'complete' : 'map')}><span className="mm-level-star">✦</span><div><small>{player.completed ? 'ALL 50 COMPLETE' : 'YOUR ADVENTURE'}</small><strong>{player.completed ? 'Maths superstar' : `Level ${player.level} of 50`}</strong><span className="mm-level-dots">{[0, 1, 2].map(i => <i key={i} className={i < player.levelCorrect ? 'filled' : ''} />)}<em>3 answers per level</em></span></div><Icon name="arrow" size={17} /></button></div>
    <nav className="mm-nav" aria-label="Game places">{places.map(p => { const isLocked = p.id === 'party' ? player.partyTickets === 0 : p.id in studioCosts && !player.unlocked.includes(p.id as Studio); return <button key={p.id} className={place === p.id ? 'active' : ''} onClick={() => visit(p.id)} aria-pressed={place === p.id}><Icon name={p.icon} size={18} />{p.title}{isLocked && <Icon name="lock" size={12} />}{p.id === 'party' && player.partyTickets > 0 && <b className="mm-ticket-count">{player.partyTickets}</b>}</button> })}<button className="mm-earn" onClick={openMaths}><Icon name="maths" size={18} />Earn $1,000<Icon name="arrow" size={17} /></button></nav>
    {imageError && <p role="alert" className="mm-asset-error">A picture could not load. Refresh the page to try again.</p>}
    <div className="mm-layout"><Room player={player} place={place} onVisit={visit} dancing={dancing} poseKey={poseKey} onPose={pose} />
      <aside className="mm-studio"><div className="mm-studio-heading"><span className="mm-mini-icon"><Icon name={places.find(p => p.id === place)!.icon} /></span><div><p className="mm-eyebrow">{place === 'room' ? 'MAKE YOURSELF AT HOME' : place === 'show' ? 'YOUR MOMENT TO SHINE' : place === 'party' ? 'YOU EARNED THIS' : 'YOUR STYLE STORY'}</p><h2>{place === 'room' ? 'Welcome, designer' : places.find(p => p.id === place)!.title}</h2></div></div>
        {locked && studio ? <div className="mm-locked"><div className="mm-lock-orbit"><Icon name="lock" size={34} /><span>✧</span></div><h3>A new door to open</h3><p>Solve maths to unlock your {places.find(p => p.id === studio)!.title.toLowerCase()}.</p><div className="mm-unlock-price"><small>UNLOCK FOREVER</small><strong>{money(studioCosts[studio])}</strong><span>1 correct answer = $1,000</span></div><button className="mm-primary" onClick={() => unlock(studio)}>{player.coins >= studioCosts[studio] ? 'Unlock this studio' : 'Earn play money'}<Icon name="arrow" size={17} /></button><p className="mm-fine-print">Then shop for styles. Everything you buy stays in your collection.</p></div> : <>
          {place === 'room' && <><p className="mm-panel-copy">Your very own fashion adventure. A little maths, a lovely gown, and a moment in the spotlight.</p><div className="mm-mission"><span>✦</span><small>YOUR NEXT LITTLE ADVENTURE</small><h3>{player.completed ? 'Celebrate your achievement' : !player.unlocked.includes('wardrobe') ? 'Open your wardrobe' : 'Create your dream look'}</h3><p>{!player.unlocked.includes('wardrobe') ? 'One correct answer earns enough to unlock it.' : 'Pick a style, practise maths, then enter a fashion show.'}</p><button className="mm-primary" onClick={player.completed ? () => setModal('complete') : openMaths}>{player.completed ? 'See your achievement' : 'Let’s do some maths'}<Icon name="arrow" size={17} /></button></div><div className="mm-current-look"><div><Character player={player} thumbnail /></div><section><small>YOUR LOOK RIGHT NOW</small><strong>{currentDress.name}</strong><span>Made for your imagination</span></section></div><div className="mm-stats"><div><b>{player.correct}</b><span>answers</span></div><div><b>{player.wins}</b><span>show wins</span></div><div><b>{player.parties}</b><span>parties</span></div></div></>}
          {place === 'wardrobe' && <><p className="mm-panel-copy">Long silhouettes, flowing fabrics, a little red-carpet magic. Choose your favourite.</p><div className="mm-collection-tabs" aria-label="Dress collections">{[['all', 'All'], ['0', 'Starlight'], ['1', 'Satin'], ['2', 'Botanical']].map(([id, label]) => <button key={id} onClick={() => setCollection(id)} className={collection === id ? 'active' : ''} aria-pressed={collection === id}>{label}</button>)}</div><div className="mm-dress-grid">{visibleDresses.map(dress => <DressCard key={dress.id} dress={dress} player={player} onChoose={() => buy('dress', dress.id)} />)}</div><p className="mm-fine-print">15 colourways · 3 gown silhouettes · Wear owned styles for free</p></>}
          {place === 'hair' && <><p className="mm-panel-copy">A graceful updo or soft waves? Make it yours.</p><h3 className="mm-small-heading">Choose your hairstyle</h3><div className="mm-hair-grid">{hairstyles.map(h => <button key={h.id} className={`mm-style-card ${player.hair === h.id ? 'selected' : ''}`} onClick={() => buy('hair', h.id)} aria-pressed={player.hair === h.id}><div className="mm-hair-preview"><img src={assetRoot + h.asset} alt="" /></div><strong>{h.name}</strong><span>{player.hair === h.id ? 'Wearing' : player.owned.includes(`hair:${h.id}`) ? 'Wear it' : money(h.price)}</span></button>)}</div><h3 className="mm-small-heading">Try a colour spray</h3><div className="mm-colour-grid">{hairColours.map(c => <button key={c.id} className={player.hairColour === c.id ? 'selected' : ''} onClick={() => buy('colour', c.id)} aria-pressed={player.hairColour === c.id}><i style={{ background: c.colour }} /><strong>{c.name}</strong><span>{player.hairColour === c.id ? 'Wearing' : player.owned.includes(`colour:${c.id}`) ? 'Wear it' : money(c.price)}</span></button>)}</div><p className="mm-fine-print">Changing styles you already own is always free.</p></>}
          {place === 'makeup' && <><p className="mm-panel-copy">A tiny finishing touch. Every look is lovely, including a fresh face.</p><div className="mm-makeup-grid">{makeups.map(m => <button key={m.id} className={`mm-makeup-card ${player.makeup === m.id ? 'selected' : ''}`} onClick={() => buy('makeup', m.id)} aria-pressed={player.makeup === m.id}><span className="mm-makeup-swatch" style={{ '--swatch': m.colour } as CSSProperties}>{m.id === 'sparkle' ? '✧' : '✿'}</span><div><strong>{m.name}</strong><small>{m.id === 'natural' ? 'Your own natural glow' : m.id === 'rose' ? 'A soft rosy blush' : m.id === 'peach' ? 'Warm cheeks and shimmer' : 'A sprinkling of golden magic'}</small><span>{player.makeup === m.id ? 'Wearing' : player.owned.includes(`makeup:${m.id}`) ? 'Wear it' : money(m.price)}</span></div>{player.makeup === m.id && <Icon name="check" size={16} />}</button>)}</div></>}
          {place === 'show' && <><div className="mm-show-theme"><small>TODAY’S THEME</small><h3>{theme.name}</h3><p>{theme.description}</p></div><div className="mm-win-streak"><div>{[0, 1, 2].map(i => <span key={i} className={i < (player.showStreak % 3 || (player.showStreak ? 3 : 0)) ? 'filled' : ''}>★</span>)}</div><p>3 wins in a row = a party invitation</p></div>{showResult ? <div className={`mm-results ${showResult.won ? 'won' : ''}`} role="status"><h3>{showResult.won ? 'You lit up the runway!' : 'A lovely first step!'}</h3><strong>{showResult.won ? '+ $2,000' : '+ $500'} play money</strong><div className="mm-judges">{[['Style', showResult.style, '✿'], ['Creativity', showResult.creativity, '✧'], ['Maths confidence', showResult.confidence, '✦']].map(([label, score, icon]) => <div key={label}><span>{icon}</span><b>{score}/10</b><small>{label}</small></div>)}</div><p>{showResult.won ? 'Your outfit, ideas, and maths made a brilliant team.' : `You scored ${showResult.total}. Aim for ${showResult.target}: match the theme, try accessories, or solve more maths.`}</p></div> : <div className="mm-show-preview"><span>✧</span><h3>{dancing ? 'The spotlight is yours…' : 'Ready for your entrance?'}</h3><p>Judges cheer for style, creativity, and maths confidence.</p></div>}<button className="mm-primary" disabled={dancing} onClick={startShow}>{dancing ? 'Enjoy your little dance…' : player.lastShowCorrect === player.correct || !player.correct ? 'Solve maths to enter' : 'Take the stage'}<Icon name="star" size={17} /></button>{player.partyTickets > 0 && <button className="mm-secondary mm-party-invite" onClick={() => visit('party')}>Your party invitation is here! ✧</button>}</>}
          {place === 'party' && <><div className="mm-party-card"><span>✧</span><h3>You’re on the guest list!</h3><p>A beautiful gown, fancy treats, and a dance floor all to yourself. You earned this celebration.</p></div><h3 className="mm-small-heading">Pick a party treat</h3><div className="mm-foods">{[['Cupcakes', '🧁'], ['Strawberries', '🍓'], ['Sparkling juice', '🍹']].map(([name, emoji]) => <button key={name} onClick={() => { setSelectedFood(name); chime(); setMessage(`A little ${name.toLowerCase()} treat. Enjoy your celebration!`) }} className={selectedFood === name ? 'selected' : ''}><span>{emoji}</span><strong>{name}</strong></button>)}</div><p className="mm-treat-message">{selectedFood ? `${selectedFood}, served with a little sparkle!` : 'Choose something delicious.'}</p><button className="mm-primary" onClick={() => { setDancing(!dancing); if (!dancing) chime(true) }}>{dancing ? 'Pause the dance' : 'Let’s dance'}<Icon name="star" size={17} /></button><button className="mm-secondary" onClick={() => { visit('room'); openMaths() }}>Back to your adventure<Icon name="arrow" size={17} /></button></>}
        </>}
        <div className="mm-studio-footer"><span>✧ Your ideas make the magic.</span><button onClick={() => setModal('map')} aria-label="See all 50 levels"><Icon name="map" size={17} /></button></div>
      </aside>
    </div>
    <div className="mm-status"><span className="mm-status-dot" /><p role="status" aria-live="polite">{message}</p><button onClick={() => setModal('players')}>Players & maths settings<Icon name="arrow" size={14} /></button></div>
    <footer className="mm-footer"><span>50 little adventures. Endless possibilities.</span><span>15 gowns · Your own pace · A little maths magic</span></footer>
    <input className="mm-file-input" type="file" accept=".json,application/json" ref={fileInput} aria-label="Load a Makeover Maths save file" onChange={event => { void loadGame(event.target.files?.[0]) }} />
    <dialog className={`mm-dialog ${modal === 'map' ? 'mm-map-dialog' : ''}`} ref={dialog} aria-labelledby="mm-dialog-title" onCancel={() => setModal(null)} onClick={event => { if (event.target === event.currentTarget) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) setModal(null) } }}>
      <button className="mm-dialog-close" onClick={() => setModal(null)} aria-label="Close dialog"><Icon name="close" /></button>
      {modal === 'maths' && question && <><p className="mm-eyebrow">{player.name.toUpperCase()} · LEVEL {player.level} · {topics.find(t => t.id === question.topic)!.name.toUpperCase()}</p><h2 id="mm-dialog-title">A little maths magic <span>✧</span></h2><p className="mm-dialog-lead">Think it through. Each correct answer earns <b>$1,000</b>.</p><div className="mm-question"><h3>{question.prompt}</h3><QuestionVisual visual={question.visual} /></div><div className="mm-answers">{question.options.map(option => <button key={option} disabled={feedback === 'correct'} className={feedback === 'correct' && option === question.answer ? 'correct' : ''} onClick={() => answer(option)}>{option}{feedback === 'correct' && option === question.answer && <Icon name="check" />}</button>)}</div>{feedback === 'correct' ? <div className="mm-correct-feedback" role="status"><strong>Lovely thinking! + $1,000 ✦</strong><p>{question.explanation}</p><div><button className="mm-primary" onClick={nextQuestion}>{player.completed ? 'See your achievement' : 'Next question'}<Icon name="arrow" size={17} /></button><button className="mm-secondary" onClick={() => { setModal(null); visit('wardrobe') }}>Go shopping<Icon name="dress" size={17} /></button></div></div> : <><p className="mm-try-again" role="status">{feedback === 'wrong' ? 'Good try! Take another look. Your play money is safe.' : 'No hurry. Take all the time you need.'}</p><button className="mm-hint-button" onClick={() => setHint(!hint)}>{hint ? 'Hide the little hint' : 'A little hint, please'} ✧</button>{hint && <p className="mm-hint">{question.hint}</p>}</>}<p className="mm-fine-print mm-question-footer">{player.track === 'year1' ? 'Year 1 starting point' : 'Year 3 starting point'} · Questions gently adapt as you practise.</p></>}
      {modal === 'help' && <><p className="mm-eyebrow">YOUR LITTLE GUIDE</p><h2 id="mm-dialog-title">Welcome to Makeover Maths <span>✧</span></h2><div className="mm-help-steps"><div><b>1</b><section><h3>Think & earn</h3><p>Every correct answer earns $1,000 play money. Three answers complete a level. There are 50 levels, and hints are always here.</p></section></div><div><b>2</b><section><h3>Unlock & style</h3><p>Unlock studios, then buy gowns, hairstyles and makeup. Your purchases stay in your collection and you can wear them again for free.</p></section></div><div><b>3</b><section><h3>Shine & celebrate</h3><p>Solve a new question to enter each show. Judges reward style, creativity and maths confidence. Three wins in a row earn a party invitation!</p></section></div></div><p className="mm-help-controls">Tap the rug or use arrow keys to walk. Tap a studio to visit. Touch your character to strike a pose.</p><div className="mm-save-note"><strong>Keep your adventure</strong><p>Progress stays here while this page is open. Download a save before closing or refreshing; load it next time to continue. The file keeps both players.</p><div><button className="mm-secondary" onClick={saveGame}><Icon name="save" size={17} />Save game</button><button className="mm-secondary" onClick={() => fileInput.current?.click()}>Load game<Icon name="arrow" size={17} /></button></div></div><button className="mm-primary" onClick={() => setModal('players')}>Choose players & maths<Icon name="arrow" size={17} /></button></>}
      {modal === 'players' && <><p className="mm-eyebrow">MADE FOR YOUR OWN PACE</p><h2 id="mm-dialog-title">Two designers, two adventures <span>✧</span></h2><p className="mm-dialog-lead">Each player has their own money, wardrobe, and progress.</p><div className="mm-player-settings">{players.map((p, i) => <section key={i}><label htmlFor={`mm-name-${i}`}>Player {i + 1} name</label><input id={`mm-name-${i}`} value={p.name} maxLength={24} onChange={event => { const copy = [...playersRef.current]; copy[i] = { ...copy[i], name: event.target.value }; playersRef.current = copy; setPlayers(copy) }} /><div className="mm-track-choice">{(['year1', 'year3'] as const).map(track => <button key={track} className={p.track === track ? 'active' : ''} aria-pressed={p.track === track} onClick={() => { const copy = [...playersRef.current]; copy[i] = { ...copy[i], track, adaptive: 0 }; playersRef.current = copy; setPlayers(copy); setQuestion(null) }}><b>{track === 'year1' ? 'Year 1' : 'Year 3'}</b><span>{track === 'year1' ? 'A gentler beginning' : 'A little more challenge'}</span></button>)}</div></section>)}</div><label className="mm-topic-label" htmlFor="mm-topic">Maths to practise</label><select id="mm-topic" value={topic} onChange={event => { setTopic(event.target.value as Topic); setQuestion(null) }}>{topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><p className="mm-fine-print">Place value, addition, subtraction, 2/3/4/5/8/10 tables, division, fractions, money, measures, shapes, clocks and charts. Current challenge: {difficulty(player) + 1} of {player.track === 'year1' ? 5 : 9}.</p><button className="mm-primary" onClick={() => setModal(null)}>Ready to play<Icon name="star" size={17} /></button></>}
      {modal === 'map' && <><p className="mm-eyebrow">YOUR 50-LEVEL ADVENTURE</p><h2 id="mm-dialog-title">One little step at a time <span>✧</span></h2><p className="mm-dialog-lead">Three correct answers per level. Your next adventure is level {player.level}.</p><div className="mm-level-map">{Array.from({ length: 50 }, (_, i) => i + 1).map(level => <button key={level} className={level < player.level || player.completed ? 'done' : level === player.level ? 'current' : ''} aria-label={`Level ${level}${level < player.level || player.completed ? ', complete' : level === player.level ? ', current' : ', coming next'}`} onClick={() => { if (level === player.level) openMaths(); else setMessage(level < player.level ? `Level ${level} complete. Keep going with level ${player.level}.` : `Level ${level} is waiting. Finish your current level first.`) }}>{level < player.level || player.completed ? '✦' : level}<small>{level < player.level || player.completed ? level : ''}</small></button>)}</div><div className="mm-stats"><div><b>{player.correct}</b><span>answers</span></div><div><b>{player.wins}</b><span>show wins</span></div><div><b>{player.parties}</b><span>parties</span></div></div><button className="mm-primary" onClick={player.completed ? () => setModal('complete') : openMaths}>{player.completed ? 'See your achievement' : 'Continue your adventure'}<Icon name="arrow" size={17} /></button></>}
      {modal === 'complete' && <><div className="mm-achievement">✦</div><p className="mm-eyebrow">ALL 50 LEVELS COMPLETE</p><h2 id="mm-dialog-title">Take a bow, {player.name || 'designer'}!</h2><p className="mm-dialog-lead">You are a Makeover Maths superstar. Every answer was a little step towards this moment.</p><div className="mm-stats"><div><b>{player.correct}</b><span>answers</span></div><div><b>{player.wins}</b><span>show wins</span></div><div><b>{player.parties}</b><span>parties</span></div></div><button className="mm-primary" onClick={() => { setModal(null); visit('show') }}>Take a final bow<Icon name="star" size={17} /></button><button className="mm-secondary" onClick={saveGame}>Save your achievement<Icon name="save" size={17} /></button></>}
    </dialog>
  </main>
}
function DressCard({ dress, player, onChoose }: { dress: Dress; player: Player; onChoose: () => void }) {
  const wearing = player.dress === dress.id, owned = player.owned.includes(`dress:${dress.id}`)
  return <button className={`mm-dress-card ${wearing ? 'selected' : ''}`} onClick={onChoose} aria-pressed={wearing} aria-label={`${dress.name}, ${wearing ? 'wearing' : owned ? 'owned, wear for free' : money(dress.price)}`}><div className="mm-dress-preview"><Character player={{ ...player, dress: dress.id }} thumbnail /><i style={{ background: dress.colour }} />{wearing && <span className="mm-wearing-check"><Icon name="check" size={13} /></span>}</div><strong>{dress.name}</strong><span>{wearing ? 'Wearing' : owned ? 'Wear it' : money(dress.price)}</span></button>
}
