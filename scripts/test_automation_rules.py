"""Run with Python without installing Odoo: python scripts/test_automation_rules.py."""
import importlib.util
import unittest
from datetime import datetime, timedelta
from pathlib import Path

spec = importlib.util.spec_from_file_location('automation_rules', Path(__file__).resolve().parents[1]
                                             / 'addons/sale_margin_automation/rules.py')
rules = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rules)


class RulesTests(unittest.TestCase):
    def test_reminder_boundary(self):
        now = datetime(2026, 10, 17, 12)
        self.assertEqual(rules.waiting_kind(now - timedelta(hours=24), now, 24), 'overdue')
        self.assertEqual(rules.waiting_kind(now - timedelta(hours=23), now, 24), 'waiting')

    def test_stable_distinct_keys(self):
        self.assertEqual(rules.event_key(1, 'waiting', 2), rules.event_key(1, 'waiting', 2))
        self.assertNotEqual(rules.event_key(1, 'waiting', 2), rules.event_key(1, 'overdue', 2))

    def test_backoff(self):
        now = datetime(2026, 10, 17)
        self.assertEqual(rules.retry_at(now, 3, 15), now + timedelta(minutes=60))

    def test_csv_cells(self):
        for value in ['=SUM(A1)', ' +cmd', '-cmd', '@cmd', '\ttext', '\n=cmd']:
            self.assertTrue(rules.csv_cell(value).startswith("'"))
        self.assertEqual(rules.csv_cell(-12.5), -12.5)
        self.assertEqual(rules.csv_cell('Client normal'), 'Client normal')

    def test_only_completed_periods_and_bound(self):
        start = datetime(2026, 1, 1)
        self.assertEqual(rules.completed_windows(start, start, 'UTC', 'daily'), [])
        periods = rules.completed_windows(start, datetime(2026, 2, 1), 'UTC', 'daily', 3)
        self.assertEqual(len(periods), 3)
        self.assertEqual(periods[0][1], periods[1][0])

    def test_dst_and_monday_boundary(self):
        periods = rules.completed_windows(datetime(2026, 3, 28, 23), datetime(2026, 3, 30), 'Europe/Paris', 'daily')
        self.assertEqual(periods[0][1] - periods[0][0], timedelta(hours=23))
        week = rules.completed_windows(datetime(2026, 10, 14, 12), datetime(2026, 10, 20), 'UTC', 'weekly')
        self.assertEqual(week[0][1], datetime(2026, 10, 19))


if __name__ == '__main__':
    unittest.main()
