"""Check Python syntax, XML syntax and files referenced by addon manifests without importing Odoo."""
import ast
from pathlib import Path
from xml.etree import ElementTree


def main():
    root = Path(__file__).resolve().parents[1]
    python_files = [*root.joinpath('addons').rglob('*.py'), *root.joinpath('config').glob('*.py'),
                    *root.joinpath('scripts').glob('*.py')]
    xml_files = list(root.joinpath('addons').rglob('*.xml'))
    for path in python_files:
        ast.parse(path.read_text(encoding='utf-8'), filename=str(path))
    for path in xml_files:
        ElementTree.parse(path)
    for manifest in root.joinpath('addons').glob('*/__manifest__.py'):
        data = ast.literal_eval(manifest.read_text(encoding='utf-8'))
        for name in [*data.get('data', []), *data.get('demo', [])]:
            if not manifest.parent.joinpath(name).is_file():
                raise SystemExit(f'Fichier absent du manifeste : {manifest.parent.name}/{name}')
    print(f'Sources valides : {len(python_files)} fichiers Python, {len(xml_files)} fichiers XML et manifestes.')


if __name__ == '__main__':
    main()
