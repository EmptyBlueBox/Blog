#!/usr/bin/env python3
"""
cd public/favicon
export DYLD_LIBRARY_PATH="/opt/homebrew/lib:$DYLD_LIBRARY_PATH" && export PKG_CONFIG_PATH="/opt/homebrew/lib/pkgconfig:$PKG_CONFIG_PATH" && python favicon_to_png.py

Convert SVG favicon to multiple PNG sizes with aspect ratio preservation.
将SVG favicon转换为多个PNG尺寸，保持宽高比。

Requirements:
    pip install cairosvg pillow

Usage:
    python favicon_to_png.py
"""

import os
import re
from pathlib import Path
from typing import Tuple, List
import cairosvg
from PIL import Image
import io


def parse_path_data(path_data: str) -> List[Tuple[float, float]]:
    """
    Parse SVG path data and extract all coordinate points.
    解析SVG路径数据并提取所有坐标点。

    Args:
        path_data (str): SVG path 'd' attribute content

    Returns:
        List[Tuple[float, float]]: List of (x, y) coordinate points
    """
    points = []

    # Remove unnecessary whitespace and normalize
    path_data = re.sub(r"\s+", " ", path_data.strip())

    # Extract all numeric coordinates (including decimals)
    # This regex finds patterns like: number,number or number number
    coordinate_pattern = r"(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)"
    matches = re.findall(coordinate_pattern, path_data)

    for match in matches:
        x, y = float(match[0]), float(match[1])
        points.append((x, y))

    return points


def get_svg_content_bounds(svg_content: str) -> Tuple[float, float, float, float]:
    """
    Calculate the actual bounding box of SVG content.
    计算SVG内容的实际边界框。

    Args:
        svg_content (str): SVG file content as string

    Returns:
        Tuple[float, float, float, float]: (min_x, min_y, max_x, max_y)
    """
    import xml.etree.ElementTree as ET

    root = ET.fromstring(svg_content)
    all_points = []

    # Find all path elements
    for path in root.iter():
        if path.tag.endswith("path"):
            d_attr = path.get("d")
            if d_attr:
                points = parse_path_data(d_attr)
                all_points.extend(points)

    # Find all basic shapes (rect, circle, ellipse, line, polyline, polygon)
    for elem in root.iter():
        tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag

        if tag == "rect":
            x = float(elem.get("x", 0))
            y = float(elem.get("y", 0))
            width = float(elem.get("width", 0))
            height = float(elem.get("height", 0))
            all_points.extend([(x, y), (x + width, y + height)])

        elif tag == "circle":
            cx = float(elem.get("cx", 0))
            cy = float(elem.get("cy", 0))
            r = float(elem.get("r", 0))
            all_points.extend([(cx - r, cy - r), (cx + r, cy + r)])

        elif tag == "ellipse":
            cx = float(elem.get("cx", 0))
            cy = float(elem.get("cy", 0))
            rx = float(elem.get("rx", 0))
            ry = float(elem.get("ry", 0))
            all_points.extend([(cx - rx, cy - ry), (cx + rx, cy + ry)])

        elif tag == "line":
            x1 = float(elem.get("x1", 0))
            y1 = float(elem.get("y1", 0))
            x2 = float(elem.get("x2", 0))
            y2 = float(elem.get("y2", 0))
            all_points.extend([(x1, y1), (x2, y2)])

        elif tag in ["polyline", "polygon"]:
            points_attr = elem.get("points", "")
            if points_attr:
                points = parse_path_data(points_attr.replace(",", " "))
                all_points.extend(points)

    if not all_points:
        # Fallback to viewBox if no content found
        viewbox = root.get("viewBox")
        if viewbox:
            _, _, width, height = map(float, viewbox.split())
            return 0, 0, width, height
        else:
            return 0, 0, 100, 100

    # Calculate bounding box
    x_coords = [p[0] for p in all_points]
    y_coords = [p[1] for p in all_points]

    min_x, max_x = min(x_coords), max(x_coords)
    min_y, max_y = min(y_coords), max(y_coords)

    return min_x, min_y, max_x, max_y


def get_svg_dimensions(svg_content: str) -> Tuple[float, float]:
    """
    Extract actual content dimensions from SVG, creating a square bounding box.
    从SVG中提取实际内容尺寸，创建正方形边界框。

    Args:
        svg_content (str): SVG file content as string

    Returns:
        Tuple[float, float]: (width, height) - always square dimensions
    """
    min_x, min_y, max_x, max_y = get_svg_content_bounds(svg_content)

    # Calculate actual content dimensions
    content_width = max_x - min_x
    content_height = max_y - min_y

    # Create square bounding box (use the larger dimension)
    square_size = max(content_width, content_height)

    print(
        f"🔍 Content bounds: ({min_x:.1f}, {min_y:.1f}) to ({max_x:.1f}, {max_y:.1f})"
    )
    print(f"📦 Content size: {content_width:.1f} x {content_height:.1f}")
    print(f"⬜ Square bounding box: {square_size:.1f} x {square_size:.1f}")

    return square_size, square_size


def calculate_render_size(
    svg_width: float, svg_height: float, target_size: int
) -> Tuple[int, int]:
    """
    Calculate the render size to fit within target_size while maintaining aspect ratio.
    计算渲染尺寸以在目标尺寸内适配同时保持宽高比。

    Since we now use square dimensions, this will always return target_size x target_size.
    由于现在使用正方形尺寸，这将总是返回target_size x target_size。

    Args:
        svg_width (float): SVG width (should be same as height for square)
        svg_height (float): SVG height (should be same as width for square)
        target_size (int): Target square size (e.g., 16, 32, 128, 256)

    Returns:
        Tuple[int, int]: (render_width, render_height) - always square
    """
    return target_size, target_size


def svg_to_png(
    svg_path: str, output_path: str, width: int, height: int, svg_content: str
) -> None:
    """
    Convert SVG to PNG with specified dimensions, cropped to actual content bounds.
    将SVG转换为指定尺寸的PNG，裁剪到实际内容边界。

    Args:
        svg_path (str): Path to input SVG file
        output_path (str): Path to output PNG file
        width (int): Output width in pixels
        height (int): Output height in pixels
        svg_content (str): SVG content for calculating bounds
    """
    # Get the actual content bounds
    min_x, min_y, max_x, max_y = get_svg_content_bounds(svg_content)
    content_width = max_x - min_x
    content_height = max_y - min_y

    # Create a modified SVG that focuses on the content bounds
    import xml.etree.ElementTree as ET

    # Parse the original SVG
    root = ET.fromstring(svg_content)

    # Calculate the square bounding box
    square_size = max(content_width, content_height)

    # Calculate centering offsets for the content within the square
    center_x = min_x + content_width / 2
    center_y = min_y + content_height / 2

    # Set new viewBox to focus on the content with square aspect ratio
    new_min_x = center_x - square_size / 2
    new_min_y = center_y - square_size / 2

    # Update the viewBox to crop to actual content
    root.set("viewBox", f"{new_min_x} {new_min_y} {square_size} {square_size}")
    root.set("width", str(width))
    root.set("height", str(height))

    # Convert the modified SVG to string
    modified_svg = ET.tostring(root, encoding="unicode")

    # Convert SVG to PNG directly with the target size
    png_data = cairosvg.svg2png(
        bytestring=modified_svg.encode("utf-8"),
        output_width=width,
        output_height=height,
    )

    # Save the image directly
    with open(output_path, "wb") as f:
        f.write(png_data)

    print(f"✓ Generated {output_path} ({width}x{height}, cropped to content)")


def main():
    """
    Main function to convert favicon.svg to multiple PNG sizes.
    主函数，将favicon.svg转换为多个PNG尺寸。
    """
    # Define paths
    current_dir = Path(__file__).parent
    svg_path = current_dir / "favicon.svg"

    # Target sizes for favicon
    target_sizes = [32, 128, 256]

    # Check if SVG file exists
    if not svg_path.exists():
        print(f"❌ Error: {svg_path} not found!")
        return

    # Read SVG content to get dimensions
    with open(svg_path, "r", encoding="utf-8") as f:
        svg_content = f.read()

    try:
        svg_width, svg_height = get_svg_dimensions(svg_content)
        print(f"📏 SVG dimensions: {svg_width} x {svg_height}")
        print(f"📐 Aspect ratio: {svg_width/svg_height:.3f}")

        # Generate PNG files for each target size
        for target_size in target_sizes:
            render_width, render_height = calculate_render_size(
                svg_width, svg_height, target_size
            )
            output_path = current_dir / f"favicon-{target_size}x{target_size}.png"

            print(
                f"🎨 Rendering {target_size}x{target_size} (actual: {render_width}x{render_height})..."
            )
            svg_to_png(
                str(svg_path),
                str(output_path),
                render_width,
                render_height,
                svg_content,
            )

        print("\n✨ All favicon sizes generated successfully!")
        print("📁 Generated files:")
        for size in target_sizes:
            print(f"   - favicon-{size}x{size}.png")

    except Exception as e:
        print(f"❌ Error processing SVG: {e}")


if __name__ == "__main__":
    main()
