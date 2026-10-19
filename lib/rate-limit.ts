// Implementation withheld from the public repository.

export declare const RATE_LIMITS: Record<string, { readonly prefix: string; readonly max: number; readonly windowMinutes: number }>

export type RateLimitName = keyof typeof RATE_LIMITS;

export async function isRateLimited(bucket: string, max: number, windowMinutes: number): Promise<boolean> {
  throw new Error('Withheld from the public repository.')
}

export async function recordRateLimitHit(bucket: string): Promise<void> {
  throw new Error('Withheld from the public repository.')
}

export async function checkRateLimit(bucket: string, max: number, windowMinutes: number): Promise<boolean> {
  throw new Error('Withheld from the public repository.')
}

export async function hitLimit(name: RateLimitName, key: string): Promise<boolean> {
  throw new Error('Withheld from the public repository.')
}

export function rateLimitMessage(name: RateLimitName): string {
  throw new Error('Withheld from the public repository.')
}

export async function getClientIp(): Promise<string> {
  throw new Error('Withheld from the public repository.')
}
