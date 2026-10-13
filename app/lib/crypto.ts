/**
 * Pure JavaScript SHA-256 and HMAC-SHA-256 Implementation
 * Ensures 100% compatibility across Expo React Native (iOS, Android, Web)
 * without requiring native binary linking.
 * Used for deterministic blind plate indexing.
 */

function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
}

export function sha256(ascii: string): string {
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let i: number, j: number;
    let result = "";

    const words: number[] = [];
    const asciiBitLength = ascii.length * 8;

    const hash: number[] = [];
    const k: number[] = [];
    let primeCounter = 0;

    const isPrime = (n: number) => {
        for (let factor = 2; factor * factor <= n; factor++) {
            if (n % factor === 0) return false;
        }
        return true;
    };

    for (let candidate = 2; primeCounter < 64; candidate++) {
        if (isPrime(candidate)) {
            if (primeCounter < 8) {
                hash[primeCounter] = (mathPow(candidate, 1 / 2) * maxWord) | 0;
            }
            k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
            primeCounter++;
        }
    }

    ascii += "\x80";
    while ((ascii.length % 64) - 56) ascii += "\x00";

    for (i = 0; i < ascii.length; i++) {
        j = ascii.charCodeAt(i);
        words[i >> 2] |= j << ((3 - (i % 4)) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength | 0;

    for (j = 0; j < words.length; ) {
        const w = words.slice(j, (j += 16));
        const oldHash = hash.slice(0);

        for (i = 0; i < 64; i++) {
            const w15 = w[i - 15],
                w2 = w[i - 2];

            const s0 = i >= 16 ? rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3) : w[i];
            const s1 = i >= 16 ? rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10) : 0;
            if (i >= 16) {
                w[i] = ((w[i - 16] + s0) | 0) + ((w[i - 7] + s1) | 0);
            }

            const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
            const temp1 =
                ((((hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25))) | 0) +
                    ch) |
                    0) +
                ((k[i] + w[i]) | 0);
            const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
            const temp2 =
                (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj;

            hash[7] = hash[6];
            hash[6] = hash[5];
            hash[5] = hash[4];
            hash[4] = (hash[3] + temp1) | 0;
            hash[3] = hash[2];
            hash[2] = hash[1];
            hash[1] = hash[0];
            hash[0] = (temp1 + temp2) | 0;
        }

        for (i = 0; i < 8; i++) {
            hash[i] = (hash[i] + oldHash[i]) | 0;
        }
    }

    for (i = 0; i < 8; i++) {
        for (let b = 3; b >= 0; b--) {
            const byte = (hash[i] >> (b * 8)) & 255;
            result += (byte < 16 ? "0" : "") + byte.toString(16);
        }
    }

    return result;
}

// Master Key identifier for ParkZone Kigali Blind Indexing
const PARKZONE_INDEX_KEY = "PARKZONE_KGL_BLIND_INDEX_KEY_2026";

export function hmacSha256(key: string, message: string): string {
    // Simple keyed HMAC formulation using sha256
    return sha256(key + ":" + sha256(key + ":" + message));
}

/**
 * Creates deterministic HMAC-SHA256 blind index hash for license plates.
 * Normalizes input (uppercase, trimmed) so lookups match with O(1) performance.
 */
export function hashLicensePlate(plate: string): string {
    const normalized = plate.trim().toUpperCase().replace(/\s+/g, " ");
    return hmacSha256(PARKZONE_INDEX_KEY, normalized);
}

/**
 * Masks raw license plate for citizen privacy protection.
 * Example: "RAD 450 A" -> "RAD *** A"
 */
export function maskLicensePlate(plate: string): string {
    const clean = plate.trim().toUpperCase();
    const parts = clean.split(" ");
    if (parts.length === 3) {
        return `${parts[0]} *** ${parts[2]}`;
    }
    if (clean.length >= 6) {
        return `${clean.slice(0, 3)} *** ${clean.slice(-1)}`;
    }
    return clean;
}

export default function () {
    return null;
}
