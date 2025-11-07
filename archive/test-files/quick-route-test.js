// Quick Route Test
const express = require('express');
const app = express();

// Add basic middleware
app.use(express.json());

// Test route loading
try {
  console.log('🔧 Loading TheaterUserArray routes...');
  const theaterUsersArrayRoutes = require('./routes/theaterUsersArray');
  app.use('/api/theater-users-array', theaterUsersArrayRoutes);
  console.log('✅ Routes loaded successfully!');
} catch (error) {
  console.error('❌ Route loading failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server working!' });
});

app.listen(5001, () => {
  console.log('🚀 Test server running on port 5001');
  console.log('Testing route: http://localhost:5001/test');
});

// Test if routes exist
setTimeout(() => {
  const routes = app._router.stack
    .filter(r => r.route)
    .map(r => Object.keys(r.route.methods)[0].toUpperCase() + ' ' + r.route.path);
  
  console.log('📋 Available routes:', routes);
}, 1000);