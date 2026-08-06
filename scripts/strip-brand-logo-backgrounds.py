#!/usr/bin/env python3
"""Strip white/checker/black plates from dealer brand PNGs (true alpha).

Keeps real logo whites (e.g. BMW quadrants ~241) and silver metal/lettering.
Removes solid plates, fake-transparency checker tiles, and edge black plates.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "brand-logos"


def chroma(r: int, g: int, b: int) -> int:
    return max(r, g, b) - min(r, g, b)


def is_plate_gray(r: int, g: int, b: int) -> bool:
    if chroma(r, g, b) > 8:
        return False
    m = min(r, g, b)
    if m >= 248:
        return True
    if 220 <= m <= 239:
        return True
    return False


def is_soft_white(r: int, g: int, b: int) -> bool:
    """240–247 band: plate leftovers OR BMW-style logo whites."""
    if chroma(r, g, b) > 8:
        return False
    return 240 <= min(r, g, b) <= 247


def is_flood_white(r: int, g: int, b: int) -> bool:
    if chroma(r, g, b) > 12:
        return False
    return min(r, g, b) >= 236


def is_black_plate(r: int, g: int, b: int) -> bool:
    return max(r, g, b) <= 16 and chroma(r, g, b) <= 4


def mark_protected_soft_whites(px, w: int, h: int) -> list[list[bool]]:
    """Protect interior soft-white blobs (BMW quadrants ~241), not plate/checker."""
    protected = [[False] * w for _ in range(h)]
    seen = [[False] * w for _ in range(h)]
    max_interior = (w * h) // 20

    for y0 in range(h):
        for x0 in range(w):
            if seen[y0][x0]:
                continue
            r, g, b, a = px[x0, y0]
            if a == 0 or not is_soft_white(r, g, b):
                seen[y0][x0] = True
                continue

            component: list[tuple[int, int]] = []
            touches_border = False
            q: deque[tuple[int, int]] = deque([(x0, y0)])
            seen[y0][x0] = True
            while q:
                x, y = q.popleft()
                component.append((x, y))
                if x == 0 or y == 0 or x == w - 1 or y == h - 1:
                    touches_border = True
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < w and 0 <= ny < h) or seen[ny][nx]:
                        continue
                    nr, ng, nb, na = px[nx, ny]
                    if na > 0 and is_soft_white(nr, ng, nb):
                        seen[ny][nx] = True
                        q.append((nx, ny))

            if (not touches_border) and 80 <= len(component) <= max_interior:
                for x, y in component:
                    protected[y][x] = True

    return protected


def clear_backgrounds(path: Path) -> None:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    out = im.copy()
    out_px = out.load()

    # BMW quadrants use soft whites (~241) that look like plate leftovers.
    # Land Rover silver lettering has distressed near-white speckles — edge flood only.
    if path.stem == "bmw":
        protected = mark_protected_soft_whites(out_px, w, h)
    else:
        protected = [[False] * w for _ in range(h)]

    removed_plate = 0
    if path.stem != "land-rover":
        for y in range(h):
            for x in range(w):
                if protected[y][x]:
                    continue
                r, g, b, a = out_px[x, y]
                if is_plate_gray(r, g, b) or is_soft_white(r, g, b):
                    out_px[x, y] = (r, g, b, 0)
                    removed_plate += 1

    removed_soft = 0

    q: deque[tuple[int, int]] = deque()
    seen = [[False] * w for _ in range(h)]
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    removed_edge = 0
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        seen[y][x] = True
        r, g, b, a = out_px[x, y]
        if a == 0:
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx]:
                    q.append((nx, ny))
            continue
        if protected[y][x]:
            continue
        clearable = is_black_plate(r, g, b)
        if path.stem == "land-rover":
            clearable = clearable or (
                chroma(r, g, b) <= 18 and min(r, g, b) >= 200
            )
        else:
            clearable = clearable or is_flood_white(r, g, b)
        if clearable:
            out_px[x, y] = (r, g, b, 0)
            removed_edge += 1
            q.append((x + 1, y))
            q.append((x - 1, y))
            q.append((x, y + 1))
            q.append((x, y - 1))

    fringe = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = out_px[x, y]
            if a == 0 or protected[y][x] or chroma(r, g, b) > 10:
                continue
            if min(r, g, b) < 248:
                continue
            near_clear = any(
                0 <= x + dx < w
                and 0 <= y + dy < h
                and out_px[x + dx, y + dy][3] < 32
                for dx, dy in (
                    (1, 0),
                    (-1, 0),
                    (0, 1),
                    (0, -1),
                    (1, 1),
                    (-1, -1),
                    (1, -1),
                    (-1, 1),
                )
            )
            if near_clear:
                out_px[x, y] = (r, g, b, 0)
                fringe += 1

    out.save(path, optimize=True)
    sample = out.getpixel((w // 3, h // 2))
    corners = [
        out.getpixel((0, 0))[3],
        out.getpixel((w - 1, 0))[3],
        out.getpixel((0, h - 1))[3],
        out.getpixel((w - 1, h - 1))[3],
    ]
    print(
        f"{path.name}: plate~{removed_plate}+{removed_soft} edge~{removed_edge} "
        f"fringe~{fringe} cornersA={corners} sample={sample}"
    )


def main() -> None:
    for path in sorted(ROOT.glob("*.png")):
        clear_backgrounds(path)
    print("done")


if __name__ == "__main__":
    main()
