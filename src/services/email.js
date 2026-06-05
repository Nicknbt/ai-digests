import nodemailer from 'nodemailer';

export async function sendEmail({ to, subject, html }) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      html,
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.warn(`email: ${err.message}`);
    return { success: false, error: err.message };
  }
}
