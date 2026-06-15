import os
from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # Disable decompression bomb protection

public_dir = "public/imagens-menu"
images_to_process = ["boliche.png"]

for img_name in images_to_process:
    input_path = os.path.join(public_dir, img_name)
    if os.path.exists(input_path):
        try:
            print(f"Resizing {input_path}...")
            img = Image.open(input_path)
            
            # Convert to RGBA to ensure alpha channel is preserved properly if needed
            img = img.convert("RGBA")
            
            # Resize down drastically
            max_size = (600, 600)
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Save compressed
            img.save(input_path, format="PNG", optimize=True)
            print(f"Successfully optimized {input_path}")
        except Exception as e:
            print(f"Error on {input_path}: {e}")
    else:
        print(f"File not found: {input_path}")
