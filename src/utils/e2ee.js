// ShadowChat E2E Encryption Module using Web Crypto API and IndexedDB

const DB_NAME = 'shadowchat_keys';
const STORE_NAME = 'private_keys';

// Initialize IndexedDB
const getDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

// Store Private Key in IndexedDB
export const storePrivateKey = async (userId, privateKey) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(privateKey, userId.toString());
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
};

// Get Private Key from IndexedDB
export const getPrivateKey = async (userId) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(userId.toString());
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

// Generate ECDH Key Pair (try X25519 first, fallback to P-256)
export const generateE2EKeyPair = async () => {
  try {
    return await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'X25519' },
      true,
      ['deriveKey', 'deriveBits']
    );
  } catch (err) {
    console.warn('X25519 not supported natively. Falling back to ECDH P-256...', err);
    return await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );
  }
};

// Export Public Key to JWK
export const exportPublicKey = async (publicKey) => {
  return await window.crypto.subtle.exportKey('jwk', publicKey);
};

// Compute fingerprint of a Public Key
export const computeFingerprint = async (publicKeyJwk) => {
  // Sort the keys to ensure deterministic serialization
  const sortedJwk = {
    crv: publicKeyJwk.crv,
    kty: publicKeyJwk.kty,
    x: publicKeyJwk.x,
    y: publicKeyJwk.y
  };
  const rawStr = JSON.stringify(sortedJwk);
  const buffer = new TextEncoder().encode(rawStr);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join(':');
};

// Derive shared AES-GCM Key from local private key and remote public key JWK
export const deriveSharedKey = async (localPrivateKey, remotePublicKeyJwk) => {
  try {
    const crv = remotePublicKeyJwk.crv;
    const remotePublicKey = await window.crypto.subtle.importKey(
      'jwk',
      remotePublicKeyJwk,
      { name: 'ECDH', namedCurve: crv },
      true,
      []
    );

    // Derive bits
    const bitsLength = crv === 'X25519' ? 256 : 256; // Standard 256 bits for both
    const sharedSecret = await window.crypto.subtle.deriveBits(
      { name: 'ECDH', public: remotePublicKey },
      localPrivateKey,
      bitsLength
    );

    // Import the raw derived bits to use with HKDF
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      sharedSecret,
      'HKDF',
      false,
      ['deriveKey']
    );

    // Derive symmetric AES-GCM key
    return await window.crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(16), // Fixed salt for simplicity
        info: new TextEncoder().encode('shadowchat-v1')
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  } catch (err) {
    console.error('Failed to derive shared key:', err);
    throw err;
  }
};

// Encrypt plaintext using AES-GCM key
export const encryptMessage = async (plaintext, aesKey) => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encodedText
  );

  // Convert to base64 for transport
  const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)));
  const ivBase64 = btoa(String.fromCharCode(...iv));

  return { ciphertext: ciphertextBase64, iv: ivBase64 };
};

// Decrypt ciphertext using AES-GCM key
export const decryptMessage = async (ciphertextBase64, ivBase64, aesKey) => {
  const iv = new Uint8Array(atob(ivBase64).split('').map(c => c.charCodeAt(0)));
  const ciphertext = new Uint8Array(atob(ciphertextBase64).split('').map(c => c.charCodeAt(0)));

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(decryptedBuffer);
};
