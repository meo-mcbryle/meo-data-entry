// Web Crypto API Database Encryption Utilities

let memoryKey: string | null = null;

/**
 * Retrieves the hardware-secured database encryption key from Electron's safeStorage,
 * or falls back to a locally stored fallback key if running in a standard web browser / non-packaged mode.
 */
export async function getDbEncryptionKey(): Promise<string> {
  if (memoryKey) return memoryKey;

  if (typeof window !== 'undefined' && window.electronAPI && (window.electronAPI as any).safeDecrypt) {
    const api = window.electronAPI as any;
    const storedEncryptedKey = localStorage.getItem('meo-db-encrypted-key');
    if (storedEncryptedKey) {
      try {
        const decrypted = await api.safeDecrypt(storedEncryptedKey);
        memoryKey = decrypted;
        return decrypted;
      } catch (err) {
        console.error('Failed to decrypt database key using safeStorage, regenerating:', err);
      }
    }

    // Generate a fresh 256-bit equivalent random key and encrypt it using safeStorage
    const newKey = window.crypto.randomUUID() + '-' + window.crypto.randomUUID();
    try {
      const encrypted = await api.safeEncrypt(newKey);
      localStorage.setItem('meo-db-encrypted-key', encrypted);
      memoryKey = newKey;
      return newKey;
    } catch (err) {
      console.error('Failed to encrypt database key using safeStorage:', err);
    }
  }

  // Fallback key if not running inside Electron or safeStorage throws an error
  let fallbackKey = localStorage.getItem('meo-db-fallback-key');
  if (!fallbackKey) {
    fallbackKey = window.crypto.randomUUID() + '-' + window.crypto.randomUUID();
    localStorage.setItem('meo-db-fallback-key', fallbackKey);
  }
  memoryKey = fallbackKey;
  return fallbackKey;
}

/**
 * Derives a CryptoKey object for AES-GCM operations from the raw string key using PBKDF2.
 */
async function getCryptoKey(rawKey: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(rawKey.padEnd(32).slice(0, 32)), // Pad or slice to standard block size
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('meo-data-salt-987'), // static salt for derivation consistency
      iterations: 1000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a Javascript object using AES-GCM and returns a Base64 string containing both the IV and encrypted payload.
 */
export async function encryptData(data: any, rawKey: string): Promise<string> {
  if (data === undefined || data === null) return '';
  const enc = new TextEncoder();
  const cryptoKey = await getCryptoKey(rawKey);
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // AES-GCM standard 12-byte IV
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    cryptoKey,
    enc.encode(JSON.stringify(data))
  );

  // Combine IV and Ciphertext into a single array for easier storage
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Convert binary to Base64 safely in browser context
  let binary = '';
  const len = combined.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

/**
 * Decrypts a Base64 string payload back into its original Javascript object format.
 * Includes a parsing fallback to handle unencrypted, plain-text objects for backward compatibility.
 */
export async function decryptData(encryptedBase64: any, rawKey: string): Promise<any> {
  if (!encryptedBase64) return null;

  // Backward compatibility: If it is already an object, it's not encrypted
  if (typeof encryptedBase64 !== 'string') {
    return encryptedBase64;
  }

  // If the string doesn't look like valid Base64 or doesn't have minimum IV length, treat as unencrypted JSON
  if (encryptedBase64.trim().startsWith('{') || encryptedBase64.trim().startsWith('[')) {
    try {
      return JSON.parse(encryptedBase64);
    } catch {
      return encryptedBase64;
    }
  }

  try {
    const cryptoKey = await getCryptoKey(rawKey);
    
    // Decode Base64 string to binary array
    const binaryString = atob(encryptedBase64);
    const len = binaryString.length;
    const combined = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }

    if (combined.length < 12) {
      throw new Error('Payload too short to contain IV');
    }

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      cryptoKey,
      ciphertext
    );
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } catch (err) {
    // If decryption fails, it could be a legacy plain-text JSON string
    try {
      return JSON.parse(encryptedBase64);
    } catch {
      // If parsing also fails, return the string itself as a fallback
      return encryptedBase64;
    }
  }
}
