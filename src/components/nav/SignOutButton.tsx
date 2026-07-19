"use client";

import { signOut } from "next-auth/react";

// Client sign-out control for the site header.
export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="font-medium text-gray-500 hover:text-gray-900"
    >
      Sign out
    </button>
  );
}
