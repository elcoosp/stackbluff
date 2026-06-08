from PIL import Image, ImageDraw, ImageFilter

W, H = 1000, 1400
tile_size = 300
circle_radius = 140
blur_radius = 80

mask = Image.new('L', (tile_size, tile_size), 0)
draw = ImageDraw.Draw(mask)
center = tile_size // 2
draw.ellipse((center - circle_radius, center - circle_radius,
              center + circle_radius, center + circle_radius), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(blur_radius))

tile = Image.new('RGBA', (tile_size, tile_size), (255, 255, 255, 255))
tile.putalpha(mask)

full_gradient = Image.new('RGBA', (W, H), (0, 0, 0, 0))
full_gradient.paste(tile, (0, 0), tile)
tile_rot = tile.rotate(180, expand=True)
full_gradient.paste(tile_rot, (W - tile_rot.width, H - tile_rot.height), tile_rot)

full_gradient.save('public/corner-light.png')
print("Generated public/corner-light.png")
