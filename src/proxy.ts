import { clerkMiddleware } from "@clerk/nextjs/server";

// In development, local clock may drift behind Clerk's servers (e.g. when
// Windows Time Service is stopped). We expand the JWT clock-skew tolerance
// to 60 s only during development so production token validation stays strict.
const isDev = process.env.NODE_ENV === "development";

export default clerkMiddleware(isDev ? { clockSkewInMs: 60 * 1000 } : {});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};