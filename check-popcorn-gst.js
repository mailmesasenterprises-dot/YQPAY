// Quick check for Pop Corn product GST details
// Run this in browser console on the theater-order page

fetch('http://localhost:5000/theater-products/68f8837a541316c6ad54b79f?page=1&limit=100', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(res => res.json())
.then(data => {
  const popCorn = data.products.find(p => p.name && p.name.toLowerCase().includes('corn'));
  if (popCorn) {
    console.log('🍿 Pop Corn Product Details:');
    console.log('Name:', popCorn.name);
    console.log('Price:', popCorn.sellingPrice || popCorn.pricing?.basePrice);
    console.log('GST Type:', popCorn.gstType);
    console.log('Tax Rate:', popCorn.taxRate || popCorn.pricing?.taxRate);
    console.log('Discount:', popCorn.discountPercentage || popCorn.pricing?.discountPercentage);
    console.log('\nFull Product:', popCorn);
  } else {
    console.log('Pop Corn product not found');
  }
})
.catch(err => console.error('Error:', err));
