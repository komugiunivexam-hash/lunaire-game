import os
import math
from PIL import Image, ImageOps

diff_dir = r"C:\Users\motta\OneDrive\Desktop\死にゲーを作ろう\そざい\差分ファイル"
output_dir = r"C:\Users\motta\.gemini\antigravity\scratch\factory-invaders\public\assets"

os.makedirs(output_dir, exist_ok=True)

# Poses layout: 2 rows, 3 columns
# Row 0: Pose 1 (Idle), Pose 2 (Telegraph), Pose 3 (Attack)
# Row 1: Pose 4 (Parried), Pose 5 (Staggered/Stun), Pose 6 (Defeat)

boss_configs = {
    "hound": {
        "file": "ドリームハウンド差分.png",
        "poses": {
            "boss_hound_idle": (0, 0, True),       # (col, row, flip_needed) - flip to face right
            "boss_hound_telegraph": (1, 0, True),
            "boss_hound_charge": (2, 0, True),     # Attack state
            "boss_hound_stun": (1, 1, True),       # Staggered/Stun state
        }
    },
    "harpy": {
        "file": "ネオン・ハーピー差分.png",
        "poses": {
            "boss_harpy_idle": (0, 0, True),
            "boss_harpy_telegraph": (1, 0, True),
            "boss_harpy_attack": (2, 0, True),
            "boss_harpy_stun": (1, 1, True),
        }
    }
}

def remove_background(img):
    w, h = img.size
    # Sample background color from the edges
    edge_pixels = []
    for x in range(w):
        edge_pixels.append(img.getpixel((x, 0)))
        edge_pixels.append(img.getpixel((x, h-1)))
    for y in range(1, h-1):
        edge_pixels.append(img.getpixel((0, y)))
        edge_pixels.append(img.getpixel((w-1, y)))
        
    avg_r = sum(p[0] for p in edge_pixels) / len(edge_pixels)
    avg_g = sum(p[1] for p in edge_pixels) / len(edge_pixels)
    avg_b = sum(p[2] for p in edge_pixels) / len(edge_pixels)
    
    bg_color = (avg_r, avg_g, avg_b)
    print(f"  Sampled background color: {bg_color}")
    
    img = img.convert("RGBA")
    datas = img.getdata()
    new_data = []
    
    # Thresholds for background distance
    # Since the background might have noise/gradient, we use a distance threshold
    t1 = 20.0  # Fully transparent below this distance
    t2 = 55.0  # Fully opaque above this distance
    
    for item in datas:
        r, g, b, a = item
        
        # Color distance
        dist = math.sqrt((r - bg_color[0])**2 + (g - bg_color[1])**2 + (b - bg_color[2])**2)
        
        # Also check brightness. If a pixel is very bright, it must be part of the glow
        brightness = max(r, g, b)
        
        if dist < t1:
            new_data.append((0, 0, 0, 0))
        elif dist < t2:
            # Interpolate alpha
            alpha = int(((dist - t1) / (t2 - t1)) * 255)
            # If it's a neon glow (bright purple/pink), keep it more opaque
            if brightness > 100:
                alpha = max(alpha, 180)
            
            if alpha > 0:
                # Color correction to restore color vibrancy from dark blend
                ratio = 255.0 / alpha
                ratio = min(2.0, ratio)
                nr = min(255, int(r * ratio))
                ng = min(255, int(g * ratio))
                nb = min(255, int(b * ratio))
                new_data.append((nr, ng, nb, alpha))
            else:
                new_data.append((0, 0, 0, 0))
        else:
            new_data.append((r, g, b, 255))
            
    img.putdata(new_data)
    return img

def crop_to_content(img):
    alpha = img.split()[-1]
    bbox = alpha.getbbox()
    if bbox:
        left, top, right, bottom = bbox
        # Add a small padding of 4px
        left = max(0, left - 4)
        top = max(0, top - 4)
        right = min(img.width, right + 4)
        bottom = min(img.height, bottom + 4)
        return img.crop((left, top, right, bottom))
    return img

def main():
    for boss_name, cfg in boss_configs.items():
        file_path = os.path.join(diff_dir, cfg["file"])
        if not os.path.exists(file_path):
            print(f"Error: {file_path} does not exist!")
            continue
            
        print(f"Processing boss: {boss_name} ({cfg['file']})...")
        sheet = Image.open(file_path)
        sheet_w, sheet_h = sheet.size
        
        # Grid dimensions
        cell_w = sheet_w // 3
        cell_h = sheet_h // 2
        
        for pose_name, (col, row, flip) in cfg["poses"].items():
            print(f"  Extracting pose '{pose_name}' from grid (col={col}, row={row})...")
            
            # Define crop box
            left = col * cell_w
            top = row * cell_h
            right = (col + 1) * cell_w
            bottom = (row + 1) * cell_h
            
            # Crop the cell
            cell = sheet.crop((left, top, right, bottom))
            
            # Remove background
            cell_trans = remove_background(cell)
            
            # Crop to content
            cell_cropped = crop_to_content(cell_trans)
            
            # Flip if needed (to make them face right by default)
            if flip:
                cell_cropped = ImageOps.mirror(cell_cropped)
                
            # Save the cropped sprite
            out_path = os.path.join(output_dir, f"{pose_name}.png")
            cell_cropped.save(out_path, "PNG")
            print(f"  Saved to {out_path} (Size: {cell_cropped.size})")

    print("Sprite extraction from diff files complete!")

if __name__ == "__main__":
    main()
