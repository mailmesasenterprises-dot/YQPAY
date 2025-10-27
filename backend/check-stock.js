const mongoose = require('mongoose');
const fs = require('fs');

mongoose.connect('mongodb://localhost:27017/yqpaynow')
  .then(async () => {
    let output = '✅ Connected to MongoDB\n\n';
    
    const db = mongoose.connection.db;
    const theaterId = new mongoose.Types.ObjectId('68f8837a541316c6ad54b79f');
    
    const result = await db.collection('productlist').findOne({ theater: theaterId });
    
    if (result) {
      output += '📦 All Products Stock Status:\n\n';
      result.productList.forEach((product, index) => {
        output += `${index + 1}. ${product.name} (${product.pricing?.quantity || 'N/A'})\n`;
        output += `   Current Stock: ${product.inventory?.currentStock ?? 'N/A'}\n`;
        output += `   Track Stock: ${product.inventory?.trackStock ?? 'N/A'}\n`;
        output += `   Active: ${product.isActive}, Available: ${product.isAvailable}\n\n`;
      });
    }
    
    console.log(output);
    fs.writeFileSync('stock-report.txt', output);
    console.log('📄 Report saved to stock-report.txt');
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
