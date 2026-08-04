/**
 * baseUrl — Server Component 用的 API base URL
 *
 * Next.js Server Components 不能用相對路徑 fetch，需要完整 URL。
 * 優先順序：
 *   1. NEXT_PUBLIC_SITE_URL（手動設定的正式域名，最可靠）
 *   2. VERCEL_URL（Vercel 自動注入，每次 preview deploy 不同）
 *   3. localhost:3000（本地開發）
 */
export function baseUrl(): string {
  // 1. 手動設定的正式域名（在 Vercel Environment Variables 設定）
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  // 2. Vercel 自動注入（preview deploys）
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // 3. 本地開發
  return "http://localhost:3000";
}
