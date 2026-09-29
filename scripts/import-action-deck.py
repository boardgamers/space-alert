#!/usr/bin/env python3
"""Extract factual component counts from the audited BGG workbook; no macros execute."""
import collections
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile

source = Path(sys.argv[1])
assert hashlib.sha256(source.read_bytes()).hexdigest() == '3fb17351f46fd278962d4d02c3ade38e0a39c72c83f8951118dc8ee441d2e86c', 'Unknown workbook revision'
ns = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
symbols = {'A':'A','B':'B','C':'C','Battlebots':'bots','Left':'red','Right':'blue','Gravolift':'lift'}
counts = collections.Counter()
with ZipFile(source) as z:
    strings = [''.join(s.itertext()) for s in ET.fromstring(z.read('xl/sharedStrings.xml'))]
    rows = ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('x:sheetData/x:row', ns)
    for row in rows[1:]:
        cells = []
        for c in row.findall('x:c',ns):
            v = c.findtext('x:v',namespaces=ns)
            cells.append(strings[int(v)] if c.get('t')=='s' else int(v))
        a,b,c,n = cells
        assert n in (1,2)
        counts[(symbols[a],symbols[b],symbols[c])] += n
assert sum(counts.values()) == 90
result = [{'sides':[[a,b],[c]],'count':n} for (a,b,c),n in counts.items()]
target = Path(__file__).resolve().parents[1] / 'src/game/double-deck.json'
target.write_text(json.dumps(result,indent=2)+'\n')
print(f'{len(result)} distinct cards, {sum(counts.values())} physical cards')
