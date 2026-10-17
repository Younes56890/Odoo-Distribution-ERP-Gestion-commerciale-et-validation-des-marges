"""Pure rules shared by the Odoo engine and standalone tests. No Odoo dependency."""
import hashlib
import re
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo


def event_key(*parts):
    return hashlib.sha256('|'.join(str(part) for part in parts).encode('utf-8')).hexdigest()


def waiting_kind(requested_at, now, reminder_hours):
    return 'overdue' if requested_at + timedelta(hours=reminder_hours) <= now else 'waiting'


def retry_at(now, attempts, delay_minutes):
    return now + timedelta(minutes=delay_minutes * (2 ** max(0, attempts - 1)))


def completed_windows(start, now, tz_name, frequency, limit=10):
    """Half-open UTC intervals ending on local calendar boundaries, including DST changes."""
    zone = ZoneInfo(tz_name)
    cursor = start
    windows = []
    while len(windows) < limit:
        local = cursor.replace(tzinfo=timezone.utc).astimezone(zone)
        step = 1 if frequency == 'daily' else 7 - local.weekday()
        end_date = local.date() + timedelta(days=step)
        boundary = datetime.combine(end_date, time.min, tzinfo=zone)
        end = boundary.astimezone(timezone.utc).replace(tzinfo=None)
        if end > now:
            break
        windows.append((cursor, end))
        cursor = end
    return windows


def csv_cell(value):
    if value is None or value is False:
        return ''
    if isinstance(value, (int, float)):
        return value
    value = str(value).replace('\x00', '')
    if value.startswith(('\t', '\r', '\n')) or re.match(r'^\s*[=+\-@]', value):
        return "'" + value
    return value
