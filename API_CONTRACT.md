# CronLens — API Contract

This contract is **backend-agnostic**. Any application (django-celery-beat, APScheduler,
cron, custom schedulers) can implement it. The Vue app knows nothing about how schedules
are stored or expressed — it only renders what the API returns.

---

## Design principles

| Concern                                | Who owns it                                    |
|----------------------------------------|------------------------------------------------|
| Schedule expansion (cron → fire times) | **Backend**                                    |
| Timezone conversion                    | **Frontend** (UTC/local toggle)                |
| Human-readable schedule description    | **Backend**                                    |
| Which attributes are filterable        | **Backend**                                    |
| Group definitions                      | **Shared** (backend persists, frontend caches) |

---

## 1. `GET /api/schedule/events/`

Returns all scheduled events.

### Response

```json
{
  "events": [
    {
      "id": "1947489",
      "name": "Analyze stock images",
      "kind": "analyze_images",
      "enabled": true,
      "recurrence": "recurring",
      "fires_utc": [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55,
                    60, 65, 70],
      "fires_on_days": null,
      "last_run_at": "2026-05-05T14:00:00Z",
      "total_run_count": 1200,
      "schedule_display": "every 5 minutes",
      "attributes": []
    },
    {
      "id": "1736228",
      "name": "Analyze logos",
      "kind": "analyze_images",
      "enabled": true,
      "recurrence": "recurring",
      "fires_utc": [0, 240, 480, 720, 960, 1200],
      "fires_on_days": null,
      "last_run_at": "2026-05-05T08:00:00Z",
      "total_run_count": 200,
      "schedule_display": "every 4 hours",
      "attributes": [
        { "key": "logo", "value": "1", "filterable": true }
      ]
    },
    {
      "id": "268349",
      "name": "Increase quality of low res images",
      "kind": "increase_image_quality",
      "enabled": true,
      "recurrence": "one_off",
      "fires_utc": [],
      "fires_on_days": null,
      "last_run_at": "2025-11-03T09:00:00Z",
      "total_run_count": 1,
      "schedule_display": "once — ran 2025-11-03 09:00",
      "attributes": [
        { "key": "res_min_dpi",           "value": "100", "filterable": false },
        { "key": "res_max_dpi",           "value": "200", "filterable": false },
        { "key": "full_ai_mode",          "value": "1",   "filterable": false }
      ]
    }
  ],
  "meta": {
    "source": "django-celery-beat",
    "source_url": "http://localhost:8000/admin/django_celery_beat/",
    "generated_at": "2026-05-05T14:32:00Z",
    "timezone": "Europe/Amsterdam"
  }
}
```

### Field reference

| Field              | Type                                        | Description                                                                                                                       |
|--------------------|---------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `id`               | string \| number                            | Opaque unique identifier                                                                                                          |
| `name`             | string                                      | Human display name                                                                                                                |
| `kind`             | string                                      | Logical category used for group matching. <br> _For beat: task function name. For other backends: any stable string._             |
| `enabled`          | boolean                                     | Whether the event is currently active                                                                                             |
| `recurrence`       | `"recurring"` \| `"one_off"` \| `"clocked"` | `recurring` = repeating schedule. <br> `one_off` = ran once, finished. <br>`clocked` = scheduled for a specific future/past time. |
| `fires_utc`        | `number[]`                                  | Sorted, deduplicated **minute-of-day** values (0–1439) for a 24h window. <br> _Empty for `one_off` and `clocked`._                |
| `fires_on_days`    | `number[] \| null`                          | Which days-of-week fire: 0=Sun…6=Sat. `null` = every day. `null` when `fires_utc` is empty.                                       |
| `last_run_at`      | string \| null                              | ISO 8601 UTC timestamp of last execution, or `null`                                                                               |
| `total_run_count`  | number                                      | Cumulative run count                                                                                                              |
| `schedule_display` | string                                      | Human-readable description. Backend controls wording. e.g. `"every 5 minutes"`, `"daily at 03:00"`, `"Mon/Wed/Fri at 08:30"`      |
| `attributes`       | `EventAttribute[]`                          | Flat list of key-value metadata. Backend decides what to expose.                                                                  |

### EventAttribute

| Field        | Type    | Description                                                              |
|--------------|---------|--------------------------------------------------------------------------|
| `key`        | string  | Attribute name, e.g. `"image_id"`, `"logo"`                              |
| `value`      | string  | Always a string. Backend serialises non-strings.                         |
| `filterable` | boolean | If `true`, appears in the filter dropdown. Use for IDs and foreign keys. |
| `label`      | string? | Optional display label; falls back to `key` if absent.                   |

### `fires_utc` — how to compute it

The backend is responsible for expanding the native schedule format into minute-of-day
integers. Here are implementations for common cases:

**Crontab (django-celery-beat):**
```python
from itertools import product

def crontab_fires_utc(crontab) -> list[int]:
    def expand(field, max_val):
        if field == '*': return list(range(max_val))
        if field.startswith('*/'): return list(range(0, max_val, int(field[2:])))
        if ',' in field: return [int(x) for x in field.split(',')]
        if '-' in field:
            a, b = field.split('-'); return list(range(int(a), int(b)+1))
        return [int(field)]
    hours = expand(crontab.hour, 24)
    mins  = expand(crontab.minute, 60)
    return sorted(set(h * 60 + m for h, m in product(hours, mins)))
```

**Interval (e.g. every N seconds/minutes):**
```python
def interval_fires_utc(every: int, period: str) -> list[int]:
    if period == 'seconds': step = max(1, every // 60)
    elif period == 'minutes': step = every
    elif period == 'hours': step = every * 60
    else: return []  # days or longer — not shown on 24h timeline
    return list(range(0, 1440, step))
```

**Clocked / one_off:** return `fires_utc: []`

### `fires_on_days` — how to compute it

```python
def fires_on_days(crontab) -> list[int] | None:
    dow = crontab.day_of_week
    if dow == '*': return None
    # Celery uses 0=Sun by default — check your Beat version
    return [int(d) % 7 for d in expand_field(dow, 7)]
```

---

## 2. Groups CRUD `/api/schedule/groups/`

### `GET /api/schedule/groups/`

```json
{
  "groups": [
    {
      "id": "1",
      "name": "Images",
      "color": "#378ADD",
      "kinds": ["analyze_images", "increase_image_quality", "mark_images_as_logo"],
      "description": "All tasks related to image processing"
    }
  ]
}
```

### `POST /api/schedule/groups/`

Body: `{ "name": "...", "color": "#hex", "kinds": [...], "description": "..." }`
Returns: created group with server-assigned `id`.

### `PUT /api/schedule/groups/{id}/`

Body: same shape. Returns updated group.

### `DELETE /api/schedule/groups/{id}/`

Returns 204.

### Django model

```python
class ScheduleGroup(models.Model):
    name        = models.CharField(max_length=100)
    color       = models.CharField(max_length=7)    # hex e.g. "#378ADD"
    kinds       = models.JSONField(default=list)    # list of kind strings
    description = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
```

---

## Implementing the beat adapter

```python
# views.py
from django_celery_beat.models import PeriodicTask
from django.http import JsonResponse

def events(request):
    tasks = PeriodicTask.objects.select_related(
        'crontab', 'interval', 'clocked'
    ).all()
    return JsonResponse({'events': [serialize(t) for t in tasks], 'meta': meta()})

def serialize(task) -> dict:
    fires_utc, fires_on_days = [], None
    display = '—'

    if task.crontab_id:
        fires_utc    = crontab_fires_utc(task.crontab)
        fires_on_days = fires_on_days_from_crontab(task.crontab)
        display      = describe_crontab(task.crontab)
    elif task.interval_id:
        fires_utc = interval_fires_utc(task.interval.every, task.interval.period)
        display   = f'every {task.interval.every} {task.interval.period}'
    elif task.clocked_id:
        display = f'once at {task.clocked.clocked_time:%Y-%m-%d %H:%M}'

    recurrence = 'one_off' if task.one_off else \
                 'clocked'  if task.clocked_id else 'recurring'

    # Expose filterable attributes from kwargs
    kwargs = json.loads(task.kwargs or '{}')
    attributes = []
    for k, v in kwargs.items():
        is_id = k == 'id' or k.endswith('_id') or k.endswith('_ids')
        attributes.append({
            'key': k,
            'value': ', '.join(str(x) for x in v) if isinstance(v, list) else str(v),
            'filterable': is_id,
        })

    return {
        'id':             task.id,
        'name':           task.name,
        'kind':           task.task,   # task function name becomes the kind
        'enabled':        task.enabled,
        'recurrence':     recurrence,
        'fires_utc':      fires_utc,
        'fires_on_days':  fires_on_days,
        'last_run_at':    task.last_run_at.isoformat().replace('+00:00','Z') if task.last_run_at else None,
        'total_run_count':task.total_run_count,
        'schedule_display':display,
        'attributes':     attributes,
    }

def meta() -> dict:
    return {
        'source':     'django-celery-beat',
        'source_url': '/admin/django_celery_beat/',
        'generated_at': datetime.utcnow().isoformat() + 'Z',
    }
```

---

## CORS / CSRF

- Dev: add `django-cors-headers`, `CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]`
- The app sends `X-CSRFToken` on POST/PUT/DELETE — add `CSRF_TRUSTED_ORIGINS = ["http://localhost:5173"]`
- Production (same origin): no CORS config needed
