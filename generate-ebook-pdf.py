import argparse
import json
import os
import re
from pathlib import Path

from PIL import Image
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parent
PAGE = 1000
GREEN = HexColor("#294B32")
ORANGE = HexColor("#E8662F")
GOLD = HexColor("#C99A49")
CREAM = HexColor("#FFF7E9")
PAPER = HexColor("#FFFDF8")
INK = HexColor("#28352D")
MUTED = HexColor("#756657")


def register_fonts():
    pdfmetrics.registerFont(TTFont("NiliTitle", str(ROOT / "assets/fonts/Baloo2-Variable.ttf")))
    pdfmetrics.registerFont(TTFont("NiliBody", str(ROOT / "assets/fonts/Kalam-Bold.ttf")))
    pdfmetrics.registerFont(TTFont("NiliScript", str(ROOT / "assets/fonts/Caveat-Variable.ttf")))


def clean(value):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str(value or ""))).strip()


def split_lines(value):
    text = str(value or "").replace("\r", "\n")
    parts = re.split(r"\n+|(?<=\.)\s+(?=[A-ZÇĞİÖŞÜ0-9])|(?=\d{1,2}[.)]\s+)", text)
    cleaned = [re.sub(r"^\s*\d{1,2}[.)-]?\s*", "", clean(item)) for item in parts]
    return [item for item in cleaned if item]


def ingredients_for(recipe):
    raw = (
        recipe.get("adminIngredientsTr")
        or recipe.get("ingredientsText")
        or recipe.get("ingredients")
        or recipe.get("extendedIngredients")
        or recipe.get("usedIngredients")
        or ""
    )
    if isinstance(raw, list):
        return [clean(item.get("original") or item.get("name") or item) for item in raw]
    return [clean(item) for item in re.split(r"\n+|\s*,\s*(?=\d)", str(raw)) if clean(item)]


def steps_for(recipe):
    analyzed = recipe.get("analyzedInstructions") or []
    values = []
    for block in analyzed:
        for item in block.get("steps", []) if isinstance(block, dict) else []:
            value = clean(item.get("step") if isinstance(item, dict) else item)
            if value:
                values.append(value)
    if values:
        return values
    return split_lines(recipe.get("adminInstructionsTr") or recipe.get("instructions") or "")


def image_path(recipe):
    values = [recipe.get("mediaUrl"), recipe.get("image"), recipe.get("originalMediaUrl"), recipe.get("mediaFile")]
    for value in values:
        if not value or str(value).startswith(("http://", "https://")):
            continue
        candidate = ROOT / str(value).lstrip("/").replace("/", os.sep)
        if candidate.exists():
            return candidate
        name = Path(str(value)).name
        for folder in (ROOT / "optimized-images/recipe-import", ROOT / "recipe-import-images"):
            candidate = folder / name
            if candidate.exists():
                return candidate
    return ROOT / "logo.jpeg"


def draw_crop(c, source, x, y, width, height):
    with Image.open(source) as image:
        iw, ih = image.size
        target_ratio = width / height
        image_ratio = iw / ih
        if image_ratio > target_ratio:
            crop_width = int(ih * target_ratio)
            left = (iw - crop_width) // 2
            image = image.crop((left, 0, left + crop_width, ih))
        else:
            crop_height = int(iw / target_ratio)
            top = (ih - crop_height) // 2
            image = image.crop((0, top, iw, top + crop_height))
        image = image.convert("RGB")
        c.drawImage(ImageReader(image), x, y, width, height, mask="auto")


def rounded_panel(c, x, y, w, h, fill=PAPER, stroke=GOLD, radius=22, line=1.5):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(line)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def draw_brand(c, x, y):
    c.setFont("NiliScript", 28)
    c.setFillColor(GREEN)
    c.drawString(x, y, "Nili's Kitchen")
    c.setStrokeColor(ORANGE)
    c.setLineWidth(3)
    c.line(x, y - 8, x + 155, y - 8)


def draw_cover(c, title, recipes):
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE, PAGE, fill=1, stroke=0)
    first_image = image_path(recipes[0]) if recipes else ROOT / "logo.jpeg"
    draw_crop(c, first_image, 485, 0, 515, PAGE)
    c.setFillColor(Color(1, .97, .91, alpha=.94))
    c.rect(0, 0, 555, PAGE, fill=1, stroke=0)
    c.setStrokeColor(GOLD)
    c.setLineWidth(4)
    c.rect(20, 20, 960, 960, fill=0, stroke=1)
    c.setLineWidth(1)
    c.rect(29, 29, 942, 942, fill=0, stroke=1)
    draw_brand(c, 70, 900)
    c.setFillColor(ORANGE)
    c.setFont("NiliTitle", 18)
    c.drawString(70, 785, "SANA ÖZEL E-TARİF KİTABI")
    title_style = ParagraphStyle("cover", fontName="NiliTitle", fontSize=66, leading=61, textColor=GREEN)
    p = Paragraph(title, title_style)
    p.wrapOn(c, 405, 280)
    p.drawOn(c, 70, 485)
    c.setFillColor(GREEN)
    c.roundRect(70, 380, 310, 62, 31, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setFont("NiliBody", 23)
    c.drawCentredString(225, 400, f"{len(recipes)} seçilmiş tarif")
    c.setFillColor(MUTED)
    c.setFont("NiliScript", 25)
    c.drawString(70, 92, "Sevgiyle seçildi, keyifle hazırlandı.")
    c.bookmarkPage("cover")
    c.showPage()


def draw_toc(c, recipes):
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE, PAGE, fill=1, stroke=0)
    rounded_panel(c, 34, 34, 932, 932, fill=PAPER, stroke=GOLD, radius=26, line=2)
    draw_brand(c, 70, 912)
    c.setFillColor(GREEN)
    c.setFont("NiliTitle", 48)
    c.drawString(70, 830, "İçindekiler")
    c.setFillColor(MUTED)
    c.setFont("NiliBody", 17)
    c.drawString(70, 794, "Yemek adına tıklayarak doğrudan tarif sayfasına gidebilirsin.")
    columns = 2 if len(recipes) > 12 else 1
    rows = (len(recipes) + columns - 1) // columns
    for index, recipe in enumerate(recipes):
        column = index // rows
        row = index % rows
        x = 78 + column * 445
        y = 730 - row * min(62, 620 / max(rows, 1))
        c.setFillColor(ORANGE)
        c.circle(x + 17, y + 8, 17, fill=1, stroke=0)
        c.setFillColor(PAPER)
        c.setFont("NiliTitle", 13)
        c.drawCentredString(x + 17, y + 3, str(index + 1))
        c.setFillColor(GREEN)
        c.setFont("NiliTitle", 19)
        title = clean(recipe.get("title") or recipe.get("adminTitleTr") or "Tarif")[:31]
        c.drawString(x + 48, y + 3, title)
        c.setFillColor(MUTED)
        c.setFont("NiliBody", 11)
        c.drawString(x + 48, y - 15, clean(recipe.get("cuisine") or recipe.get("country") or "Dünya mutfağı")[:40])
        c.linkRect("", f"recipe-{index + 1}", (x, y - 21, x + 405, y + 27), relative=0, thickness=0)
    c.bookmarkPage("contents")
    c.addOutlineEntry("İçindekiler", "contents", level=0)
    c.showPage()


def draw_recipe_page(c, recipe, index):
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE, PAGE, fill=1, stroke=0)
    draw_crop(c, image_path(recipe), 0, 585, PAGE, 415)
    c.setFillColor(Color(1, .97, .91, alpha=.92))
    c.rect(0, 565, 555, 435, fill=1, stroke=0)
    c.setStrokeColor(GOLD)
    c.setLineWidth(3)
    c.rect(18, 18, 964, 964, fill=0, stroke=1)
    draw_brand(c, 55, 938)
    cuisine = clean(recipe.get("cuisine") or recipe.get("country") or "Dünya mutfağı")
    c.setFillColor(ORANGE)
    c.setFont("NiliBody", 18)
    c.drawString(55, 840, cuisine[:45])
    title_style = ParagraphStyle("recipe-title", fontName="NiliTitle", fontSize=46, leading=43, textColor=GREEN)
    title = clean(recipe.get("title") or recipe.get("adminTitleTr") or "Tarif")
    p = Paragraph(title, title_style)
    p.wrapOn(c, 450, 150)
    p.drawOn(c, 55, 685)
    c.setFillColor(GREEN)
    c.roundRect(55, 615, 385, 48, 24, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setFont("NiliBody", 16)
    meta = f"{recipe.get('servings') or 4} kişilik  •  {recipe.get('readyInMinutes') or 30} dakika"
    c.drawCentredString(247, 631, meta)

    rounded_panel(c, 42, 62, 432, 470, fill=PAPER, stroke=HexColor("#E6C89C"), radius=22, line=1.3)
    rounded_panel(c, 496, 62, 462, 470, fill=PAPER, stroke=HexColor("#E6C89C"), radius=22, line=1.3)
    c.setFillColor(ORANGE)
    c.roundRect(62, 481, 205, 48, 20, fill=1, stroke=0)
    c.setFillColor(GREEN)
    c.roundRect(516, 481, 238, 48, 20, fill=1, stroke=0)
    c.setFillColor(PAPER)
    c.setFont("NiliTitle", 19)
    c.drawCentredString(164, 496, "MALZEMELER")
    c.drawCentredString(635, 496, "NASIL YAPILIR")

    ingredients = ingredients_for(recipe)
    steps = steps_for(recipe)
    ingredient_size = 13 if len(ingredients) <= 12 else 11 if len(ingredients) <= 18 else 9
    step_size = 13 if len(steps) <= 8 else 11 if len(steps) <= 12 else 9
    ing_style = ParagraphStyle("ing", fontName="NiliBody", fontSize=ingredient_size, leading=ingredient_size * 1.32, textColor=INK, bulletIndent=0, leftIndent=18)
    step_style = ParagraphStyle("step", fontName="NiliBody", fontSize=step_size, leading=step_size * 1.3, textColor=INK, bulletIndent=0, leftIndent=24)
    y = 453
    for item in ingredients[:24]:
        p = Paragraph(f"<font color='#E8662F'>●</font> {item}", ing_style)
        _, h = p.wrap(385, 52)
        if y - h < 82:
            break
        p.drawOn(c, 72, y - h)
        y -= h + 4
    y = 453
    for number, item in enumerate(steps[:16], 1):
        p = Paragraph(f"<font color='#49743B'><b>{number}.</b></font> {item}", step_style)
        _, h = p.wrap(405, 72)
        if y - h < 82:
            break
        p.drawOn(c, 523, y - h)
        y -= h + 7

    c.setFillColor(MUTED)
    c.setFont("NiliBody", 10)
    c.drawCentredString(500, 35, f"{index + 2}  •  Nili's Kitchen")
    destination = f"recipe-{index}"
    c.bookmarkPage(destination)
    c.addOutlineEntry(title, destination, level=0)
    c.linkRect("", "contents", (45, 20, 230, 50), relative=0, thickness=0)
    c.showPage()


def load_recipes(input_path, count):
    if input_path:
        payload = json.loads(Path(input_path).read_text(encoding="utf-8"))
        recipes = payload.get("recipes", payload) if isinstance(payload, dict) else payload
    else:
        recipes = json.loads((ROOT / "approved-recipes/approved_recipes.json").read_text(encoding="utf-8"))
    return [item for item in recipes if image_path(item).exists()][:count]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input")
    parser.add_argument("--output", default=str(ROOT / "output/pdf/nilis-kitchen-10-tarif.pdf"))
    parser.add_argument("--title", default="Benim Dünya Mutfağım")
    parser.add_argument("--count", type=int, default=10)
    args = parser.parse_args()
    register_fonts()
    recipes = load_recipes(args.input, args.count)
    if not recipes:
        raise SystemExit("PDF için tarif bulunamadı")
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output), pagesize=(PAGE, PAGE), pageCompression=1)
    c.setTitle(args.title)
    c.setAuthor("Nili's Kitchen")
    draw_cover(c, args.title, recipes)
    draw_toc(c, recipes)
    for index, recipe in enumerate(recipes, 1):
        draw_recipe_page(c, recipe, index)
    c.save()
    print(json.dumps({"output": str(output), "recipes": len(recipes), "pages": len(recipes) + 2}, ensure_ascii=False))


if __name__ == "__main__":
    main()
