#!/usr/bin/env python3
"""把 Images 文件夹里的扫描图裁剪、缩小，放进前端能读到的 apps/frontend/public/game-assets/。

这些图是官方美术，只在你自己电脑上用：Images 和 game-assets 都写在 .gitignore 里，
不会被提交，也不会被部署出去。前端完全靠这些图来画桌面，没有它们页面上会出现
"缺少素材"的提示，所以第一次运行网页之前、以及每次更新了这个脚本之后，都要运行一次。

用法（在仓库根目录运行）：
    python3 tools/assets/make_game_assets.py
需要 Pillow（pip install pillow）。重复运行没关系，会覆盖旧的图。
"""
from __future__ import annotations

import os
from pathlib import Path
import sys
from typing import Callable

from PIL import Image, ImageDraw, ImageFilter, ImageOps, features

ROOT = Path(__file__).resolve().parents[2]
# 素材文件夹默认是仓库根目录的 Images；设置环境变量 AOI_IMAGES 可以换成别的地方
SRC = Path(os.environ.get("AOI_IMAGES", ROOT / "Images"))
OUT = ROOT / "apps" / "frontend" / "public" / "game-assets"

# Images 里的文件名很长（从 Steam 创意工坊下载时自动起的），最后 8 个字符已经不会重复，
# 所以这里只记"文件名末尾"。注释里的"图 N"是文件名排序后的序号。
# 格式：种类 -> [(前端用的编号, 文件名末尾), ...]
ASSETS: dict[str, list[tuple[str, str]]] = {
    "faction": [
        ("omar", "3205FDD1.png"),  # 图 1
        ("inventors", "33CA0C91.png"),  # 图 2
        ("goblins", "03EAFDE6.png"),  # 图 3
        ("navigators", "E902C7DC.png"),  # 图 4
        ("felines", "07C1730A.png"),  # 图 5
        ("monks", "75D13A61.png"),  # 图 6
        ("blessed", "582186C0.png"),  # 图 7
        ("psychics", "667E172A.png"),  # 图 8
        ("lizards", "27F58C7E.png"),  # 图 9
        ("moles", "D63B3823.png"),  # 图 10
        ("philosophers", "BC6F2320.png"),  # 图 11
        ("illusionists", "7681D376.png"),  # 图 12
    ],
    "competency": [
        ("incomeBookPower", "FD85C4D4.png"),  # 图 14
        ("bonusToolVpCoins", "0E9AE9A8.png"),  # 图 15
        ("passLowestScience", "CB3B8F1C.png"),  # 图 16
        ("incomeToolLevel", "6C3B406A.png"),  # 图 17
        ("bonusSpades", "6F4E5435.png"),  # 图 18
        ("tower", "A5BD038E.png"),  # 图 19
        ("incomeVpCoins", "F09C0AD6.png"),  # 图 20
        ("passCityVp", "986F8922.png"),  # 图 21
        ("borderWorkshopVp", "9D5F80CA.png"),  # 图 22
        ("actionPower4", "4DFE68BC.png"),  # 图 23
        ("scholarVp", "78418210.png"),  # 图 24
        ("annexes", "103C3E4F.png"),  # 图 25
    ],
    "planning": [
        ("lake", "25292F3A.jpg"),  # 图 27
        ("wasteland", "9BCC4F33.jpg"),  # 图 28
        ("plains", "1E3D3AC5.jpg"),  # 图 29
        ("desert", "3550AE3C.jpg"),  # 图 30
        ("mountain", "440AD65D.jpg"),  # 图 31
        ("swamp", "C9242FC9.jpg"),  # 图 32
        ("forest", "905CCA08.jpg"),  # 图 147
    ],
    "palace": [
        ("1", "BAE68C2D.png"),  # 图 52
        ("2", "96B0E97B.png"),  # 图 53
        ("3", "A46161DE.png"),  # 图 54
        ("4", "5C6A016C.png"),  # 图 55
        ("5", "C0E1FF98.png"),  # 图 56
        ("6", "BF1AAD6C.png"),  # 图 57
        ("7", "42D71DBF.png"),  # 图 58
        ("8", "75FF5D70.png"),  # 图 59
        ("9", "1195ABD2.png"),  # 图 60
        ("10", "D3C18E22.png"),  # 图 61
        ("11", "784C8316.png"),  # 图 62
        ("12", "10A1D893.png"),  # 图 63
        ("13", "9037255D.png"),  # 图 64
        ("14", "D653AFCB.png"),  # 图 65
        ("15", "E54B2895.png"),  # 图 66
        ("16", "8C04E38E.png"),  # 图 67
        ("17", "BFB6044B.png"),  # 图 68
    ],
    "bookAction": [
        ("guildVp", "C22A87BA.png"),  # 图 69
        ("power5", "9279A4F6.png"),  # 图 70
        ("freeGuild", "7E3B0FA4.png"),  # 图 71
        ("levels2", "CAAE9B0B.png"),  # 图 72
        ("spade3", "EAE1E296.png"),  # 图 73
        ("coins6", "FC4CCAAB.png"),  # 图 74
    ],
    "bonus": [
        ("schoolsPass", "ED4911E2.png"),  # 图 75
        ("guildBuild", "F57FF421.png"),  # 图 76
        ("riverWorkshop", "2FE67AAB.png"),  # 图 77
        ("scholarSend", "A7BE3528.png"),  # 图 78
        ("levelAction", "1070F64E.png"),  # 图 79
        ("bigBuildingsPass", "15FDB342.png"),  # 图 80
        ("spadeAction", "E7613629.png"),  # 图 81
        ("bridgeAction", "43083EB9.png"),  # 图 82
        ("coins6", "69434014.png"),  # 图 83
        ("power4coins2", "BAA3A315.png"),  # 图 84
    ],
    # 回合计分板块：左半边是行动分，右半边是轮末的科学奖励。编号和引擎的 RoundScoreId 一样
    "roundScore": [
        ("workshopBanking", "FDA358BA.png"),  # 图 105
        ("workshopLaw", "A2948321.png"),  # 图 106
        ("levelMedicine", "8CD50A5B.png"),  # 图 107
        ("guildLaw", "A4E96AD5.png"),  # 图 108
        ("guildMedicine", "F711ACC5.png"),  # 图 109
        ("schoolBanking", "21BD6B86.png"),  # 图 110
        ("innovationLaw", "32300C8D.png"),  # 图 111
        ("cityEngineering", "C508DAE6.png"),  # 图 112
        ("spadeEngineering", "B64700F7.png"),  # 图 113
        ("trackEngineering", "E5C9930B.png"),  # 图 114
        ("bigBanking", "BF51DB29.png"),  # 图 115
        ("bigMedicine", "17B87210.png"),  # 图 116
        ("back", "A11119FC.png"),  # 图 121：背面（还不知道是哪一块时用）
    ],
    # 终局回合计分板块：盖在第 6 轮板块的右半边
    "finalRound": [
        ("guild", "7F7C001A.png"),  # 图 117：行会 3 分
        ("borderWorkshop", "0E6CE3BC.png"),  # 图 118：版图边缘的工坊 3 分
        ("school", "5D3661F3.png"),  # 图 119：学校 4 分
        ("workshop", "8141FCD0.png"),  # 图 120：工坊 2 分
    ],
    "marker": [
        ("x", "812D5338.png"),  # 图 146：行动格"本轮已用"的标记
    ],
    # 4 种颜色的书
    "book": [
        ("law", "E2A4CCA3.png"),  # 图 141
        ("engineering", "779C1204.png"),  # 图 142
        ("medicine", "E7342838.png"),  # 图 143
        ("banking", "9793414A.png"),  # 图 144
    ],
    "board": [
        ("science", "D741EDB7.jpg"),  # 图 148：学科板
        ("display", "C3CDCF92.jpg"),  # 创新板块和能力板块的展示板
        ("frame", "7A38BC6D.png"),  # 图 147：地图的边框（中间是空的）
    ],
}

# 每种图缩到多大（像素）：(最大宽度, 最大高度)。网页上显示得比这小，留一点余量给高分屏
MAX_SIZE: dict[str, tuple[int, int]] = {
    "faction": (520, 520),
    "competency": (260, 260),
    "planning": (1400, 1400),
    "palace": (400, 400),
    "bookAction": (320, 320),
    "bonus": (240, 640),
    "roundScore": (360, 200),
    "finalRound": (190, 200),
    "marker": (96, 96),
    "book": (96, 96),
    "board": (2400, 1410),
    "terrain": (214, 248),
    "powerAction": (380, 200),
    "cityTile": (220, 200),
}


def find(suffix: str) -> Path | None:
    matches = [p for p in SRC.iterdir() if p.name.endswith(suffix)]
    return matches[0] if len(matches) == 1 else None


def shrink(kind: str, img: Image.Image) -> Image.Image:
    img.thumbnail(MAX_SIZE[kind], Image.Resampling.LANCZOS)
    return img


# ---------- 从大图（图集）里裁出来的 ----------

# 图 122 是一张图集：左上角是回合轨，下面一排是行动格。书本行动的图本身就带着格子，这里只裁 6 个能量行动格
ATLAS_TRACKS = "A0A3BF4B.png"
# 图 123 也是图集：地图模块，每个六边形宽 214 像素（尖顶朝上）
ATLAS_HEXES = "493893E9.png"

# 能量行动格的左边缘（图 122 里，y 在 1900~2105 之间），顺序和引擎的 PowerActionId 一样
POWER_SLOTS = {"bridge": 1347, "scholar": 1772, "tools2": 2194, "coins7": 2606, "spade1": 3026, "spade2": 3434}

# 图 123 里每种地形挑一个完整的六边形，记它的中心
TERRAIN_HEXES = {
    "forest": (108, 117), "lake": (536, 117), "swamp": (750, 117), "plains": (964, 117),
    "wasteland": (1178, 117), "mountain": (1392, 117), "desert": (2462, 117),
}
HEX_R = 124  # 六边形中心到顶点的距离


def hex_mask(size: tuple[int, int], r: float) -> Image.Image:
    """尖顶六边形的蒙版：六边形里面是 255，外面是 0"""
    w, h = size
    cx, cy = w / 2, h / 2
    pts = [(cx, cy - r), (cx + r * 0.866, cy - r / 2), (cx + r * 0.866, cy + r / 2),
           (cx, cy + r), (cx - r * 0.866, cy + r / 2), (cx - r * 0.866, cy - r / 2)]
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    return mask


def crop_trim(img: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """裁下一块，再去掉四周透明的边"""
    part = img.crop(box)
    bbox = part.getchannel("A").getbbox()
    return part.crop(bbox) if bbox else part


def city_front(img: Image.Image) -> Image.Image:
    """
    城市板块的扫描图是白底，右上是正面、左下是背面。
    先把和左边缘连通的白色当成背景，再从正面中间往外"灌水"，只留正面那一块
    """
    img = img.convert("RGBA")
    near_white = img.convert("L").point(lambda v: 255 if v >= 238 else 0)
    ImageDraw.floodfill(near_white, (0, img.height // 3), 128)
    solid = near_white.point(lambda v: 0 if v == 128 else 255)
    ImageDraw.floodfill(solid, (360, 180), 128)
    tile = solid.point(lambda v: 255 if v == 128 else 0)
    img.putalpha(tile)
    return img.crop(tile.getbbox())


# 城市板块：5 种有扫描图；"5 分 2 本书""8 分 1 学者"两种没有图，用相同分数的板块改出来
CITY_SCANS = {
    "power": "169332BA.png", "levels": "96DCCADC.png", "coins": "46514C95.png",
    "tools": "8D417BB5.png", "spades": "1C950641.png",
}


def cover(tile: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """用板块中间的底色（浅色的纸）盖住一块，盖掉原来画的奖励。边缘稍微虚一点，看不出补过"""
    w, h = tile.size
    light = [p for x in range(w // 4, 3 * w // 4, 3) for y in range(h // 4, 3 * h // 4, 3)
             if min((p := tile.getpixel((x, y)))[:3]) > 200]
    color = tuple(sorted(c[i] for c in light)[len(light) // 2] for i in range(3)) + (255,)
    mask = Image.new("L", tile.size, 0)
    ImageDraw.Draw(mask).ellipse(box, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(3))
    tile = tile.copy()
    tile.paste(Image.new("RGBA", tile.size, color), (0, 0), mask)
    return tile


def book_cover(img: Image.Image) -> Image.Image:
    """书的扫描图左边是封面，右边是两条书脊，只留封面"""
    alpha = img.getchannel("A")
    w, h = img.size
    for x in range(w // 8, w):
        if sum(1 for y in range(0, h, 8) if alpha.getpixel((x, y)) > 20) < h / 16:
            return img.crop((0, 0, x, h))
    return img


def gray_book(size: int) -> Image.Image | None:
    src = find("9793414A.png")
    if src is None:
        return None
    with Image.open(src) as b:
        book = book_cover(b.convert("RGBA"))
    alpha = book.getchannel("A")
    book = ImageOps.grayscale(book).convert("RGBA")
    book.putalpha(alpha)
    book.thumbnail((size, size), Image.Resampling.LANCZOS)
    return book


def scholar_figure(size: int) -> Image.Image:
    """学者：深色的小木人（和地图、学科板上画的学者一样）"""
    s = size
    fig = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(fig)
    edge = (240, 232, 214, 255)
    body = (58, 52, 64, 255)
    d.ellipse((s * 0.32, s * 0.06, s * 0.68, s * 0.42), fill=body, outline=edge, width=max(2, s // 28))
    d.polygon([(s * 0.5, s * 0.36), (s * 0.84, s * 0.94), (s * 0.16, s * 0.94)], fill=body, outline=edge)
    return fig


def make_city_tiles(save: Callable[[str, str, Image.Image], None], missing: list[str]) -> None:
    fronts: dict[str, Image.Image] = {}
    for tile_id, suffix in CITY_SCANS.items():
        src = find(suffix)
        if src is None:
            missing.append(f"cityTile/{tile_id}（文件名以 {suffix} 结尾）")
            continue
        with Image.open(src) as img:
            fronts[tile_id] = city_front(img)
        save("cityTile", tile_id, fronts[tile_id].copy())
    # "5 分 2 本书"：拿"5 分 2 把铲子"，把铲子换成 2 本任选颜色的书（灰色）
    book = gray_book(84)
    if "spades" in fronts and book is not None:
        t = cover(fronts["spades"], (34, 108, 170, 238))
        t.alpha_composite(book, (52, 112))
        t.alpha_composite(book, (104, 128))
        save("cityTile", "books", t)
    else:
        missing.append("cityTile/books（要用到 spades 城市板块和银行书的图）")
    # "8 分 1 学者"：拿"8 分 8 能量"，把能量换成 1 个学者
    if "power" in fronts:
        t = cover(fronts["power"], (60, 110, 180, 238))
        t.alpha_composite(scholar_figure(88), (76, 134))
        save("cityTile", "scholar", t)
    else:
        missing.append("cityTile/scholar（要用到 power 城市板块的图）")


def make_crops(save: Callable[[str, str, Image.Image], None], missing: list[str]) -> None:
    src = find(ATLAS_TRACKS)
    if src is None:
        missing.append(f"图集 122（文件名以 {ATLAS_TRACKS} 结尾）：回合轨、行动格")
    else:
        with Image.open(src) as img:
            atlas = img.convert("RGBA")
        save("board", "roundTrack", crop_trim(atlas, (0, 0, 416, 1865)))
        for action_id, x in POWER_SLOTS.items():
            save("powerAction", action_id, crop_trim(atlas, (x - 8, 1896, x + 390, 2110)))

    src = find(ATLAS_HEXES)
    if src is None:
        missing.append(f"图集 123（文件名以 {ATLAS_HEXES} 结尾）：地形")
    else:
        with Image.open(src) as img:
            atlas = img.convert("RGBA")
        w, h = 214, 248
        for terrain, (cx, cy) in TERRAIN_HEXES.items():
            part = atlas.crop((cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2))
            # 只留中间这一格：邻居露出来的角用六边形蒙版切掉
            alpha = Image.composite(part.getchannel("A"), Image.new("L", part.size, 0), hex_mask(part.size, HEX_R))
            part.putalpha(alpha)
            save("terrain", terrain, part)


def main() -> int:
    if not SRC.is_dir():
        print(f"找不到 {SRC}，请把素材放在仓库根目录的 Images 文件夹里")
        return 1
    if not features.check("webp"):
        print("这个 Pillow 不支持 webp，请升级：pip install -U pillow")
        return 1
    made = 0
    missing: list[str] = []

    def save(kind: str, asset_id: str, img: Image.Image) -> None:
        nonlocal made
        folder = OUT / kind
        folder.mkdir(parents=True, exist_ok=True)
        shrink(kind, img).save(folder / f"{asset_id}.webp", "WEBP", quality=86, method=6)
        made += 1

    for kind, items in ASSETS.items():
        for asset_id, suffix in items:
            src = find(suffix)
            if src is None:
                missing.append(f"{kind}/{asset_id}（文件名以 {suffix} 结尾）")
                continue
            with Image.open(src) as img:
                img = img.convert("RGBA")
                if kind == "planning":
                    # 规划板的扫描图上半张是正面，下半张是空白，只留上半张
                    img = img.crop((0, 0, img.width, img.height // 2))
                if kind == "book":
                    img = book_cover(img)
                save(kind, asset_id, img)
    make_crops(save, missing)
    make_city_tiles(save, missing)

    print(f"生成了 {made} 张图，放在 {OUT.relative_to(ROOT)}")
    for m in missing:
        print("  没找到：", m)
    return 0 if not missing else 2


if __name__ == "__main__":
    sys.exit(main())
