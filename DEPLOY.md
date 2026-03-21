# Juliart NG — Deploy to GitHub & Render
### Step by step for Android (MGit + Render)

---

## PART 1 — Prepare the files

1. Extract `juliart_ng_final.zip` on your phone
2. Drop `logo.png` into `static/images/` folder
3. You should have this structure:
```
juliart_ng/
├── app.py
├── config.txt
├── requirements.txt
├── templates/
│   ├── index.html
│   └── login.html
└── static/
    ├── css/style.css
    ├── js/app.js
    ├── images/logo.png   ← logo here
    └── uploads/
```

---

## PART 2 — Add one required file for Render

Create a new file called `Procfile` (no extension) inside the juliart_ng folder with exactly this inside:

```
web: python app.py
```

---

## PART 3 — Push to GitHub using MGit

1. Open **MGit** on your phone
2. Tap **+** to create a new repo
3. Point it to your `juliart_ng` folder
4. Tap **Stage All** → then **Commit**
5. Write commit message: `Initial commit`
6. Tap **Push**
7. It will ask for your GitHub username and password
   - For password use a **Personal Access Token** not your real password
   - Get one at: github.com → Settings → Developer Settings → Personal Access Tokens → Generate New Token → tick `repo` → copy it
8. Paste the token as your password → Push

---

## PART 4 — Deploy on Render (free)

1. Go to **render.com** on your browser
2. Sign up with your GitHub account
3. Click **New** → **Web Service**
4. Connect your GitHub repo
5. Fill in these settings:
   - **Name:** juliart-ng
   - **Branch:** main
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python app.py`
6. Scroll down to **Environment Variables** and add:
   - `WHATSAPP_NUMBER` = `2347012001670`
7. Click **Create Web Service**
8. Wait 2-3 minutes while it deploys
9. Render gives you a free URL like:
   ```
   https://juliart-ng.onrender.com
   ```

---

## PART 5 — Your live URLs

```
https://juliart-ng.onrender.com              ← store
https://juliart-ng.onrender.com/showglass    ← admin login
```

Password is in config.txt → Juliart_Agida

---

## ⚠️ One thing to know about Render free tier

On the free plan, the app **sleeps after 15 minutes of no traffic** and takes about 30 seconds to wake up on the next visit. This is fine for now. When she's ready to go serious you can upgrade to a paid plan or move to Railway.

---

*Good luck! 🚀*
