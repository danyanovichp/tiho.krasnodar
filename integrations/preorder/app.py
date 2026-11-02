"""Local prototype of a preorder service. Do not expose publicly as-is."""
import hashlib
import hmac
import json
import os
import re
import sqlite3
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

DB = os.environ.get('TIHO_DB', 'orders.sqlite3')
CONSENT_VERSION = os.environ.get('TIHO_CONSENT_VERSION', '')
ADMIN_TOKEN = os.environ.get('TIHO_ADMIN_TOKEN', '')
MOSCOW = ZoneInfo('Europe/Moscow')


def database():
    db = sqlite3.connect(DB, timeout=10)
    db.execute('''CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY, created_at TEXT NOT NULL, name TEXT NOT NULL,
        phone TEXT NOT NULL, quantity INTEGER NOT NULL, pickup_date TEXT NOT NULL,
        pickup_time TEXT NOT NULL, comment TEXT NOT NULL, consent_version TEXT NOT NULL,
        consent_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new')''')
    return db


def create_order(payload):
    if not CONSENT_VERSION:
        raise ValueError('Приём заявок не настроен')
    try:
        order_id = str(uuid.UUID(payload['id']))
        name, phone = payload['name'].strip(), payload['phone'].strip()
        comment = payload.get('comment', '').strip()
        quantity = payload['quantity']
        date, time = payload['date'], payload['time']
        if not isinstance(quantity, int) or isinstance(quantity, bool) or not 1 <= quantity <= 20:
            raise ValueError()
        if not 1 <= len(name) <= 100 or not 10 <= len(re.sub(r'\D', '', phone)) <= 15 or len(phone) > 30 or len(comment) > 500:
            raise ValueError()
        now = datetime.now(MOSCOW)
        if date not in (now.date().isoformat(), (now.date() + timedelta(days=1)).isoformat()):
            raise ValueError()
        datetime.strptime(time, '%H:%M')
        if not re.fullmatch(r'\d{2}:\d{2}', time):
            raise ValueError()
        if payload['consent'] is not True or payload['consent_version'] != CONSENT_VERSION:
            raise ValueError()
    except (KeyError, TypeError, ValueError, AttributeError):
        raise ValueError('Проверьте поля и согласие') from None
    timestamp = now.isoformat(timespec='seconds')
    with database() as db:
        existing = db.execute('SELECT id FROM orders WHERE id = ?', (order_id,)).fetchone()
        if existing:
            # Retries are idempotent and cannot overwrite an existing order.
            return {'saved': True}
        db.execute('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                   (order_id, timestamp, name, phone, quantity, date, time, comment, CONSENT_VERSION, timestamp, 'new'))
    return {'saved': True}


def authorized(value):
    return bool(ADMIN_TOKEN) and hmac.compare_digest(value, 'Bearer ' + ADMIN_TOKEN)


def application(environ, start_response):
    def respond(code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode()
        start_response(code, [('Content-Type', 'application/json; charset=utf-8'), ('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff'), ('Content-Length', str(len(data)))])
        return [data]
    method, path = environ.get('REQUEST_METHOD'), environ.get('PATH_INFO')
    if method == 'POST' and path == '/api/orders':
        try:
            size = int(environ.get('CONTENT_LENGTH') or '0')
            if not 1 <= size <= 8192:
                return respond('413 Payload Too Large', {'error': 'Размер заявки недопустим'})
            data = json.loads(environ['wsgi.input'].read(size))
            return respond('200 OK', create_order(data))
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            return respond('400 Bad Request', {'error': 'Проверьте данные заявки'})
    if path == '/api/admin/orders' and method in ('GET', 'DELETE'):
        if not authorized(environ.get('HTTP_AUTHORIZATION', '')):
            return respond('401 Unauthorized', {'error': 'Нет доступа'})
        with database() as db:
            if method == 'DELETE':
                try:
                    order_id = str(uuid.UUID(environ.get('QUERY_STRING', '').removeprefix('id=')))
                except ValueError:
                    return respond('400 Bad Request', {'error': 'Неверный ID'})
                db.execute('DELETE FROM orders WHERE id = ?', (order_id,))
                return respond('200 OK', {'deleted': True})
            rows = db.execute('SELECT id, created_at, name, phone, quantity, pickup_date, pickup_time, comment, status FROM orders ORDER BY created_at DESC LIMIT 500').fetchall()
            return respond('200 OK', {'orders': [dict(zip(('id','created_at','name','phone','quantity','date','time','comment','status'), row)) for row in rows]})
    return respond('404 Not Found', {'error': 'Не найдено'})
