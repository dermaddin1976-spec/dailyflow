/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Meal photos live in Vercel Blob public storage now instead of
    // base64 in the DB — next/image needs the remote host allow-listed.
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
};
export default nextConfig;
