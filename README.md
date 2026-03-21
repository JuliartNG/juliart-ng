# Juliart NG 💍
### "Where Handcrafted Elegance Meets Digital Sophistication"

---

## Folder Structure

```
juliart_ng/
├── app.py                        ← Main Flask app
├── config.txt                    ← Admin password (change this!)
├── requirements.txt              ← Python dependencies
├── templates/
│   ├── index.html                ← Main storefront
│   └── login.html                ← Ghost admin login page
└── static/
    ├── css/style.css             ← All styling
    ├── js/app.js                 ← All interactivity
    ├── images/
    │   └── logo.png              ← ⚠️ DROP THE LOGO HERE
    └── uploads/                  ← Product photos (auto-created)
```

---

## Setup (Pydroid 3)

```bash
pip install flask flask-sqlalchemy werkzeug
python app.py
```

---

## Changing the Admin Password

Open `config.txt` with any text editor and change the part after the `=`:

```
password=YourNewPasswordHere
```

Then restart the app. No coding needed.

---

## Ghost Admin Access

Visit this URL in your browser:
```
http://YOUR-IP:5000/showglass
```

Enter your password → Curator Mode unlocked.
To exit → tap "Exit" in the top navigation.

---

## WhatsApp Number

The order receipt goes to: **+2347012001670**

To change it, open `app.py` and find:
```python
whatsapp = os.environ.get('WHATSAPP_NUMBER', '2347012001670')
```
Replace the number, save, restart.

---

## Deploying Live (Koyeb / Railway / Render)

1. Push this folder to GitHub
2. Connect repo to your hosting platform
3. Set start command: `python app.py`
4. Set environment variable: `WHATSAPP_NUMBER=2347012001670`
5. Deploy → get your public URL

---

*Juliart NG © 2026. All rights reserved.*
