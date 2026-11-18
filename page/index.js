/**
 * «Задачи 2» (🧩) для Amazfit Bip Max: очередь задач из приложения LuvU613 (ОЧЕРЕДЬ -> ЗАДАЧИ) на часах, версия со строками.
 *
 *  - Один экран, прокрутки нет: шесть равных строк, в них шесть первых задач очереди (порядок = порядок очереди на телефоне).
 *    Строка: слева у самого края эмодзи вкладки (всегда по центру строки по вертикали), затем обычный горизонтальный текст,
 *    справа вплотную цветная полоска из трёх узких частей (цвета и порядок слева направо — как у квадратиков на телефоне).
 *    Серого фона нет; между строками — белая линия, которая у цветной полоски кончается (там просвет чёрный); самая верхняя и самая нижняя — всегда на всю ширину. Размеры — в shared/layout.js.
 *  - Текст: одна строка стоит по центру строки по вертикали, две занимают её целиком. Первая строка переносится по словам, вторая
 *    заполняется знаками, сколько поместится, а остаток обрывается (без «…»). Больше двух строк не бывает.
 *  - Свайп вправо — обычный выход из приложения. Свайпы вверх, вниз и влево ничего не делают.
 *  - ОБЫЧНОЕ нажатие на основную часть строки i (эмодзи и текст, в том числе пустую) — фильтр i страницы ОЧЕРЕДЬ на телефоне: верхняя строка —
 *    первый фильтр, вторая — второй и так далее до шестого. Нажатие на область цветных сегментов (любая строка, в том числе пустая) — общий
 *    список всей очереди, на телефоне все фильтры при этом снимаются. Телефон запоминает вкладку и присылает задачи этой вкладки в том порядке,
 *    в каком они стоят в ней на телефоне (событие «qtab»). Белые линии (над верхней строкой, между строками и под нижней) видны всегда.
 *  - ДОЛГОЕ нажатие на задачу — задача выполнена: пропадает с экрана сразу (место занимает следующая задача очереди), на телефон уходит
 *    событие «tdone» (пересылается, пока телефон не подтвердит; на телефоне задача становится выполненной, как при нажатии на цветные квадратики).
 *  - Какая вкладка сейчас открыта, знает телефон: список приходит именно этой вкладки (при открытии, после выполнения, после переключения).
 *  - Список приходит с телефона при каждом открытии приложения (оно открывается заново при включении экрана) и в ответ на каждое
 *    событие, которое отправили часы. Последний список запоминается, поэтому без связи на экране остаётся то, что было.
 *  - Системная полоска сверху скрыта (setStatusBarVisible), прокрутка страницы заблокирована (setScrollLock), а место полоски занято
 *    приложением: весь экран сдвинут вверх на LIFT px — точно так же, как в приложении «Таймер» (см. DOWN ниже);
 *    по горизонтали всё сдвинуто влево на 23 px (SHIFT_X): 18 как в U613 Stat плюс ещё 5.
 *
 * Текст рисуют сами часы (системным шрифтом), а где переносить строку, считает страница: ширину строки узнаёт у часов (getTextLayout),
 * поэтому перенос и обрезка точно совпадают с тем, как строка будет нарисована. Часы не умеют менять содержимое готового виджета надёжно,
 * поэтому при любой смене экрана виджеты задач удаляются и создаются заново.
 */
import { BasePage } from '@zeppos/zml/base-page'
import { createWidget, deleteWidget, getTextLayout, widget, align, text_style, setStatusBarVisible } from '@zos/ui'
import { setScrollLock } from '@zos/page'
import { Vibrator } from '@zos/sensor'
import * as sensor from '@zos/sensor'
import { setWakeUpRelaunch } from '@zos/display'
import { LocalStorage } from '@zos/storage'
import * as inter from '@zos/interaction'
import * as lay from '../shared/layout'
import * as T from '../shared/tasks'

const SEND_GAP = 15000          // как часто повторять отправку неподтверждённого события, мс
const SYNC_RETRY = 15000        // пока список с телефона ни разу не пришёл — как часто повторять запрос, мс
const SWIPE_EXIT = true         // true — свайп вправо закрывает приложение (обычное поведение часов)
const VIBRATE = true            // короткая вибрация при выполнении задачи
const FIT_MARGIN = 2            // запас по ширине строки, px: чтобы последний знак не обрезался из-за округления

// Положение экрана по вертикали — то же число и тот же приём, что в приложении «Таймер» (page/index.js там).
// Система считает верхние 64 px полоской: если её просто скрыть, на её месте остаётся чёрная пустота, а низ страницы обрезается.
// Поэтому весь экран (514 px) рисуется со сдвигом вверх на LIFT, то есть в координатах страницы от y = -LIFT.
//
// ===== ВОТ ЭТО ЧИСЛО МЕНЯТЬ, ЧТОБЫ ДВИГАТЬ ВЕСЬ ЭКРАН ПО ВЕРТИКАЛИ =====
// DOWN — на сколько пикселей опустить весь экран от полностью поднятого положения. Допустимо от 0 до 64.
//   Сверху обрезано (первая карточка не видна целиком) — число БОЛЬШЕ, например 45.
//   Снизу обрезано (последняя карточка прижата к краю) — число МЕНЬШЕ, например 20. Больше ничего менять не надо.
const DOWN = 33
const LIFT = 64 - DOWN
const DY = -LIFT

// ===== СДВИГ ВСЕГО ЭКРАНА ПО ГОРИЗОНТАЛИ — то же число и тот же приём, что в U613 Stat (SHIFT_X там) =====
// Страница приложения на часах стоит правее центра экрана, поэтому всё рисуется со сдвигом влево: минус — влево, плюс — вправо, в пикселях.
//   Справа обрезано — число МЕНЬШЕ (например -27), слева обрезано — БОЛЬШЕ (например -19). Двигаются сразу все строки.
//   (В версии 1.0.1 было -18, как в U613 Stat; в 1.0.2 список сдвинут ещё на 5 px влево.)
const SHIFT_X = -23
const DX = SHIFT_X

// ---------------------------------------------------------------------------------------------------------------------

let ls = null
const mem = {}
const store = {
  getItem(k, d) {
    try { if (ls) { const v = ls.getItem(k, d); return v === undefined || v === null ? d : v } } catch (e) { fail('getItem ' + e) }
    return k in mem ? mem[k] : d
  },
  setItem(k, v) {
    mem[k] = v
    try { if (ls) ls.setItem(k, v) } catch (e) { fail('setItem ' + e) }
  }
}

// Ошибки показываем на экране (а не оставляем чёрный экран): без этого на часах их не увидеть
let failed = 0
function fail(msg) {
  failed++
  if (failed > 3) return
  try {
    createWidget(widget.FILL_RECT, { x: DX, y: DY, w: 432, h: 514, color: 0x300000 })
    createWidget(widget.TEXT, {
      x: DX + 12, y: DY + 12 + (failed - 1) * 150, w: 408, h: 140, color: 0xffffff, text_size: 22,
      align_h: align.LEFT, align_v: align.TOP, text_style: text_style.WRAP, text: 'Ошибка ' + failed + ': ' + String(msg).slice(0, 160)
    })
  } catch (e) { /* больше показать нечем */ }
}
function guard(name, f) {
  try { return f() } catch (e) { fail(name + ': ' + e); return undefined }
}

let ST = null            // состояние (хранится): задачи с телефона, сдвиг списка, неподтверждённые завершения
let me = null
let timer = null
let vib = null
let dyn = []             // виджеты задач на экране (удаляются и создаются заново при любой перерисовке)
let msgW = null          // надпись, когда задач нет
let inflight = false
let inflightAt = 0
let syncing = false
let syncAt = 0
let synced = false       // список с телефона уже приходил в этот раз
let linkFail = false     // последний запрос к телефону не удался
let tabSeq = 0           // номер последнего запроса вкладки: ответ на более ранний не применяется
const wrapCache = {}     // текст -> строки (одна или две)

function save() {
  try { store.setItem('st', T.serialize(ST)) } catch (e) { /* без сохранения продолжаем работать */ }
}

function vibrate(mode) {
  try {
    if (!vib) vib = new Vibrator()
    vib.start({ mode: mode })
  } catch (e) {
    try { vib.setMode({ mode: mode }); vib.start() } catch (e2) { /* нет вибромотора */ }
  }
}

function buzz() {
  if (!VIBRATE) return
  const m = sensor.VIBRATOR_SCENE_SHORT_LIGHT
  if (m === undefined) return
  vibrate(m)
}

/** Системная полоска сверху скрыта, прокрутка страницы заблокирована. */
function applyBar() {
  try { setStatusBarVisible(false) } catch (e) { /* не квадратный экран — полоски нет */ }
  try { setScrollLock({ lock: true }) } catch (e) { /* не критично */ }
}

// ---------------------------------------------------------------------------------------------------------------------
// Текст: ширина строки и перенос
// ---------------------------------------------------------------------------------------------------------------------

let estimate = false     // getTextLayout не работает — считаем ширину приблизительно
function measure(s) {
  if (!estimate) {
    try {
      const r = getTextLayout(s, { text_size: lay.TEXT_SIZE, text_width: 4000, wrapped: 0 })
      if (r && typeof r.width === 'number') return r.width
    } catch (e) { /* ниже */ }
    estimate = true
  }
  return s.length * lay.TEXT_SIZE * 0.56
}

/** Строки задачи (одна или две): считаются один раз на каждый текст. */
function linesOf(task) {
  let l = wrapCache[task.x]
  if (!l) {
    l = T.wrapText(task.x, lay.textWidth() - FIT_MARGIN, measure)
    wrapCache[task.x] = l
  }
  return l
}

// ---------------------------------------------------------------------------------------------------------------------
// Рисование
// ---------------------------------------------------------------------------------------------------------------------

function clearDyn() {
  for (let k = 0; k < dyn.length; k++) {
    try { deleteWidget(dyn[k]) } catch (e) { /* уже удалён */ }
  }
  dyn = []
  if (msgW) {
    try { deleteWidget(msgW) } catch (e) { /* уже удалён */ }
    msgW = null
  }
}

function rect(r, color) {
  dyn.push(createWidget(widget.FILL_RECT, { x: r.x + DX, y: r.y + DY, w: r.w, h: r.h, color: color }))
}

/** Одна строка задачи i: три части полоски на всю высоту, эмодзи по центру, одна или две строки текста по центру. Фона у строки нет. */
function drawRow(i, task, lines) {
  for (let s = 0; s < 3; s++) rect(lay.segRect(i, s), lay.segColor(task.c[s]))
  if (task.e >= 0) {
    const r = lay.emojiRect(i)
    dyn.push(createWidget(widget.IMG, { x: r.x + DX, y: r.y + DY, w: r.w, h: r.h, src: 'e' + task.e + '.png' }))
  }
  for (let k = 0; k < lines.length; k++) {
    if (!lines[k]) continue
    const r = lay.lineRect(i, k, lines.length)
    dyn.push(createWidget(widget.TEXT, {
      x: r.x + DX, y: r.y + DY, w: r.w, h: r.h, color: lay.TEXT_COLOR, text_size: lay.TEXT_SIZE,
      align_h: align.LEFT, align_v: align.CENTER_V, text: lines[k]
    }))
  }
}

/** Белая линия между строками i и i + 1: между двумя задачами — до цветной полоски (на полоску не заходит, там просвет чёрный), у пустой строки — на всю ширину. */
function drawDivider(i, full) {
  rect(lay.dividerRect(i, full), lay.DIV_COLOR)
}

/**
 * Две прозрачные кнопки на строку (создаются после всех строк, чтобы лежать выше): основная часть (эмодзи и текст) и область цветных сегментов.
 * Обычное нажатие: основная часть — фильтр с номером строки (pickTab(i)), область сегментов — общий список очереди (pickTab(-1), любая строка).
 * Долгое нажатие на любую из двух — задача выполнена.
 */
function drawButtons(i, task) {
  const id = task ? task.i : ''          // у пустой строки задачи нет: долгое нажатие ничего не делает, обычное всё равно переключает вкладку
  const lp = () => { if (id) guard('долгое', () => me.done(id)) }
  const m = lay.mainBtnRect(i)
  dyn.push(createWidget(widget.BUTTON, {
    x: m.x + DX, y: m.y + DY, w: m.w, h: m.h, text: '',
    normal_src: 'tz' + m.h + '.png', press_src: 'tp' + m.h + '.png',
    click_func: () => { guard('вкладка', () => me.pickTab(i)) },     // обычное нажатие на основную часть строки i = фильтр i на телефоне
    longpress_func: lp
  }))
}

function drawStripButton(i, task) {
  const id = task ? task.i : ''
  const s = lay.stripBtnRect(i)
  dyn.push(createWidget(widget.BUTTON, {
    x: s.x + DX, y: s.y + DY, w: s.w, h: s.h, text: '',
    normal_src: 'sz' + s.h + '.png', press_src: 'sp' + s.h + '.png',
    click_func: () => { guard('общий список', () => me.pickTab(-1)) },   // область цветных сегментов = общий список очереди
    longpress_func: () => { if (id) guard('долгое', () => me.done(id)) }
  }))
}

/** Надпись, когда задач нет: внутри первой строки (линии между строками остаются видны и через надпись не проходят). */
function showMessage(text) {
  const r = lay.rowRect(0)
  msgW = createWidget(widget.TEXT, {
    x: r.x + DX, y: r.y + DY, w: r.w, h: r.h, color: 0x8c8c8c, text_size: 30,
    align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.WRAP, text: text
  })
}

function redraw() {
  clearDyn()
  const list = T.visibleTasks(T.shownTasks(ST))
  for (let k = 0; k < list.length; k++) {
    guard('строка ' + k, () => drawRow(k, list[k], linesOf(list[k])))
  }
  // надпись — до кнопок, чтобы кнопки лежали выше неё и ловили нажатия
  if (!list.length) {
    if (synced) showMessage('Очередь задач пуста')
    else if (linkFail) showMessage('Нет связи с телефоном')
    else showMessage('Загрузка…')
  }
  // белые линии видны всегда, есть задачи или нет: над верхней строкой, между шестью строками (пять) и под нижней — всего семь.
  // Самая верхняя и самая нижняя всегда белые на всю ширину списка (рядом с задачей не обрываются у цветной полоски); остальные — как раньше
  guard('линия сверху', () => rect(lay.topDividerRect(true), lay.DIV_COLOR))
  for (let k = 0; k + 1 < lay.ROWS; k++) {
    guard('линия ' + k, () => drawDivider(k, !(list[k] && list[k + 1])))
  }
  guard('линия снизу', () => rect(lay.dividerRect(lay.ROWS - 1, true), lay.DIV_COLOR))
  // кнопки на всех шести строках, в том числе пустых: сначала основные части (0…5), затем области цветных сегментов (6…11)
  for (let k = 0; k < lay.ROWS; k++) {
    guard('кнопка ' + k, () => drawButtons(k, list[k]))
  }
  for (let k = 0; k < lay.ROWS; k++) {
    guard('кнопка сегментов ' + k, () => drawStripButton(k, list[k]))
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Жесты
// ---------------------------------------------------------------------------------------------------------------------

/** Свайпы. Возвращает true — «система, не обрабатывай». Вправо — обычный выход из приложения, остальные ничего не делают (прокрутки нет). */
function onSwipe(e) {
  if (e === inter.GESTURE_RIGHT) return !SWIPE_EXIT
  return true
}

function setupGestures() {
  try {
    inter.onGesture({
      callback: function (e) {
        const swipe = e === inter.GESTURE_RIGHT || e === inter.GESTURE_LEFT || e === inter.GESTURE_UP || e === inter.GESTURE_DOWN
        if (!swipe) return false
        return guard('жест', () => onSwipe(e))
      }
    })
  } catch (e) { /* без обработки жестов */ }
}

// ---------------------------------------------------------------------------------------------------------------------

/** Новый список с телефона (в ответе на запрос или на событие). */
function takeList(raw) {
  if (!Array.isArray(raw)) return
  const list = T.cleanTasks(raw)
  const changed = T.applyTasks(ST, list)
  save()
  if (changed) redraw()
}

Page(
  BasePage({
    onInit() {
      try { if (!ls) ls = new LocalStorage() } catch (e) { /* ошибка покажется в build */ }
      applyBar()   // полоска скрывается до построения экрана, чтобы страница сразу получила весь экран
    },

    build() {
      me = this
      guard('старт', () => { ls = new LocalStorage() })
      applyBar()
      guard('открытие', () => setWakeUpRelaunch({ relaunch: true }))   // при включении экрана приложение открывается заново и обновляет список
      ST = guard('состояние', () => T.restore(store.getItem('st', ''))) || T.newState()
      for (let k = 0; k < ST.pend.length; k++) ST.pend[k].tried = 0   // новое открытие: неподтверждённые завершения отправляются сразу, а не через SEND_GAP
      setupGestures()
      guard('экран', redraw)
      applyBar()   // ещё раз после построения: прокрутка заблокирована при любом размере содержимого
      guard('отправка', () => this.sendDue(Date.now()))
      guard('телефон', () => this.syncPhone(true))
      timer = setInterval(() => { guard('секунда', () => this.tick()) }, 1000)
    },

    onDestroy() {
      if (timer) { clearInterval(timer); timer = null }
      save()
    },

    tick() {
      const now = Date.now()
      if (!synced && now - syncAt >= SYNC_RETRY) this.syncPhone(false)
      if (ST.pend.length) this.sendDue(now)
    },

    /** Долгое нажатие на задачу: задача выполнена. Перерисовка — чуть позже, потому что кнопка, на которую нажали, сама удаляется. */
    done(taskId) {
      const now = Date.now()
      const id = T.complete(ST, taskId, now)
      if (!id) return
      buzz()
      save()
      setTimeout(() => { guard('экран', redraw) }, 40)
      this.sendDue(now)
    },

    /**
     * Обычное нажатие: i = 0…5 — основная часть строки i, то же, что нажатие на фильтр i страницы ОЧЕРЕДЬ на телефоне (первая строка — первый фильтр);
     * i = -1 — область цветных сегментов: общий список всей очереди (на телефоне фильтры снимаются).
     * Телефон запоминает вкладку и отвечает списком задач этой вкладки в её порядке; без связи ничего не меняется.
     */
    pickTab(i) {
      const my = ++tabSeq
      this.request({ method: 'u613.send', params: { t: 'qtab', n: i } })
        .then((res) => {
          if (my !== tabSeq) return           // позже нажали другую строку — этот ответ устарел
          const r = res && res.ok ? res.reply : null
          if (r && r.t === 'tasks' && Array.isArray(r.q)) {
            synced = true
            linkFail = false
            takeList(r.q)
          }
        })
        .catch(() => { /* нет связи: вкладка не меняется */ })
    },

    /** Спросить у телефона очередь задач. */
    syncPhone(force) {
      const now = Date.now()
      if (!force && syncing && now - syncAt < 30000) return
      syncing = true
      syncAt = now
      this.request({ method: 'u613.send', params: { t: 'tasks' } })
        .then((res) => {
          syncing = false
          const r = res && res.ok ? res.reply : null
          if (r && r.t === 'tasks' && Array.isArray(r.q)) {
            const first = !synced
            synced = true
            linkFail = false
            takeList(r.q)
            if (first && !T.shownTasks(ST).length) guard('экран', redraw)   // «Загрузка…» → «Очередь задач пуста»
          } else {
            linkFail = true
            if (!T.shownTasks(ST).length) guard('экран', redraw)
          }
        })
        .catch(() => {
          syncing = false
          linkFail = true
          if (!T.shownTasks(ST).length) guard('экран', redraw)
        })
    },

    /** Отправить телефону одно неподтверждённое завершение (по одному за раз). */
    sendDue(now) {
      if (inflight && now - inflightAt < 30000) return
      const owner = ST
      const d = T.due(owner, now, SEND_GAP)
      if (!d.length) return
      const target = d[0]
      target.tried = now
      inflight = true
      inflightAt = now
      const id = target.id
      this.request({ method: 'u613.send', params: { t: 'tdone', id: id, tid: target.tid, ts: target.ts } })
        .then((res) => {
          inflight = false
          const r = res && res.ok ? res.reply : null
          if (r && r.t === 'ack' && r.id === id) {
            T.ack(owner, id)
            synced = true
            linkFail = false
            if (Array.isArray(r.q)) takeList(r.q)
            else { save(); guard('экран', redraw) }
            this.sendDue(Date.now())
          }
        })
        .catch(() => { inflight = false })
    }
  })
)
