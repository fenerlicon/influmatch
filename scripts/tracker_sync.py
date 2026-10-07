#!/usr/bin/env python3
"""Takip panosunu (claude.ai artifact) docs/SYSTEM_MAP.md ile eşitlemek için yazma listesi üretir.

Kullanım (Claude Code içinde):
  1. Panoyu indir: ArtifactData action=list, url=<pano>, collection=issues,
     query={"limit":1000}, out_dir=<DIR>   → <DIR>/issues/*.json oluşur
  2. list sonucunun metnini (belge kimlikleri ve "version N" bilgileri) bir dosyaya kaydet: <VERSIONS.txt>
  3. python3 scripts/tracker_sync.py <DIR>/issues <VERSIONS.txt> > /tmp/writes.json
  4. Çıktıdaki listeyi ArtifactData action=batch, writes=<liste> ile gönder (en fazla 50'lik parçalar).
     Sürümü bilinmeyen bir güncelleme reddedilirse o belgeyi action=get ile okuyup sürümüyle tekrar yaz.

Kurallar:
  - Haritada ✅ olan madde panoda done değilse → done (skip olanlara dokunulmaz).
  - Haritada açık olan madde panoda done ise → open'a çekilmez, yalnızca uyarı basılır (stderr).
  - Haritada olup panoda olmayan madde → yeni belge olarak eklenir.
  - Panodaki notlara dokunulmaz; yalnızca yeni done olan maddeye, notu boşsa haritadaki açıklama yazılır.
"""
import datetime
import glob
import json
import os
import re
import sys

MAP_PATH = os.path.join(os.path.dirname(__file__), '..', 'docs', 'SYSTEM_MAP.md')
ITEM_RE = re.compile(
    r"^(?P<indent>\s*)-\s+(?P<done>✅\s+~~)?\*\*(?P<id>\d+\.\d+b?-[SNT]\d+)(?: \[(?P<sev>[^\]]+)\])?\*\*(?:~~)?\s*(?P<rest>.*)$"
)


def parse_map():
    items = {}
    order = 0
    section_by_module = {}
    lines = open(MAP_PATH, encoding='utf-8').read().split('\n')
    for idx, line in enumerate(lines):
        m = ITEM_RE.match(line)
        if not m:
            continue
        order += 1
        rest = m.group('rest').strip()
        # Madde birden çok satıra yayılabilir: girintili, yeni madde olmayan satırlar devamıdır.
        item_indent = len(m.group('indent'))
        j = idx + 1
        while j < len(lines):
            nxt = lines[j]
            stripped = nxt.strip()
            if not stripped or stripped.startswith('- ') or stripped.startswith('#') or stripped.startswith('|'):
                break
            if len(nxt) - len(nxt.lstrip()) <= item_indent:
                break
            rest += ' ' + stripped
            j += 1
        note = ''
        if rest.startswith('('):
            depth = 0
            for i, ch in enumerate(rest):
                depth += ch == '('
                depth -= ch == ')'
                if depth == 0:
                    note, rest = rest[1:i], rest[i + 1:].strip()
                    break
        item_id = m.group('id')
        module = item_id.split('-')[0]
        section = int(module.split('.')[0])
        section_by_module[module] = section
        items[item_id] = {
            'id': item_id,
            'done': bool(m.group('done')),
            'severity': m.group('sev'),
            'text': rest,
            'note': note,
            'module': module,
            'section': section,
            'order': order,
            'kind': 'note' if '-N' in item_id else 'issue',
        }
    return items


def main():
    if len(sys.argv) not in (2, 3):
        print(__doc__, file=sys.stderr)
        sys.exit(1)
    versions = {}
    if len(sys.argv) == 3:
        text = open(sys.argv[2], encoding='utf-8').read()
        for doc_id, ver in re.findall(r'"([^"]+)"\s+(?:\d+ bytes\s+version\s+)?(\d+)', text):
            versions[doc_id] = int(ver)
    tracker = {}
    for path in glob.glob(os.path.join(sys.argv[1], '*.json')):
        doc = json.load(open(path, encoding='utf-8'))
        tracker[doc['id']] = doc
    today = datetime.date.today().isoformat()
    writes = []
    for item_id, item in parse_map().items():
        doc = tracker.get(item_id)
        if doc is None:
            writes.append({'op': 'set', 'collection': 'issues', 'doc_id': item_id, 'data': {
                'id': item_id, 'kind': item['kind'], 'module': item['module'], 'section': item['section'],
                'order': item['order'], 'severity': item['severity'], 'text': item['text'],
                'status': 'done' if item['done'] else 'open', 'note': item['note'], 'commit': '',
                'log': [], 'priority': None, 'updatedAt': today, 'updatedBy': None,
            }})
            continue
        data = {}
        if item['done'] and doc.get('status') not in ('done', 'skip'):
            data['status'] = 'done'
        if not item['done'] and doc.get('status') == 'done':
            print(f"uyarı: {item_id} haritada açık ama panoda done", file=sys.stderr)
        if data.get('status') == 'done' and item['note'] and not doc.get('note'):
            data['note'] = item['note']
        if data:
            data['updatedAt'] = today
            entry = {'op': 'update', 'collection': 'issues', 'doc_id': item_id, 'data': data}
            version = doc.get('version') or versions.get(item_id)
            if version:
                entry['if_version'] = version
            writes.append(entry)
    json.dump(writes, sys.stdout, ensure_ascii=False, indent=1)
    print(f"\n{len(writes)} yazma", file=sys.stderr)


if __name__ == '__main__':
    main()
