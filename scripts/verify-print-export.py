"""Verify a print-ready HTML export and its rendered PDF using bundled Python.

Usage: python scripts/verify-print-export.py document.html document.pdf [--full-source]
For a page-range export, omit --full-source and compare its output separately to
the corresponding pages of a full export. Requires lxml and pypdf.
"""
import argparse
import json
import re
from pathlib import Path

from lxml import html
from pypdf import PdfReader

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("html", type=Path)
parser.add_argument("pdf", type=Path)
parser.add_argument("--full-source", action="store_true")
args = parser.parse_args()
markup = args.html.read_text(encoding="utf-8")
document = html.fromstring(markup)
sheets = document.xpath('//section[contains(@class,"print-page")]')
pdf = PdfReader(args.pdf)
assert len(pdf.pages) == len(sheets), "PDF page count differs from the selected preview pages"
size = re.search(r"@page\s*\{\s*size:\s*([\d.]+)in\s+([\d.]+)in", markup)
assert size, "Print CSS must define physical page dimensions"
width, height = (float(value) * 72 for value in size.groups())
texts = []
for sheet, page in zip(sheets, pdf.pages):
    assert abs(float(page.mediabox.width) - width) < .5, "PDF paper width differs"
    assert abs(float(page.mediabox.height) - height) < .5, "PDF paper height differs"
    text = page.extract_text()
    number = sheet.xpath('.//span[contains(@class,"print-number")]')
    if number:
        expected = number[0].text_content().strip()
        assert text.startswith(expected + "\n"), f"Original page number {expected} missing"
        text = text[len(expected) + 1:]
    texts.append(text)
root = sheets[0].xpath('.//div[contains(@class,"editor-input")]')[0]
for br in root.xpath('.//br'):
    br.tail = " " + (br.tail or "")
source = " ".join(element.text_content() for element in root)
words = lambda value: re.findall(r"\w+", value.casefold())
if args.full_source:
    assert words(source) == words(" ".join(texts)), "PDF has missing, duplicated, or reordered words"
print(json.dumps({"pages": len(pdf.pages), "sourcePages": [int(sheet.attrib["data-page"]) for sheet in sheets],
    "paperPoints": [width, height], "sourceWords": len(words(source)), "pdfWords": len(words(" ".join(texts))),
    "fullSourceVerified": args.full_source}, indent=2))
