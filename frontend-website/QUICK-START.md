# 🚀 Quick Start Guide

## Installation & Setup

### Step 1: Install Dependencies

```bash
cd frontend-website
npm install
```

This will install all required packages including:
- React 19
- Material-UI
- React Router
- Axios
- And all other dependencies

### Step 2: Environment Variables (Optional)

Create a `.env` file if you need custom configuration:

```bash
cp .env.example .env
```

Edit `.env` and update values as needed. Remember all variables must start with `VITE_` prefix.

### Step 3: Start Development Server

```bash
npm run dev
```

The app will start at: **http://localhost:3000**

### Step 4: Build for Production

```bash
npm run build
```

Output will be in the `dist/` folder.

---

## ✅ Verification

After starting the dev server, verify:

1. ✅ App loads at http://localhost:3000
2. ✅ No console errors
3. ✅ API calls work (check Network tab)
4. ✅ All pages accessible
5. ✅ Authentication works

---

## 🎯 Common Commands

```bash
# Development
npm run dev          # Start dev server

# Production
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
```

---

## 📝 Important Notes

1. **Environment Variables**: Use `VITE_` prefix (not `REACT_APP_`)
2. **Access Pattern**: Use `import.meta.env` (not `process.env`)
3. **Entry Point**: `src/main.jsx` (not `src/index.js`)
4. **Build Output**: `dist/` folder (not `build/`)

---

## 🐛 Troubleshooting

### Port Already in Use
Change port in `vite.config.js`:
```js
server: { port: 3001 }
```

### Module Not Found
```bash
rm -rf node_modules package-lock.json
npm install
```

### Environment Variables Not Working
- Ensure variables start with `VITE_`
- Restart dev server
- Use `import.meta.env` not `process.env`

---

## 🎉 You're Ready!

Your Vite project is set up and ready to go. All features from the original project are preserved and ready to use.

**Happy Coding! 🚀**

