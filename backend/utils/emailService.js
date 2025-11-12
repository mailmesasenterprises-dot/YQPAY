/**
 * Email Notification Service for Stock Management
 * Handles sending email notifications for stock events (expiration, low stock, daily reports)
 */

const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const ExcelJS = require('exceljs');

/**
 * Get SMTP configuration from database
 */
async function getSMTPConfig() {
  try {
    const db = mongoose.connection.db;
    const mailConfig = await db.collection('settings').findOne({ type: 'mail' });
    
    if (!mailConfig || !mailConfig.mailConfig) {
      console.warn('⚠️  SMTP configuration not found. Email notifications disabled.');
      return null;
    }
    
    return mailConfig.mailConfig;
  } catch (error) {
    console.error('❌ Error fetching SMTP config:', error);
    return null;
  }
}

/**
 * Create nodemailer transporter from SMTP config
 */
async function createTransporter() {
  const config = await getSMTPConfig();
  if (!config) return null;
  
  try {
    const portNum = parseInt(config.port);
    const isSSL = config.encryption === 'SSL';
    
    // Auto-correct port/encryption mismatch
    let useSecure = isSSL;
    if (portNum === 465 && !isSSL) {
      useSecure = true;
    } else if (portNum === 587 && isSSL) {
      useSecure = false;
    }
    
    return nodemailer.createTransport({
      host: config.host,
      port: portNum,
      secure: useSecure,
      auth: {
        user: config.username.trim(),
        pass: config.password.trim()
      },
      tls: {
        rejectUnauthorized: false // For development/testing
      }
    });
  } catch (error) {
    console.error('❌ Error creating email transporter:', error);
    return null;
  }
}

/**
 * Send email with optional Excel attachment
 */
async function sendEmail({ to, subject, html, attachments = [] }) {
  try {
    const transporter = await createTransporter();
    if (!transporter) {
      console.warn('⚠️  Email transporter not available. Skipping email send.');
      return { success: false, error: 'SMTP not configured' };
    }
    
    const config = await getSMTPConfig();
    if (!config) {
      return { success: false, error: 'SMTP config not found' };
    }
    
    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      attachments
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate Excel buffer for stock report
 */
async function generateStockExcelBuffer(stockData, reportTitle = 'Stock Report') {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Stock Report');
    
    // Title
    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = reportTitle;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 25;
    
    // Headers
    const headers = ['S.No', 'Product Name', 'Old Stock', 'Invord Stock', 'Sales', 'Damage Stock', 'Expired Stock', 'Balance', 'Expire Date', 'Status'];
    worksheet.getRow(3).values = headers;
    worksheet.getRow(3).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    worksheet.getRow(3).height = 20;
    
    // Column widths
    worksheet.columns = [
      { width: 8 },   // S.No
      { width: 30 },  // Product Name
      { width: 15 },  // Old Stock
      { width: 15 },  // Invord Stock
      { width: 12 },  // Sales
      { width: 15 },  // Damage Stock
      { width: 15 },  // Expired Stock
      { width: 12 },  // Balance
      { width: 15 },  // Expire Date
      { width: 15 }   // Status
    ];
    
    // Add data rows
    let rowNumber = 4;
    stockData.forEach((item, index) => {
      const row = worksheet.getRow(rowNumber);
      row.values = [
        index + 1,
        item.productName || 'N/A',
        item.oldStock || 0,
        item.invordStock || 0,
        item.sales || 0,
        item.damageStock || 0,
        item.expiredStock || 0,
        item.balance || 0,
        item.expireDate ? new Date(item.expireDate).toLocaleDateString('en-IN') : 'N/A',
        item.status || 'Active'
      ];
      
      // Style data rows
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle' };
      });
      
      // Highlight low stock or expired items
      if (item.status === 'Low Stock' || item.status === 'Expiring Soon') {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
        });
      } else if (item.status === 'Expired') {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
        });
      }
      
      rowNumber++;
    });
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    console.error('❌ Error generating Excel buffer:', error);
    throw error;
  }
}

/**
 * Send stock expiration warning email
 */
async function sendStockExpirationWarning(theater, products) {
  try {
    if (!theater.email) {
      console.warn(`⚠️  Theater ${theater.name} has no email configured. Skipping expiration warning.`);
      return { success: false, error: 'No email configured for theater' };
    }
    
    const stockData = products.map(p => ({
      productName: p.productName,
      oldStock: p.oldStock || 0,
      invordStock: p.invordStock || 0,
      sales: p.sales || 0,
      damageStock: p.damageStock || 0,
      expiredStock: p.expiredStock || 0,
      balance: p.balance || 0,
      expireDate: p.expireDate,
      status: p.daysUntilExpiry <= 3 ? 'Expiring Soon' : 'Active'
    }));
    
    // Generate Excel attachment
    const excelBuffer = await generateStockExcelBuffer(stockData, `Stock Expiration Warning - ${theater.name}`);
    const fileName = `Stock_Expiration_Warning_${theater.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #8B5CF6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .warning { background-color: #FFF3CD; border-left: 4px solid #FFC107; padding: 15px; margin: 20px 0; }
          .product-list { margin: 20px 0; }
          .product-item { padding: 10px; border-bottom: 1px solid #ddd; }
          .footer { background-color: #F3F4F6; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⚠️ Stock Expiration Warning</h1>
        </div>
        <div class="content">
          <p>Dear ${theater.name} Team,</p>
          
          <div class="warning">
            <strong>⚠️ Important:</strong> You have ${products.length} product(s) that will expire within the next 3 days.
          </div>
          
          <h3>Products Expiring Soon:</h3>
          <div class="product-list">
            ${products.map(p => `
              <div class="product-item">
                <strong>${p.productName}</strong><br>
                Expiry Date: ${new Date(p.expireDate).toLocaleDateString('en-IN')}<br>
                Days Remaining: ${p.daysUntilExpiry} day(s)<br>
                Current Balance: ${p.balance || 0} units
              </div>
            `).join('')}
          </div>
          
          <p>Please review the attached Excel report for detailed stock information.</p>
          
          <p>Best regards,<br>YQPayNow System</p>
        </div>
        <div class="footer">
          <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `;
    
    return await sendEmail({
      to: theater.email,
      subject: `⚠️ Stock Expiration Warning - ${theater.name}`,
      html,
      attachments: [{
        filename: fileName,
        content: excelBuffer
      }]
    });
  } catch (error) {
    console.error('❌ Error sending expiration warning:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send low stock alert email
 */
async function sendLowStockAlert(theater, products) {
  try {
    if (!theater.email) {
      console.warn(`⚠️  Theater ${theater.name} has no email configured. Skipping low stock alert.`);
      return { success: false, error: 'No email configured for theater' };
    }
    
    const stockData = products.map(p => ({
      productName: p.productName,
      oldStock: p.oldStock || 0,
      invordStock: p.invordStock || 0,
      sales: p.sales || 0,
      damageStock: p.damageStock || 0,
      expiredStock: p.expiredStock || 0,
      balance: p.balance || 0,
      expireDate: p.expireDate,
      status: 'Low Stock'
    }));
    
    // Generate Excel attachment
    const excelBuffer = await generateStockExcelBuffer(stockData, `Low Stock Alert - ${theater.name}`);
    const fileName = `Low_Stock_Alert_${theater.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .alert { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
          .product-list { margin: 20px 0; }
          .product-item { padding: 10px; border-bottom: 1px solid #ddd; }
          .footer { background-color: #F3F4F6; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📦 Low Stock Alert</h1>
        </div>
        <div class="content">
          <p>Dear ${theater.name} Team,</p>
          
          <div class="alert">
            <strong>⚠️ Alert:</strong> You have ${products.length} product(s) with low stock levels.
          </div>
          
          <h3>Low Stock Products:</h3>
          <div class="product-list">
            ${products.map(p => `
              <div class="product-item">
                <strong>${p.productName}</strong><br>
                Current Stock: ${p.balance || 0} units<br>
                Low Stock Threshold: ${p.lowStockAlert || 5} units
              </div>
            `).join('')}
          </div>
          
          <p>Please review the attached Excel report and consider restocking these items.</p>
          
          <p>Best regards,<br>YQPayNow System</p>
        </div>
        <div class="footer">
          <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `;
    
    return await sendEmail({
      to: theater.email,
      subject: `📦 Low Stock Alert - ${theater.name}`,
      html,
      attachments: [{
        filename: fileName,
        content: excelBuffer
      }]
    });
  } catch (error) {
    console.error('❌ Error sending low stock alert:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send stock added notification email
 */
async function sendStockAddedNotification(theater, stockEntry) {
  try {
    if (!theater.email) {
      console.warn(`⚠️  Theater ${theater.name} has no email configured. Skipping stock added notification.`);
      return { success: false, error: 'No email configured for theater' };
    }
    
    const stockData = [{
      productName: stockEntry.productName,
      oldStock: stockEntry.oldStock || 0,
      invordStock: stockEntry.invordStock || 0,
      sales: stockEntry.sales || 0,
      damageStock: stockEntry.damageStock || 0,
      expiredStock: stockEntry.expiredStock || 0,
      balance: stockEntry.balance || 0,
      expireDate: stockEntry.expireDate,
      status: 'Added'
    }];
    
    // Generate Excel attachment
    const excelBuffer = await generateStockExcelBuffer(stockData, `Stock Added - ${theater.name}`);
    const fileName = `Stock_Added_${theater.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .info { background-color: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; }
          .footer { background-color: #F3F4F6; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>✅ Stock Added Successfully</h1>
        </div>
        <div class="content">
          <p>Dear ${theater.name} Team,</p>
          
          <div class="info">
            <strong>✅ Stock Update:</strong> New stock has been added to your inventory.
          </div>
          
          <h3>Stock Details:</h3>
          <p><strong>Product:</strong> ${stockEntry.productName}</p>
          <p><strong>Quantity Added:</strong> ${stockEntry.invordStock || 0} units</p>
          <p><strong>Date:</strong> ${new Date(stockEntry.date).toLocaleDateString('en-IN')}</p>
          ${stockEntry.expireDate ? `<p><strong>Expiry Date:</strong> ${new Date(stockEntry.expireDate).toLocaleDateString('en-IN')}</p>` : ''}
          <p><strong>New Balance:</strong> ${stockEntry.balance || 0} units</p>
          
          <p>Please review the attached Excel report for complete details.</p>
          
          <p>Best regards,<br>YQPayNow System</p>
        </div>
        <div class="footer">
          <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `;
    
    return await sendEmail({
      to: theater.email,
      subject: `✅ Stock Added - ${stockEntry.productName} - ${theater.name}`,
      html,
      attachments: [{
        filename: fileName,
        content: excelBuffer
      }]
    });
  } catch (error) {
    console.error('❌ Error sending stock added notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send daily sales report email
 */
async function sendDailySalesReport(theater, salesData) {
  try {
    if (!theater.email) {
      console.warn(`⚠️  Theater ${theater.name} has no email configured. Skipping daily sales report.`);
      return { success: false, error: 'No email configured for theater' };
    }
    
    // Generate Excel for sales report (reuse existing sales report generation logic)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Daily Sales Report');
    
    // Title
    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = `Daily Sales Report - ${theater.name} - ${new Date().toLocaleDateString('en-IN')}`;
    worksheet.getCell('A1').font = { bold: true, size: 16 };
    worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    // Headers
    const headers = ['S.No', 'Order ID', 'Date', 'Total Amount', 'Payment Method', 'Items Count', 'Status', 'Customer'];
    worksheet.getRow(3).values = headers;
    worksheet.getRow(3).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
    });
    
    // Add sales data
    salesData.forEach((order, index) => {
      worksheet.addRow([
        index + 1,
        order.orderId || order._id,
        new Date(order.createdAt).toLocaleDateString('en-IN'),
        order.totalAmount || 0,
        order.paymentMethod || 'N/A',
        order.itemsCount || 0,
        order.status || 'Completed',
        order.customerName || 'N/A'
      ]);
    });
    
    const excelBuffer = await workbook.xlsx.writeBuffer();
    const fileName = `Daily_Sales_Report_${theater.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    const totalSales = salesData.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalOrders = salesData.length;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #8B5CF6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .summary { background-color: #E0E7FF; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { background-color: #F3F4F6; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Daily Sales Report</h1>
        </div>
        <div class="content">
          <p>Dear ${theater.name} Team,</p>
          
          <div class="summary">
            <h3>Sales Summary for ${new Date().toLocaleDateString('en-IN')}</h3>
            <p><strong>Total Orders:</strong> ${totalOrders}</p>
            <p><strong>Total Sales:</strong> ₹${totalSales.toLocaleString('en-IN')}</p>
          </div>
          
          <p>Please find the detailed daily sales report attached in Excel format.</p>
          
          <p>Best regards,<br>YQPayNow System</p>
        </div>
        <div class="footer">
          <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `;
    
    return await sendEmail({
      to: theater.email,
      subject: `📊 Daily Sales Report - ${theater.name} - ${new Date().toLocaleDateString('en-IN')}`,
      html,
      attachments: [{
        filename: fileName,
        content: excelBuffer
      }]
    });
  } catch (error) {
    console.error('❌ Error sending daily sales report:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendStockExpirationWarning,
  sendLowStockAlert,
  sendStockAddedNotification,
  sendDailySalesReport,
  getSMTPConfig,
  createTransporter
};

