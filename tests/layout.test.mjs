import assert from 'node:assert'
import * as lay from '../shared/layout.js'

let n = 0
function t(name, f) { f(); n++; console.log('ok  ' + name) }

t('список: x = 26…406, y = 38…474 (436 px: старые 48…464 плюс по 10 сверху и снизу), шесть равных частей', () => {
  assert.equal(lay.CARD_X, 26); assert.equal(lay.CARD_W, 380)
  assert.equal(lay.LIST_TOP, 38); assert.equal(lay.LIST_BOTTOM, 474); assert.equal(lay.LIST_H, 436)
  assert.equal(lay.ROWS, 6)
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(lay.rowTop), [38, 111, 183, 256, 329, 401, 474])
  for (let i = 0; i < 6; i++) {
    const d = lay.rowTop(i + 1) - lay.rowTop(i)
    assert.ok(d === 72 || d === 73, 'части равны с точностью до пикселя округления')
  }
})

t('строки: высота = часть минус просвет 4, всегда 68 или 69, просвет между строками ровно 4', () => {
  const rows = [0, 1, 2, 3, 4, 5].map(lay.rowRect)
  assert.deepEqual(rows.map((r) => r.h), [69, 68, 69, 69, 68, 69])
  assert.ok(rows.every((r) => r.x === 26 && r.w === 380))
  for (let i = 0; i < 5; i++) assert.equal(rows[i + 1].y - (rows[i].y + rows[i].h), lay.GAP)
  assert.equal(rows[0].y, 38)
  assert.equal(rows[5].y + rows[5].h + lay.GAP, 474)
})

t('полоска: на 10% уже (части по 21 вместо 23, зазоры 3, всего 69), вплотную к правому краю, на всю высоту строки', () => {
  assert.equal(lay.SEG_LEN, 21); assert.equal(lay.SEG_GAP, 3); assert.equal(lay.STRIP_LEN, 69)
  const s = [0, 1, 2].map((k) => lay.segRect(1, k))
  assert.deepEqual(s.map((r) => r.x), [337, 361, 385])
  assert.equal(s[2].x + s[2].w, 406)
  assert.ok(s.every((r) => r.w === 21 && r.y === 111 && r.h === 68))
})

t('эмодзи: без отступа слева (x = 26), по центру строки по вертикали; текст шире на 16 px', () => {
  assert.equal(lay.EMO_PAD, 0)
  for (let i = 0; i < 6; i++) {
    const e = lay.emojiRect(i), r = lay.rowRect(i)
    assert.equal(e.x, 26); assert.equal(e.w, 38)
    assert.ok(Math.abs((e.y + e.h / 2) - (r.y + r.h / 2)) <= 0.5)
  }
  assert.equal(lay.textX(), 72)
  assert.equal(lay.textWidth(), 257)       // было 241
  assert.equal(lay.textX() + lay.textWidth() + lay.TEXT_PAD, 337)   // дальше начинается полоска
})

t('текст: одна строка по центру строки по вертикали, две строки занимают её целиком', () => {
  for (let i = 0; i < 6; i++) {
    const r = lay.rowRect(i)
    const one = lay.lineRect(i, 0, 1)
    assert.ok(Math.abs((one.y + one.h / 2) - (r.y + r.h / 2)) <= 0.5)
    const a = lay.lineRect(i, 0, 2), b = lay.lineRect(i, 1, 2)
    assert.equal(b.y - a.y, lay.LINE_PITCH)
    assert.ok(a.y >= r.y && b.y + b.h <= r.y + r.h)
    assert.ok(Math.abs((a.y - r.y) - (r.y + r.h - (b.y + b.h))) <= 1, 'сверху и снизу поровну')
  }
})

t('белая линия: 2 px по центру просвета между строками, от левого края до полоски (на полоску не заходит)', () => {
  for (let i = 0; i < 5; i++) {
    const d = lay.dividerRect(i), r = lay.rowRect(i), nx = lay.rowRect(i + 1)
    assert.equal(d.h, 2)
    assert.equal(d.y - (r.y + r.h), 1); assert.equal(nx.y - (d.y + d.h), 1)
    assert.equal(d.x, 26); assert.equal(d.x + d.w, 337)
    const f = lay.dividerRect(i, true)                       // у пустой строки — на всю ширину списка, по вертикали та же
    assert.equal(f.y, d.y); assert.equal(f.h, 2); assert.equal(f.x, 26); assert.equal(f.x + f.w, 406)
  }
  // над верхней строкой: те же 2 px и 1 px чёрного до строки; под нижней — 1 px после строки, внутри списка
  const tp = lay.topDividerRect(false), tf = lay.topDividerRect(true), r0 = lay.rowRect(0)
  assert.equal(tp.h, 2); assert.equal(r0.y - (tp.y + tp.h), 1); assert.equal(tp.x + tp.w, 337); assert.equal(tf.x + tf.w, 406)
  const bt = lay.dividerRect(lay.ROWS - 1), r5 = lay.rowRect(5)
  assert.equal(bt.y - (r5.y + r5.h), 1); assert.ok(bt.y + bt.h <= lay.LIST_BOTTOM)
  assert.equal(lay.DIV_COLOR, 0xffffff)
})

t('кнопки строки: основная часть до полоски и область сегментов вплотную к ней, обе на высоту строки', () => {
  for (let i = 0; i < 6; i++) {
    const m = lay.mainBtnRect(i), s = lay.stripBtnRect(i), r = lay.rowRect(i)
    assert.equal(m.x, 26); assert.equal(m.x + m.w, s.x); assert.equal(s.x + s.w, 406); assert.equal(s.w, lay.STRIP_LEN)
    assert.equal(m.y, r.y); assert.equal(s.y, r.y); assert.equal(m.h, r.h); assert.equal(s.h, r.h)
  }
})

t('цвета сегментов: зелёный, жёлтый, красный как квадратики на телефоне', () => {
  assert.equal(lay.segColor(0), 0x3fb950)
  assert.equal(lay.segColor(1), 0xe3b341)
  assert.equal(lay.segColor(2), 0xf85149)
  assert.equal(lay.segColor('мусор'), 0x3fb950)
})

console.log('\nвсего: ' + n)
