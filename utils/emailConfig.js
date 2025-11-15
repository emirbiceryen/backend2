const parseBoolean = (value) => {
  if (!value) return false;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

const emailVerificationEnabled = parseBoolean(process.env.EMAIL_VERIFICATION_ENABLED);

const emailVerificationConfig = {
  enabled: emailVerificationEnabled,
  from: process.env.EMAIL_VERIFICATION_FROM || '',
  baseUrl: process.env.EMAIL_VERIFICATION_BASE_URL || '',
  provider: process.env.EMAIL_PROVIDER || 'smtp',
  resend: {
    apiKey: process.env.RESEND_API_KEY || ''
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    secure: parseBoolean(process.env.SMTP_SECURE)
  }
};

if (emailVerificationEnabled) {
  const missing = [];

  if (!emailVerificationConfig.from) {
    missing.push('EMAIL_VERIFICATION_FROM');
  }
  // EMAIL_VERIFICATION_BASE_URL is optional - system will use backend URL automatically
  // Only warn if explicitly set but empty
  if (process.env.EMAIL_VERIFICATION_BASE_URL === '') {
    console.info('[Email Verification] EMAIL_VERIFICATION_BASE_URL is empty. Backend URL will be used automatically.');
  }

  if (emailVerificationConfig.provider === 'resend') {
    if (!emailVerificationConfig.resend.apiKey) {
      missing.push('RESEND_API_KEY');
    }
  } else if (emailVerificationConfig.provider === 'smtp') {
    if (!emailVerificationConfig.smtp.host) missing.push('SMTP_HOST');
    if (!emailVerificationConfig.smtp.port) missing.push('SMTP_PORT');
    if (!emailVerificationConfig.smtp.user) missing.push('SMTP_USER');
    if (!emailVerificationConfig.smtp.pass) missing.push('SMTP_PASS');
  }

  if (missing.length) {
    console.warn(
      `[Email Verification] Enabled but missing required environment variables: ${missing.join(', ')}`
    );
  }
} else {
  console.info('[Email Verification] Disabled. Set EMAIL_VERIFICATION_ENABLED=true to activate.');
}

module.exports = emailVerificationConfig;

