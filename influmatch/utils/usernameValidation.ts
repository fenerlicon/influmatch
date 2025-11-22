/**
 * Instagram-style username validation
 * Rules:
 * - 3-30 characters
 * - Only letters, numbers, dots (.), and underscores (_)
 * - Dots and underscores cannot be consecutive (.. or __)
 * - Dots and underscores cannot be at the start or end
 * - No uppercase letters (will be converted to lowercase)
 * - No spaces or special characters
 */

export interface UsernameValidationResult {
  isValid: boolean
  error?: string
  normalized?: string // Lowercase version
}

export function validateUsername(username: string): UsernameValidationResult {
  if (!username || username.trim().length === 0) {
    return {
      isValid: false,
      error: 'Kullanıcı adı boş olamaz.',
    }
  }

  const trimmed = username.trim()

  // Length check: 3-30 characters
  if (trimmed.length < 3) {
    return {
      isValid: false,
      error: 'Kullanıcı adı en az 3 karakter olmalıdır.',
    }
  }

  if (trimmed.length > 30) {
    return {
      isValid: false,
      error: 'Kullanıcı adı en fazla 30 karakter olabilir.',
    }
  }

  // Convert to lowercase for validation (Instagram doesn't allow uppercase)
  const lowercased = trimmed.toLowerCase()

  // Check if original contains uppercase (not allowed)
  if (trimmed !== lowercased) {
    return {
      isValid: false,
      error: 'Kullanıcı adı sadece küçük harf içerebilir.',
      normalized: lowercased,
    }
  }

  // Check for invalid characters (only letters, numbers, dots, underscores allowed)
  const validPattern = /^[a-z0-9._]+$/
  if (!validPattern.test(lowercased)) {
    return {
      isValid: false,
      error: 'Kullanıcı adı sadece harf, rakam, nokta (.) ve alt çizgi (_) içerebilir.',
    }
  }

  // Check if starts or ends with dot or underscore
  if (lowercased.startsWith('.') || lowercased.startsWith('_')) {
    return {
      isValid: false,
      error: 'Kullanıcı adı nokta (.) veya alt çizgi (_) ile başlayamaz.',
    }
  }

  if (lowercased.endsWith('.') || lowercased.endsWith('_')) {
    return {
      isValid: false,
      error: 'Kullanıcı adı nokta (.) veya alt çizgi (_) ile bitemez.',
    }
  }

  // Check for consecutive dots or underscores
  if (lowercased.includes('..') || lowercased.includes('__')) {
    return {
      isValid: false,
      error: 'Kullanıcı adında ardışık nokta (..) veya alt çizgi (__) bulunamaz.',
    }
  }

  // Check for consecutive dot and underscore combinations
  if (lowercased.includes('._') || lowercased.includes('_.')) {
    return {
      isValid: false,
      error: 'Kullanıcı adında nokta (.) ve alt çizgi (_) ardışık kullanılamaz.',
    }
  }

  return {
    isValid: true,
    normalized: lowercased,
  }
}

