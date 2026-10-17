"""Generate Odoo's runtime configuration without keeping secrets in the repository."""
import configparser
import os
import re
import sys
from pathlib import Path


def main():
    password = os.environ.get('PASSWORD')
    master = os.environ.get('ODOO_MASTER_PASSWORD')
    if not password or not master:
        raise SystemExit('PASSWORD et ODOO_MASTER_PASSWORD sont nécessaires.')
    database = os.environ.get('OPTIKA_DB', 'optika_demo')
    if not re.fullmatch(r'[a-zA-Z0-9_]+', database):
        raise SystemExit('OPTIKA_DB doit contenir uniquement lettres, chiffres et underscores.')
    config = configparser.ConfigParser(interpolation=None)
    config.read('/etc/odoo/odoo.conf')
    config['options'].update(db_password=password, admin_passwd=master,
                             db_name=database, dbfilter=f'^{re.escape(database)}$')
    runtime = Path('/tmp/odoo-optika.conf')
    runtime.touch(mode=0o600)
    runtime.chmod(0o600)
    with runtime.open('w') as stream:
        config.write(stream)
    os.environ['ODOO_RC'] = str(runtime)
    os.execv('/entrypoint.sh', ['/entrypoint.sh', *(sys.argv[1:] or ['odoo'])])


if __name__ == '__main__':
    main()
