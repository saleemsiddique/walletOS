from datetime import date, datetime, timedelta


def last_complete_monday(now: datetime) -> date:
    this_monday = now.date() - timedelta(days=now.weekday())
    return this_monday - timedelta(days=7)
