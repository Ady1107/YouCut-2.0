import sys
import os
from PIL import Image, ImageChops

def main():
    if len(sys.argv) < 5:
        print("Usage: python diff-settings.py <design_png> <actual_png> <diff_png> <side_by_side_png>")
        sys.exit(1)

    design_path = sys.argv[1]
    actual_path = sys.argv[2]
    diff_path = sys.argv[3]
    side_by_side_path = sys.argv[4]

    img_design = Image.open(design_path).convert('RGBA')
    img_actual = Image.open(actual_path).convert('RGBA')

    w, h = img_design.size
    aw, ah = img_actual.size

    if (w, h) != (aw, ah):
        print(f"Dimension mismatch: Design={w}x{h}, Actual={aw}x{ah}")
        img_actual = img_actual.resize((w, h), Image.Resampling.LANCZOS)

    pixels_design = img_design.load()
    pixels_actual = img_actual.load()

    diff_img = Image.new('RGBA', (w, h), (0, 0, 0, 255))
    diff_pixels = diff_img.load()

    total_pixels = w * h
    diff_count_exact = 0
    diff_count_perceptual = 0

    # Color distance threshold (anti-aliasing tolerance: sum of channel diffs > 25)
    for y in range(h):
        for x in range(w):
            r1, g1, b1, _ = pixels_design[x, y]
            r2, g2, b2, _ = pixels_actual[x, y]

            dist = abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2)
            if dist > 0:
                diff_count_exact += 1
            if dist > 25:
                diff_count_perceptual += 1
                # Mark difference in magenta
                diff_pixels[x, y] = (255, 0, 128, 255)
            else:
                # Dim background for context
                diff_pixels[x, y] = (r1 // 4, g1 // 4, b1 // 4, 255)

    diff_img.save(diff_path)

    # Create Side-by-Side (Design on left, Actual on right)
    side_by_side = Image.new('RGBA', (w * 2, h))
    side_by_side.paste(img_design, (0, 0))
    side_by_side.paste(img_actual, (w, 0))
    side_by_side.save(side_by_side_path)

    pct_exact = (diff_count_exact / total_pixels) * 100.0
    pct_perceptual = (diff_count_perceptual / total_pixels) * 100.0

    print("================ PIXEL DIFF RESULTS ================")
    print(f"Total pixels: {total_pixels:,}")
    print(f"Exact differing pixels: {diff_count_exact:,} ({pct_exact:.2f}%)")
    print(f"Perceptual differing pixels (delta > 25): {diff_count_perceptual:,} ({pct_perceptual:.2f}%)")
    print(f"Diff image saved to: {diff_path}")
    print(f"Side-by-side comparison saved to: {side_by_side_path}")
    print("====================================================")

if __name__ == '__main__':
    main()
