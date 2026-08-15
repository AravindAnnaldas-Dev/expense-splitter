/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxies /api/* through this app's own origin to the real backend
  // (server-to-server — the browser never sees the Railway domain). This
  // exists specifically so auth cookies come back as first-party/same-site
  // from the browser's point of view: Safari's cross-site tracking
  // prevention silently drops cookies set by a different registrable
  // domain (e.g. an api.railway.app response while browsing a vercel.app
  // page), no matter what SameSite/Secure attributes they carry. Routing
  // through the same origin sidesteps that entirely.
  //
  // Only active when API_PROXY_TARGET is set (production). Local dev talks
  // directly to http://localhost:4000 via NEXT_PUBLIC_API_URL instead,
  // where client and server are "same site" (both localhost) already.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    if (!target) return [];
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
