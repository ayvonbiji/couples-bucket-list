// Optional device lock for Secret Fantasy: a PIN (salted SHA-256) and/or the device's
// biometric unlock via WebAuthn (Face ID, Touch ID, fingerprint, Windows Hello).
//
// This is a *convenience* lock on this device — it stops someone who picks up your
// unlocked phone. The real protection is server-side: Row Level Security means the
// database never sends private entries to anyone but their author.

const key = (userId) => `cbl:fantasyLock:${userId}`;

export function getLock(userId) {
  try { return JSON.parse(localStorage.getItem(key(userId)) || 'null'); } catch { return null; }
}
export function clearLock(userId) { localStorage.removeItem(key(userId)); }
const saveLock = (userId, lock) => localStorage.setItem(key(userId), JSON.stringify(lock));

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  return hex(await crypto.subtle.digest('SHA-256', data));
}

export async function setPin(userId, pin) {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('Use 4 to 6 digits');
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const prev = getLock(userId) || {};
  saveLock(userId, { ...prev, salt, pinHash: await hashPin(pin, salt) });
}

export async function checkPin(userId, pin) {
  const lock = getLock(userId);
  if (!lock?.pinHash) return true;
  return (await hashPin(pin, lock.salt)) === lock.pinHash;
}

export async function biometricsAvailable() {
  try {
    return Boolean(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()));
  } catch { return false; }
}

/** Register this device's biometric unlock. */
export async function enableBiometrics(userId, displayName) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Our Bucket List' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: displayName || 'me', displayName: displayName || 'me' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    },
  });
  const prev = getLock(userId) || {};
  saveLock(userId, { ...prev, credentialId: b64(cred.rawId) });
}

export function disableBiometrics(userId) {
  const prev = getLock(userId);
  if (!prev) return;
  delete prev.credentialId;
  if (prev.pinHash) saveLock(userId, prev); else clearLock(userId);
}

/** Ask the device to verify the user (Face ID / fingerprint). */
export async function unlockWithBiometrics(userId) {
  const lock = getLock(userId);
  if (!lock?.credentialId) return false;
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(lock.credentialId) }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return true;
  } catch { return false; }
}
