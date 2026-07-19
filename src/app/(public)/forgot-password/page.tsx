"use client";

import { useState } from "react";
import Link from "next/link";

// Forgot-password (Phase 3.2). INTERIM STUB: password-reset email delivery
// depends on the email service (SendGrid/Resend), which is not yet wired. This
// page collects the address and always shows the same neutral confirmation (to
// avoid leaking which emails exist), but does NOT send a reset link yet. Wire the
// token-generation + email step before relying on this in production.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
        Reset your password
      </h1>

      {submitted ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-700">
          <p>
            If an account exists for <span className="font-medium">{email}</span>,
            a reset link will be sent.
          </p>
          <p className="mt-2 text-xs text-amber-700">
            Note: email delivery isn&apos;t connected yet, so no message is sent in
            this build. This flow is a placeholder pending the email service.
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
          className="mt-6 space-y-4"
        >
          <p className="text-sm text-gray-500">
            Enter your email and we&apos;ll send a link to reset your password.
          </p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Send reset link
          </button>
        </form>
      )}

      <Link href="/login" className="mt-6 text-sm text-gray-500 hover:text-gray-800">
        ← Back to sign in
      </Link>
    </div>
  );
}
