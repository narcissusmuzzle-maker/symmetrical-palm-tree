/**
 * Логика приложения «Задачи 2» для часов (чистый JS без обращений к API часов — проверяется тестами в Node, tests/tasks.test.mjs).
 *
 * Что здесь:
 *  - cleanTasks    — привести список, пришедший с телефона, к виду, с которым работает экран;
 *  - wrapText      — разбить текст на одну или две строки (то, что не поместилось во вторую строку, отрезается без «…»);
 *  - visibleTasks  — первые шесть задач очереди: это весь экран, прокрутки нет;
 *  - завершения    — очередь «задача выполнена на часах, телефон ещё не подтвердил» (пересылается, пока телефон не подтвердит).
 */
import * as lay from './layout.js'

export const MAX_TASKS = 40        // сколько задач храним (телефон тоже столько отдаёт)
export const MAX_PEND = 200        // сколько неподтверждённых завершений храним

// эмодзи вкладок в порядке картинок e0..e12: 🏠 🍀 🔍 📖 🧬 💀 🤿 🎨 🩸 🎵 🎞 🧭 🤖 (🎞️ без селектора варианта: он отбрасывается при сравнении)
export const EMOJI = ['\u{1F3E0}', '\u{1F340}', '\u{1F50D}', '\u{1F4D6}', '\u{1F9EC}', '\u{1F480}',
  '\u{1F93F}', '\u{1F3A8}', '\u{1FA78}', '\u{1F3B5}', '\u{1F39E}', '\u{1F9ED}', '\u{1F916}']

/** Номер картинки эмодзи (0..8) или -1, если такой картинки нет (вкладка с другим эмодзи — на часах место остаётся пустым). */
export function emojiIndex(e) {
  const s = String(e == null ? '' : e).replace(/\uFE0F/g, '')
  return EMOJI.indexOf(s)
}

/** Уровень цветного квадрата: 0 зелёный, 1 жёлтый, 2 красный. */
function level(v) {
  const n = Math.round(+v)
  return n >= 0 && n <= 2 ? n : 0
}

/** Текст задачи: переводы строк и табы — пробелы, пробелы по краям убираются, регистр и остальные пробелы как есть. */
export function normText(s) {
  return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/\uFE0F/g, '').replace(/^ +| +$/g, '')
}

/**
 * Список с телефона → список экрана. Телефон присылает [{ i: id, e: эмодзи вкладки, x: текст, c: [важность, сложность, срочность] }, ...];
 * c — по порядку квадратиков на телефоне слева направо; части полоски идут в том же порядке слева направо.
 */
export function cleanTasks(raw) {
  const out = []
  if (!Array.isArray(raw)) return out
  for (let k = 0; k < raw.length && out.length < MAX_TASKS; k++) {
    const r = raw[k]
    if (!r || r.i === undefined || r.i === null || r.i === '') continue
    const c = Array.isArray(r.c) ? r.c : []
    // e: с телефона приходит сам эмодзи (строка), из хранилища — уже номер картинки
    const e = typeof r.e === 'number' ? (r.e >= 0 && r.e < EMOJI.length ? Math.round(r.e) : -1) : emojiIndex(r.e)
    out.push({ i: String(r.i), e: e, x: normText(r.x), c: [level(c[0]), level(c[1]), level(c[2])] })
  }
  return out
}

/** Одинаковые ли списки (чтобы не перерисовывать экран зря). */
export function sameTasks(a, b) {
  if (a.length !== b.length) return false
  for (let k = 0; k < a.length; k++) {
    const x = a[k], y = b[k]
    if (x.i !== y.i || x.e !== y.e || x.x !== y.x || x.c[0] !== y.c[0] || x.c[1] !== y.c[1] || x.c[2] !== y.c[2]) return false
  }
  return true
}

// ---------------------------------------------------------------------------------------------------------------------
// Текст: одна или две строки
// ---------------------------------------------------------------------------------------------------------------------

/** Сколько первых знаков (кодовых точек) массива chars помещается в maxW; не меньше одного, чтобы всегда двигаться вперёд. */
function fitCount(chars, maxW, measure) {
  let lo = 0, hi = chars.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (measure(chars.slice(0, mid).join('')) <= maxW) lo = mid
    else hi = mid - 1
  }
  return Math.max(1, lo)
}

/**
 * Разбить текст на строки шириной не более maxW (measure(строка) — ширина строки в px).
 * Первая строка — обычный перенос по словам (слово длиннее строки — по знакам). Вторая строка заполняется знаками, сколько их помещается,
 * хоть посреди слова; то, что не поместилось, обрывается без «…». Больше двух строк не бывает.
 * Возвращает массив из одной или двух строк (для пустого текста — одна пустая).
 */
export function wrapText(text, maxW, measure) {
  const s = normText(text)
  if (!s || measure(s) <= maxW) return [s]
  const chars = Array.from(s)
  const n1 = fitCount(chars, maxW, measure)
  let cut = n1
  if (n1 < chars.length) {
    const sp = chars.lastIndexOf(' ', n1)    // пробел, на котором строку можно закончить (в том числе сразу за последним поместившимся знаком)
    if (sp > 0) cut = sp
  }
  const first = chars.slice(0, cut).join('').replace(/ +$/, '')
  const rest = chars.slice(cut)
  while (rest.length && rest[0] === ' ') rest.shift()
  if (!rest.length) return [first]
  const n2 = fitCount(rest, maxW, measure)
  return [first, rest.slice(0, n2).join('').replace(/ +$/, '')]
}

// ---------------------------------------------------------------------------------------------------------------------
// Что на экране
// ---------------------------------------------------------------------------------------------------------------------

/** Задачи на экране: первые lay.ROWS (шесть) задач очереди. Прокрутки нет — остальные не показываются, пока эти не выполнены. */
export function visibleTasks(list) { return list.slice(0, lay.ROWS) }

// ---------------------------------------------------------------------------------------------------------------------
// Завершённые на часах задачи, о которых телефон ещё не знает
// ---------------------------------------------------------------------------------------------------------------------

export function newState() { return { tasks: [], pend: [], seq: 0 } }

/** Состояние из хранилища; мусор — пустое состояние. */
export function restore(raw) {
  const st = newState()
  try {
    const o = JSON.parse(raw)
    if (!o) return st
    st.tasks = cleanTasks(o.tasks)
    st.seq = Math.max(0, Math.round(+o.seq) || 0)
    if (Array.isArray(o.pend)) {
      for (let k = 0; k < o.pend.length && st.pend.length < MAX_PEND; k++) {
        const p = o.pend[k]
        if (p && p.id && p.tid !== undefined) st.pend.push({ id: String(p.id), tid: String(p.tid), ts: +p.ts || 0, tried: +p.tried || 0 })
      }
    }
  } catch (e) { /* пусто */ }
  return st
}

export function serialize(st) {
  return JSON.stringify({ tasks: st.tasks, pend: st.pend, seq: st.seq })
}

/** Задачи, которые показываем: без тех, что уже выполнены на часах (даже если телефон ещё не подтвердил и прислал их снова). */
export function shownTasks(st) {
  if (!st.pend.length) return st.tasks
  const gone = {}
  for (let k = 0; k < st.pend.length; k++) gone[st.pend[k].tid] = true
  return st.tasks.filter((t) => !gone[t.i])
}

/** Задача выполнена на часах: убирается из показа (место занимает следующая задача очереди), событие встаёт в очередь отправки. Возвращает id события или '' (такой задачи нет). */
export function complete(st, taskId, now) {
  const tid = String(taskId)
  for (let k = 0; k < st.pend.length; k++) if (st.pend[k].tid === tid) return ''   // уже выполнена, ждёт подтверждения
  let found = false
  for (let k = 0; k < st.tasks.length; k++) if (st.tasks[k].i === tid) { found = true; break }
  if (!found) return ''
  st.seq++
  const id = 'tk' + Math.round(now).toString(36) + '-' + st.seq.toString(36)
  st.pend.push({ id: id, tid: tid, ts: Math.round(now), tried: 0 })
  while (st.pend.length > MAX_PEND) st.pend.shift()
  return id
}

/** Новый список с телефона. Возвращает true, если экран нужно перерисовать. */
export function applyTasks(st, list) {
  const before = shownTasks(st)
  st.tasks = list
  return !sameTasks(before, shownTasks(st))
}

/** Телефон подтвердил завершение: событие больше не отправляем, а задача (если телефон её уже убрал из списка) уходит и из кэша. */
export function ack(st, id) {
  for (let k = 0; k < st.pend.length; k++) {
    if (st.pend[k].id === id) {
      const tid = st.pend[k].tid
      st.pend.splice(k, 1)
      st.tasks = st.tasks.filter((t) => t.i !== tid)
      return true
    }
  }
  return false
}

/** Какие события пора (повторно) отправить: ещё не пробовали или прошло gap миллисекунд с прошлой попытки. По порядку завершения. */
export function due(st, now, gap) {
  const out = []
  for (let k = 0; k < st.pend.length; k++) {
    const p = st.pend[k]
    if (!p.tried || now - p.tried >= gap) out.push(p)
  }
  return out
}
