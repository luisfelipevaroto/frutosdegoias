/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optional local Windows build mode; normal deployment settings are unchanged.
  ...(process.env.BUILD_WORKER_THREADS === "1" ? {
    experimental: { workerThreads: true, webpackBuildWorker: false, cpus: 2 },
  } : {}),
  images: {
    // Libera qualquer domínio https para as fotos dos produtos (ex: Supabase Storage).
    // Se quiser mais segurança depois, troque "hostname: '**'" pelo domínio exato
    // do seu bucket do Supabase.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    dangerouslyAllowSVG: true, // necessário para exibir a logo em .svg
  },
};

module.exports = nextConfig;
