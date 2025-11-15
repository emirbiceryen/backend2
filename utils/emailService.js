const nodemailer = require('nodemailer');
const emailConfig = require('./emailConfig');

let transporter = null;

// Initialize email transporter
const initializeTransporter = () => {
  if (!emailConfig.enabled) {
    console.warn('[Email Service] Email service is disabled');
    return null;
  }

  if (emailConfig.provider === 'smtp') {
    // Check if required SMTP config is present
    if (!emailConfig.smtp.host || !emailConfig.smtp.port || !emailConfig.smtp.user || !emailConfig.smtp.pass) {
      console.warn('[Email Service] SMTP configuration incomplete. Email service will not work.');
      return null;
    }

    try {
      // Clean SMTP password (remove spaces - Gmail App Passwords may have spaces)
      const cleanPassword = emailConfig.smtp.pass ? emailConfig.smtp.pass.replace(/\s+/g, '') : '';
      
      transporter = nodemailer.createTransport({
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure, // true for 465, false for other ports
        auth: {
          user: emailConfig.smtp.user,
          pass: cleanPassword,
        },
      });

      // Verify connection asynchronously (don't block server startup)
      transporter.verify((error, success) => {
        if (error) {
          console.error('[Email Service] Connection error:', error.message);
          console.warn('[Email Service] Email sending may fail. Check SMTP configuration.');
        } else {
          console.log('[Email Service] Server is ready to send emails');
        }
      });
    } catch (error) {
      console.error('[Email Service] Error initializing transporter:', error.message);
      return null;
    }
  }

  return transporter;
};

// Initialize on module load (with error handling)
if (emailConfig.enabled) {
  try {
    initializeTransporter();
  } catch (error) {
    console.error('[Email Service] Failed to initialize:', error.message);
    console.warn('[Email Service] Email service disabled due to initialization error');
  }
}

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 * @returns {Promise}
 */
const sendEmail = async ({ to, subject, html, text }) => {
  if (!emailConfig.enabled || !transporter) {
    console.warn('[Email Service] Email service is disabled or not configured');
    return { success: false, message: 'Email service is not configured' };
  }

  try {
    const info = await transporter.sendMail({
      from: emailConfig.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
    });

    console.log('[Email Service] Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email Service] Error sending email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send email verification email
 * @param {Object} user - User object
 * @param {string} token - Verification token
 * @returns {Promise}
 */
const sendVerificationEmail = async (user, token) => {
  const verificationUrl = `${emailConfig.baseUrl}/verify-email?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2E7D32; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Hubi!</h1>
        </div>
        <div class="content">
          <p>Hello ${user.name || user.email},</p>
          <p>Thank you for signing up for Hubi! Please verify your email address by clicking the button below:</p>
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #4CAF50;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account with Hubi, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Hubi. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: user.email,
    subject: 'Verify Your Hubi Email Address',
    html,
  });
};

/**
 * Send notification email
 * @param {Object} options - Notification options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.message - Notification message
 * @param {string} options.type - Notification type
 * @param {Object} options.data - Additional data (optional)
 * @returns {Promise}
 */
const sendNotificationEmail = async ({ to, subject, message, type, data = {} }) => {
  if (!emailConfig.enabled) {
    return { success: false, message: 'Email service is disabled' };
  }

  // Check if user has email notifications enabled (can be added to User model later)
  // For now, send to all users

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2E7D32; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Hubi Notification</h1>
        </div>
        <div class="content">
          <p>${message}</p>
          ${data.actionUrl ? `<p><a href="${data.actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">View Details</a></p>` : ''}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Hubi. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: subject || 'Hubi Notification',
    html,
  });
};

/**
 * Send business event application notification
 * @param {Object} businessOwner - Business owner user object
 * @param {Object} applicant - Applicant user object
 * @param {Object} event - Event object
 * @returns {Promise}
 */
const sendBusinessEventApplicationEmail = async (businessOwner, applicant, event) => {
  const message = `${applicant.name} has applied to your event "${event.title}". Please review the application in your Business Dashboard.`;
  const actionUrl = `${emailConfig.baseUrl}/business/events/${event._id}/participants`;

  return sendNotificationEmail({
    to: businessOwner.email,
    subject: `New Application: ${event.title}`,
    message,
    type: 'business_event_application',
    data: { actionUrl },
  });
};

/**
 * Send business event application approved/rejected email
 * @param {Object} applicant - Applicant user object
 * @param {Object} event - Event object
 * @param {string} status - 'approved' or 'rejected'
 * @returns {Promise}
 */
const sendBusinessEventApplicationStatusEmail = async (applicant, event, status) => {
  const isApproved = status === 'approved';
  const subject = isApproved 
    ? `Application Approved: ${event.title}`
    : `Application Update: ${event.title}`;
  
  const message = isApproved
    ? `Congratulations! Your application to "${event.title}" has been approved. You can now view event details and prepare for the event.`
    : `Your application to "${event.title}" has been reviewed. Unfortunately, it was not approved at this time.`;

  return sendNotificationEmail({
    to: applicant.email,
    subject,
    message,
    type: `business_event_application_${status}`,
    data: { actionUrl: `${emailConfig.baseUrl}/forum/events/${event._id}` },
  });
};

/**
 * Send match request notification email
 * @param {Object} recipient - Recipient user object
 * @param {Object} requester - Requester user object
 * @returns {Promise}
 */
const sendMatchRequestEmail = async (recipient, requester) => {
  const message = `${requester.name} wants to match with you! Check your Hubi app to view their profile and respond.`;
  const actionUrl = `${emailConfig.baseUrl}/matching`;

  return sendNotificationEmail({
    to: recipient.email,
    subject: `New Match Request from ${requester.name}`,
    message,
    type: 'match_request',
    data: { actionUrl },
  });
};

/**
 * Send team join request notification email
 * @param {Object} captain - Team captain user object
 * @param {Object} requester - User requesting to join
 * @param {Object} team - Team object
 * @returns {Promise}
 */
const sendTeamJoinRequestEmail = async (captain, requester, team) => {
  const message = `${requester.name} wants to join your team "${team.name}". Please review the request in your Hubi app.`;
  const actionUrl = `${emailConfig.baseUrl}/teams/${team._id}`;

  return sendNotificationEmail({
    to: captain.email,
    subject: `Team Join Request: ${team.name}`,
    message,
    type: 'team_join_request',
    data: { actionUrl },
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendNotificationEmail,
  sendBusinessEventApplicationEmail,
  sendBusinessEventApplicationStatusEmail,
  sendMatchRequestEmail,
  sendTeamJoinRequestEmail,
  isEmailServiceEnabled: () => emailConfig.enabled && transporter !== null,
};

