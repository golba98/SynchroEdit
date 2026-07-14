import { isProductionHost } from './config.js';

export function stripApiErrorPrefix(message) {
  return String(message || '').replace('API error: ', '');
}

export function getEmailConfigurationErrorMessage() {
  if (isProductionHost()) {
    return 'Email verification is temporarily unavailable. Please contact support.';
  }
  return 'Email verification is not configured for this environment.\nSet RESEND_API_KEY, EMAIL_CODE_PEPPER, EMAIL_FROM, and APP_NAME for staging.';
}

export function isEmailConfigurationError(code) {
  return (
    code === 'EMAIL_NOT_CONFIGURED' ||
    code === 'missing_email_code_pepper' ||
    code === 'missing_email_delivery_config'
  );
}

export function getApiErrorMessage(error, fallback = 'Something went wrong.') {
  const code = error?.data?.code;
  if (isEmailConfigurationError(code)) {
    return getEmailConfigurationErrorMessage();
  }
  return stripApiErrorPrefix(error?.message) || fallback;
}
