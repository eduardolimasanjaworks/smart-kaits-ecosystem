import os
from rembg import remove
from PIL import Image

def process_image(input_path, output_path):
    print(f"Processing: {input_path}")
    try:
        input_image = Image.open(input_path)
        output_image = remove(input_image)
        output_image.save(output_path)
        print(f"Success: {output_path}")
    except Exception as e:
        print(f"Failed to process {input_path}: {e}")

public_dir = "public/imagens-menu"
images_to_process = ["faturamento.png", "restaurante.png", "eventos.png", "ia.png"]

for img_name in images_to_process:
    input_path = os.path.join(public_dir, img_name)
    if os.path.exists(input_path):
        process_image(input_path, input_path)  # Overwrite with transparent version
    else:
        print(f"Not found: {input_path}")

print("Done processing images!")
