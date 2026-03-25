from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import os, uuid, cloudinary, cloudinary.uploader, resend

app = Flask(__name__)
app.secret_key = 'juliart-velvet-glass-2026-xK9#mP2'
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///juliart.db').replace('postgres://', 'postgresql+pg8000://').replace('postgresql://', 'postgresql+pg8000://')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)

# ── Cloudinary ────────────────────────────────────────────────────────────────
cloudinary.config(
    cloud_name = os.environ.get('CLOUDINARY_CLOUD_NAME', 'dktxicogl'),
    api_key    = os.environ.get('CLOUDINARY_API_KEY',    '699971215324763'),
    api_secret = os.environ.get('CLOUDINARY_API_SECRET', 'tEtP9KnoM_AgbLId4vdcL-Z3qY4')
)

# ── Resend ────────────────────────────────────────────────────────────────────
resend.api_key = os.environ.get('RESEND_API_KEY', 're_bzAXoTi8_Pyxrj528VQqCED826YSFMPbU')

db = SQLAlchemy(app)

# ── Models ────────────────────────────────────────────────────────────────────
class Category(db.Model):
    id   = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False, unique=True)

class Product(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(120), nullable=False)
    price       = db.Column(db.Float, nullable=False)
    category    = db.Column(db.String(60), default='General')
    desc        = db.Column(db.Text, default='')
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    sold_out    = db.Column(db.Boolean, default=False)
    sold_out_at = db.Column(db.DateTime, nullable=True)
    image1      = db.Column(db.String(300), nullable=False)
    image2      = db.Column(db.String(300), nullable=True)
    image3      = db.Column(db.String(300), nullable=True)
    image4      = db.Column(db.String(300), nullable=True)

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

# ── Helpers ───────────────────────────────────────────────────────────────────
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
    if 'iPhone' in ua:      return 'iPhone'
    elif 'iPad' in ua:      return 'iPad'
    elif 'Android' in ua:
        try:
            start = ua.index('(') + 1
            end   = ua.index(')')
            parts = ua[start:end].split(';')
            return parts[2].strip() if len(parts) > 2 else 'Android Device'
        except: return 'Android Device'
    elif 'Windows' in ua:   return 'Windows PC'
    elif 'Macintosh' in ua: return 'Mac'
    else:                   return 'Unknown Device'

def get_browser():
    ua = request.headers.get('User-Agent', '')
    if 'Chrome' in ua and 'Edg' not in ua and 'OPR' not in ua: return 'Chrome'
    elif 'Firefox' in ua:   return 'Firefox'
    elif 'Safari' in ua and 'Chrome' not in ua: return 'Safari'
    elif 'Edg' in ua:       return 'Edge'
    elif 'OPR' in ua:       return 'Opera'
    else:                   return 'Unknown Browser'

def log_event(event, success=True):
    try:
        db.session.add(ActivityLog(
            ip=get_ip(), event=event, success=success,
            device=get_device(), browser=get_browser()
        ))
        db.session.commit()
    except: pass

def is_admin():
    return session.get('is_admin', False)

def is_blocked(ip):
    window = datetime.utcnow() - timedelta(minutes=30)
    return LoginAttempt.query.filter(
        LoginAttempt.ip == ip,
        LoginAttempt.timestamp >= window
    ).count() >= 5

def record_failed_attempt(ip):
    db.session.add(LoginAttempt(ip=ip))
    db.session.commit()

def clear_attempts(ip):
    LoginAttempt.query.filter_by(ip=ip).delete()
    db.session.commit()

def purge_expired_soldout():
    try:
        cutoff  = datetime.utcnow() - timedelta(days=7)
        expired = Product.query.filter(
            Product.sold_out == True,
            Product.sold_out_at <= cutoff
        ).all()
        for p in expired:
            db.session.delete(p)
        if expired:
            db.session.commit()
    except: pass

def product_to_dict(p):
    images = [i for i in [p.image1, p.image2, p.image3, p.image4] if i]
    return {
        'id': p.id, 'name': p.name, 'price': p.price,
        'category': p.category, 'desc': p.desc,
        'sold_out': p.sold_out,
        'is_new': (datetime.utcnow() - p.created_at).days < 7,
        'images': images, 'image': p.image1
    }

def seed_categories():
    defaults = ['Waistbeads','Anklets','Bracelets','Neckpiece',
                'Glasses Strap','Phone Strap','Beaded Bags']
    for name in defaults:
        if not Category.query.filter_by(name=name).first():
            db.session.add(Category(name=name))
    db.session.commit()

# ── Public routes ─────────────────────────────────────────────────────────────
@app.route('/')
def index():
    purge_expired_soldout()
    products   = Product.query.order_by(Product.id.desc()).all()
    categories = Category.query.order_by(Category.name).all()
    whatsapp   = os.environ.get('WHATSAPP_NUMBER', '2347012001670')
    return render_template('index.html',
                           products=products,
                           categories=categories,
                           is_admin=is_admin(),
                           whatsapp=whatsapp,
                           now=datetime.utcnow())

# ── Ghost Admin ───────────────────────────────────────────────────────────────
@app.route('/showglass', methods=['GET', 'POST'])
def showglass():
    ip = get_ip(); error = None
    if request.method == 'POST':
        if is_blocked(ip):
            log_event('Blocked IP tried admin login', success=False)
            return render_template('login.html', error='Too many failed attempts. Try again in 30 minutes.')
        entered = request.form.get('password', '').strip()
        if entered == get_admin_password():
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
                LoginAttempt.timestamp >= window).count()
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

# ── Admin: upload image via Cloudinary ───────────────────────────────────────
@app.route('/admin/upload', methods=['POST'])
def upload_image():
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403
    if 'image' not in request.files:
        return jsonify({'error': 'No file'}), 400
    f = request.files['image']
    if not f.filename:
        return jsonify({'error': 'Invalid file'}), 400
    try:
        result = cloudinary.uploader.upload(
            f, folder='juliart_ng',
            transformation=[{'width': 800, 'crop': 'limit', 'quality': 'auto'}]
        )
        return jsonify({'url': result['secure_url']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Admin: categories ─────────────────────────────────────────────────────────
@app.route('/admin/categories')
def get_categories():
    cats = Category.query.order_by(Category.name).all()
    return jsonify([{'id': c.id, 'name': c.name} for c in cats])

@app.route('/admin/categories/add', methods=['POST'])
def add_category():
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Name required'}), 400
    if Category.query.filter_by(name=name).first():
        return jsonify({'error': 'Category already exists'}), 400
    c = Category(name=name)
    db.session.add(c); db.session.commit()
    log_event(f'Category added: {name}')
    return jsonify({'id': c.id, 'name': c.name})

@app.route('/admin/categories/delete/<int:cid>', methods=['DELETE'])
def delete_category(cid):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403
    c = Category.query.get_or_404(cid)
    log_event(f'Category deleted: {c.name}')
    db.session.delete(c); db.session.commit()
    return jsonify({'deleted': cid})

# ── Admin: add product ────────────────────────────────────────────────────────
@app.route('/admin/add', methods=['POST'])
def add_product():
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    if not data or not data.get('name') or not data.get('price') or not data.get('image1'):
        return jsonify({'error': 'Missing required fields'}), 400
    p = Product(
        name     = data['name'].strip(),
        price    = float(data['price']),
        image1   = data['image1'],
        image2   = data.get('image2') or None,
        image3   = data.get('image3') or None,
        image4   = data.get('image4') or None,
        category = data.get('category', 'General').strip() or 'General',
        desc     = data.get('desc', '').strip()
    )
    db.session.add(p); db.session.commit()
    log_event(f'Product listed: {p.name}')
    return jsonify(product_to_dict(p))

# ── Admin: toggle sold out ────────────────────────────────────────────────────
@app.route('/admin/soldout/<int:pid>', methods=['POST'])
def toggle_soldout(pid):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403
    p             = Product.query.get_or_404(pid)
    p.sold_out    = not p.sold_out
    p.sold_out_at = datetime.utcnow() if p.sold_out else None
    db.session.commit()
    log_event(f'Product {"sold out" if p.sold_out else "available"}: {p.name}')
    return jsonify({'sold_out': p.sold_out})

# ── Admin: delete product ─────────────────────────────────────────────────────
@app.route('/admin/delete/<int:pid>', methods=['DELETE'])
def delete_product(pid):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403
    p = Product.query.get_or_404(pid)
    name = p.name
    db.session.delete(p); db.session.commit()
    log_event(f'Product removed: {name}')
    return jsonify({'deleted': pid})

# ── Cart ──────────────────────────────────────────────────────────────────────
@app.route('/cart/add/<int:pid>', methods=['POST'])
def cart_add(pid):
    p = Product.query.get_or_404(pid)
    if p.sold_out:
        return jsonify({'error': 'Sold out'}), 400
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
        if cart[key] <= 0: del cart[key]
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
                          'qty': qty, 'image': p.image1})
            total += p.price * qty
    return jsonify({'items': items, 'total': total, 'count': sum(cart.values())})

# ── Boot ──────────────────────────────────────────────────────────────────────
with app.app_context():
    db.create_all()
    seed_categories()

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000)
