from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import os, uuid

app = Flask(__name__)
app.secret_key = 'juliart-velvet-glass-2026-xK9#mP2'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///juliart.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)

UPLOAD_FOLDER = os.path.join('static', 'uploads')
ALLOWED_EXT   = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
app.config['UPLOAD_FOLDER']      = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

db = SQLAlchemy(app)

class Product(db.Model):
    id       = db.Column(db.Integer, primary_key=True)
    name     = db.Column(db.String(120), nullable=False)
    price    = db.Column(db.Float, nullable=False)
    image    = db.Column(db.String(300), nullable=False)
    category = db.Column(db.String(60),  default='Jewelry')
    desc     = db.Column(db.Text,        default='')

class ActivityLog(db.Model):
    id        = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    ip        = db.Column(db.String(60))
    event     = db.Column(db.String(200))
    success   = db.Column(db.Boolean, default=True)
    device    = db.Column(db.String(200), default='Unknown')
    browser   = db.Column(db.String(200), default='Unknown')

class LoginAttempt(db.Model):
    id        = db.Column(db.Integer, primary_key=True)
    ip        = db.Column(db.String(60))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

def get_admin_password():
    try:
        with open('config.txt', 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith('password='):
                    return line.split('=', 1)[1].strip()
    except FileNotFoundError:
        pass
    return 'Juliart_Agida'

def get_ip():
    return request.headers.get('X-Forwarded-For', request.remote_addr).split(',')[0].strip()

def get_device():
    ua = request.headers.get('User-Agent', '')
    if 'iPhone' in ua:       device = 'iPhone'
    elif 'iPad' in ua:       device = 'iPad'
    elif 'Android' in ua:
        # Try to extract device model
        try:
            start  = ua.index('(') + 1
            end    = ua.index(')')
            parts  = ua[start:end].split(';')
            device = parts[2].strip() if len(parts) > 2 else 'Android Device'
        except:
            device = 'Android Device'
    elif 'Windows' in ua:    device = 'Windows PC'
    elif 'Macintosh' in ua:  device = 'Mac'
    elif 'Linux' in ua:      device = 'Linux PC'
    else:                    device = 'Unknown Device'
    return device

def get_browser():
    ua = request.headers.get('User-Agent', '')
    if 'Chrome' in ua and 'Edg' not in ua and 'OPR' not in ua:
        browser = 'Chrome'
    elif 'Firefox' in ua:    browser = 'Firefox'
    elif 'Safari' in ua and 'Chrome' not in ua:
        browser = 'Safari'
    elif 'Edg' in ua:        browser = 'Edge'
    elif 'OPR' in ua:        browser = 'Opera'
    else:                    browser = 'Unknown Browser'
    return browser

def log_event(event, success=True):
    entry = ActivityLog(
        ip      = get_ip(),
        event   = event,
        success = success,
        device  = get_device(),
        browser = get_browser()
    )
    db.session.add(entry)
    db.session.commit()

def is_admin():
    return session.get('is_admin', False)

def is_blocked(ip):
    window   = datetime.utcnow() - timedelta(minutes=30)
    attempts = LoginAttempt.query.filter(
        LoginAttempt.ip == ip,
        LoginAttempt.timestamp >= window
    ).count()
    return attempts >= 5

def record_failed_attempt(ip):
    db.session.add(LoginAttempt(ip=ip))
    db.session.commit()

def clear_attempts(ip):
    LoginAttempt.query.filter_by(ip=ip).delete()
    db.session.commit()

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT

@app.route('/')
def index():
    products = Product.query.order_by(Product.id.desc()).all()
    whatsapp = os.environ.get('WHATSAPP_NUMBER', '2347012001670')
    return render_template('index.html',
                           products=products,
                           is_admin=is_admin(),
                           whatsapp=whatsapp)

@app.route('/showglass', methods=['GET', 'POST'])
def showglass():
    ip    = get_ip()
    error = None
    if request.method == 'POST':
        if is_blocked(ip):
            log_event('Blocked IP tried to login', success=False)
            error = 'Too many failed attempts. Try again in 30 minutes.'
            return render_template('login.html', error=error)
        entered = request.form.get('password', '').strip()
        correct = get_admin_password()
        if entered == correct:
            session.clear()
            session['is_admin'] = True
            session['admin_ip'] = ip
            session.permanent   = True
            clear_attempts(ip)
            log_event('Admin login successful')
            return redirect(url_for('index'))
        else:
            record_failed_attempt(ip)
            window    = datetime.utcnow() - timedelta(minutes=30)
            remaining = 5 - LoginAttempt.query.filter(
                LoginAttempt.ip == ip,
                LoginAttempt.timestamp >= window
            ).count()
            log_event('Failed admin login attempt', success=False)
            error = f'Incorrect passphrase. {remaining} attempt(s) remaining.'
    return render_template('login.html', error=error)

@app.route('/exitglass')
def exitglass():
    log_event('Admin logged out')
    session.clear()
    return redirect(url_for('index'))

@app.route('/showglass/vault')
def vault():
    if not is_admin():
        return redirect(url_for('showglass'))
    logs = ActivityLog.query.order_by(ActivityLog.timestamp.desc()).limit(100).all()
    return render_template('vault.html', logs=logs)

@app.route('/admin/upload', methods=['POST'])
def upload_image():
    if not is_admin():
        log_event('Unauthorized upload attempt', success=False)
        return jsonify({'error': 'Unauthorized'}), 403
    if 'image' not in request.files:
        return jsonify({'error': 'No file sent'}), 400
    f = request.files['image']
    if f.filename == '' or not allowed_file(f.filename):
        return jsonify({'error': 'Invalid file'}), 400
    ext      = f.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    f.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
    log_event(f'New product photo uploaded')
    return jsonify({'url': url_for('static', filename=f'uploads/{filename}')})

@app.route('/admin/add', methods=['POST'])
def add_product():
    if not is_admin():
        log_event('Unauthorized add product attempt', success=False)
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    if not data or not data.get('name') or not data.get('price') or not data.get('image'):
        return jsonify({'error': 'Missing fields'}), 400
    p = Product(
        name     = data['name'].strip(),
        price    = float(data['price']),
        image    = data['image'],
        category = data.get('category', 'Jewelry').strip() or 'Jewelry',
        desc     = data.get('desc', '').strip()
    )
    db.session.add(p)
    db.session.commit()
    log_event(f'New product listed: {p.name} — ₦{p.price:,.0f}')
    return jsonify({'id': p.id, 'name': p.name, 'price': p.price,
                    'image': p.image, 'category': p.category, 'desc': p.desc})

@app.route('/admin/delete/<int:pid>', methods=['DELETE'])
def delete_product(pid):
    if not is_admin():
        log_event('Unauthorized delete attempt', success=False)
        return jsonify({'error': 'Unauthorized'}), 403
    p = Product.query.get_or_404(pid)
    name = p.name
    if p.image.startswith('/static/uploads/'):
        filepath = p.image.lstrip('/')
        if os.path.exists(filepath):
            os.remove(filepath)
    db.session.delete(p)
    db.session.commit()
    log_event(f'Product removed: {name}')
    return jsonify({'deleted': pid})

@app.route('/cart/add/<int:pid>', methods=['POST'])
def cart_add(pid):
    cart           = session.get('cart', {})
    cart[str(pid)] = cart.get(str(pid), 0) + 1
    session['cart'] = cart
    return jsonify({'count': sum(cart.values())})

@app.route('/cart/remove/<int:pid>', methods=['POST'])
def cart_remove(pid):
    cart = session.get('cart', {})
    key  = str(pid)
    if key in cart:
        cart[key] -= 1
        if cart[key] <= 0:
            del cart[key]
    session['cart'] = cart
    return jsonify({'count': sum(cart.values())})

@app.route('/cart/clear', methods=['POST'])
def cart_clear():
    session.pop('cart', None)
    return jsonify({'ok': True})

@app.route('/cart')
def cart_data():
    cart     = session.get('cart', {})
    products = {str(p.id): p for p in Product.query.all()}
    items, total = [], 0
    for pid, qty in cart.items():
        p = products.get(pid)
        if p:
            items.append({'id': p.id, 'name': p.name, 'price': p.price,
                          'qty': qty, 'image': p.image})
            total += p.price * qty
    return jsonify({'items': items, 'total': total, 'count': sum(cart.values())})

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000)
