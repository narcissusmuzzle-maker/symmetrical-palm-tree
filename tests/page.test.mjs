// Прогон настоящего page/index.js на заглушках API часов: экран, долгое нажатие, отправка на телефон.
// Запуск: node --import ./tests/register.mjs tests/page.test.mjs   (из папки приложения)
import assert from 'node:assert'
import * as lay from '../shared/layout.js'

let n = 0
async function t(name, f) { await f(); n++; console.log('ok  ' + name) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const alive = () => globalThis.__W.filter((w) => w.alive)
const buttons = () => alive().filter((w) => w.type === 'BUTTON')
const texts = () => alive().filter((w) => w.type === 'TEXT').map((w) => w.props.text)
const DY = -31
const DX = -23          // горизонтальный сдвиг: 18, как в U613 Stat, и ещё 5 влево

// телефон: tab — открытая вкладка очереди; у фильтров 0…5 свои списки (filters), tab = -1 — общий список всей очереди q
const phone = { q: [], got: [], online: true, tab: -1, filters: {}, view() { return this.tab < 0 ? this.q : (this.filters[this.tab] || []) } }
function task(i, e, x, c) { return { i: i, e: e, x: x, c: c } }
phone.q = [
  task('a', '🏠', 'найти электрика', [0, 0, 2]),
  task('b', '🧬', 'индекс 100 элементов', [2, 1, 0]),
  task('c', '🩸', 'запись текучки', [2, 0, 0]),
  task('d', '🏠', 'очень длинное название задачи на две строки', [0, 0, 1]),
  task('e', '🏠', 'уборка в коридоре', [0, 0, 2]),
  task('f', '📖', 'а'.repeat(90), [2, 1, 0]),
  task('g', '🍀', 'седьмая', [1, 1, 1]),
  task('h', '📦', 'восьмая', [0, 1, 2]),
  task('i', '🤿', 'девятая', [2, 2, 2]),
  task('j', '🎨', 'десятая', [2, 2, 2]),
  task('k', '💀', 'одиннадцатая', [0, 2, 0]),
  task('l', '🔍', 'двенадцатая', [0, 0, 0])
]
globalThis.__REQ = (p) => {
  phone.got.push(p)
  if (!phone.online) return Promise.reject(new Error('offline'))
  if (p.t === 'tasks') return Promise.resolve({ ok: true, reply: { t: 'tasks', q: phone.view(), n: phone.tab } })
  if (p.t === 'qtab') {
    phone.tab = p.n
    return Promise.resolve({ ok: true, reply: { t: 'tasks', q: phone.view(), n: phone.tab } })
  }
  if (p.t === 'tdone') {
    phone.q = phone.q.filter((x) => x.i !== p.tid)
    for (const k of Object.keys(phone.filters)) if (phone.filters[k]) phone.filters[k] = phone.filters[k].filter((x) => x.i !== p.tid)
    return Promise.resolve({ ok: true, reply: { t: 'ack', id: p.id, q: phone.view() } })
  }
  return Promise.resolve({ ok: false })
}
globalThis.Page = (o) => { globalThis.__PAGE = o }
await import('../page/index.js')
const page = globalThis.__PAGE

await t('запуск: полоска скрыта, прокрутка заблокирована, шесть строк без серого фона, белые линии между строками', async () => {
  page.onInit()
  page.build()
  await sleep(20)
  assert.equal(globalThis.__STATUSBAR, false)
  assert.equal(globalThis.__SCROLLLOCK, true)
  assert.equal(globalThis.__RELAUNCH, true)
  assert.equal(buttons().length, 12)                                  // только шесть первых задач из двенадцати: шесть основных кнопок и шесть областей сегментов
  assert.equal(alive().filter((w) => w.type === 'FILL_RECT' && w.props.color === 0x1c1c1c).length, 0)   // серого фона нет
  const rows = [0, 1, 2, 3, 4, 5].map(lay.rowRect)
  buttons().slice(0, 6).forEach((b, i) => {                           // основная часть строки: эмодзи и текст, до полоски
    assert.equal(b.props.x, 26 + DX); assert.equal(b.props.w, 311)
    assert.equal(b.props.y, rows[i].y + DY); assert.equal(b.props.h, rows[i].h)
    assert.equal(b.props.normal_src, 'tz' + rows[i].h + '.png')
  })
  buttons().slice(6).forEach((b, i) => {                              // область цветных сегментов
    assert.equal(b.props.x, 337 + DX); assert.equal(b.props.w, 69)
    assert.equal(b.props.y, rows[i].y + DY); assert.equal(b.props.h, rows[i].h)
    assert.equal(b.props.normal_src, 'sz' + rows[i].h + '.png')
  })
  assert.equal(buttons()[0].props.y, 38 + DY)
  const last = buttons()[5]
  assert.equal(last.props.y - DY + last.props.h + 4, 474)             // нижняя граница списка
  const divs = alive().filter((w) => w.type === 'FILL_RECT' && w.props.color === 0xffffff)
  assert.equal(divs.length, 7)                                        // над верхней строкой, между шестью строками пять, под нижней
  const exp = [lay.topDividerRect(true), ...[0, 1, 2, 3, 4].map((i) => lay.dividerRect(i, false)), lay.dividerRect(5, true)]
  divs.forEach((d, i) => {
    const r = exp[i]
    const wide = i === 0 || i === 6                                   // самая верхняя и самая нижняя — всегда на всю ширину списка
    assert.deepEqual([d.props.x, d.props.y, d.props.w, d.props.h], [r.x + DX, r.y + DY, wide ? 380 : 311, 2])   // остальные до полоски (x = 26…337), на полоску не заходят
    if (!wide) assert.ok(d.props.x + d.props.w <= 337 + DX)
  })
  // верхняя линия: 1 px чёрного до первой строки (так же, как между строками); нижняя: 1 px от последней строки и до границы списка
  assert.equal(divs[0].props.y - DY, 35); assert.equal(divs[0].props.y + 2 - DY + 1, 38 + 0)
  const lastRow = lay.rowRect(5)
  assert.equal(divs[6].props.y - DY - (lastRow.y + lastRow.h), 1)
  assert.ok(divs[6].props.y - DY + 2 <= 474)
})

await t('полоска: части шириной 21 (на 10% уже), на всю высоту строки; цвета слева направо — важность, сложность, срочность', async () => {
  const strips = alive().filter((w) => w.type === 'FILL_RECT' && w.props.w === 21)
  assert.equal(strips.length, 18)
  const rows = [0, 1, 2, 3, 4, 5].map(lay.rowRect)
  for (let i = 0; i < 6; i++) {
    const row = strips.slice(i * 3, i * 3 + 3)
    assert.deepEqual(row.map((w) => w.props.x), [337 + DX, 361 + DX, 385 + DX])
    assert.ok(row.every((w) => w.props.h === rows[i].h && w.props.y === rows[i].y + DY))
  }
  assert.deepEqual(strips.slice(0, 3).map((w) => w.props.color), [0x3fb950, 0x3fb950, 0xf85149])   // a: [0,0,2]
  assert.deepEqual(strips.slice(3, 6).map((w) => w.props.color), [0xf85149, 0xe3b341, 0x3fb950])   // b: [2,1,0]
})

await t('текст: короткий — одна строка по центру строки по вертикали, длинный — две строки на всю высоту, без «…»', async () => {
  const tx = alive().filter((w) => w.type === 'TEXT')
  const one = tx.find((w) => w.props.text === 'найти электрика')       // 15 знаков помещаются в строку (255 px = 18 знаков)
  const r0 = lay.lineRect(0, 0, 1)
  assert.deepEqual([one.props.x, one.props.y], [lay.textX() + DX, r0.y + DY])
  assert.equal(lay.textX(), 72)
  const row0 = lay.rowRect(0)
  assert.ok(Math.abs((one.props.y - DY + 17) - (row0.y + row0.h / 2)) <= 0.5)   // середина строки текста = середина строки задачи
  // задача d: две строки
  const two = tx.filter((w) => w.props.y - DY >= lay.rowRect(3).y && w.props.y - DY < lay.rowRect(3).y + lay.rowRect(3).h)
  assert.equal(two.length, 2)
  assert.equal(two[1].props.y - two[0].props.y, 34)
  assert.deepEqual(two.map((w) => w.props.text), ['очень длинное', 'название задачи на'])   // первая — по словам, вторая — по знакам
  // задача f: 90 одинаковых знаков — по 18 в обе строки, остаток обрезан
  const f = tx.filter((w) => w.props.text.startsWith('а'))
  assert.deepEqual(f.map((w) => w.props.text.length), [18, 18])
  const all = tx.map((w) => w.props.text)
  assert.ok(all.every((x) => !x.includes('…') && !x.includes('...')))
  assert.ok(all.every((x) => x.length * 14 <= 257))
  assert.equal(all.includes('седьмая'), false)                        // седьмой задачи на экране нет
})

await t('эмодзи: у левого края списка без отступа, по центру строки по вертикали', async () => {
  const e = alive().filter((w) => w.type === 'IMG')
  assert.equal(e.length, 6)
  assert.equal(e[0].props.src, 'e0.png')       // 🏠
  assert.equal(e[1].props.src, 'e4.png')       // 🧬
  e.forEach((w, i) => {
    const r = lay.rowRect(i)
    assert.equal(w.props.x, 26 + DX)
    assert.ok(Math.abs((w.props.y - DY + 19) - (r.y + r.h / 2)) <= 0.5)
  })
})

await t('жесты: прокрутки нет — свайпы вверх/вниз/влево ничего не делают; вправо — выход из приложения', async () => {
  const g = globalThis.__GESTURE
  const first = () => alive().filter((w) => w.type === 'TEXT')[0].props.text
  const count = () => alive().length
  const before = count()
  assert.equal(g('R'), false)                     // выход
  assert.equal(g('L'), true)
  assert.equal(g('U'), true)
  assert.equal(g('D'), true)
  assert.equal(first(), 'найти электрика')
  assert.equal(count(), before)                   // экран не перерисовывался
  assert.equal(texts().includes('седьмая'), false)
  page.onDestroy()
})

await t('долгое нажатие: задача пропадает, на телефон уходит tdone, после подтверждения список обновляется', async () => {
  globalThis.__W.length = 0
  phone.got.length = 0
  page.build()
  await sleep(20)
  const before = globalThis.__VIB || 0
  const nBtn = buttons().length
  buttons()[1].props.longpress_func()             // вторая карточка — задача b
  await sleep(120)
  assert.equal((globalThis.__VIB || 0), before + 1)
  const td = phone.got.filter((p) => p.t === 'tdone')
  assert.equal(td.length, 1)
  assert.equal(td[0].tid, 'b')
  assert.equal(phone.q.length, 11)
  assert.equal(buttons().length, nBtn)            // на экране снова шесть задач: освободившееся место заняла следующая
  assert.ok(texts().includes('седьмая'))
  assert.equal(texts().includes('индекс 100 элементов'), false)
  page.onDestroy()
})

await t('нет связи: выполнение запоминается и пересылается, пока телефон не подтвердит', async () => {
  phone.online = false
  globalThis.__W.length = 0
  phone.got.length = 0
  page.build()
  await sleep(20)
  buttons()[0].props.longpress_func()             // задача a
  await sleep(120)
  assert.equal(texts().includes('найти электрика'), false)
  assert.equal(JSON.parse(globalThis.__LS.st).pend.length, 1)
  page.onDestroy()
  phone.online = true
  globalThis.__W.length = 0
  phone.got.length = 0
  page.build()
  await sleep(50)
  assert.equal(phone.got.filter((p) => p.t === 'tdone').length, 1)
  assert.equal(phone.q.find((x) => x.i === 'a'), undefined)
  assert.equal(JSON.parse(globalThis.__LS.st).pend.length, 0)
  page.onDestroy()
})

await t('пустая очередь: надпись', async () => {
  phone.q = []
  globalThis.__W.length = 0
  page.build()
  await sleep(30)
  assert.equal(buttons().length, 12)                                  // кнопки на всех строках, чтобы нажатие переключало вкладки и здесь
  assert.deepEqual(texts(), ['Очередь задач пуста'])
  const divs = alive().filter((w) => w.type === 'FILL_RECT' && w.props.color === 0xffffff)
  assert.equal(divs.length, 7)                                        // белые линии на месте, хотя задач нет (в том числе сверху и снизу)
  divs.forEach((d) => assert.deepEqual([d.props.x, d.props.w], [26 + DX, 380]))   // у пустых строк — на всю ширину
  const msg = alive().find((w) => w.type === 'TEXT')
  const r0 = lay.rowRect(0)
  assert.deepEqual([msg.props.y, msg.props.h], [r0.y + DY, r0.h])    // надпись внутри первой строки
  // ни одна линия не пересекает надпись
  assert.ok(divs.every((d) => d.props.y >= msg.props.y + msg.props.h || d.props.y + d.props.h <= msg.props.y))
  page.onDestroy()
})

await t('обычное нажатие: основная часть строки i — фильтр i, область сегментов (любая строка) — общий список; работает и на пустых строках', async () => {
  phone.tab = -1
  phone.q = [task('a', '🏠', 'первая общая', [0, 0, 0]), task('b', '🧬', 'вторая общая', [1, 1, 1]), task('c', '🩸', 'третья общая', [2, 2, 2])]
  phone.filters = {
    1: [task('c', '🩸', 'третья общая', [2, 2, 2]), task('a', '🏠', 'первая общая', [0, 0, 0])],   // свой порядок фильтра
    2: [],
    3: [task('b', '🧬', 'вторая общая', [1, 1, 1])],
    0: [task('a', '🏠', 'первая общая', [0, 0, 0])]                  // первая строка теперь открывает первый фильтр
  }
  globalThis.__W.length = 0
  phone.got.length = 0
  page.build()
  await sleep(30)
  assert.deepEqual(texts(), ['первая общая', 'вторая общая', 'третья общая'])
  assert.equal(buttons().length, 12)
  buttons()[0].props.click_func()                                    // первая строка — первый фильтр (а не общий список)
  await sleep(60)
  assert.equal(phone.tab, 0)
  assert.deepEqual(texts(), ['первая общая'])
  buttons()[1].props.click_func()                                    // вторая строка — второй фильтр
  await sleep(60)
  assert.deepEqual(phone.got.filter((p) => p.t === 'qtab').map((p) => p.n), [0, 1])
  assert.equal(phone.tab, 1)
  assert.deepEqual(texts(), ['третья общая', 'первая общая'])         // порядок фильтра, а не общий
  assert.equal(buttons().length, 12)
  buttons()[5].props.click_func()                                    // шестая строка (пустая) — шестой фильтр
  await sleep(60)
  assert.equal(phone.tab, 5)
  assert.deepEqual(texts(), ['Очередь задач пуста'])
  assert.equal(alive().filter((w) => w.type === 'FILL_RECT' && w.props.color === 0xffffff).length, 7)
  buttons()[3].props.click_func()                                    // четвёртая строка (пустая в этом списке) — четвёртый фильтр
  await sleep(60)
  assert.equal(phone.tab, 3)
  assert.deepEqual(texts(), ['вторая общая'])
  buttons()[6 + 2].props.click_func()                                // область сегментов (третья строка) — общий список, фильтры сняты
  await sleep(60)
  assert.equal(phone.tab, -1)
  assert.deepEqual(phone.got.filter((p) => p.t === 'qtab').map((p) => p.n).slice(-1), [-1])
  assert.deepEqual(texts(), ['первая общая', 'вторая общая', 'третья общая'])
  buttons()[1].props.click_func(); await sleep(60)
  buttons()[6 + 5].props.click_func()                                // область сегментов пустой шестой строки — то же самое
  await sleep(60)
  assert.equal(phone.tab, -1)
  assert.deepEqual(texts(), ['первая общая', 'вторая общая', 'третья общая'])
  // долгое нажатие на задачу в фильтре завершает её, и список остаётся этой вкладки
  buttons()[1].props.click_func()
  await sleep(60)
  phone.got.length = 0
  buttons()[0].props.longpress_func()
  await sleep(120)
  assert.equal(phone.got.filter((p) => p.t === 'tdone')[0].tid, 'c')
  assert.equal(phone.tab, 1)
  assert.deepEqual(texts(), ['первая общая'])
  // долгое нажатие на область сегментов тоже завершает задачу (обычное там — общий список)
  phone.got.length = 0
  buttons()[6].props.longpress_func()
  await sleep(120)
  assert.equal(phone.got.filter((p) => p.t === 'tdone')[0].tid, 'a')
  assert.equal(phone.tab, 1)
  // нет связи: вкладка не меняется
  phone.online = false
  const before = texts().join('|')
  buttons()[2].props.click_func()
  buttons()[6 + 1].props.click_func()
  await sleep(60)
  assert.equal(texts().join('|'), before)
  phone.online = true
  page.onDestroy()
})

await t('линии: самая верхняя и самая нижняя всегда на всю ширину; между двумя задачами короткие (до полоски, чёрный просвет), у пустой строки — на всю ширину', async () => {
  phone.tab = -1
  phone.q = [task('a', '🏠', 'раз', [0, 0, 0]), task('b', '🏠', 'два', [0, 0, 0]), task('c', '🏠', 'три', [0, 0, 0])]
  phone.filters = {}
  globalThis.__W.length = 0
  page.build()
  await sleep(30)
  const divs = alive().filter((w) => w.type === 'FILL_RECT' && w.props.color === 0xffffff)
  assert.equal(divs.length, 7)
  // самая верхняя (рядом задача) — на всю ширину; между строками 0-1 и 1-2 — короткие; ниже (2-3, 3-4, 4-5) и под нижней — на всю ширину
  assert.deepEqual(divs.map((d) => d.props.w), [380, 311, 311, 380, 380, 380, 380])
  assert.equal(divs[0].props.y, lay.topDividerRect(true).y + DY)
  assert.ok(divs.slice(1, 6).every((d, i) => d.props.y === lay.dividerRect(i, false).y + DY))
  assert.equal(divs[6].props.y, lay.dividerRect(5, true).y + DY)
  page.onDestroy()
})

await t('быстрые нажатия: ответ на более раннее не перебивает последнее', async () => {
  phone.tab = -1
  phone.q = [task('a', '🏠', 'общая', [0, 0, 0])]
  phone.filters = { 1: [task('x', '🏠', 'первый фильтр', [0, 0, 0])], 2: [task('y', '🏠', 'второй фильтр', [0, 0, 0])] }
  globalThis.__W.length = 0
  page.build()
  await sleep(30)
  const old = globalThis.__REQ
  const slow = []
  globalThis.__REQ = (p) => {
    if (p.t === 'qtab' && p.n === 1) { phone.tab = 1; return new Promise((res) => slow.push(() => res({ ok: true, reply: { t: 'tasks', q: phone.filters[1], n: 1 } }))) }
    return old(p)
  }
  buttons()[1].props.click_func()                                    // вкладка 1: ответ задержан
  buttons()[2].props.click_func()                                    // вкладка 2: ответ сразу
  await sleep(40)
  slow.forEach((f) => f())                                           // запоздавший ответ на вкладку 1
  await sleep(40)
  assert.deepEqual(texts(), ['второй фильтр'])
  globalThis.__REQ = old
  page.onDestroy()
})

console.log('\nвсего: ' + n)
process.exit(0)
