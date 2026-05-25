import os
import math
from PIL import Image, ImageOps, ImageDraw

diff_dir = r"C:\Users\motta\OneDrive\Desktop\死にゲーを作ろう\そざい\差分ファイル"
output_dir = r"C:\Users\motta\.gemini\antigravity\scratch\factory-invaders\public\assets"

os.makedirs(output_dir, exist_ok=True)

boss_configs = {
    "hound": {
        "file": "ドリームハウンド差分.png",
        "poses": {
            # (col, row, flip_needed, list_of_erase_boxes)
            "boss_hound_idle": (0, 0, True, [
                [0, 0, 557, 80],       # Top title area
                [150, 350, 410, 420],  # Bottom label
                [0, 430, 557, 470],    # Bottom border
                [0, 0, 20, 470],       # Left border
                [537, 0, 557, 470]     # Right border
            ]),
            "boss_hound_telegraph": (1, 0, True, [
                [0, 0, 557, 80],       # Top title area
                [150, 350, 410, 420],  # Bottom label
                [0, 430, 557, 470],    # Bottom border
                [0, 0, 20, 470],       # Left border
                [537, 0, 557, 470]     # Right border
            ]),
            "boss_hound_charge": (2, 0, True, [
                [0, 0, 557, 80],       # Top title area
                [150, 350, 410, 420],  # Bottom label
                [0, 430, 557, 470],    # Bottom border
                [0, 0, 20, 470],       # Left border
                [537, 0, 557, 470]     # Right border
            ]),
            "boss_hound_stun": (1, 1, True, [
                [150, 350, 410, 420],  # Bottom label
                [0, 430, 557, 470],    # Bottom border
                [0, 0, 20, 470],       # Left border
                [537, 0, 557, 470]     # Right border
            ]),
        }
    },
    "harpy": {
        "file": "ネオン・ハーピー差分.png",
        "poses": {
            # (col, row, flip_needed, list_of_erase_boxes)
            "boss_harpy_idle": (0, 0, True, [
                [0, 0, 557, 202],      # Complete top area including label & title
                [0, 202, 60, 470],     # Left border
                [497, 202, 557, 470],  # Right border
                [0, 430, 557, 470]     # Bottom border
            ]),
            "boss_harpy_telegraph": (1, 0, True, [
                [0, 0, 557, 235],      # Complete top area including label & title
                [0, 235, 60, 470],     # Left border
                [497, 235, 557, 470],  # Right border
                [0, 430, 557, 470]     # Bottom border
            ]),
            "boss_harpy_attack": (2, 0, True, [
                [0, 0, 557, 198],      # Top area
                [0, 198, 220, 240],    # Left side below 198
                [220, 198, 350, 210],  # "ATTACK" text in center
                [350, 198, 557, 240],  # Right side below 198
                [0, 430, 557, 470]     # Bottom border
            ]),
            "boss_harpy_stun": (1, 1, True, [
                [0, 0, 557, 160],      # Top area including label
                [0, 430, 557, 470]     # Bottom border
            ]),
        }
    }
}

def remove_background_bfs(img, is_harpy):
    img = img.convert("RGBA")
    w, h = img.size
    pixels = img.load()
    
    visited = [[False for _ in range(h)] for _ in range(w)]
    queue = []
    
    # Background color range check
    def is_bg_color(r, g, b):
        if is_harpy:
            return r < 38 and g < 38 and b < 48
        else:
            return r < 40 and g < 40 and b < 48
        
    # Seed BFS from all borders
    for x in range(w):
        for y in [0, h - 1]:
            r, g, b = pixels[x, y][:3]
            if is_bg_color(r, g, b):
                queue.append((x, y))
                visited[x][y] = True
    for y in range(h):
        for x in [0, w - 1]:
            if not visited[x][y]:
                r, g, b = pixels[x, y][:3]
                if is_bg_color(r, g, b):
                    queue.append((x, y))
                    visited[x][y] = True
                    
    # BFS traversal
    idx = 0
    while idx < len(queue):
        cx, cy = queue[idx]
        cr, cg, cb = pixels[cx, cy][:3]
        idx += 1
        
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                nr, ng, nb = pixels[nx, ny][:3]
                if is_bg_color(nr, ng, nb):
                    # Color difference to neighbor should be small to prevent leak
                    dist = math.sqrt((nr - cr)**2 + (ng - cg)**2 + (nb - cb)**2)
                    if dist < 12.0:
                        visited[nx][ny] = True
                        queue.append((nx, ny))
                        
    # Apply alpha channel
    for x in range(w):
        for y in range(h):
            if visited[x][y]:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                r, g, b, a = pixels[x, y]
                pixels[x, y] = (r, g, b, 255)
                
    return img

def crop_to_content(img):
    alpha = img.split()[-1]
    bbox = alpha.getbbox()
    if bbox:
        left, top, right, bottom = bbox
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
        
        # Sample base background color from (5,5)
        bg_color = sheet.getpixel((5, 5))
        
        # Grid cell dimensions
        cell_w = sheet_w // 3
        cell_h = sheet_h // 2
        
        for pose_name, (col, row, flip, erase_boxes) in cfg["poses"].items():
            print(f"  Extracting pose '{pose_name}' (col={col}, row={row})...")
            
            # Base cell box
            left = col * cell_w
            top = row * cell_h
            right = (col + 1) * cell_w
            bottom = (row + 1) * cell_h
            
            # Crop the cell
            cell = sheet.crop((left, top, right, bottom))
            
            # Blank out the label boxes
            if erase_boxes:
                draw = ImageDraw.Draw(cell)
                for box in erase_boxes:
                    draw.rectangle(box, fill=bg_color)
            
            # Crop slightly to exclude original borders
            cropped_cell = cell.crop((20, 20, cell_w - 20, cell_h - 20))
            
            # Remove background using BFS
            cell_trans = remove_background_bfs(cropped_cell, is_harpy=(boss_name == "harpy"))
            
            # Crop to content
            cell_cropped = crop_to_content(cell_trans)
            
            # Flip if needed
            if flip:
                cell_cropped = ImageOps.mirror(cell_cropped)
                
            # Save the cropped sprite
            out_path = os.path.join(output_dir, f"{pose_name}.png")
            cell_cropped.save(out_path, "PNG")
            print(f"  Saved to {out_path} (Size: {cell_cropped.size})")

    print("Sprite extraction v6 complete!")

if __name__ == "__main__":
    main()
