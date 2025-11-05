/**
 * QR Code Parser Utility
 * Parses and validates QR code data
 */

/**
 * Parse QR code data
 * The QR code contains the student registration ID
 */
export const parseQRCode = (data: string): { isValid: boolean; registrationId: string | null } => {
  if (!data || typeof data !== 'string') {
    return { isValid: false, registrationId: null };
  }

  // Trim whitespace
  const trimmedData = data.trim();

  // Check if it's a valid format (alphanumeric, dashes, underscores)
  const isValidFormat = /^[A-Za-z0-9_-]+$/.test(trimmedData);

  if (!isValidFormat || trimmedData.length === 0) {
    return { isValid: false, registrationId: null };
  }

  return {
    isValid: true,
    registrationId: trimmedData,
  };
};

/**
 * Validate registration ID format
 */
export const isValidRegistrationId = (registrationId: string): boolean => {
  return /^[A-Za-z0-9_-]+$/.test(registrationId) && registrationId.length > 0;
};
