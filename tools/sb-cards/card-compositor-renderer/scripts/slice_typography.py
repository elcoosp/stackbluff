import os
import sys
import cv2
import numpy as np
from PIL import Image

def merge_nearby_components(components, max_gap=10, vertical_tolerance=5):
    if not components:
        return []
    comps = sorted(components, key=lambda b: b[0])
    merged = []
    current = list(comps[0])
    for next_comp in comps[1:]:
        x1, y1, x2, y2 = current
        nx1, ny1, nx2, ny2 = next_comp
        horizontal_gap = nx1 - x2
        vertical_overlap = max(0, min(y2, ny2) - max(y1, ny1))
        if horizontal_gap <= max_gap and vertical_overlap > 0:
            current = [min(x1, nx1), min(y1, ny1), max(x2, nx2), max(y2, ny2)]
        else:
            merged.append(tuple(current))
            current = list(next_comp)
    merged.append(tuple(current))
    return merged

def slice_typography_grid(input_path, output_folder, suffix=""):
    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"Error: cannot load {input_path}")
        return
    if img.shape[2] == 4:
        alpha = img[:, :, 3]
    else:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, alpha = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
    mask = (alpha > 0).astype(np.uint8) * 255

    h_proj = np.sum(mask, axis=1) // 255
    rows_with_content = np.where(h_proj > 10)[0]
    if len(rows_with_content) < 2:
        split_y = img.shape[0] // 2
    else:
        gaps = np.diff(rows_with_content)
        split_idx = np.argmax(gaps)
        split_y = (rows_with_content[split_idx] + rows_with_content[split_idx + 1]) // 2

    top_mask = mask[:split_y, :]
    bottom_mask = mask[split_y:, :]

    def crop_to_bbox(mask):
        rows = np.any(mask, axis=1)
        cols = np.any(mask, axis=0)
        if not rows.any() or not cols.any():
            return mask, 0, 0
        y_min, y_max = np.where(rows)[0][[0, -1]]
        x_min, x_max = np.where(cols)[0][[0, -1]]
        return mask[y_min:y_max+1, x_min:x_max+1], x_min, y_min

    top_cropped, top_off_x, top_off_y = crop_to_bbox(top_mask)
    bottom_cropped, bottom_off_x, bottom_off_y = crop_to_bbox(bottom_mask)

    def get_components(mask, min_area=5):
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        comps = []
        for i in range(1, num_labels):
            x, y, w, h, area = stats[i]
            if area >= min_area:
                comps.append((x, y, x+w, y+h))
        return comps

    top_comps = get_components(top_cropped, min_area=5)
    bottom_comps = get_components(bottom_cropped, min_area=5)
    top_comps = merge_nearby_components(top_comps, max_gap=8, vertical_tolerance=5)
    bottom_comps = merge_nearby_components(bottom_comps, max_gap=8, vertical_tolerance=5)

    top_comps.sort(key=lambda b: b[0])
    bottom_comps.sort(key=lambda b: b[0])

    expected_chars = ["a", "k", "q", "j", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
    if len(top_comps) == 14:
        last = top_comps[-2]
        second_last = top_comps[-1]
        merged = (min(last[0],second_last[0]), min(last[1],second_last[1]), max(last[2],second_last[2]), max(last[3],second_last[3]))
        top_comps = top_comps[:-2] + [merged]
    if len(bottom_comps) == 14:
        last = bottom_comps[-2]
        second_last = bottom_comps[-1]
        merged = (min(last[0],second_last[0]), min(last[1],second_last[1]), max(last[2],second_last[2]), max(last[3],second_last[3]))
        bottom_comps = bottom_comps[:-2] + [merged]

    pil_img = Image.open(input_path).convert("RGBA")

    def save_row(merged_comps, variant, y_global_offset):
        for idx, (x1, y1, x2, y2) in enumerate(merged_comps):
            if idx >= len(expected_chars):
                break
            ch = expected_chars[idx]
            if variant == "dark":
                left = x1 + top_off_x
                right = x2 + top_off_x
                top = y1 + top_off_y
                bottom = y2 + top_off_y
            else:
                left = x1 + bottom_off_x
                right = x2 + bottom_off_x
                top = y1 + bottom_off_y + split_y
                bottom = y2 + bottom_off_y + split_y
            if left >= right or top >= bottom:
                continue
            char_img = pil_img.crop((left, top, right, bottom))
            bbox = char_img.getbbox()
            if bbox:
                char_img = char_img.crop(bbox)
            if char_img.getbbox() is None:
                continue
            prefix = "char" if ch in ["a","k","q","j"] else "num"
            out_name = f"{prefix}-{ch}_{variant}{suffix}.png"
            out_path = os.path.join(output_folder, out_name)
            char_img.save(out_path)
            print(f"Saved {out_name}")

    save_row(top_comps, "dark", 0)
    save_row(bottom_comps, "accent", split_y)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python slice_typo.py <input_image> <output_folder> [suffix]")
        sys.exit(1)
    input_image = sys.argv[1]
    output_folder = sys.argv[2]
    suffix = sys.argv[3] if len(sys.argv) > 3 else ""
    os.makedirs(output_folder, exist_ok=True)
    slice_typography_grid(input_image, output_folder, suffix)
