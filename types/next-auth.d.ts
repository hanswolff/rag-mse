import { DefaultSession } from "next-auth";

declare module "next-auth" {
  type ImpersonatedByUser = {
    id: string;
    role: string;
    name: string;
    email: string;
  };

  interface Session {
    user: {
      id: string;
      role: string;
      isImpersonating?: boolean;
      impersonatedBy?: ImpersonatedByUser;
    } & DefaultSession["user"];
    impersonationStartProof?: string;
    impersonationStopProof?: string;
  }

  interface User {
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    name: string;
    impersonatedById?: string;
    impersonatedByRole?: string;
    impersonatedByName?: string;
    impersonatedByEmail?: string;
  }
}
