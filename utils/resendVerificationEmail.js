/**
 * Send verification email using Resend API
 * @param {string} recipientEmail - Recipient's email address
 * @param {string} verificationCode - 6-digit verification code
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function sendVerificationEmail(recipientEmail, verificationCode) {
  // Resend API key from environment variable
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.error('[Resend Email] ❌ RESEND_API_KEY environment variable is not set');
    return {
      success: false,
      error: 'Resend API key is not configured'
    };
  }

  if (!recipientEmail || !verificationCode) {
    console.error('[Resend Email] ❌ Missing required parameters');
    return {
      success: false,
      error: 'Recipient email and verification code are required'
    };
  }

  // Email HTML template
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          padding: 0;
        }
        .header {
          background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%);
          color: #ffffff;
          padding: 40px 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 16px;
          color: #333333;
          margin-bottom: 20px;
        }
        .message {
          font-size: 15px;
          color: #666666;
          margin-bottom: 30px;
          line-height: 1.8;
        }
        .code-container {
          background-color: #f8f9fa;
          border: 2px dashed #4CAF50;
          border-radius: 12px;
          padding: 30px;
          text-align: center;
          margin: 30px 0;
        }
        .verification-code {
          font-size: 36px;
          font-weight: bold;
          color: #2E7D32;
          letter-spacing: 8px;
          font-family: 'Courier New', monospace;
          margin: 0;
        }
        .code-label {
          font-size: 14px;
          color: #666666;
          margin-top: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .footer {
          padding: 30px;
          text-align: center;
          background-color: #f8f9fa;
          border-top: 1px solid #e0e0e0;
        }
        .footer-text {
          font-size: 12px;
          color: #999999;
          margin: 5px 0;
        }
        .warning {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .warning-text {
          font-size: 13px;
          color: #856404;
          margin: 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Hubi</h1>
        </div>
        <div class="content">
          <div class="greeting">
            Merhaba,
          </div>
          <div class="message">
            Hubi hesabınızı doğrulamak için aşağıdaki doğrulama kodunu kullanın:
          </div>
          <div class="code-container">
            <p class="verification-code">${verificationCode}</p>
            <p class="code-label">Doğrulama Kodu</p>
          </div>
          <div class="warning">
            <p class="warning-text">
              ⚠️ Bu kod 10 dakika içinde geçersiz olacaktır. Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.
            </p>
          </div>
        </div>
        <div class="footer">
          <p class="footer-text">© ${new Date().getFullYear()} Hubi. Tüm hakları saklıdır.</p>
          <p class="footer-text">Bu otomatik bir e-postadır, lütfen yanıtlamayın.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Plain text version for email clients that don't support HTML
  const emailText = `
Hubi Doğrulama Kodu

Merhaba,

Hubi hesabınızı doğrulamak için aşağıdaki doğrulama kodunu kullanın:

Doğrulama Kodu: ${verificationCode}

Bu kod 10 dakika içinde geçersiz olacaktır.

Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.

© ${new Date().getFullYear()} Hubi. Tüm hakları saklıdır.
  `.trim();

  try {
    console.log(`[Resend Email] 📧 Sending verification email to: ${recipientEmail}`);
    console.log(`[Resend Email] 🔑 Verification code: ${verificationCode}`);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'info@hubiiapp.com',
        to: [recipientEmail],
        subject: 'Doğrulama Kodu',
        html: emailHtml,
        text: emailText,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Resend Email] ❌ Failed to send email:', data);
      
      // Provide helpful error messages
      if (data.statusCode === 403) {
        if (data.message && data.message.includes('domain')) {
          console.error('[Resend Email] ❌ Domain not verified. Please verify "hubiiapp.com" domain in Resend dashboard.');
          return {
            success: false,
            error: 'Domain not verified. Please verify your domain in Resend dashboard at https://resend.com/domains',
            details: data.message
          };
        }
      }
      
      return {
        success: false,
        error: data.message || 'Failed to send email',
        details: data
      };
    }

    console.log('[Resend Email] ✅ Email sent successfully!');
    console.log(`[Resend Email] 📬 Email ID: ${data.id}`);
    
    return {
      success: true,
      message: 'Verification email sent successfully',
      emailId: data.id
    };

  } catch (error) {
    console.error('[Resend Email] ❌ Error sending email:', error.message);
    console.error('[Resend Email] ❌ Error stack:', error.stack);
    
    return {
      success: false,
      error: error.message || 'Unknown error occurred while sending email'
    };
  }
}

module.exports = sendVerificationEmail;

// Example usage:
// 
// const sendVerificationEmail = require('./utils/resendVerificationEmail');
// 
// // In your route handler or function:
// const result = await sendVerificationEmail('user@example.com', '123456');
// 
// if (result.success) {
//   console.log('Email sent:', result.message);
// } else {
//   console.error('Failed to send email:', result.error);
// }

