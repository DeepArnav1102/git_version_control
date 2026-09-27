const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) === 465 : true, // port 465 requires SSL
    family: 4, // Force IPv4 — prevents ENETUNREACH on IPv6-broken networks
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

module.exports = transporter;
