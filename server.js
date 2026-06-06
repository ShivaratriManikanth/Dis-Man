const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve all files inside /public as static assets
app.use(express.static(path.join(__dirname, 'public')));

// POST endpoint for sending email notifications to the admin
app.post('/api/send-email', async (req, res) => {
  const { type, description, severity, contactName, contactPhone, latitude, longitude } = req.body;

  try {
    // Generate ethereal test account automatically (requires zero config)
    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await transporter.sendMail({
      from: '"Smart Disaster Response" <no-reply@disaster-response.com>',
      to: "mca111724039104@gmail.com",
      subject: `🚨 NEW EMERGENCY ALERT: ${type} (${severity})`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; border: 1px solid #cbd5e1; border-radius: 12px; padding: 24px; color: #1e293b;">
          <h2 style="color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 12px; margin-top: 0;">🚨 New Emergency Request</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 140px;">Disaster Type:</td>
              <td style="padding: 8px 0; font-size: 1.1rem; color: #0f172a;"><strong>${type}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Severity:</td>
              <td style="padding: 8px 0;"><span style="background: ${severity === 'Critical' ? '#fee2e2' : '#fef3c7'}; color: ${severity === 'Critical' ? '#ef4444' : '#d97706'}; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 0.85rem;">${severity}</span></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Description:</td>
              <td style="padding: 8px 0; color: #334155;">${description}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Reporter Name:</td>
              <td style="padding: 8px 0; color: #334155;">${contactName || 'Anonymous'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Reporter Phone:</td>
              <td style="padding: 8px 0; color: #334155;">${contactPhone || '—'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">GPS Coordinates:</td>
              <td style="padding: 8px 0; color: #334155;">${latitude && longitude ? `${latitude}, ${longitude}` : 'No GPS captured'}</td>
            </tr>
          </table>
          <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 24px 0;">
          <p style="font-size: 0.82rem; color: #64748b; margin-bottom: 0;">Please log in to the <a href="http://localhost:3000/authority.html" style="color: #38bdf8; text-decoration: none; font-weight: bold;">Authority Dashboard</a> to assign a volunteer.</p>
        </div>
      `,
    });

    console.log("-----------------------------------------");
    console.log("Email Notification Dispatched to Admin!");
    console.log("Message ID: %s", info.messageId);
    console.log("Ethereal Mailbox Preview Link: %s", nodemailer.getTestMessageUrl(info));
    console.log("-----------------------------------------");

    res.status(200).json({
      success: true,
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info)
    });
  } catch (err) {
    console.error("Email send failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Root → Login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Smart Disaster Response System running at http://localhost:${PORT}`);
});
