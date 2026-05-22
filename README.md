# ⚡ PoE2 Patch Notes Reformatted

> **Open source micro-tools for the Path of Exile 2 community** — built in celebration of the new League.

🌐 **Live at:** [poe2-changelog-converter.vercel.app](https://poe2-changelog-converter.vercel.app)

---

## What is this?

**Patch Notes Reformatted** transforms the wall-of-text Path of Exile forum patch notes into a clean, structured, Dota 2-inspired reading experience — with color-coded buffs, nerfs, fixes, and new content, all filterable at a glance.

**Features:**
- 🟢 **Buffs** / 🔴 **Nerfs** / 🔵 **Fixes** / ⭐ **New** — color-coded and filterable
- 📋 Click any stat in the header to filter the entire changelog by type
- 🗂️ Auto-generated Table of Contents + sticky section navigation
- 📌 Works with any `pathofexile.com/forum/view-thread/...` URL, or paste raw text directly
- ⏳ Countdown to the next league launch (Return of the Ancients — Update 0.5)
- 📱 Fully responsive, dark mode by default

---

## 🛠️ More Tools Coming

This is the first of a series of **free, open source micro-tools** I'm building for the PoE2 community in celebration of the new league season.

**Got an idea?** If there's something that would make your Path of Exile 2 experience more convenient — a tool, a helper, a calculator, anything — I'd love to hear it.

📬 **Reach out:** [contact@nguyenlnp.com](mailto:contact@nguyenlnp.com)
🌐 **More projects:** [ai.nguyenlnp.com](https://ai.nguyenlnp.com)
☕ **Support the work:** [ko-fi.com/nguyenlnp](https://ko-fi.com/nguyenlnp)

---

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Start the dev server (frontend + backend)
npm run dev
```

Then open **http://localhost:5173**

The app has two parts running concurrently:
- **Vite** — frontend dev server with hot-reload
- **Express** — backend API that fetches and parses PoE forum threads

---

## 🗂️ Project Structure

```
├── index.html              # Main HTML shell
├── src/
│   ├── main.js             # App entry point, filter logic, countdown
│   ├── render.js           # HTML rendering for sections/changes
│   ├── styles/             # Modular CSS (tokens, layout, components)
│   └── utils/
│       ├── api.js          # Frontend API calls
│       ├── classify.js     # Change type icons & diff formatting
│       └── scroll-spy.js   # Active section tracking
├── api/                    # Vercel serverless functions
│   ├── fetch-changelog.js  # Fetches & parses forum thread
│   └── parse-text.js       # Parses raw pasted text
└── server/
    └── parser.js           # Core HTML → structured data parser
```

---

## 🤝 Contributing

This project is open source and contributions are welcome! Whether it's a bug fix, a new feature, or a suggestion — open an issue or submit a PR.

---

## 📄 License

MIT — free to use, modify, and share.

---

*Built for exiles, by an exile. May your maps be juicy and your builds be buffed. 🗡️*
