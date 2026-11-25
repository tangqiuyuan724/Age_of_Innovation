#!/usr/bin/env python3
"""把 Images 文件夹里的扫描图裁剪、缩小，放进前端能读到的 apps/frontend/public/game-assets/。

这些图是官方美术，只在你自己电脑上用：Images 和 game-assets 都写在 .gitignore 里，
不会被提交，也不会被部署出去。前端找不到某张图时，会自动退回扁平的样子。

用法（在仓库根目录运行）：
    python3 tools/assets/make_game_assets.py
需要 Pillow（pip install pillow）。重复运行没关系，会覆盖旧的图。
"""
from __future__ import annotations

from pathlib import Path
import sys

from PIL import Image, features

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "Images"
OUT = ROOT / "apps" / "frontend" / "public" / "game-assets"

# Images 里的文件名很长（从 Steam 创意工坊下载时自动起的），最后 8 个字符已经不会重复，
# 所以这里只记"文件名末尾"。注释里的"图 N"是文件名排序后的序号，和教程里说的一样。
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
}

# 每种图缩到多大（像素）：(最大宽度, 最大高度)。网页上显示得比这小，留一点余量给高分屏
MAX_SIZE: dict[str, tuple[int, int]] = {
    "faction": (520, 520),
    "competency": (260, 260),
    "planning": (1400, 1400),
    "palace": (400, 400),
    "bookAction": (320, 320),
    "bonus": (240, 640),
}


def find(suffix: str) -> Path | None:
    matches = [p for p in SRC.iterdir() if p.name.endswith(suffix)]
    return matches[0] if len(matches) == 1 else None


def prepare(kind: str, img: Image.Image) -> Image.Image:
    if kind == "planning":
        # 规划板的扫描图上半张是正面，下半张是空白，只留上半张
        img = img.crop((0, 0, img.width, img.height // 2))
    img.thumbnail(MAX_SIZE[kind], Image.Resampling.LANCZOS)
    return img


def main() -> int:
    if not SRC.is_dir():
        print(f"找不到 {SRC}，请把素材放在仓库根目录的 Images 文件夹里")
        return 1
    if not features.check("webp"):
        print("这个 Pillow 不支持 webp，请升级：pip install -U pillow")
        return 1
    made, missing = 0, []
    for kind, items in ASSETS.items():
        folder = OUT / kind
        folder.mkdir(parents=True, exist_ok=True)
        for asset_id, suffix in items:
            src = find(suffix)
            if src is None:
                missing.append(f"{kind}/{asset_id}（文件名以 {suffix} 结尾）")
                continue
            with Image.open(src) as img:
                out = prepare(kind, img.convert("RGBA"))
                out.save(folder / f"{asset_id}.webp", "WEBP", quality=85, method=6)
            made += 1
    print(f"生成了 {made} 张图，放在 {OUT.relative_to(ROOT)}")
    for m in missing:
        print("  没找到：", m)
    return 0 if not missing else 2


if __name__ == "__main__":
    sys.exit(main())
