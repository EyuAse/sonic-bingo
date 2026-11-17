/**
 * server/game/provablyFair.ts
 * Provably Fair Cryptographic Random Number Generator for Fast Keno
 * Uses SHA-256 HMAC to deterministically select 20 distinct balls from 1 to 80.
 * Allows client 1-click verification of server seeds, hashes, and draw integrity.
 */

import crypto from 'crypto';

export interface ProvablyFairRound {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export class ProvablyFairKeno {
  /**
   * Generates a new random cryptographic server seed (32 bytes CSPRNG) and its SHA-256 commit hash
   */
  static generateServerSeed(): { serverSeed: string; serverSeedHash: string } {
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    return { serverSeed, serverSeedHash };
  }

  /**
   * Generates 20 distinct balls (1 to 80) deterministically from seeds and nonce
   */
  static generateDraw(serverSeed: string, clientSeed: string, nonce: number): number[] {
    const balls = Array.from({ length: 80 }, (_, i) => i + 1);
    const drawn: number[] = [];

    // Combine seeds via HMAC-SHA256
    const hmac = crypto.createHmac('sha256', serverSeed);
    hmac.update(`${clientSeed}:${nonce}`);
    let buffer = hmac.digest();

    let byteIndex = 0;
    while (drawn.length < 20) {
      if (byteIndex + 4 > buffer.length) {
        // Expand buffer if exhausted
        const nextHmac = crypto.createHmac('sha256', serverSeed);
        nextHmac.update(`${clientSeed}:${nonce}:${drawn.length}`);
        buffer = nextHmac.digest();
        byteIndex = 0;
      }

      // Read 32-bit unsigned integer
      const uint = buffer.readUInt32BE(byteIndex);
      byteIndex += 4;

      const remainingPoolSize = balls.length;
      const selectedIndex = uint % remainingPoolSize;
      const ball = balls.splice(selectedIndex, 1)[0];
      drawn.push(ball);
    }

    return drawn;
  }

  /**
   * Verifies that a published draw matches the server seed and hash
   */
  static verifyRound(
    serverSeed: string,
    expectedHash: string,
    clientSeed: string,
    nonce: number,
    expectedDrawn: number[]
  ): { valid: boolean; calculatedDrawn: number[]; error?: string } {
    const hash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    if (hash.toLowerCase() !== expectedHash.toLowerCase()) {
      return { valid: false, calculatedDrawn: [], error: 'SHA-256 hash mismatch between revealed seed and commitment' };
    }

    const calculatedDrawn = this.generateDraw(serverSeed, clientSeed, nonce);
    const valid =
      calculatedDrawn.length === expectedDrawn.length &&
      calculatedDrawn.every((num, idx) => num === expectedDrawn[idx]);

    return {
      valid,
      calculatedDrawn,
      error: valid ? undefined : 'Drawn ball sequence does not match computed HMAC output'
    };
  }
}
