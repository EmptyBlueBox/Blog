"""Utility for resizing animated GIF files to reduce storage footprint."""

from __future__ import annotations

import os
from pathlib import Path
from typing import List

from PIL import Image, ImageOps, ImageSequence


def resize_gif(input_path: str, output_path: str, max_width: int, max_height: int) -> None:
    """Resize an animated GIF while preserving animation timing and loop configuration.

    Parameters
    ----------
    input_path : str
        Path to the GIF that should be resized.
    output_path : str
        Destination path for the resized GIF.
    max_width : int
        Maximum width (in pixels); frames wider than this value are scaled down proportionally.
    max_height : int
        Maximum height (in pixels); frames taller than this value are scaled down proportionally.

    Returns
    -------
    None
        The function writes the resized GIF to ``output_path`` and performs no in-memory return.
    """

    input_gif = Path(input_path)
    output_gif = Path(output_path)

    if not input_gif.exists():
        raise FileNotFoundError(f"Input GIF not found: {input_gif}")

    with Image.open(str(input_gif)) as base_gif:
        base_duration = base_gif.info.get("duration", 100)
        base_loop = base_gif.info.get("loop", 0)
        base_disposal = base_gif.info.get("disposal", 2)
        transparency = base_gif.info.get("transparency")

        frames: List[Image.Image] = []
        durations: List[int] = []

        for frame in ImageSequence.Iterator(base_gif):
            frame_duration = frame.info.get("duration", base_duration)
            durations.append(frame_duration)

            frame_rgba = frame.convert("RGBA")
            resized_frame = ImageOps.contain(
                frame_rgba,
                size=(max_width, max_height),
                method=Image.Resampling.LANCZOS,
            )

            palettized = resized_frame.convert("P", palette=Image.Palette.ADAPTIVE)
            frames.append(palettized)

        if not frames:
            raise ValueError("No frames were extracted from the GIF; input may be corrupt.")

        save_kwargs = {
            "save_all": True,
            "append_images": frames[1:],
            "loop": base_loop,
            "duration": durations,
            "disposal": base_disposal,
            "optimize": True,
        }

        if transparency is not None:
            save_kwargs["transparency"] = transparency

        frames[0].save(str(output_gif), **save_kwargs)


def display_size_report(input_path: str, output_path: str) -> None:
    """Print a textual report comparing file sizes and dimensions pre/post resizing.

    Parameters
    ----------
    input_path : str
        Path to the original GIF.
    output_path : str
        Path to the resized GIF whose metrics should be displayed.

    Returns
    -------
    None
        This function emits a textual report to stdout for manual verification.
    """

    input_gif = Path(input_path)
    output_gif = Path(output_path)

    def _inspect(path: Path) -> tuple[int, tuple[int, int]]:
        if not path.exists():
            raise FileNotFoundError(f"GIF not found: {path}")
        with Image.open(str(path)) as gif_image:
            return path.stat().st_size, gif_image.size

    original_bytes, original_dims = _inspect(input_gif)
    resized_bytes, resized_dims = _inspect(output_gif)

    print(f"Original GIF: {input_gif}")
    print(f"  Dimensions: {original_dims[0]}x{original_dims[1]} pixels")
    print(f"  Size: {original_bytes / (1024 * 1024):.2f} MiB")
    print(f"Resized GIF: {output_gif}")
    print(f"  Dimensions: {resized_dims[0]}x{resized_dims[1]} pixels")
    print(f"  Size: {resized_bytes / (1024 * 1024):.2f} MiB")


def main() -> None:
    """Demonstrate GIF resizing by shrinking ``retargeting.gif`` to 512px constraints."""

    project_root = Path(__file__).resolve().parent
    original_gif = project_root / "retargeting-original.gif"
    resized_gif = project_root / "retargeting-abit.gif"

    resize_gif(
        input_path=str(original_gif),
        output_path=str(resized_gif),
        max_width=360,
        max_height=360,
    )
    display_size_report(str(original_gif), str(resized_gif))


if __name__ == "__main__":
    main()

