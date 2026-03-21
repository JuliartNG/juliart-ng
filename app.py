from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
import os, uuid

app = Flask(__name__)
app.secret_key = 'juliart-velvet-glass-2026'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///juliart.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# ── Upload config ─────────────────────────────────────────────────────────────
UPLOAD_FOLDER = os.path.join('static', 'uploads')
ALLOWED_EXT   = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
app.config['UPLOAD_FOLDER']        = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH']   = 16 * 1024 * 1024  # 16MB max
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

db = SQLAlchemy(app)

# ── Read password from config.txt ─────────────────────────────────────────────
def get_admin_password():
    try:
        with open('config.txt', 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith('password='):
                    return line.split('=', 1)[1].strip()
    except FileNotFoundError:
        pass
    return 'Juliart_Agida'  # fallback if config.txt is missing

# ── Model ─────────────────────────────────────────────────────────────────────
class Product(db.Model):
    id       = db.Column(db.Integer, primary_key=True)
    name     = db.Column(db.String(120), nullable=False)
    price    = db.Column(db.Float, nullable=False)
    image    = db.Column(db.String(300), nullable=False)
    category = db.Column(db.String(60),  default='Jewelry')
    desc     = db.Column(db.Text,        default='')

# ── Helpers ───────────────────────────────────────────────────────────────────
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT

def is_admin():
    return session.get('is_admin', False)

# ── Public routes ─────────────────────────────────────────────────────────────
@app.route('/')
def index():
    products  = Product.query.order_by(Product.id.desc()).all()
    whatsapp  = os.environ.get('WHATSAPP_NUMBER', '2347012001670')
    return render_template('index.html',
                           products=products,
                           is_admin=is_admin(),
                           whatsapp=whatsapp)

# ── Ghost Admin ───────────────────────────────────────────────────────────────
@app.route('/showglass', methods=['GET', 'POST'])
def showglass():
    error = None
    if request.method == 'POST':
        entered  = request.form.get('password', '').strip()
        correct  = get_admin_password()
        if entered == correct:
            session['is_admin'] = True
            session.permanent   = True
            return redirect(url_for('index'))
        else:
            error = 'Incorrect passphrase. Please try again.'
    return render_template('login.html', error=error)

@app.route('/exitglass')
def exitglass():
    session.clear()
    return redirect(url_for('index'))

# ── Admin: upload image ───────────────────────────────────────────────────────
@app.route('/admin/upload', methods=['POST'])
def upload_image():
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403
    if 'image' not in request.files:
        return jsonify({'error': 'No file sent'}), 400
    f = request.files['image']
    if f.filename == '' or not allowed_file(f.filename):
        return jsonify({'error': 'Invalid file'}), 400
    ext      = f.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    f.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
    return jsonify({'url': url_for('static', filename=f'uploads/{filename}')})

# ── Admin: add product ────────────────────────────────────────────────────────
@app.route('/admin/add', methods=['POST'])
def add_product():
    if not is_admin():
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
    return jsonify({'id': p.id, 'name': p.name, 'price': p.price,
                    'image': p.image, 'category': p.category, 'desc': p.desc})

# ── Admin: delete product ─────────────────────────────────────────────────────
@app.route('/admin/delete/<int:pid>', methods=['DELETE'])
def delete_product(pid):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403
    p = Product.query.get_or_404(pid)
    # remove image file from disk
    if p.image.startswith('/static/uploads/'):
        filepath = p.image.lstrip('/')
        if os.path.exists(filepath):
            os.remove(filepath)
    db.session.delete(p)
    db.session.commit()
    return jsonify({'deleted': pid})

# ── Cart (server-side session) ────────────────────────────────────────────────
@app.route('/cart/add/<int:pid>', methods=['POST'])
def cart_add(pid):
    cart      = session.get('cart', {})
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

# ── Boot ──────────────────────────────────────────────────────────────────────
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
