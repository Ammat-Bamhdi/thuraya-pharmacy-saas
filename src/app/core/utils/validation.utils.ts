/**
 * @fileoverview Security validation utilities
 * Provides input sanitization and validation for authentication
 * 
 * @author Thuraya Systems
 * @version 1.0.0
 */

/**
 * Email validation regex (RFC 5322 compliant)
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Password strength levels
 */
export enum PasswordStrength {
  WEAK = 0,
  FAIR = 1,
  GOOD = 2,
  STRONG = 3,
  VERY_STRONG = 4
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
  // Length check
  if (email.length > 254) return false;
  
  // Format check
  if (!EMAIL_REGEX.test(email)) return false;
  
  // Local part (before @) max length = 64
  const localPart = email.split('@')[0];
  if (localPart.length > 64) return false;
  
  return true;
}

/**
 * Sanitize string input - remove HTML and dangerous characters
 * Prevents XSS attacks
 */
export function sanitizeString(input: string, maxLength: number = 255): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/[<>\"'`]/g, '') // Remove HTML/script injection chars
    .replace(/javascript:/gi, '') // Remove javascript: protocol  
    .replace(/on\w+=/gi, '') // Remove event handlers (onclick, onerror, etc)
    .replace(/data:text\/html/gi, '') // Remove data URLs
    .trim()
    .slice(0, maxLength);
}

/**
 * Validate password strength
 * Returns strength level and feedback
 */
export function validatePasswordStrength(password: string): {
  strength: PasswordStrength;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (!password) {
    return {
      strength: PasswordStrength.WEAK,
      score: 0,
      feedback: ['Password is required']
    };
  }

  // Length check
  if (password.length < 8) {
    feedback.push('Password should be at least 8 characters');
  } else if (password.length >= 8) {
    score += 1;
  }
  
  if (password.length >= 12) {
    score += 1;
  }

  // Complexity checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1; // Has both cases
  } else {
    feedback.push('Use both uppercase and lowercase letters');
  }

  if (/\d/.test(password)) {
    score += 1; // Has numbers
  } else {
    feedback.push('Include at least one number');
  }

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 1; // Has special characters
  } else {
    feedback.push('Include at least one special character');
  }

  // Common password check
  const commonPasswords = ['password', '123456', 'qwerty', 'abc123', 'letmein', 'admin'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    score = Math.max(0, score - 2);
    feedback.push('Avoid common passwords');
  }

  // Sequential characters check
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 1);
    feedback.push('Avoid repeating characters');
  }

  // Determine strength
  let strength: PasswordStrength;
  if (score <= 1) {
    strength = PasswordStrength.WEAK;
  } else if (score === 2) {
    strength = PasswordStrength.FAIR;
  } else if (score === 3) {
    strength = PasswordStrength.GOOD;
  } else if (score === 4) {
    strength = PasswordStrength.STRONG;
  } else {
    strength = PasswordStrength.VERY_STRONG;
  }

  return { strength, score, feedback: feedback.length > 0 ? feedback : ['Strong password!'] };
}

/**
 * Validate JWT token format (basic client-side validation)
 */
export function isValidJWTFormat(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  
  // JWT must have 3 parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  // Each part should be base64url encoded (only alphanumeric, -, _)
  const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
  return parts.every(part => part.length > 0 && base64UrlRegex.test(part));
}

/**
 * Check if string contains potential XSS attack vectors
 */
export function containsXSS(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\(/i,
    /expression\(/i,
    /vbscript:/i,
    /data:text\/html/i
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Validate phone number (international format)
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  
  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Must start with + and have 7-15 digits
  return /^\+\d{7,15}$/.test(cleaned);
}

/**
 * Validate organization/tenant name
 */
export function isValidOrganizationName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  
  // 2-100 characters, letters, numbers, spaces, basic punctuation only
  if (name.length < 2 || name.length > 100) return false;
  
  // No special characters that could be used for injection
  if (containsXSS(name)) return false;
  
  return /^[a-zA-Z0-9\s\-_&.,']+$/.test(name);
}

/**
 * Rate limiting helper - check if too many attempts
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 15 * 60 * 1000 // 15 minutes
  ) {}
  
  /**
   * Check if action is allowed
   * @param key - Identifier (e.g., email, IP)
   * @returns true if allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside the window
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (recentAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    // Record this attempt
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    
    return true;
  }
  
  /**
   * Get remaining attempts
   */
  getRemainingAttempts(key: string): number {
    const attempts = this.attempts.get(key) || [];
    const now = Date.now();
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxAttempts - recentAttempts.length);
  }
  
  /**
   * Clear attempts for a key (e.g., after successful login)
   */
  clear(key: string): void {
    this.attempts.delete(key);
  }
  
  /**
   * Clear all attempts
   */
  clearAll(): void {
    this.attempts.clear();
  }
}

/**
 * Password requirements configuration
 */
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  maxLength?: number;
}

/**
 * Default password requirements
 */
export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  maxLength: 128
};

/**
 * Validate password against requirements
 */
export function validatePassword(
  password: string,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!password) {
    return { valid: false, errors: ['Password is required'] };
  }
  
  if (password.length < requirements.minLength) {
    errors.push(`Password must be at least ${requirements.minLength} characters`);
  }
  
  if (requirements.maxLength && password.length > requirements.maxLength) {
    errors.push(`Password must not exceed ${requirements.maxLength} characters`);
  }
  
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (requirements.requireNumber && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (requirements.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
