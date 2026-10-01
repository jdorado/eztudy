import assert from 'node:assert/strict'
import test from 'node:test'
import { answerQuestion, buyItem, decodeSave, difficulty, dresses, enterParty, enterShow, makeQuestion, newPlayer, topics, unlockStudio } from '../src/games/makeover/game.ts'

test('a question pays once, mistakes preserve money, and studios and purchases charge once', () => {
  let p = newPlayer('Test', 'year1')
  const q = makeQuestion(p, 'addition')
  const wrong = answerQuestion(p, q, q.options.find(o => o !== q.answer)!).player
  assert.equal(wrong.coins, 0)
  assert.equal(wrong.correct, 0)
  p = answerQuestion(wrong, q, q.answer).player
  assert.equal(p.coins, 1000)
  assert.equal(answerQuestion(p, q, q.answer).player, p)
  p = unlockStudio(p, 'wardrobe')
  assert.equal(p.coins, 0)
  assert.equal(unlockStudio(p, 'wardrobe'), p)
  assert.equal(buyItem(p, 'dress', '2-0'), p)
  p = { ...p, coins: 8000 }
  p = buyItem(p, 'dress', '2-0')
  assert.equal(p.coins, 8000 - dresses.find(d => d.id === '2-0')!.price)
  const coins = p.coins
  p = buyItem(p, 'dress', '0-0')
  p = buyItem(p, 'dress', '2-0')
  assert.equal(p.coins, coins)
})

test('150 correct answers finish all 50 levels and one player cannot change another', () => {
  let p = newPlayer('First', 'year1')
  const other = newPlayer('Second', 'year3'), untouched = structuredClone(other)
  for (let i = 0; i < 150; i++) { const q = makeQuestion(p, 'addition'); p = answerQuestion(p, q, q.answer).player }
  assert.equal(p.level, 50); assert.equal(p.levelCorrect, 3); assert.equal(p.completed, true)
  assert.equal(p.correct, 150); assert.equal(p.coins, 150000)
  assert.deepEqual(other, untouched)
  assert.ok(difficulty(newPlayer('Older', 'year3')) > difficulty(newPlayer('Younger', 'year1')))
})

test('shows require a fresh answer and three consecutive wins earn one consumable invitation', () => {
  let p = { ...newPlayer('Test', 'year3'), dress: '2-0', hair: 'bun', hairColour: 'honey', makeup: 'sparkle', streak: 5 }
  assert.equal(enterShow(p).result, null)
  for (let i = 1; i <= 3; i++) {
    p = { ...p, correct: i }
    const show = enterShow(p)
    assert.equal(show.result?.won, true)
    p = show.player
    assert.equal(enterShow(p).player, p)
  }
  assert.equal(p.partyTickets, 1); assert.equal(p.wins, 3); assert.equal(p.coins, 6000)
  p = enterParty(p); assert.equal(p.partyTickets, 0); assert.equal(p.parties, 1)
  assert.equal(enterParty(p), p)
})

test('save files round-trip both players and reject invalid progress and unknown styles', () => {
  const players = [newPlayer('First', 'year1'), newPlayer('Second', 'year3')]
  const encode = () => JSON.stringify({ version: 1, players, active: 1 })
  assert.deepEqual(decodeSave(encode()), { players, active: 1 })
  players[0].coins = -1; assert.throws(() => decodeSave(encode())); players[0].coins = 0
  players[0].dress = 'missing'; assert.throws(() => decodeSave(encode()))
  assert.throws(() => decodeSave('{"version":3}'))
})

test('every topic and difficulty produces four distinct choices with exactly one correct answer', () => {
  let seed = 123456
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  for (const track of ['year1', 'year3'] as const) for (const level of [1, 15, 30, 50]) for (const topic of topics) for (let i = 0; i < 80; i++) {
    const q = makeQuestion({ ...newPlayer('Test', track), level, adaptive: i % 5 - 2 }, topic.id, random)
    assert.equal(q.options.length, 4, `${topic.id}: ${q.prompt}: ${q.options}`)
    assert.equal(new Set(q.options).size, 4)
    assert.equal(q.options.filter(o => o === q.answer).length, 1)
    assert.ok(q.hint && q.explanation)
    const arithmetic = q.prompt.match(/^What is (\d+) ([+−×]) (\d+)\?$/)
    if (arithmetic) { const a = Number(arithmetic[1]), b = Number(arithmetic[3]); assert.equal(Number(q.answer), arithmetic[2] === '+' ? a + b : arithmetic[2] === '−' ? a - b : a * b) }
    if (q.visual?.kind === 'clock') assert.equal(q.answer, `${q.visual.hour}:${String(q.visual.minute).padStart(2, '0')}`)
  }
})
