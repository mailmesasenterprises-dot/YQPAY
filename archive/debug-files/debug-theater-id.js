// Theater ID Debug Test
console.log('=== THEATER ID DEBUG TEST ===');

// Check what's in localStorage
console.log('localStorage authToken:', localStorage.getItem('authToken') ? 'EXISTS' : 'MISSING');
console.log('localStorage user:', localStorage.getItem('user'));
console.log('localStorage userType:', localStorage.getItem('userType'));
console.log('localStorage theaterId:', localStorage.getItem('theaterId'));

// Parse user data if exists
const userData = localStorage.getItem('user');
if (userData) {
  try {
    const parsedUser = JSON.parse(userData);
    console.log('Parsed user data:', parsedUser);
    
    if (parsedUser.assignedTheater) {
      console.log('user.assignedTheater:', parsedUser.assignedTheater);
    }
    
    if (parsedUser.theater) {
      console.log('user.theater:', parsedUser.theater);
    }
  } catch (e) {
    console.log('Error parsing user data:', e);
  }
}

// Check current URL
console.log('Current URL:', window.location.href);
console.log('Current pathname:', window.location.pathname);

// Try to extract theater ID from URL
const pathParts = window.location.pathname.split('/');
const theaterIdFromUrl = pathParts[pathParts.indexOf('theater') + 1];
console.log('Theater ID from URL:', theaterIdFromUrl);

console.log('=== END DEBUG TEST ===');