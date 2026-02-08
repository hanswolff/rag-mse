import { useEffect } from "react";

export function useSuccessTimer(success: string, setSuccess: (val: string) => void) {
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [success, setSuccess]);
}
