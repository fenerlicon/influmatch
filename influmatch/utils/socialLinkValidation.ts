/**
 * Validates social media links to ensure they are in the correct format
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
  normalizedUrl?: string
}

/**
 * Normalizes and validates Instagram link
 * Accepts: instagram.com/username, @username, https://instagram.com/username
 */
export function validateInstagram(link: string | null | undefined): ValidationResult {
  if (!link || link.trim().length === 0) {
    return { isValid: true } // Empty is allowed
  }

  const trimmed = link.trim()

  // Remove @ if present
  let username = trimmed.replace(/^@/, '')

  // If it's already a full URL, extract username
  if (trimmed.includes('instagram.com')) {
    const match = trimmed.match(/instagram\.com\/([^/?]+)/i)
    if (match) {
      username = match[1]
    } else {
      return {
        isValid: false,
        error: 'Geçersiz Instagram linki. Örnek: https://instagram.com/kullaniciadi veya @kullaniciadi',
      }
    }
  }

  // Validate username format (alphanumeric, dots, underscores)
  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    return {
      isValid: false,
      error: 'Instagram kullanıcı adı sadece harf, rakam, nokta ve alt çizgi içerebilir.',
    }
  }

  if (username.length < 1 || username.length > 30) {
    return {
      isValid: false,
      error: 'Instagram kullanıcı adı 1-30 karakter arasında olmalıdır.',
    }
  }

  return {
    isValid: true,
    normalizedUrl: `https://instagram.com/${username}`,
  }
}

/**
 * Normalizes and validates TikTok link
 * Accepts: tiktok.com/@username, @username, https://tiktok.com/@username
 */
export function validateTikTok(link: string | null | undefined): ValidationResult {
  if (!link || link.trim().length === 0) {
    return { isValid: true } // Empty is allowed
  }

  const trimmed = link.trim()

  // Remove @ if present
  let username = trimmed.replace(/^@/, '')

  // If it's already a full URL, extract username
  if (trimmed.includes('tiktok.com')) {
    const match = trimmed.match(/tiktok\.com\/@?([^/?]+)/i)
    if (match) {
      username = match[1]
    } else {
      return {
        isValid: false,
        error: 'Geçersiz TikTok linki. Örnek: https://tiktok.com/@kullaniciadi veya @kullaniciadi',
      }
    }
  }

  // Validate username format (alphanumeric, dots, underscores)
  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    return {
      isValid: false,
      error: 'TikTok kullanıcı adı sadece harf, rakam, nokta ve alt çizgi içerebilir.',
    }
  }

  if (username.length < 1 || username.length > 24) {
    return {
      isValid: false,
      error: 'TikTok kullanıcı adı 1-24 karakter arasında olmalıdır.',
    }
  }

  return {
    isValid: true,
    normalizedUrl: `https://tiktok.com/@${username}`,
  }
}

/**
 * Normalizes and validates YouTube link
 * Accepts: youtube.com/@username, youtube.com/channel/..., youtube.com/c/..., @username
 */
export function validateYouTube(link: string | null | undefined): ValidationResult {
  if (!link || link.trim().length === 0) {
    return { isValid: true } // Empty is allowed
  }

  const trimmed = link.trim()

  // If it's already a full URL
  if (trimmed.includes('youtube.com')) {
    // Check for @username format
    if (trimmed.includes('/@')) {
      const match = trimmed.match(/youtube\.com\/@([^/?]+)/i)
      if (match) {
        return {
          isValid: true,
          normalizedUrl: `https://youtube.com/@${match[1]}`,
        }
      }
    }
    // Check for channel format
    if (trimmed.includes('/channel/') || trimmed.includes('/c/')) {
      // Validate it's a proper YouTube URL
      if (/youtube\.com\/(channel|c)\/[^/?]+/i.test(trimmed)) {
        return {
          isValid: true,
          normalizedUrl: trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
        }
      }
    }
    return {
      isValid: false,
      error: 'Geçersiz YouTube linki. Örnek: https://youtube.com/@kullaniciadi veya https://youtube.com/channel/...',
    }
  }

  // If it's just @username
  if (trimmed.startsWith('@')) {
    const username = trimmed.slice(1)
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      return {
        isValid: false,
        error: 'YouTube kullanıcı adı geçersiz karakterler içeriyor.',
      }
    }
    return {
      isValid: true,
      normalizedUrl: `https://youtube.com/@${username}`,
    }
  }

  return {
    isValid: false,
    error: 'Geçersiz YouTube linki. Örnek: https://youtube.com/@kullaniciadi',
  }
}

/**
 * Validates website URL
 * Must start with http:// or https://
 */
export function validateWebsite(link: string | null | undefined): ValidationResult {
  if (!link || link.trim().length === 0) {
    return { isValid: true } // Empty is allowed
  }

  const trimmed = link.trim()

  // Must start with http:// or https://
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      isValid: false,
      error: 'Web sitesi linki http:// veya https:// ile başlamalıdır.',
    }
  }

  // Basic URL validation
  try {
    new URL(trimmed)
    return {
      isValid: true,
      normalizedUrl: trimmed,
    }
  } catch {
    return {
      isValid: false,
      error: 'Geçersiz web sitesi linki.',
    }
  }
}

/**
 * Validates LinkedIn link
 */
export function validateLinkedIn(link: string | null | undefined): ValidationResult {
  if (!link || link.trim().length === 0) {
    return { isValid: true } // Empty is allowed
  }

  const trimmed = link.trim()

  // Must be a LinkedIn URL
  if (!trimmed.includes('linkedin.com')) {
    return {
      isValid: false,
      error: 'Geçersiz LinkedIn linki. Örnek: https://linkedin.com/company/... veya https://linkedin.com/in/...',
    }
  }

  // Must start with http:// or https://
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      isValid: false,
      error: 'LinkedIn linki http:// veya https:// ile başlamalıdır.',
    }
  }

  try {
    new URL(trimmed)
    return {
      isValid: true,
      normalizedUrl: trimmed,
    }
  } catch {
    return {
      isValid: false,
      error: 'Geçersiz LinkedIn linki.',
    }
  }
}

