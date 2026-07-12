import nodemailer from 'nodemailer';

/**
 * Sends a 6-digit OTP verification code to a user's email.
 * If SMTP credentials are not configured, it will print to the console.
 */
export async function sendOtpEmail(email: string, otp: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM || '"WealthOS Support" <noreply@wealthos.dev>';

  // If credentials are not configured, log to console and skip sending
  if (!host || !user || !pass) {
    console.log('\n======================================');
    console.log(`[EMAIL SYSTEM (SIMULATED)] ✉️`);
    console.log(`To: ${email}`);
    console.log(`Subject: Your WealthOS Verification Code`);
    console.log(`Body: Your OTP code is ${otp}. It will expire in 10 minutes.`);
    console.log('======================================\n');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    const mailOptions = {
      from,
      to: email,
      subject: '🔑 Your WealthOS Verification Code',
      text: `Your OTP verification code is ${otp}. This code expires in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #f3f4f6; border-radius: 12px; background-color: #ffffff; color: #1f2937;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; padding: 12px; border-radius: 16px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; font-size: 24px; font-weight: bold; width: 40px; height: 40px; line-height: 40px; text-align: center; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2);">
              W
            </div>
            <h2 style="color: #1f2937; margin-top: 15px; font-size: 20px; font-weight: 800;">Verify Your WealthOS Account</h2>
          </div>
          <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">Hello,</p>
          <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">Thank you for registering with WealthOS. To complete your sign-up verification, please enter the following 6-digit One-Time Password (OTP):</p>
          
          <div style="background-color: #f3f4f6; font-size: 28px; font-weight: 800; letter-spacing: 6px; text-align: center; padding: 18px; margin: 25px 0; border-radius: 10px; color: #111827; font-family: monospace;">
            ${otp}
          </div>
          
          <p style="font-size: 13px; color: #6b7280; line-height: 1.5; text-align: center; margin-bottom: 25px;">
            This OTP code is valid for <strong>10 minutes</strong>. If you did not request this verification, please ignore this email.
          </p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
            &copy; ${new Date().getFullYear()} WealthOS. All rights reserved.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SYSTEM] ✅ Real email sent successfully to ${email} via SMTP.`);
    return true;
  } catch (error) {
    console.error('[EMAIL SYSTEM] ❌ Failed to send SMTP email:', error);
    return false;
  }
}
