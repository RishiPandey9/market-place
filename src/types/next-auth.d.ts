import "next-auth";
import "next-auth/jwt";

// Module augmentation so our custom fields on the session/JWT are typed.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      verificationLevel?: string;
      sid?: string;
    };
  }

  interface User {
    verificationLevel?: string;
    sid?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    verificationLevel?: string;
    sid?: string;
  }
}
