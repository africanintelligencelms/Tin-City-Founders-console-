#!/usr/bin/env python3
"""Turn a Built in Jos directory form export into an /api/admin/import-members payload.

    python3 scripts/directory-xlsx-to-members.py "<sheet>.xlsx" -o import/members.json

Writes JSON and prints a report of everything it could not map cleanly. It never
guesses at a phone number: a row whose contact will not normalise is reported and
left for a human, because a wrong number attaches one founder's identity to
another's profile.

Output holds real contact details. Keep it out of git (import/ is ignored).
"""
import argparse, json, re, sys, collections
import openpyxl

# The form's question text, matched loosely so a reworded question still lands.
FIELDS = {
    "name":         ["your name"],
    "organization": ["startup", "venture"],
    "sector":       ["sector"],
    "stage":        ["stage"],
    "bio":          ["what are you building", "one line"],
    "giveAsk":      ["what do you need"],
    "whatsapp":     ["contact", "whatsapp", "phone"],
    "link":         ["instagram", "website"],
    "location":     ["based"],
    "listed":       ["directory", "list you"],
    "timestamp":    ["timestamp"],
}

def map_headers(headers):
    resolved, used = {}, set()
    for field, needles in FIELDS.items():
        for i, header in enumerate(headers):
            if i in used or not header:
                continue
            if any(n in str(header).lower() for n in needles):
                resolved[field] = i
                used.add(i)
                break
    return resolved

def repair_spreadsheet_phone(value, notes, name):
    """Undo two things a spreadsheet does to phone numbers before parsing.

    Excel stores an unquoted 08000000000 as the NUMBER 8000000000, dropping the
    leading zero and handing it back as '8000000000.0'. That is a real founder's
    number, not a bad one, so it is repaired rather than reported.

    A cell holding two numbers ('08000000000, 08111111111') takes the first and
    says so — guessing which is primary is the host's call, but dropping the
    member entirely is worse than a note.
    """
    text = str(value).strip()
    if re.fullmatch(r"\d+\.0", text):
        text = text[:-2]
        if re.fullmatch(r"[789]\d{9}", text):
            text = "0" + text
            notes.append(("phone repaired from a spreadsheet number", name, "%s -> %s" % (value, text)))
    parts = [p.strip() for p in re.split(r"[,/;]| or ", text) if p.strip()]
    if len(parts) > 1:
        notes.append(("first of several numbers used", name, "%s -> %s" % (text, parts[0])))
        text = parts[0]
    return text

def normalize_phone(value):
    """Mirror of normalizePhone in src/utils/phone.ts. Kept in step deliberately:
    a row this accepts must be one the server accepts, or the import reports a
    skip for a row that looked fine here."""
    text = str(value).strip()
    if not text:
        return ""
    if not re.fullmatch(r"[+\d\s().\-]+", text):
        raise ValueError("not a phone number")
    number = re.sub(r"[\s().\-]", "", text)
    if number.startswith("00"):
        number = "+" + number[2:]
    if re.fullmatch(r"0[789]\d{9}", number):
        number = "+234" + number[1:]
    elif re.fullmatch(r"234[789]\d{9}", number):
        number = "+" + number
    if not re.fullmatch(r"\+[1-9]\d{7,14}", number) or (
        number.startswith("+234") and not re.fullmatch(r"\+234[789]\d{9}", number)
    ):
        raise ValueError("not a Nigerian mobile or a full international number")
    return number

def normalize_link(value, notes, name):
    """A bare @handle under a question headed 'Instagram / website' is Instagram.
    A bare word with no @ and no dot is ambiguous, so it is reported, not guessed."""
    text = str(value).strip()
    if not text:
        return ""
    if text.startswith("@"):
        handle = text[1:].strip()
        notes.append(("link read as Instagram", name, text + " -> instagram.com/" + handle))
        return "https://instagram.com/" + handle
    embedded = re.search(r"https?://\S+", text, re.I)
    if embedded:
        if embedded.group(0) != text:
            notes.append(("link pulled out of a longer answer", name, text[:44] + " -> " + embedded.group(0)[:44]))
        return embedded.group(0)
    if "." in text.split()[0]:
        return text.split()[0]
    notes.append(("link not understood, left out", name, text))
    return ""

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("xlsx")
    parser.add_argument("-o", "--out", default="import/members.json")
    parser.add_argument("--sheet", default=None)
    args = parser.parse_args()

    book = openpyxl.load_workbook(args.xlsx, data_only=True)
    sheet = book[args.sheet] if args.sheet else book.worksheets[0]
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        sys.exit("empty sheet")

    columns = map_headers(rows[0])
    missing = [f for f in ("name", "whatsapp") if f not in columns]
    if missing:
        sys.exit("could not find a column for: " + ", ".join(missing))

    def cell(row, field):
        index = columns.get(field)
        if index is None or index >= len(row):
            return ""
        value = row[index]
        return "" if value is None else str(value).strip()

    members, notes, needs_review = [], [], []
    for number, row in enumerate(rows[1:], start=2):
        if not any(c not in (None, "") for c in row):
            continue
        name = cell(row, "name")
        if not name:
            needs_review.append((number, "(no name)", "row has no name"))
            continue
        try:
            phone = normalize_phone(repair_spreadsheet_phone(cell(row, "whatsapp"), notes, name))
        except ValueError as error:
            needs_review.append((number, name, "%s: %r" % (error, cell(row, "whatsapp"))))
            continue

        consent = cell(row, "listed").lower()
        member = {
            "name": name,
            "organization": cell(row, "organization"),
            "tags": [cell(row, "sector")] if cell(row, "sector") else [],
            "stage": cell(row, "stage"),
            "bio": cell(row, "bio"),
            "giveAsk": cell(row, "giveAsk"),
            "location": cell(row, "location"),
            "whatsapp": phone,
            "link": normalize_link(cell(row, "link"), notes, name),
            # Anything other than an explicit yes is treated as community-only.
            # Erring toward privacy is the recoverable direction.
            "listed": consent.startswith("yes"),
        }
        stamp = cell(row, "timestamp")
        if stamp:
            member["checkedInAt"] = stamp
        members.append(member)

    by_phone = collections.Counter(m["whatsapp"] for m in members)
    by_name = collections.Counter(m["name"].lower() for m in members)

    import os
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump({"members": members}, handle, indent=2, ensure_ascii=False)

    print("wrote %s — %d members (%d listed, %d community-only)" % (
        args.out, len(members),
        sum(1 for m in members if m["listed"]),
        sum(1 for m in members if not m["listed"])))
    print("\ncolumns mapped: " + ", ".join("%s->[%d]" % (k, v) for k, v in sorted(columns.items(), key=lambda kv: kv[1])))
    unmapped = [str(h) for i, h in enumerate(rows[0]) if h and i not in columns.values()]
    if unmapped:
        print("columns ignored: " + "; ".join(unmapped))

    if notes:
        print("\nlinks interpreted (%d):" % len(notes))
        for kind, who, detail in notes:
            print("   %-28s %-24s %s" % (kind, who[:24], detail))

    duplicate_phones = [p for p, c in by_phone.items() if c > 1 and p]
    if duplicate_phones:
        print("\nsame number submitted more than once (%d) — the import merges these,"
              " later rows winning field by field:" % len(duplicate_phones))
        for phone in duplicate_phones:
            print("   %s: %s" % (phone, ", ".join(m["name"] for m in members if m["whatsapp"] == phone)))

    same_name = [n for n, c in by_name.items() if c > 1]
    same_name = [n for n in same_name if len({m["whatsapp"] for m in members if m["name"].lower() == n}) > 1]
    if same_name:
        print("\nSAME NAME, DIFFERENT NUMBER (%d) — imported as separate people."
              " Check these are not one person who submitted twice:" % len(same_name))
        for name in same_name:
            print("   %s: %s" % (name, ", ".join(m["whatsapp"] for m in members if m["name"].lower() == name)))

    if needs_review:
        print("\nNEEDS YOUR EYE (%d) — left out of the payload entirely:" % len(needs_review))
        for number, name, why in needs_review:
            print("   row %-3d %-24s %s" % (number, name[:24], why))

if __name__ == "__main__":
    main()
