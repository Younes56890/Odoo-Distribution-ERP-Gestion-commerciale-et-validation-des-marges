from odoo import _, api, models
from odoo.exceptions import AccessError


class IrAttachment(models.Model):
    _inherit = 'ir.attachment'

    @api.model
    def check(self, mode, values=None):
        result = super().check(mode, values)
        if not self.env.su and values and values.get('res_model') == 'sale.margin.automation.job':
            raise AccessError(_('Les documents sont créés uniquement par le moteur interne.'))
        self._check_automation_documents(mode)
        return result

    def _check_automation_documents(self, mode='read'):
        if not self.env.su and self.ids:
            # Metadata lookup avoids recursively reading an attachment inside its access check.
            self.flush_model(['res_model', 'res_id'])
            self.env.cr.execute('SELECT res_id FROM ir_attachment WHERE id IN %s AND res_model = %s',
                                [tuple(self.ids), 'sale.margin.automation.job'])
            for (identifier,) in self.env.cr.fetchall():
                job = self.env['sale.margin.automation.job'].browse(identifier).exists()
                if mode != 'read':
                    raise AccessError(_('Les documents d’automatisation restent privés et immuables.'))
                if job:
                    job._check_artifact()
                else:
                    raise AccessError(_('Document interne sans traitement accessible.'))

    def _read_format(self, fnames, load='_classic_read'):
        # Covers read/search_read even when ORM fields are already present in the cache.
        self._check_automation_documents()
        return super()._read_format(fnames, load)

    def validate_access(self, access_token):
        # /web/content streams files directly: do not rely on Binary field computations.
        self._check_automation_documents()
        return super().validate_access(access_token)
