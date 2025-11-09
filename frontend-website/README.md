# 🎬 YQPayNow Theater Canteen Management - Frontend

Modern React frontend built with **Vite** for lightning-fast development and optimized production builds.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📋 Prerequisites

- Node.js >= 16.0.0
- npm or yarn

## ⚙️ Configuration

### Environment Variables

All environment variables must start with `VITE_` prefix.

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:8080/api
VITE_APP_NAME=YQPayNow
```

See `.env.example` for all available variables.

## 🏗️ Project Structure

```
frontend-website/
├── public/          # Static assets
├── src/
│   ├── components/  # Reusable components
│   ├── pages/       # Page components
│   ├── contexts/    # React contexts
│   ├── hooks/      # Custom hooks
│   ├── services/    # API services
│   ├── utils/      # Utility functions
│   ├── styles/     # CSS files
│   ├── config/     # Configuration
│   └── main.jsx    # Entry point
├── index.html       # HTML template
└── vite.config.js  # Vite configuration
```

## 🔧 Key Features

- ⚡ **Vite** - Lightning fast HMR and builds
- ⚛️ **React 19** - Latest React features
- 🎨 **Material-UI** - Modern UI components
- 🛣️ **React Router** - Client-side routing
- 📱 **Responsive Design** - Mobile-first approach
- 🔐 **Authentication** - JWT-based auth
- 💳 **Payment Integration** - Razorpay support
- 📊 **Real-time Updates** - Live data synchronization
- 🎯 **Offline Support** - Works without internet

## 📦 Available Scripts

- `npm run dev` - Start development server (port 3000)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🌐 API Proxy

The development server proxies `/api/*` requests to `http://localhost:8080`.

Configure in `vite.config.js`:

```js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
}
```

## 🎨 Styling

- Global styles in `src/styles/index.css`
- Component-specific styles in `src/styles/`
- CSS modules supported
- Material-UI theme customization

## 📱 Features

### Customer Features
- QR code scanning
- Menu browsing
- Shopping cart
- Order placement
- Payment processing
- Order history

### Theater Admin Features
- Dashboard
- Product management
- Order management
- Stock management
- Reports & analytics
- User management
- Settings

### POS Features
- Online POS
- Offline POS (with auto-sync)
- Kiosk interface
- Order processing

## 🔒 Security

- JWT token authentication
- Role-based access control
- Secure API communication
- XSS protection
- CSRF protection

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

### Deploy to Production

1. Build the project: `npm run build`
2. Serve the `dist/` folder with a web server
3. Configure environment variables
4. Set up API proxy if needed

## 📝 Development Notes

- Entry point: `src/main.jsx`
- Main app component: `src/App.js`
- Configuration: `src/config/index.js`
- All environment variables use `VITE_` prefix
- Use `import.meta.env` instead of `process.env`

## 🐛 Troubleshooting

### Module not found errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Environment variables not working
- Ensure variables start with `VITE_` prefix
- Restart dev server after changing `.env`
- Use `import.meta.env` instead of `process.env`

### Port already in use
Change port in `vite.config.js`:
```js
server: {
  port: 3001, // Change to available port
}
```

## 📚 Documentation

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Material-UI Documentation](https://mui.com/)

## 👥 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License

---

**Built with ❤️ using Vite + React**
