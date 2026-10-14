const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const data = req.body || {};
  const siteDomain = (data.websiteDomain || '').replace(/https?:\/\//i, '').replace(/\/.*$/, '') || 'N/A';
  const subject = data.emailSubject || `Design Notes for ${siteDomain}`;

  // 1. Build Plain-Text Body (Optimal for Salesforce Regex / Parsing Triggers)
  let plainTextBody = `=== NEW WEBSITE DISCOVERY SUBMISSION ===\n\n`;
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('_') || key === 'emailSubject') continue;
    const cleanVal = (value && String(value).trim()) ? String(value).trim() : 'N/A';
    plainTextBody += `${key}: ${cleanVal}\n`;
  }

  // 2. Build HTML Body (Clean table layout for inbox viewers)
  let tableRows = '';
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('_') || key === 'emailSubject') continue;
    const cleanVal = (value && String(value).trim()) ? String(value).trim() : 'N/A';
    tableRows += `
      <tr>
        <th style="text-align:left; padding:10px 14px; border:1px solid #e2e8f0; background:#f8fafc; width:36%; font-size:13px; color:#475569;">${key}</th>
        <td style="padding:10px 14px; border:1px solid #e2e8f0; font-size:13px; color:#0f172a;">${cleanVal}</td>
      </tr>
    `;
  }

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8fafc;">
      <div style="max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: #0284c7; color: #ffffff; padding: 16px 20px; font-size: 16px; font-weight: bold;">
          ${subject}
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${tableRows}
        </table>
      </div>
    </body>
    </html>
  `;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Website Discovery" <${process.env.SMTP_USER}>`,
      to: 'ideperalta@officite.com', // Replace with the destination delegated address
      replyTo: data.doctorEmail || process.env.SMTP_USER,
      subject: subject,
      text: plainTextBody, // Consumed by Salesforce triggers
      html: htmlBody,     // Consumed by human reviewers
    });

    return res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error('Mail dispatch error:', err);
    return res.status(500).json({ error: 'Mail dispatch failed', details: err.message });
  }
};
