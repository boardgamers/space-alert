"""Import factual timelines from a pinned ConstructedMissions.java; never execute it.
Usage: python3 scripts/import-missions.py /path/to/ConstructedMissions.java
The importer intentionally rejects unrecognized Java statements.
"""
import ast
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REVISION = '8dd0734c4f4a5c8ad9f1376a7459a87f32471f0e'
source = Path(sys.argv[1]).read_text()
EXPECTED_SHA256 = 'd0f215e8d598bea51e687f1a41a23dbeee6dbbecffd369c370695d4ac9a32fbf'
if hashlib.sha256(source.encode()).hexdigest() != EXPECTED_SHA256:
    raise ValueError('Source differs from the audited upstream revision')

def arguments(text):
    out, start, depth = [], 0, 0
    for i, char in enumerate(text):
        if char == '(':
            depth += 1
        elif char == ')':
            depth -= 1
        elif char == ',' and depth == 0:
            out.append(text[start:i].strip())
            start = i + 1
    return out + [text[start:].strip()]

def value(text, variables):
    text = re.sub(r'(?<![\w.])0+(\d+)', r'\1', text)
    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) is int:
            return node.value
        if isinstance(node, ast.Name) and node.id in variables:
            return variables[node.id]
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub)):
            return visit(node.left) + (1 if isinstance(node.op, ast.Add) else -1) * visit(node.right)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == 'sec' and len(node.args) == 2 and not node.keywords:
            return visit(node.args[0]) * 60 + visit(node.args[1])
        raise ValueError(f'Unsupported expression: {text}')
    return visit(ast.parse(text, mode='eval').body)

missions = []
for name, body in re.findall(r'public static EventList (\w+)\(\)\s*\{(.*?)return eventList;\s*\}', source, re.S):
    variables, events, phase_ends, total = {}, [], [], 0
    body = re.sub(r'//[^\n]*', '', body)
    for statement in [s.strip() for s in body.split(';') if s.strip()]:
        if statement == 'EventList eventList = new EventList()':
            continue
        if match := re.fullmatch(r'int (\w+) = (.*)', statement, re.S):
            variables[match[1]] = value(match[2], variables)
            continue
        match = re.fullmatch(r'eventList\.(addPhaseEvents|addWhiteNoiseEvents|addEvent)\((.*)\)', statement, re.S)
        if not match:
            raise ValueError(f'Unsupported statement: {statement}')
        method, args = match[1], arguments(match[2])
        if method == 'addPhaseEvents':
            for arg in args:
                total += value(arg, variables) * 1000
                phase_ends.append(total)
        elif method == 'addWhiteNoiseEvents':
            at, duration = (value(arg, variables) * 1000 for arg in args)
            events += [{'atMs': at, 'type': 'communications-down'}, {'atMs': at + duration, 'type': 'communications-restored'}]
        else:
            at, kind = value(args[0], variables) * 1000, args[1]
            if kind == 'new IncomingData()':
                events.append({'atMs': at, 'type': 'incoming-data'})
            elif kind == 'new DataTransfer()':
                events.append({'atMs': at, 'type': 'data-transfer', 'durationMs': 15000})
            elif kind.startswith('threat(') and kind.endswith(')'):
                confirmed, zone, severity, position, turn = arguments(kind[7:-1])
                assert confirmed in ('true', 'false')
                internal = position == 'Threat.THREAT_POSITION_INTERNAL'
                assert internal or position == 'Threat.THREAT_POSITION_EXTERNAL'
                assert severity in ('Threat.THREAT_LEVEL_NORMAL', 'Threat.THREAT_LEVEL_SERIOUS')
                assert zone in ('Threat.THREAT_SECTOR_RED', 'Threat.THREAT_SECTOR_WHITE', 'Threat.THREAT_SECTOR_BLUE')
                events.append({'atMs': at, 'type': 'threat', 'confirmed': confirmed == 'true', 'zone': None if internal else zone.rsplit('_', 1)[1].lower(), 'severity': severity.rsplit('_', 1)[1].lower(), 'position': 'internal' if internal else 'external', 'turn': value(turn, variables)})
            else:
                raise ValueError(f'Unknown event: {kind}')
    group = ('double-action-easy' if name.startswith('doubleActionEasier') else 'double-action' if name.startswith('doubleAction') else 'advanced-simulation' if name.startswith('advancedsimulation') else 'simulation' if name.startswith('simulation') else 'mission' if name.startswith('realmission') else 'test-run')
    label = {'double-action-easy': 'Double-action easy mission', 'double-action': 'Double-action mission', 'advanced-simulation': 'Advanced simulation', 'simulation': 'Simulation', 'mission': 'Mission', 'test-run': 'Test run'}[group]
    number = re.search(r'\d+$', name)
    number = number[0] if number else '1' if name.startswith('first') else '2'
    events.sort(key=lambda e: e['atMs'])
    missions.append({'id': name, 'title': f'{label} {number}', 'group': group, 'doubleActions': group.startswith('double-action'), 'phaseEndsMs': phase_ends, 'events': events})
assert len(missions) == 34, f'Unexpected mission count: {len(missions)}'
result = {'source': {'repository': 'https://github.com/nibuen/SpaceAlertMissionGenerator', 'revision': REVISION, 'file': 'app/src/main/java/com/boarbeard/generator/beimax/ConstructedMissions.java', 'sha256': hashlib.sha256(source.encode()).hexdigest(), 'notice': 'Derived mission schedules; see THIRD_PARTY.md. Not the random generator or a rules engine.'}, 'missions': missions}
(ROOT / 'mission-data/catalog.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'Imported {len(missions)} mission schedules')
