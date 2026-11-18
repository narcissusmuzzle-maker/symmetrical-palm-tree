/**
 * Раскладка экрана задач — версия «строки» (чистые функции, без обращений к API часов — проверяются тестами в Node).
 *
 * Экран 432 × 514, фон чёрный. Список занимает по вертикали y = 38…474 (436 px) и разделён на ROWS = 6 равных частей (по 72,67 px) —
 * это шесть строк задач. Прокрутки нет: показываются только шесть первых задач очереди, один экран. Между строками просвет GAP = 4 px,
 * поэтому сама строка выше на этот просвет не больше (68 или 69 px — границы строк округляются до целых).
 * По горизонтали список стоит на x = 26…406 (380 px); общий сдвиг экрана влево (SHIFT_X в page/index.js) и вертикальный (DOWN там же)
 * накладываются на эти координаты уже при рисовании.
 *
 * Строка слева направо: эмодзи вкладки (38 px, вплотную к левому краю, всегда по центру строки по вертикали), текст и вплотную
 * к правому краю цветная полоска из трёх узких частей (части идут слева направо в порядке квадратиков на телефоне: важность, сложность,
 * срочность). Серого фона у строк нет — фон чёрный. Между строками (всегда все пять, даже когда задач нет) и над верхней и под нижней строкой (ещё две, всего семь) — белая линия 2 px по центру просвета;
 * до цветной полоски она не доходит, у полоски просвет остаётся чёрным; если одна из двух строк пустая (полоски нет), линия идёт на всю ширину списка.
 * Текст — обычный горизонтальный, одна или две строки: одна строка стоит по центру строки задачи по вертикали, две занимают её целиком.
 */
export const SCREEN_W = 432
export const SCREEN_H = 514
export const CARD_X = 26         // левый край списка (без общего сдвига экрана)
export const CARD_W = 380        // ширина списка
export const LIST_TOP = 38       // верх первой строки
export const LIST_BOTTOM = 474   // низ последней строки
export const ROWS = 6            // сколько задач на экране (и вообще показывается)
export const GAP = 4             // просвет между строками
export const TEXT_SIZE = 28      // размер шрифта (шрифт — системный шрифт часов)
export const LINE_PITCH = 34     // высота одной строки текста
export const MAX_LINES = 2
export const EMO_SIZE = 38
export const EMO_PAD = 0         // от левого края списка до эмодзи (отступа нет)
export const TEXT_PAD = 8        // от эмодзи до текста и от текста до полоски
export const SEG_LEN = 21        // ширина одной части полоски (было 23, на 10% уже)
export const SEG_GAP = 3
export const STRIP_LEN = 3 * SEG_LEN + 2 * SEG_GAP    // 69
export const DIV_H = 2           // толщина белой линии между строками

// цвета: фон, текст, разделитель, три цвета полоски (как цветные квадратики в приложении на телефоне: зелёный, жёлтый, красный)
export const BG = 0x000000
export const TEXT_COLOR = 0xf0f0f0
export const DIV_COLOR = 0xffffff
export const SEG_COLORS = [0x3fb950, 0xe3b341, 0xf85149]

/** Сколько места у списка по высоте. */
export const LIST_H = LIST_BOTTOM - LIST_TOP

/** Верхний край строки i (0…ROWS); rowTop(ROWS) = LIST_BOTTOM. Равные части, границы округляются до целых. */
export function rowTop(i) { return Math.round(LIST_TOP + (i * LIST_H) / ROWS) }

/** Строка задачи i (0…5): верх и высота; высота = часть списка минус просвет. */
export function rowRect(i) {
  const y = rowTop(i)
  return { x: CARD_X, y: y, w: CARD_W, h: rowTop(i + 1) - GAP - y }
}

/** Часть полоски s (0 — левая, 2 — правая), на всю высоту строки. */
export function segRect(i, s) {
  const r = rowRect(i)
  return { x: CARD_X + CARD_W - STRIP_LEN + s * (SEG_LEN + SEG_GAP), y: r.y, w: SEG_LEN, h: r.h }
}

/** Эмодзи — у левого края, по центру строки по вертикали. */
export function emojiRect(i) {
  const r = rowRect(i)
  return { x: CARD_X + EMO_PAD, y: r.y + Math.round((r.h - EMO_SIZE) / 2), w: EMO_SIZE, h: EMO_SIZE }
}

export function textX() { return CARD_X + EMO_PAD + EMO_SIZE + TEXT_PAD }

/** Ширина под текст: от эмодзи до полоски. */
export function textWidth() { return CARD_X + CARD_W - STRIP_LEN - TEXT_PAD - textX() }

/** Строка текста k (0 или 1) задачи из `lines` строк (1 или 2): весь блок текста стоит по центру строки задачи по вертикали. */
export function lineRect(i, k, lines) {
  const r = rowRect(i)
  const top = r.y + Math.round((r.h - LINE_PITCH * lines) / 2)
  return { x: textX(), y: top + k * LINE_PITCH, w: textWidth(), h: LINE_PITCH }
}

/**
 * Белая линия под строкой i (между строкой i и i + 1), по центру просвета. Если с обеих сторон есть цветные полоски (full = false),
 * линия доходит до полоски, но не заходит на неё: у полоски просвет чёрный, цветные поля разделены. Если одна из строк пустая
 * (полоски нет, full = true) — линия идёт на всю ширину списка.
 */
export function dividerRect(i, full) {
  const r = rowRect(i)
  return { x: CARD_X, y: r.y + r.h + Math.round((GAP - DIV_H) / 2), w: full ? CARD_W : CARD_W - STRIP_LEN, h: DIV_H }
}

/**
 * Линия над самой верхней строкой: так же, как между строками (2 px, между ней и строкой 1 px чёрного). Страница рисует верхнюю и нижнюю линии
 * всегда на всю ширину (full = true), независимо от задач рядом. Нижняя линия — dividerRect(ROWS - 1, true): под последней строкой с тем же зазором.
 */
export function topDividerRect(full) {
  return { x: CARD_X, y: LIST_TOP - 1 - DIV_H, w: full ? CARD_W : CARD_W - STRIP_LEN, h: DIV_H }
}

/** Основная часть строки (эмодзи и текст, до цветной полоски): обычное нажатие — фильтр с номером строки. */
export function mainBtnRect(i) {
  const r = rowRect(i)
  return { x: r.x, y: r.y, w: CARD_W - STRIP_LEN, h: r.h }
}

/** Область цветных сегментов строки i (на всю высоту строки): обычное нажатие — общий список очереди (одинаково для любой строки). */
export function stripBtnRect(i) {
  const r = rowRect(i)
  return { x: r.x + CARD_W - STRIP_LEN, y: r.y, w: STRIP_LEN, h: r.h }
}

/** Цвет сегмента по уровню (0 зелёный, 1 жёлтый, 2 красный); мусор — зелёный. */
export function segColor(level) {
  const l = Math.round(+level)
  return SEG_COLORS[l >= 0 && l <= 2 ? l : 0]
}
