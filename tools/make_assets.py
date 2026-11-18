#!/usr/bin/env python3
"""
Генератор картинок для приложения «U613 Задачи 2». Запускать НЕ нужно: готовые файлы уже лежат в assets/default.w432-s/.
Скрипт оставлен, чтобы можно было пересоздать картинки. Нужны Pillow и шрифт Noto Color Emoji.

Что создаётся:
  e0..e8.png — эмодзи вкладок 38 × 38: 🏠 🍀 🔍 📖 🧬 💀 🤿 🎨 🩸
  tz68/tz69.png (основная часть строки) и sz68/sz69.png (область цветных сегментов) — почти прозрачные накладки на строку задачи (строки бывают высотой 68 и 69 px, см. rowRect в shared/layout.js), ловят долгое нажатие;
  tp68/tp69 и sp68/sp69.png — подсветка при нажатии
  icon.png — иконка приложения 🧩
Текст на экране рисуют сами часы (системным шрифтом), картинок букв нет.
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'assets', 'default.w432-s')
NOTO = os.environ.get('NOTO', '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf')

EMOJI = ['\U0001F3E0', '\U0001F340', '\U0001F50D', '\U0001F4D6', '\U0001F9EC', '\U0001F480',
         '\U0001F93F', '\U0001F3A8', '\U0001FA78', '\U0001F3B5', '\U0001F39E', '\U0001F9ED', '\U0001F916']   # дальше 🎵 🎞 🧭 🤖
EMO_SIZE = 38
CARD_W = 380
STRIP_LEN = 69                         # ширина цветной полоски (shared/layout.js)
CARD_H = (68, 69)                      # какой высоты бывают строки задач (shared/layout.js: rowRect)


def render_emoji(ch, box):
    font = ImageFont.truetype(NOTO, 109)
    big = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
    ImageDraw.Draw(big).text((10, 10), ch, font=font, embedded_color=True)
    big = big.crop(big.getbbox())
    s = box / max(big.size)
    return big.resize((max(1, round(big.width * s)), max(1, round(big.height * s))), Image.LANCZOS)


def build_emoji():
    for i, ch in enumerate(EMOJI):
        g = render_emoji(ch, EMO_SIZE)
        im = Image.new('RGBA', (EMO_SIZE, EMO_SIZE), (0, 0, 0, 0))
        im.alpha_composite(g, ((EMO_SIZE - g.width) // 2, (EMO_SIZE - g.height) // 2))
        im.save(os.path.join(OUT, 'e%d.png' % i), optimize=True)


def build_misc():
    for h in CARD_H:
        # alpha 1 из 255: на глаз не видно, но картинка не полностью прозрачная
        Image.new('RGBA', (CARD_W - STRIP_LEN, h), (255, 255, 255, 1)).save(os.path.join(OUT, 'tz%d.png' % h), optimize=True)    # основная часть строки
        Image.new('RGBA', (CARD_W - STRIP_LEN, h), (255, 255, 255, 36)).save(os.path.join(OUT, 'tp%d.png' % h), optimize=True)
        Image.new('RGBA', (STRIP_LEN, h), (255, 255, 255, 1)).save(os.path.join(OUT, 'sz%d.png' % h), optimize=True)           # область цветных сегментов
        Image.new('RGBA', (STRIP_LEN, h), (255, 255, 255, 36)).save(os.path.join(OUT, 'sp%d.png' % h), optimize=True)
    ic = Image.new('RGBA', (120, 120), (0, 0, 0, 0))
    m = Image.new('L', (120, 120), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 119, 119), radius=26, fill=255)
    ic.paste(Image.new('RGBA', (120, 120), (0x1C, 0x1C, 0x1C, 255)), (0, 0), m)
    g = render_emoji('\U0001F9E9', 84)
    ic.alpha_composite(g, ((120 - g.width) // 2, (120 - g.height) // 2))
    ic.save(os.path.join(OUT, 'icon.png'), optimize=True)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
    build_emoji()
    build_misc()
    print('готово: %d файлов' % len(os.listdir(OUT)))
