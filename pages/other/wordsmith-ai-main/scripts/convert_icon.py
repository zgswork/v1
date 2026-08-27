#!/usr/bin/env python3
"""Convert PNG icon to ICO format for Windows application."""

from PIL import Image
import os

def convert_png_to_ico(input_path: str, output_path: str):
    """Convert PNG to ICO with multiple sizes for Windows."""
    # Open the source image
    img = Image.open(input_path)

    # Convert to RGBA if necessary
    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    # ICO sizes needed for Windows (from largest to smallest)
    sizes = [256, 128, 64, 48, 32, 16]

    # Create resized versions
    icons = []
    for size in sizes:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        icons.append(resized)

    # Save as ICO
    icons[0].save(
        output_path,
        format='ICO',
        sizes=[(s, s) for s in sizes],
        append_images=icons[1:]
    )
    print(f"Created ICO: {output_path}")

def create_png_sizes(input_path: str, output_dir: str):
    """Create PNG files in various sizes for electron-builder."""
    img = Image.open(input_path)

    if img.mode != 'RGBA':
        img = img.convert('RGBA')

    sizes = [512, 256, 128, 64, 48, 32, 16]

    os.makedirs(output_dir, exist_ok=True)

    for size in sizes:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        output_path = os.path.join(output_dir, f'{size}x{size}.png')
        resized.save(output_path, 'PNG')
        print(f"Created PNG: {output_path}")

    # Also save a 256x256 as icon.png for electron-builder
    img_256 = img.resize((256, 256), Image.Resampling.LANCZOS)
    icon_path = os.path.join(output_dir, 'icon.png')
    img_256.save(icon_path, 'PNG')
    print(f"Created PNG: {icon_path}")

if __name__ == '__main__':
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)

    input_png = os.path.join(project_dir, '图标.png')
    build_dir = os.path.join(project_dir, 'build')
    ico_path = os.path.join(build_dir, 'icon.ico')

    # Create build directory
    os.makedirs(build_dir, exist_ok=True)

    # Convert to ICO
    convert_png_to_ico(input_png, ico_path)

    # Create PNG sizes
    create_png_sizes(input_png, build_dir)

    print("\nIcon conversion complete!")
    print(f"ICO file: {ico_path}")
