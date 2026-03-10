const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
    console.log('Testing SMTP connection...');
    console.log('Host:', process.env.SMTP_HOST);
    console.log('Port:', process.env.SMTP_PORT);
    console.log('User:', process.env.SMTP_USER);
    console.log('Secure:', process.env.SMTP_SECURE);

    let pass = process.env.SMTP_PASSWORD;
    if (pass.startsWith('"') && pass.endsWith('"')) {
        pass = pass.slice(1, -1);
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: pass,
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        const info = await transporter.verify();
        console.log('Connection successful!');

        // Attempt to send a test email
        const mailInfo = await transporter.sendMail({
            from: process.env.FROM_EMAIL || process.env.SMTP_USER,
            to: process.env.SMTP_USER, // send to self
            subject: 'Test Email - Connection Check',
            text: 'This is a test email to verify SMTP configuration.'
        });
        console.log('Test email sent:', mailInfo.messageId);
    } catch (error) {
        console.error('Connection failed:');
        console.error(error);
    }
}

testEmail();
