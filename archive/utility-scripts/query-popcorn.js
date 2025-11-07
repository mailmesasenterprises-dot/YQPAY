const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://cluster0.vrj9qje.mongodb.net/yqpay')
  .then(async () => {
    const db = mongoose.connection.db;
    const product = await db.collection('productlist').findOne({ name: 'Pop Corn' });
    
    console.log('\n========== POP CORN PRODUCT DATA ==========\n');
    console.log(JSON.stringify(product, null, 2));
    console.log('\n========== PRODUCT LIST (VARIANTS) ==========\n');
    if (product && product.productList) {
      product.productList.forEach((variant, index) => {
        console.log(`\nVariant ${index + 1}:`);
        console.log(`  _id: ${variant._id}`);
        console.log(`  name: ${variant.name}`);
        console.log(`  size: ${variant.size}`);
        console.log(`  sizeLabel: ${variant.sizeLabel || 'N/A'}`);
        console.log(`  quantity: ${variant.quantity || 'N/A'}`);
        console.log(`  price: ${variant.pricing?.base || variant.pricing?.sale || 'N/A'}`);
      });
    }
    console.log('\n==========================================\n');
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
