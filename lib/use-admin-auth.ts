import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { isAdmin } from "@/lib/role-utils";
import { buildLoginUrlWithReturnUrl, getCurrentPathWithSearch } from "@/lib/return-url";

interface UseAdminAuthOptions {
  redirectOnFailure?: boolean;
}

export function useAdminAuth(options: UseAdminAuthOptions = {}) {
  const { redirectOnFailure = true } = options;
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (!redirectOnFailure) {
      return;
    }

    if (status === "unauthenticated") {
      router.push(buildLoginUrlWithReturnUrl(getCurrentPathWithSearch()));
    } else if (status === "authenticated" && !isAdmin(session.user)) {
      router.push("/");
    }
  }, [status, session, router, redirectOnFailure]);

  return { session, status };
}
