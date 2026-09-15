/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Libera qualquer domínio https para as fotos dos produtos (ex: Supabase Storage).
    // Se quiser mais segurança depois, troque "hostname: '**'" pelo domínio exato
    // do seu bucket do Supabase.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    dangerouslyAllowSVG: true, // necessário para exibir a logo em .svg
  },
};

module.exports = nextConfig;
