// Test to compare what server.js mongoose connection returns vs direct test

const express = require('express');
const mongoose = require('mongoose');

// This should match how server.js connects
mongoose.connect('mongodb://localhost:27017/theater_canteen_db', {
  // Add any options from server.js if needed
})
.then(async () => {
  console.log('✅ Connected to MongoDB like server.js does\n');
  
  const db = mongoose.connection.db;
  const doc = await db.collection('settings').findOne({ type: 'sms' });
  
  console.log('📊 Document _id:', doc._id);
  console.log('📊 msg91SenderId:', doc.smsConfig.msg91SenderId);
  console.log('📊 msg91SenderId length:', doc.smsConfig.msg91SenderId.length);
  console.log('📊 msg91ApiKey:', doc.smsConfig.msg91ApiKey);
  console.log('📊 msg91TemplateId:', doc.smsConfig.msg91TemplateId);
  
  console.log('\n📋 Full smsConfig:');
  console.log(JSON.stringify(doc.smsConfig, null, 2));
  
  mongoose.connection.close();
})
.catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
