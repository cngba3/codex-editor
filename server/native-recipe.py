"""Replay a declarative plan through Ghost Editor's real recipe builders.

No eval/exec or generated Python. Only public recipe methods and helpers declared
in the selected recipe module may be called. The driver owns build() and paths.
"""
import ast
import importlib
import inspect
import json
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
GHOST = ROOT / 'ghost-editor'
CATALOG = json.loads((ROOT / 'server/recipe-catalog.json').read_text(encoding='utf-8'))
BLOCKED = {'build', 'write_page', 'write_html', 'emit', 'js', 'save', 'setup', 'render', 'run', 'sh', 'system', 'exec', 'eval'}


def api(recipe):
    paths = [GHOST / 'recipes' / recipe['folder'] / (recipe['module'] + '.py'), GHOST / 'scripts/lib/facereel.py']
    paths += [p for p in [GHOST / 'recipes' / recipe['folder'] / 'kit.py', GHOST / 'recipes' / recipe['folder'] / 'props.py'] if p.exists()]
    result = []
    for path in paths:
        tree = ast.parse(path.read_text(encoding='utf-8'))
        result.append(f'FILE {path.name}\n{ast.get_docstring(tree) or ""}')
        for node in tree.body:
            if isinstance(node, ast.FunctionDef) and not node.name.startswith('_'):
                result.append(f'helper {node.name}({ast.unparse(node.args)}): {ast.get_docstring(node) or ""}')
            if isinstance(node, ast.ClassDef):
                result.append(f'class {node.name}: {ast.get_docstring(node) or ""}')
                for method in node.body:
                    if isinstance(method, ast.FunctionDef) and (method.name == '__init__' or not method.name.startswith('_')):
                        result.append(f'  {method.name}({ast.unparse(method.args)}): {ast.get_docstring(method) or ""}')
    if recipe['id'] == 'seoul-list':
        result.append('ADAPTER SeoulList(project): project is supplied. options_json={}. Call R.compose(spec) exactly once with a list.json object per README. Clip ids are face and support-1, support-2 etc. R.build() automatically runs seoul.write(spec) and seoul.measure(spec); do not call setup/write or shell commands. Every shot and insert must match the spoken line. Use tail=0 in spec, music optional. Only use provided clips and images.')
    return '\n'.join(result)


def render_plan(project, recipe, plan):
    project = Path(project).resolve()
    os.chdir(project)
    sys.path.insert(0, str(GHOST / 'recipes' / recipe['folder']))
    sys.path.insert(0, str(GHOST / 'scripts/lib'))
    module = importlib.import_module(recipe['module'])
    helpers = {name: importlib.import_module(name) for name in ('kit', 'props') if (GHOST / 'recipes' / recipe['folder'] / (name + '.py')).exists()}
    # Native font metrics use a macOS venv path upstream. Use this managed Python.
    if hasattr(module, 'GHOST_PY'):
        module.GHOST_PY = sys.executable
    context = json.loads((project / 'build/native-context.json').read_text(encoding='utf-8'))
    references = {}

    def decode(value):
        if isinstance(value, list):
            return [decode(x) for x in value]
        if isinstance(value, dict):
            if set(value) == {'$ref'}:
                return references[value['$ref']]
            if set(value) == {'$constant'}:
                key = value['$constant']
                if not re.fullmatch('[A-Z][A-Z0-9_]*', key):
                    raise ValueError('Invalid constant')
                result = getattr(module, key)
                if not isinstance(result, (str, int, float, tuple, list, dict)):
                    raise ValueError('Not a data constant')
                return result
            return {k: decode(v) for k, v in value.items()}
        if isinstance(value, str):
            if value == '$duration':
                return context['duration']
            if value == '$title':
                return context['title']
            if re.search(r'<script|\bon\w+\s*=|javascript:|(?:^|[/\\])\.\.(?:[/\\]|$)', value, re.I):
                raise ValueError('Unsafe markup or path in recipe plan')
            if re.match(r'^[a-zA-Z]:[\\/]|^[/\\]{1,2}', value):
                raise ValueError('Recipe assets must use project-relative paths')
        return value

    options = decode(json.loads(plan['options_json']))
    if not isinstance(options, dict) or 'project' in options:
        raise ValueError('Invalid constructor options')
    class SeoulList:
        def __init__(self, directory):
            module.setup(directory)
            self.spec = None
        def compose(self, spec):
            self.spec = spec
        def build(self):
            if not isinstance(self.spec, dict) or not self.spec.get('shots'):
                raise ValueError('Seoul List needs a shot plan')
            module.write(self.spec)
            module.measure(self.spec)
    constructor = SeoulList if recipe['id'] == 'seoul-list' else getattr(module, recipe['builder'])
    instance = constructor(str(project), **options)
    references['R'] = instance
    ops = plan['operations']
    if not isinstance(ops, list) or not 1 <= len(ops) <= 1500:
        raise ValueError('Recipe must contain 1-1500 operations')
    for i, op in enumerate(ops):
        name = op['method']
        if not re.fullmatch('[a-zA-Z][a-zA-Z0-9_]*', name) or name in BLOCKED:
            raise ValueError(f'Operation {i}: forbidden method {name}')
        target = module if op['target'] == 'module' else helpers[op['target']] if op['target'] in helpers else references[op['target']]
        method = getattr(target, name)
        if not callable(method):
            raise ValueError(f'Operation {i}: {name} is not callable')
        owner = Path(inspect.getfile(method)).resolve()
        if not owner.is_relative_to(GHOST / 'recipes') and not owner.is_relative_to(GHOST / 'scripts/lib') and not (recipe['id'] == 'seoul-list' and target is instance and name == 'compose'):
            raise ValueError(f'Operation {i}: method is not a recipe API')
        args, kwargs = decode(json.loads(op['args_json'])), decode(json.loads(op['kwargs_json']))
        if not isinstance(args, list) or not isinstance(kwargs, dict):
            raise ValueError(f'Operation {i}: args must be a list and kwargs an object')
        try:
            result = method(*args, **kwargs)
        except Exception as error:
            raise ValueError(f'Operation {i} {op["target"]}.{name}: {error}') from error
        if op['result']:
            if op['result'] in ('R', 'module'):
                raise ValueError('Cannot overwrite the builder')
            references[op['result']] = result
    build_options = decode(json.loads(plan.get('build_json', '{}')))
    if build_options.get('components') is False:
        raise ValueError('Cannot disable component checks')
    instance.build(**build_options)
    if not (project / 'index.html').exists():
        raise ValueError('Native builder produced no index.html')
    # Keep offline renders deterministic: freeze GSAP locally instead of CDN.
    page = (project / 'index.html').read_text(encoding='utf-8')
    gsap = project / 'assets/gsap.min.js'
    if gsap.exists():
        page = re.sub(r'https://cdn\.jsdelivr\.net/npm/gsap@[^/]+/dist/gsap\.min\.js', 'assets/gsap.min.js', page)
    fonts = project / 'assets/vietnamese-fonts.css'
    if fonts.exists():
        page = page.replace('</head>', '<style>' + fonts.read_text(encoding='utf-8') + '</style></head>')
    (project / 'index.html').write_text(page, encoding='utf-8')
    print(json.dumps({'recipe': recipe['id'], 'operations': len(ops), 'built': True}))


if __name__ == '__main__':
    recipe = next((r for r in CATALOG if r['id'] == sys.argv[2]), None)
    if not recipe:
        raise SystemExit('Unknown native recipe')
    if sys.argv[1] == 'api':
        print(api(recipe))
    elif sys.argv[1] == 'build':
        render_plan(sys.argv[3], recipe, json.loads(Path(sys.argv[4]).read_text(encoding='utf-8')))
    else:
        raise SystemExit('Usage: native-recipe.py api RECIPE | build RECIPE PROJECT PLAN')
