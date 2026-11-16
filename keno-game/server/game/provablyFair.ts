import crypto from 'crypto';

export interface ProvablyFairRound {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

/**
 * Provably Fair Cryptographic Random Number Generator for Atlas-V Keno
 * Uses SHA-256 HMAC to deterministically select 20 distinct balls from 1 to 80.
 */
export class ProvablyFairKeno {
  /**
   * Generates a new random cryptographic server seed and its public SHA-256 hash
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
  ): { valid: boolean; calculatedDrawn: number[] } {
    const hash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    if (hash !== expectedHash) {
      return { valid: false, calculatedDrawn: [] };
    }

    const calculatedDrawn = this.generateDraw(serverSeed, clientSeed, nonce);
    const valid = calculatedDrawn.length === expectedDrawn.length &&
      calculatedDrawn.every((num, idx) => num === expectedDrawn[idx]);

    return { valid, calculatedDrawn };
  }
}

