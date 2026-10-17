from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, ValidationError


class AutomationPolicy(models.Model):
    _name = 'sale.margin.automation.policy'
    _description = 'Politique de suivi automatique des marges'
    _rec_name = 'company_id'

    company_id = fields.Many2one('res.company', required=True, default=lambda self: self.env.company, ondelete='restrict')
    enabled = fields.Boolean(string='Traitements autorisés', default=False)
    activation_from = fields.Datetime(string='Traiter les demandes depuis', required=True, default=fields.Datetime.now)
    runner_id = fields.Many2one('res.users', string='Compte technique', required=True, readonly=True,
                               default=lambda self: self.env.ref('sale_margin_automation.user_automation'))
    recipient_ids = fields.Many2many('res.users', string='Approbateurs à notifier')
    notifications_enabled = fields.Boolean(default=True, string='Suivi des attentes')
    pdf_enabled = fields.Boolean(default=True, string='Document après approbation')
    reports_enabled = fields.Boolean(default=True, string='Rapport CSV périodique')
    reminder_hours = fields.Float(default=24, string='Relance après (heures)', required=True)
    report_frequency = fields.Selection([('daily', 'Quotidien'), ('weekly', 'Hebdomadaire')], default='weekly', required=True)
    timezone = fields.Char(default='Africa/Casablanca', required=True, string='Fuseau des périodes')
    batch_size = fields.Integer(default=50, required=True)
    max_attempts = fields.Integer(default=3, required=True)
    retry_delay_minutes = fields.Integer(default=15, required=True)
    report_cursor = fields.Datetime(readonly=True, copy=False)

    _sql_constraints = [('company_uniq', 'unique(company_id)', 'Une seule politique est autorisée par société.')]

    @api.constrains('runner_id', 'company_id', 'recipient_ids', 'enabled', 'notifications_enabled',
                    'reminder_hours', 'batch_size', 'max_attempts', 'retry_delay_minutes', 'timezone', 'activation_from')
    def _validate_configuration(self):
        for policy in self:
            if not 0 < policy.reminder_hours <= 8760 or not 1 <= policy.batch_size <= 200:
                raise ValidationError(_('Délai positif et taille de lot entre 1 et 200 requis.'))
            if not 1 <= policy.max_attempts <= 10 or not 1 <= policy.retry_delay_minutes <= 1440:
                raise ValidationError(_('Configurez 1 à 10 tentatives et un délai de 1 à 1440 minutes.'))
            try:
                ZoneInfo(policy.timezone)
            except (ZoneInfoNotFoundError, ValueError):
                raise ValidationError(_('Fuseau horaire inconnu.'))
            runner = policy.runner_id
            if (not runner.active or not runner.has_group('sale_margin_automation.group_runner')
                    or runner.has_group('sale_margin_approval.group_approver')
                    or runner.has_group('base.group_system') or runner.id == 1
                    or self.env['sale.order'].with_user(runner).check_access_rights('write', raise_exception=False)
                    or self.env['sale.margin.approval'].with_user(runner).check_access_rights('write', raise_exception=False)
                    or policy.company_id not in runner.company_ids):
                raise ValidationError(_('Le compte technique doit être actif, autorisé dans la société et dépourvu de droits d’approbation ou d’administration.'))
            if policy.enabled and policy.notifications_enabled and not policy.recipient_ids:
                raise ValidationError(_('Choisissez au moins un approbateur interne à notifier.'))
            for recipient in policy.recipient_ids:
                if (not recipient.active or recipient.share or policy.company_id not in recipient.company_ids
                        or not recipient.has_group('sale_margin_approval.group_approver')):
                    raise ValidationError(_('Les destinataires doivent être des approbateurs internes actifs de la société.'))
            if policy.activation_from > fields.Datetime.now():
                raise ValidationError(_('La date de reprise ne peut pas être dans le futur.'))

    def write(self, vals):
        if not self.env.su and {'runner_id', 'report_cursor', 'company_id'}.intersection(vals):
            raise AccessError(_('Le compte technique, la société et le curseur sont gérés par le module.'))
        return super().write(vals)

    @api.model_create_multi
    def create(self, vals_list):
        if not self.env.su:
            runner = self.env.ref('sale_margin_automation.user_automation')
            for vals in vals_list:
                if vals.get('report_cursor') or vals.get('runner_id', runner.id) != runner.id:
                    raise AccessError(_('Configuration technique non autorisée.'))
        return super().create(vals_list)

    def _check_manager(self):
        self.ensure_one()
        if not self.env.user.has_group('sale_margin_approval.group_approver'):
            raise AccessError(_('Accès réservé aux approbateurs.'))
        self.check_access_rights('read')
        self.check_access_rule('read')
        if self.company_id not in self.env.companies:
            raise AccessError(_('Société non autorisée.'))

    def action_preview(self):
        self._check_manager()
        return self.env['sale.margin.automation.engine']._preview(self)

    def action_run(self):
        result = self._run_batch()
        return {'type': 'ir.actions.client', 'tag': 'display_notification',
                'params': {'title': _('Suivi interne'),
                           'message': _('%s traitement(s) exécuté(s).') % result['processed'],
                           'type': 'info', 'sticky': False}}

    def _run_batch(self):
        self._check_manager()
        self._validate_configuration()
        if not self.enabled:
            raise ValidationError(_('Activez explicitement la politique avant une exécution.'))
        return self.env['sale.margin.automation.engine']._run_as_runner(self, self.env.uid)
