import dotenv from 'dotenv';
import path from 'path';

// Load env vars from root .env
dotenv.config({ path: path.join(__dirname, '../.env') });

import { emailService } from '../src/services/email.service';

const main = async () => {
  const to = process.argv[2];

  if (!to) {
    console.error('Usage: npx ts-node scripts/test-email.ts <email>');
    process.exit(1);
  }

  console.log(`Sending test emails to ${to}...`);

  if (!process.env.SENDGRID_API_KEY) {
    console.warn('WARNING: SENDGRID_API_KEY is missing');
  }

  // 1. Test Standard HTML Email
  console.log('\n1. Testing Standard HTML Email...');
  const success1 = await emailService.sendEmail({
    to,
    subject: 'Test 1: Standard HTML',
    text: 'This is a standard email.',
    html: '<strong>This is a standard email.</strong>',
  });
  console.log(success1 ? '✅ Standard Email Sent' : '❌ Standard Email Failed');

  // 2. Test EJS Template Email
  console.log('\n2. Testing EJS Template Email...');
  const success2 = await emailService.sendEmail({
    to,
    subject: 'Test 2: EJS Template',
    template: 'welcome.ejs',
    templateData: {
      name: 'User',
      appName: 'Express TS App',
      year: new Date().getFullYear(),
    },
  });
  console.log(success2 ? '✅ EJS Email Sent' : '❌ EJS Email Failed');

  // 3. Test SendGrid Dynamic Template (only if ID is present)
  if (process.env.SENDGRID_WELCOME_TEMPLATE_ID) {
    console.log('\n3. Testing SendGrid Dynamic Template...');
    const success3 = await emailService.sendEmail({
      to,
      templateId: process.env.SENDGRID_WELCOME_TEMPLATE_ID,
      dynamicTemplateData: {
        name: 'Suresh',
        appName: 'Express TS App',
        year: new Date().getFullYear(),
      },
    });
    console.log(success3 ? '✅ Dynamic Template Email Sent' : '❌ Dynamic Template Email Failed');
  } else {
    console.log('\n3. Skipping SendGrid Dynamic Template (SENDGRID_WELCOME_TEMPLATE_ID not set)');
  }

  process.exit(0);
};

main();
