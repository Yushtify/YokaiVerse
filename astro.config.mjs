// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  // Astro'nun kendi server ayarları (Dış erişim için)
  server: {
    host: true,
    port: 4321, // Astro varsayılan portu, ngrok hangi portu dinliyorsa o olmalı
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      // Burası kritik: ngrok hostuna izin veriyoruz
      allowedHosts: [
        "d0b11a3f409d.ngrok-free.app",
        ".ngrok-free.app", // Gelecekteki tüm ngrok linkleri için
      ],
    },
  },
  devToolbar: { enabled: false },
});
