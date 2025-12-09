from PIL import Image
import sys

def crop_transparent(image_path):
    try:
        img = Image.open(image_path)
        img = img.convert("RGBA")
        
        # Get bounding box of non-zero alpha pixels
        bbox = img.getbbox()
        
        if bbox:
            cropped = img.crop(bbox)
            # Add a small padding (optional, e.g. 5%)
            # For max size, minimal padding is best. Let's stick to tight crop for "enlarge" effect.
            cropped.save(image_path)
            print(f"Successfully cropped {image_path}. New size: {cropped.size}")
        else:
            print("Image is fully transparent?")
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    crop_transparent("app/icon.png")
