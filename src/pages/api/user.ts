// src/pages/api/kullanici.ts
import type { APIRoute } from 'astro';

// Handle incoming GET requests
export const GET: APIRoute = ({ request }) => {
  // Create sample user data
  const userData = {
    username: "Yushtify",
    role: "Fullstack Developer"
  };

  // Return a valid JSON response
  return new Response(JSON.stringify(userData), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
};
