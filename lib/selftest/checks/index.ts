import type { RegisteredCheck } from "../types";
import { databaseChecks } from "./database";
import { dataPresenceChecks } from "./data-presence";
import { documentStorageChecks } from "./document-storage";
import { emailChecks } from "./email";
import { systemChecks } from "./system";

/** All self-test checks, in report order. */
export function getSelfTestChecks(): RegisteredCheck[] {
  return [
    ...databaseChecks,
    ...dataPresenceChecks,
    ...documentStorageChecks,
    ...emailChecks,
    ...systemChecks,
  ];
}
