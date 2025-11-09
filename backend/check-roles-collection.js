require('dotenv').config();
const mongoose = require('mongoose');

async function checkRoles() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const docs = await mongoose.connection.db.collection('roles').find({}).toArray();
    console.log(`📊 Total roles documents: ${docs.length}\n`);
    
    docs.forEach((doc, i) => {
      console.log(`Document ${i + 1}:`);
      console.log(`  _id: ${doc._id}`);
      console.log(`  Theater: ${doc.theater || 'NULL/UNDEFINED'}`);
      console.log(`  Role List Length: ${doc.roleList ? doc.roleList.length : 0}`);
      console.log();
    });
    
    // Find orphaned document
    const orphaned = await mongoose.connection.db.collection('roles').find({ theater: null }).toArray();
    if (orphaned.length > 0) {
      console.log('⚠️  Found orphaned documents with null theater:');
      orphaned.forEach(doc => {
        console.log(`  ID: ${doc._id}`);
      });
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkRoles();
