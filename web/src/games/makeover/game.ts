export type Place = 'room' | 'wardrobe' | 'hair' | 'makeup' | 'show' | 'party'
export type Track = 'year1' | 'year3'
export type Topic = 'mixed' | 'addition' | 'subtraction' | 'place' | 'multiplication' | 'division' | 'fractions' | 'money' | 'measure' | 'time' | 'charts'
export const assetRoot = '/games/makeover-maths/'
export type Dress = { id: string; name: string; asset: string; colour: string; filter: string; price: number; quality: number; palette: string }
const collections = [
  { asset: 'teen-lavender.png', title: 'Starlight', price: 0, quality: 3, colours: [
    ['Lilac', '#bda3dd', 'none', 'purple'], ['Silver', '#d7d6df', 'saturate(.12) brightness(1.12)', 'silver'],
    ['Royal blue', '#778cd6', 'hue-rotate(-45deg) saturate(1.4)', 'blue'], ['Rose', '#e9a1bc', 'hue-rotate(65deg)', 'pink'], ['Champagne', '#dfbd86', 'hue-rotate(140deg) saturate(.75) brightness(1.08)', 'gold'],
  ] },
  { asset: 'teen-rose.png', title: 'Satin silhouette', price: 2000, quality: 6, colours: [
    ['Blush', '#e9a5ba', 'none', 'pink'], ['Ruby', '#ad526c', 'hue-rotate(-18deg) saturate(1.65) brightness(.8)', 'red'],
    ['Gold', '#d6ba8b', 'hue-rotate(65deg) saturate(.65) brightness(1.1)', 'gold'], ['Sage', '#91ad99', 'hue-rotate(150deg) saturate(.5)', 'green'], ['Midnight', '#7483ac', 'hue-rotate(-110deg) saturate(.8) brightness(.72)', 'blue'],
  ] },
  { asset: 'teen-teal.png', title: 'Botanical couture', price: 3000, quality: 8, colours: [
    ['Teal', '#62b3ad', 'none', 'green'], ['Emerald', '#398a70', 'hue-rotate(-24deg) saturate(1.5) brightness(.82)', 'green'],
    ['Aqua', '#91cfd1', 'hue-rotate(15deg) brightness(1.12)', 'blue'], ['Orchid', '#b99bc9', 'hue-rotate(115deg) saturate(.65)', 'purple'], ['Pearl', '#dce0da', 'saturate(.08) brightness(1.22)', 'silver'],
  ] },
] as const
export const dresses: Dress[] = collections.flatMap((collection, c) => collection.colours.map((colour, i) => ({
  id: `${c}-${i}`, name: `${colour[0]} ${collection.title}`, asset: collection.asset, colour: colour[1], filter: colour[2], palette: colour[3],
  price: c === 0 && i === 0 ? 0 : collection.price + 1000 + i * 500, quality: collection.quality + (i ? 1 : 0),
})))
export const hairstyles = [
  { id: 'waves', name: 'Soft waves', asset: 'teen-lavender.png', price: 0 },
  { id: 'bun', name: 'Braided low bun', asset: 'hair-bun.png', price: 1500 },
  { id: 'pony', name: 'High ponytail', asset: 'hair-pony.png', price: 1500 },
] as const
export const hairColours = [
  { id: 'brown', name: 'Chestnut', colour: '#6d422c', filter: 'none', price: 0 },
  { id: 'black', name: 'Midnight', colour: '#322737', filter: 'saturate(.35) brightness(.5)', price: 1000 },
  { id: 'honey', name: 'Honey', colour: '#b88d52', filter: 'hue-rotate(8deg) saturate(.65) brightness(1.5)', price: 1000 },
  { id: 'rose', name: 'Rose gold', colour: '#ba758e', filter: 'hue-rotate(-35deg) saturate(.7) brightness(1.4)', price: 1500 },
  { id: 'purple', name: 'Violet spray', colour: '#8b6bb0', filter: 'hue-rotate(-95deg) saturate(.85) brightness(1.3)', price: 1500 },
] as const
export const makeups = [
  { id: 'natural', name: 'Fresh face', colour: '#e8b795', price: 0 },
  { id: 'rose', name: 'Rosy glow', colour: '#e391ad', price: 1000 },
  { id: 'peach', name: 'Peach shimmer', colour: '#eab084', price: 1000 },
  { id: 'sparkle', name: 'Golden sparkle', colour: '#d8b781', price: 1500 },
] as const
export const topics: { id: Topic; name: string }[] = [
  { id: 'mixed', name: 'Surprise mix' }, { id: 'addition', name: 'Addition' }, { id: 'subtraction', name: 'Subtraction' },
  { id: 'place', name: 'Place value' }, { id: 'multiplication', name: 'Times tables' }, { id: 'division', name: 'Division' },
  { id: 'fractions', name: 'Fractions' }, { id: 'money', name: 'Money & change' }, { id: 'measure', name: 'Measures & shapes' },
  { id: 'time', name: 'Telling time' }, { id: 'charts', name: 'Reading charts' },
]
export const studioCosts = { wardrobe: 1000, hair: 2000, makeup: 2000 } as const
export type Studio = keyof typeof studioCosts
export type Player = {
  name: string; track: Track; level: number; levelCorrect: number; coins: number; correct: number; streak: number; adaptive: number;
  owned: string[]; unlocked: Studio[]; credited: string[]; lastMiss: string;
  dress: string; hair: string; hairColour: string; makeup: string;
  wins: number; showStreak: number; lastShowCorrect: number; partyTickets: number; parties: number; completed: boolean;
}
export function newPlayer(name: string, track: Track): Player {
  return { name, track, level: 1, levelCorrect: 0, coins: 0, correct: 0, streak: 0, adaptive: 0,
    owned: ['dress:0-0', 'hair:waves', 'colour:brown', 'makeup:natural'], unlocked: [], credited: [], lastMiss: '',
    dress: '0-0', hair: 'waves', hairColour: 'brown', makeup: 'natural', wins: 0, showStreak: 0, lastShowCorrect: -1,
    partyTickets: 0, parties: 0, completed: false }
}
export type Question = { id: string; topic: Topic; prompt: string; answer: string; options: string[]; hint: string; explanation: string;
  visual?: { kind: 'clock'; hour: number; minute: number } | { kind: 'chart'; bars: { name: string; value: number; colour: string }[] }
    | { kind: 'shape'; shape: 'rectangle' | 'triangle' | 'square' | 'pentagon'; width?: number; height?: number }
    | { kind: 'fraction'; numerator: number; denominator: number }
    | { kind: 'sum'; a: number; b: number; operation: '+' | '−' }
}
type Random = () => number
function integer(random: Random, min: number, max: number) { return min + Math.floor(random() * (max - min + 1)) }
function pick<T>(random: Random, values: readonly T[]): T { return values[Math.floor(random() * values.length)] }
function shuffle<T>(values: T[], random: Random) { for (let i = values.length - 1; i > 0; i--) { const j = integer(random, 0, i); [values[i], values[j]] = [values[j], values[i]] } return values }
export function difficulty(player: Player) {
  return Math.max(0, Math.min(player.track === 'year1' ? 4 : 8, Math.round((player.track === 'year3' ? 3 : 0) + (player.level - 1) / 12 + player.adaptive)))
}
export function makeQuestion(player: Player, chosen: Topic = 'mixed', random: Random = Math.random): Question {
  const step = difficulty(player)
  const topic = chosen === 'mixed' ? pick(random, topics.slice(1).map(t => t.id)) : chosen
  const id = `${player.level}-${crypto.randomUUID()}`
  const make = (prompt: string, answer: string, options: string[], hint: string, explanation: string, visual?: Question['visual']): Question => ({ id, topic, prompt, answer, options: shuffle([...new Set([answer, ...options])].slice(0, 4), random), hint, explanation, visual })
  const number = (prompt: string, value: number, hint: string, explanation: string, unit = '', visual?: Question['visual']) => {
    const candidates = shuffle([-3, -2, -1, 1, 2, 3, 5, 10], random).map(d => value + d).filter(n => n >= 0 && n !== value)
    return make(prompt, `${value}${unit}`, candidates.map(n => `${n}${unit}`), hint, explanation, visual)
  }
  const max = [5, 10, 20, 50, 100, 200, 500, 800, 999][step]
  if (topic === 'addition' || topic === 'subtraction') {
    let a = integer(random, 1, max), b = integer(random, 1, max)
    if (topic === 'subtraction' && b > a) [a, b] = [b, a]
    const op = topic === 'addition' ? '+' : '−', value = topic === 'addition' ? a + b : a - b
    const hint = step < 3 ? `${topic === 'addition' ? 'Start at' : 'Start with'} ${a} and count ${topic === 'addition' ? 'on' : 'back'} ${b}.` : `Line up the ones, tens and hundreds. Work from the ones column and ${topic === 'addition' ? 'exchange 10 ones for 1 ten if needed' : 'exchange 1 ten for 10 ones if needed'}.`
    return number(`What is ${a} ${op} ${b}?`, value, hint, `${a} ${op} ${b} = ${value}.`, '', step >= 3 ? { kind: 'sum', a, b, operation: op } : undefined)
  }
  if (topic === 'place') {
    const n = integer(random, step < 2 ? 10 : 100, step < 2 ? 99 : 999)
    if (step >= 3 && random() < .4) {
      const draw = integer(random, 100, 999), b = draw === n ? (n === 999 ? 998 : n + 1) : draw
      return make(`Which number is greater: ${n} or ${b}?`, String(Math.max(n, b)), [String(Math.min(n, b)), String(Math.max(n, b) + 10), String(Math.max(n, b) - 10), String(Math.max(n, b) + 20)], 'Compare hundreds first, then tens, then ones.', `${Math.max(n, b)} is greater than ${Math.min(n, b)}.`)
    }
    const place = step < 2 ? 'tens' : pick(random, ['hundreds', 'tens', 'ones'] as const)
    const value = place === 'hundreds' ? Math.floor(n / 100) * 100 : place === 'tens' ? Math.floor(n / 10) % 10 * 10 : n % 10
    return number(`In ${n}, what is the value of the ${place} digit?`, value, 'Hundreds are worth 100 each. Tens are worth 10 each. Ones are worth 1 each.', `${n} has ${Math.floor(n / 100)} hundreds, ${Math.floor(n / 10) % 10} tens and ${n % 10} ones.`)
  }
  if (topic === 'multiplication' || topic === 'division') {
    const table = pick(random, step < 3 ? [2, 5, 10] : [2, 3, 4, 5, 8, 10])
    const count = integer(random, 1, step >= 5 && topic === 'multiplication' ? 29 : step < 2 ? 5 : 12)
    if (topic === 'division') return number(`${table * count} ribbons are shared equally between ${table} gift bags. How many in each?`, count, `Think: ${table} × what number = ${table * count}?`, `${table * count} ÷ ${table} = ${count}.`)
    return number(`What is ${count} × ${table}?`, count * table, `Add ${count} ${table === 10 ? 'ten' : String(table)} times, or split ${count} into tens and ones.`, `${count} × ${table} = ${count * table}.`)
  }
  if (topic === 'fractions') {
    const denominator = pick(random, step < 3 ? [2, 4] : [2, 3, 4, 5, 8, 10])
    if (step >= 4 && random() < .35) {
      const numerator = integer(random, 1, denominator - 1)
      return make(`Which fraction is equal to ${numerator}/${denominator}?`, `${numerator * 2}/${denominator * 2}`, [`${numerator}/${denominator * 2}`, `${numerator * 2 + 1}/${denominator * 2}`, `${numerator * 2}/${denominator}`], 'Multiply the top and bottom by the same number.', `${numerator}/${denominator} = ${numerator * 2}/${denominator * 2}. Both represent the same amount.`, { kind: 'fraction', numerator, denominator })
    }
    if (step >= 4 && random() < .5) {
      const d = pick(random, [5, 8, 10]), a = integer(random, 1, d - 2), b = integer(random, 1, d - a)
      const subtract = random() < .5 && a > 1, c = subtract ? integer(random, 1, a - 1) : b, n = subtract ? a - c : a + c
      return make(`${a}/${d} ${subtract ? '−' : '+'} ${c}/${d} = ?`, `${n}/${d}`, [`${n}/${d * 2}`, `${n + 1}/${d}`, `${Math.max(0, n - 1)}/${d}`], 'Keep the denominator the same. Only add or subtract the numerators.', `The pieces stay the same size: ${a}/${d} ${subtract ? '−' : '+'} ${c}/${d} = ${n}/${d}.`)
    }
    const groups = integer(random, 1, step < 3 ? 5 : 10), quantity = denominator * groups
    return number(`What is 1/${denominator} of ${quantity} flowers?`, groups, `Share ${quantity} into ${denominator} equal groups.`, `${quantity} ÷ ${denominator} = ${groups}, so 1/${denominator} of ${quantity} is ${groups}.`, '', { kind: 'fraction', numerator: 1, denominator })
  }
  if (topic === 'money') {
    const price = integer(random, 1, step < 3 ? 9 : 39), paid = price <= 9 ? 10 : Math.ceil((price + 1) / 10) * 10
    if (step >= 5 && random() < .4) {
      const pence = integer(random, 1, 18) * 5, change = 100 - pence
      return number(`A ribbon costs ${pence}p. You pay £1. How much change?`, change, '£1 is 100 pence. Count from the price up to 100p.', `100p − ${pence}p = ${change}p change.`, 'p')
    }
    return number(`A hair accessory costs £${price}. You pay £${paid}. How much change?`, paid - price, `Count up from ${price} to ${paid}, or subtract.`, `£${paid} − £${price} = £${paid - price} change.`, ' pounds')
  }
  if (topic === 'measure') {
    if (step >= 3 && random() < .45) {
      const width = integer(random, 2, 12), height = integer(random, 2, 9)
      return number(`A rectangular stage is ${width}m long and ${height}m wide. What is its perimeter?`, 2 * (width + height), 'Perimeter is the distance all the way around. Add all four sides.', `${width} + ${height} + ${width} + ${height} = ${2 * (width + height)} metres.`, 'm', { kind: 'shape', shape: 'rectangle', width, height })
    }
    if (step >= 4 && random() < .45) {
      const metres = integer(random, 1, 8)
      return number(`How many centimetres are in ${metres} metres of fabric?`, metres * 100, '1 metre = 100 centimetres.', `${metres} × 100 = ${metres * 100}cm.`, 'cm')
    }
    const shape = pick(random, ['triangle', 'square', 'pentagon'] as const), sides = { triangle: 3, square: 4, pentagon: 5 }[shape]
    return number(`How many sides does a ${shape} have?`, sides, 'Trace around the outside and count each straight edge.', `A ${shape} has ${sides} straight sides.`, '', { kind: 'shape', shape })
  }
  if (topic === 'time') {
    const hour = integer(random, 1, 12), minute = pick(random, step < 2 ? [0, 30] : step < 5 ? [0, 15, 30, 45] : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
    const format = (h: number, m: number) => `${(h - 1) % 12 + 1}:${String(m).padStart(2, '0')}`
    return make('What time is shown on the clock?', format(hour, minute), [format(hour % 12 + 1, minute), format(hour, (minute + 15) % 60), format(hour, (minute + 30) % 60)], 'The short hand shows the hour. The long hand counts minutes: each number is 5 minutes.', `The clock shows ${format(hour, minute)}.`, { kind: 'clock', hour, minute })
  }
  const bars = ['Rose', 'Lilac', 'Mint'].map((name, i) => ({ name, value: integer(random, 1, step < 3 ? 6 : 12), colour: ['#dda0b5', '#b49ad1', '#97c4b0'][i] }))
  const total = bars.reduce((sum, bar) => sum + bar.value, 0)
  if (random() < .5) return number('How many dresses are there altogether in this chart?', total, 'Read each bar, then add the three numbers.', `${bars.map(b => b.value).join(' + ')} = ${total} dresses.`, '', { kind: 'chart', bars })
  const index = integer(random, 0, 2)
  return number(`How many ${bars[index].name.toLowerCase()} dresses are in the chart?`, bars[index].value, 'Find the colour label, then read the number next to that bar.', `The ${bars[index].name} bar shows ${bars[index].value} dresses.`, '', { kind: 'chart', bars })
}
export function answerQuestion(player: Player, question: Question, answer: string) {
  if (player.credited.includes(question.id)) return { player, correct: answer === question.answer, duplicate: true }
  if (answer !== question.answer) return { player: player.lastMiss === question.id ? player : { ...player, streak: 0, lastMiss: question.id, adaptive: Math.max(-2, player.adaptive - .25) }, correct: false, duplicate: false }
  const levelCorrect = player.levelCorrect + 1, advance = levelCorrect >= 3 && !player.completed
  const completed = player.completed || (player.level === 50 && advance)
  return { player: { ...player, coins: player.coins + 1000, correct: player.correct + 1, streak: player.streak + 1,
    adaptive: Math.min(2, player.adaptive + (player.lastMiss === question.id ? 0 : .15)), credited: [...player.credited, question.id],
    level: advance && !completed ? player.level + 1 : player.level, levelCorrect: advance && !completed ? 0 : Math.min(3, levelCorrect), completed }, correct: true, duplicate: false }
}
export function unlockStudio(player: Player, studio: Studio): Player {
  if (player.unlocked.includes(studio) || player.coins < studioCosts[studio]) return player
  return { ...player, coins: player.coins - studioCosts[studio], unlocked: [...player.unlocked, studio] }
}
export function buyItem(player: Player, category: 'dress' | 'hair' | 'colour' | 'makeup', id: string): Player {
  const item = category === 'dress' ? dresses.find(i => i.id === id) : category === 'hair' ? hairstyles.find(i => i.id === id) : category === 'colour' ? hairColours.find(i => i.id === id) : makeups.find(i => i.id === id)
  const studio = category === 'dress' ? 'wardrobe' : category === 'makeup' ? 'makeup' : 'hair'
  if (!item || !player.unlocked.includes(studio)) return player
  const key = `${category}:${id}`, owned = player.owned.includes(key), cost = owned ? 0 : item.price
  if (cost > player.coins) return player
  return { ...player, coins: player.coins - cost, owned: owned ? player.owned : [...player.owned, key], [category === 'colour' ? 'hairColour' : category]: id }
}
export const themes = [
  { name: 'Starlight soirée', palette: 'purple', description: 'Lavender, silver, and a little sparkle.' },
  { name: 'Rose garden gala', palette: 'pink', description: 'Soft rose tones and graceful details.' },
  { name: 'Emerald evening', palette: 'green', description: 'Fresh greens and botanical elegance.' },
  { name: 'Golden hour', palette: 'gold', description: 'Warm golden tones for a glowing entrance.' },
  { name: 'Midnight magic', palette: 'blue', description: 'Blue, silver, and a touch of mystery.' },
]
export function themeFor(player: Player) { return themes[(player.level - 1) % themes.length] }
export function judgeShow(player: Player) {
  const gown = dresses.find(d => d.id === player.dress)!, theme = themeFor(player)
  const style = Math.min(10, gown.quality + (gown.palette === theme.palette ? 2 : 0))
  const creativity = Math.min(10, 6 + (player.hair !== 'waves' ? 1 : 0) + (player.hairColour !== 'brown' ? 1 : 0) + (player.makeup !== 'natural' ? 2 : 0))
  const confidence = Math.min(10, 6 + player.streak)
  const total = style + creativity + confidence, target = 20 + Math.floor((player.level - 1) / 17)
  return { style, creativity, confidence, total, target, won: total >= target }
}
export function enterShow(player: Player): { player: Player; result: ReturnType<typeof judgeShow> | null } {
  if (player.correct < 1 || player.correct === player.lastShowCorrect) return { player, result: null }
  const result = judgeShow(player), streak = result.won ? player.showStreak + 1 : 0
  return { result, player: { ...player, lastShowCorrect: player.correct, wins: player.wins + Number(result.won), showStreak: streak,
    partyTickets: player.partyTickets + Number(result.won && streak % 3 === 0), coins: player.coins + (result.won ? 2000 : 500) } }
}
export function enterParty(player: Player): Player {
  if (player.partyTickets < 1) return player
  return { ...player, partyTickets: player.partyTickets - 1, parties: player.parties + 1 }
}
export function decodeSave(text: string): { players: Player[]; active: number } {
  if (text.length > 300000) throw new Error('That save file is too large.')
  const data: unknown = JSON.parse(text)
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('players' in data) || !Array.isArray(data.players) || data.players.length !== 2) throw new Error('Choose a Makeover Maths save file.')
  const safeIds = new Set([...dresses.map(d => `dress:${d.id}`), ...hairstyles.map(h => `hair:${h.id}`), ...hairColours.map(c => `colour:${c.id}`), ...makeups.map(m => `makeup:${m.id}`)])
  const players = data.players.map((value: unknown): Player => {
    if (!value || typeof value !== 'object') throw new Error('This save file is incomplete.')
    const p = value as Record<string, unknown>, track = p.track
    if (track !== 'year1' && track !== 'year3') throw new Error('Unknown maths starting point.')
    const player = newPlayer(typeof p.name === 'string' ? p.name.slice(0, 24) : 'Designer', track)
    for (const key of ['level', 'levelCorrect', 'coins', 'correct', 'streak', 'wins', 'showStreak', 'partyTickets', 'parties'] as const) {
      const n = p[key]
      if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < (key === 'level' ? 1 : 0) || n > (key === 'level' ? 50 : key === 'levelCorrect' ? 3 : 10000000)) throw new Error('This save has invalid progress.')
      player[key] = n
    }
    if (typeof p.adaptive !== 'number' || !Number.isFinite(p.adaptive) || Math.abs(p.adaptive) > 2) throw new Error('This save has invalid difficulty.')
    player.adaptive = p.adaptive
    if (!Array.isArray(p.owned) || p.owned.some(id => typeof id !== 'string' || !safeIds.has(id))) throw new Error('This save has unknown clothes.')
    player.owned = [...new Set([...player.owned, ...p.owned as string[]])]
    if (!Array.isArray(p.unlocked) || p.unlocked.some(id => !['wardrobe', 'hair', 'makeup'].includes(String(id)))) throw new Error('This save has unknown studios.')
    player.unlocked = [...new Set(p.unlocked)] as Studio[]
    for (const key of ['dress', 'hair', 'hairColour', 'makeup'] as const) {
      const id = p[key], category = key === 'hairColour' ? 'colour' : key
      if (typeof id !== 'string' || !player.owned.includes(`${category}:${id}`)) throw new Error('This save has an outfit you do not own.')
      player[key] = id
    }
    if (!Array.isArray(p.credited) || p.credited.length > 5000 || p.credited.some(id => typeof id !== 'string' || id.length > 80)) throw new Error('This save has invalid question receipts.')
    player.credited = [...new Set(p.credited)] as string[]
    player.lastMiss = typeof p.lastMiss === 'string' ? p.lastMiss.slice(0, 80) : ''
    player.lastShowCorrect = typeof p.lastShowCorrect === 'number' && Number.isSafeInteger(p.lastShowCorrect) ? Math.min(player.correct, Math.max(-1, p.lastShowCorrect)) : -1
    player.completed = p.completed === true && player.level === 50 && player.levelCorrect === 3
    return player
  })
  return { players, active: 'active' in data && data.active === 1 ? 1 : 0 }
}
