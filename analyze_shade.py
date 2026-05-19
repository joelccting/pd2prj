import json
import os

import cv2
import numpy as np


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_PATH = os.path.join(BASE_DIR, "ccu_orthophoto.png")
JSON_INPUT_PATH = os.path.join(BASE_DIR, "campus_nodes_edges.json")
JSON_OUTPUT_PATH = os.path.join(BASE_DIR, "campus_nodes_edges_updated.json")
DEBUG_MASK_PATH = os.path.join(BASE_DIR, "debug_tree_mask.png")

MIN_LON, MIN_LAT = 120.460, 23.550
MAX_LON, MAX_LAT = 120.485, 23.570


def get_tree_mask(image_path):
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    b, g, r = cv2.split(img.astype(np.int16))

    # Vegetation should be green-dominant, not merely dark. The old broad HSV
    # range was accepting farm plots, roads, and shadowed roofs as tree pixels.
    exg = 2 * g - r - b
    green_dominance = (g > r + 4) & (g > b + 4) & (exg > 10)
    hsv_green = cv2.inRange(hsv, np.array([35, 25, 25]), np.array([95, 210, 175])) > 0

    tree_mask = np.where(green_dominance & hsv_green, 255, 0).astype(np.uint8)

    kernel = np.ones((3, 3), np.uint8)
    tree_mask = cv2.morphologyEx(tree_mask, cv2.MORPH_OPEN, kernel, iterations=1)
    tree_mask = cv2.morphologyEx(tree_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(tree_mask, connectivity=8)
    cleaned = np.zeros_like(tree_mask)
    for label in range(1, num_labels):
        if stats[label, cv2.CC_STAT_AREA] >= 25:
            cleaned[labels == label] = 255

    cv2.imwrite(DEBUG_MASK_PATH, cleaned)
    print(f"Wrote tree mask: {DEBUG_MASK_PATH}")
    return cleaned


def coord_to_pixel(lat, lng, img_width, img_height):
    if not (MIN_LON <= lng <= MAX_LON and MIN_LAT <= lat <= MAX_LAT):
        return None, None

    x = int((lng - MIN_LON) / (MAX_LON - MIN_LON) * img_width)
    y = int((MAX_LAT - lat) / (MAX_LAT - MIN_LAT) * img_height)
    return max(0, min(x, img_width - 1)), max(0, min(y, img_height - 1))


def get_bresenham_line(x1, y1, x2, y2):
    pixels = []
    dx = abs(x2 - x1)
    dy = abs(y2 - y1)
    x, y = x1, y1
    sx = -1 if x1 > x2 else 1
    sy = -1 if y1 > y2 else 1

    if dx > dy:
        err = dx / 2.0
        while x != x2:
            pixels.append((x, y))
            err -= dy
            if err < 0:
                y += sy
                err += dx
            x += sx
    else:
        err = dy / 2.0
        while y != y2:
            pixels.append((x, y))
            err -= dx
            if err < 0:
                x += sx
                err += dy
            y += sy

    pixels.append((x, y))
    return pixels


def main():
    tree_mask = get_tree_mask(IMAGE_PATH)
    img_height, img_width = tree_mask.shape

    if not os.path.exists(JSON_INPUT_PATH):
        raise FileNotFoundError(f"Could not find JSON file: {JSON_INPUT_PATH}")

    with open(JSON_INPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    node_dict = {node["id"]: node for node in data["nodes"]}
    valid_edges_count = 0
    shaded_edges_count = 0

    for edge in data["edges"]:
        node_a = node_dict.get(edge.get("from"))
        node_b = node_dict.get(edge.get("to"))
        if not node_a or not node_b:
            continue

        x1, y1 = coord_to_pixel(node_a["lat"], node_a["lng"], img_width, img_height)
        x2, y2 = coord_to_pixel(node_b["lat"], node_b["lng"], img_width, img_height)
        if x1 is None or x2 is None:
            edge["tree_shade"] = 0
            continue

        valid_edges_count += 1
        line_pixels = get_bresenham_line(x1, y1, x2, y2)
        tree_pixel_count = sum(1 for px, py in line_pixels if tree_mask[py, px] == 255)
        coverage_ratio = tree_pixel_count / len(line_pixels)

        edge["tree_shade"] = 1 if coverage_ratio > 0.5 else 0
        shaded_edges_count += edge["tree_shade"]

    with open(JSON_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("=" * 40)
    print("Analysis complete.")
    print(f"- Valid edges: {valid_edges_count}")
    print(f"- Tree-shaded edges: {shaded_edges_count}")
    print(f"- Output: {JSON_OUTPUT_PATH}")
    print("=" * 40)


if __name__ == "__main__":
    main()
