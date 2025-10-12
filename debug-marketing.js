// Debug marketing email service
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

console.log('🔍 Debug Marketing Email Service');
console.log('=================================');

// Test 1: Check environment variables
console.log('\n1. Environment Variables:');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***SET***' : 'NOT SET');

// Test 2: Check marketing config import
console.log('\n2. Marketing Config Import:');
try {
  const { MARKETING_CONFIG } = await import('./marketing-config.js');
  console.log('MARKETING_CONFIG.OFFICIAL_EMAIL:', MARKETING_CONFIG.OFFICIAL_EMAIL);
} catch (error) {
  console.log('❌ Failed to import marketing config:', error.message);
}

// Test 3: Check marketing email list
console.log('\n3. Marketing Email List:');
try {
  const { getMarketingEmailList } = await import('./marketing-config.js');
  const emails = getMarketingEmailList();
  console.log('Email list:', emails);
} catch (error) {
  console.log('❌ Failed to get email list:', error.message);
}

// Test 4: Test nodemailer directly
console.log('\n4. Direct Nodemailer Test:');
const EMAIL_CONFIG = {
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
};

try {
  const transporter = nodemailer.createTransport(EMAIL_CONFIG);
  console.log('✅ Transporter created');
  
  // Test sending a simple email
  const mailOptions = {
    from: 'johnowolabi80@gmail.com',
    to: 'johnowolabi80@gmail.com',
    subject: 'Test Email from Marketing System',
    text: 'This is a test email to verify the marketing system is working.'
  };
  
  console.log('📧 Attempting to send test email...');
  const result = await transporter.sendMail(mailOptions);
  console.log('✅ Email sent successfully:', result.messageId);
  
} catch (error) {
  console.log('❌ Email sending failed:', error.message);
}
