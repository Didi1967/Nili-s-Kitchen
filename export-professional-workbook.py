"""Render the published snapshot into a copy of the professional workbook."""
import json
import re
import sys
from collections import defaultdict
from copy import copy
from openpyxl import load_workbook
from openpyxl.formula.translate import Translator
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.cell_range import MultiCellRange

TRANSFER = "Sisteme Aktarım"
MAIN = "Tarifler"
ING = "Malzemeler"
STEPS = "Hazırlama Adımları"
EXTRA = "Ek İçerikler"
CARD = "Kart İçeriği"
BOOK = "E-Kitap İçeriği"
MEDIA = "Medya"
QC = "Kalite Kontrol"
DATA = [TRANSFER, MAIN, ING, STEPS, EXTRA, CARD, BOOK, MEDIA, QC]


def resize(ranges, end):
    result = MultiCellRange(str(ranges))
    for area in list(result.ranges):
        if area.min_row >= 4 and area.max_row >= 4:
            result.remove(str(area))
            area.max_row = max(area.max_row, end)
            result.add(area)
    return result


def rebuild(ws, records):
    # Hold the original cells independently of the output grid. Never use
    # another recipe's literals when a row is new.
    originals = defaultdict(list)
    sample = None
    for row in ws.iter_rows(min_row=4):
        if re.fullmatch(r"NK-\d+", str(row[0].value)):
            originals[row[0].value].append(row)
            if sample is None:
                sample = row
    if sample is None:
        raise ValueError(f"{ws.title}: missing model row")
    heights = {n: d.height for n, d in ws.row_dimensions.items()}
    ws.delete_rows(4, ws.max_row - 3)
    end = 3
    for old_id, part, values in records:
        group = originals.get(old_id, ())
        original = group[part] if part < len(group) else None
        source = original or sample
        end += 1
        ws.row_dimensions[end].height = heights.get(source[0].row)
        for cell in source:
            dest = ws.cell(end, cell.column)
            dest._style = copy(cell._style)
            if cell.column in values:
                value = values[cell.column]
                dest.value = value
                if isinstance(value, str):
                    dest.data_type = "s"
                    if value.startswith(("https://", "http://")) and cell.hyperlink:
                        dest.hyperlink = value
            elif cell.data_type == "f":
                dest.value = Translator(cell.value, origin=cell.coordinate).translate_formula(dest.coordinate)
            elif original:
                dest.value = cell.value
                dest.data_type = cell.data_type
                if cell.hyperlink:
                    dest.hyperlink = copy(cell.hyperlink)
                if cell.comment:
                    dest.comment = copy(cell.comment)
    bound = f"A3:{get_column_letter(len(sample))}{max(4, end)}"
    for table in ws.tables.values():
        table.ref = bound
        if table.autoFilter:
            table.autoFilter.ref = bound
    if ws.auto_filter.ref:
        ws.auto_filter.ref = bound
    for validation in ws.data_validations.dataValidation:
        validation.sqref = resize(validation.sqref, end)
    for cf in list(ws.conditional_formatting):
        updated = resize(cf.sqref, end)
        if str(updated) != str(cf.sqref):
            rules = ws.conditional_formatting[cf]
            del ws.conditional_formatting[cf]
            for rule in rules:
                ws.conditional_formatting.add(str(updated), rule)


def populated(mapping):
    return {k: v for k, v in mapping.items() if v is not None and v != ""}


def render(template, output, recipes):
    wb = load_workbook(template)
    old = {}
    old_ids = set()
    for row in wb[TRANSFER].iter_rows(min_row=4, values_only=True):
        if not row[0]:
            continue
        key = str(row[1] or "")
        if not key or key in old or row[0] in old_ids:
            raise ValueError("Ambiguous template identity")
        old[key] = row
        old_ids.add(row[0])
    records = {sheet: [] for sheet in DATA}
    detail_counts = {}
    for sheet in [ING, STEPS]:
        counts = defaultdict(int)
        for (rid,) in wb[sheet].iter_rows(min_row=4, max_col=1, values_only=True):
            counts[rid] += 1
        detail_counts[sheet] = counts
    ids, keys = set(), set()
    for item in recipes:
        key, rid = str(item["key"] or ""), item["nk"]
        if not key or key in keys or rid in ids:
            raise ValueError("Ambiguous live identity")
        keys.add(key)
        ids.add(rid)
        prior = old.get(key)
        oid = prior[0] if prior else None
        r = item["recipe"]
        name, ing, steps, photo = (item[k] for k in ("name", "ingredients", "steps", "photo"))
        prep, cook = r.get("prepTimeText") or r.get("prepTime"), r.get("cookTimeText")
        def add(sheet, fields):
            records[sheet].append((oid, 0, {1: rid, **fields}))
        add(TRANSFER, dict(enumerate([key, name, r.get("type"), r.get("cuisine"), r.get("servings"), prep, cook, ing, steps, photo, item["tags"], r.get("seoTitle") or name, r.get("seoDescription"), "Evet"], 2)))
        add(MAIN, {**populated({2:r.get("originalTitle"), 4:r.get("descriptionTr"), 5:r.get("slug"), 8:r.get("relatedCountryRegion"), 9:r.get("region"), 10:r.get("kitchen"), 13:r.get("passiveTimeText"), 16:r.get("temperatureText"), 17:r.get("difficulty"), 18:r.get("allergens"), 20:r.get("sourceUrl"), 22:r.get("editorialStatus"), 24:r.get("verificationStatus")}), **({2:name} if not prior and not r.get("originalTitle") else {}), 3:name, 6:r.get("type"), 7:r.get("cuisine"), 11:r.get("servings"), 12:prep, 14:cook, 19:photo, 21:key, 23:"Evet"})
        changed = {}
        for sheet, value, col in [(ING, ing, 8), (STEPS, steps, 9)]:
            same = prior and str(prior[col] or "").strip() == value.strip() and detail_counts[sheet][oid]
            changed[sheet] = not same
            lines = value.splitlines()
            count = detail_counts[sheet][oid] if same else len(lines)
            for i in range(count):
                values = {1:rid, 2:i+1, (13 if sheet == ING else 10):f"{rid}|{i+1:02d}"}
                if not same:
                    line = lines[i]
                    cols = (6,14,15) if sheet == ING else (4,11,12)
                    values.update(dict.fromkeys(cols, line))
                records[sheet].append((oid if same else None, i, values))
        add(EXTRA, populated(dict(enumerate([r.get(k) for k in ("tip","servingSuggestion","storageSuggestion","alternativeIngredients","cultureOrigin","verificationSource","verificationStatus")], 2))))
        add(CARD, populated({3:r.get("cardSummary"), 5:r.get("cardIngredients") or (ing if changed[ING] else None), 6:r.get("cardSteps") or (steps if changed[STEPS] else None)}))
        add(BOOK, {**populated({3:r.get("ebookIntro"), 7:r.get("donenessControl")}), 4:ing, 5:steps})
        add(MEDIA, {2:photo, 3:"Mevcut" if photo else "Eksik", **populated({4:r.get("recipeCardUrl"), 6:r.get("ebookImageUrl"), 7:r.get("imageAltText")})})
        quality = populated({19:r.get("editorDecision"), 23:r.get("editorNote")})
        if changed[ING] or changed[STEPS] or not prior:
            quality = {**dict.fromkeys(range(2,20)), 3:len(steps.splitlines()), 5:len(steps), 10:"Uygun" if photo else "Eksik", 19:"Bekliyor", 21:None, 22:None, 23:"Editör kontrolü bekleniyor"}
        add(QC, quality)
    for sheet in DATA:
        rebuild(wb[sheet], records[sheet])
    wb["Özet"]["A1"] = f"NILI’S KITCHEN | {len(ids):,} TARİFLİK ANA EXCEL".replace(",", ".")
    wb["Özet"]["C4"] = len(ids)
    wb["Özet"]["F4"] = "İndirme anında yayında olan onaylı tarifler."
    for row in wb["Canlı Eşleştirme"].iter_rows(min_row=4):
        if row[0].value == "Hedef aktif tarif":
            row[1].value = len(ids)
    wb.calculation.fullCalcOnLoad = True
    wb.save(output)


if __name__ == "__main__":
    render(sys.argv[1], sys.argv[2], json.load(sys.stdin))
