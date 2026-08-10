import type { NewEvent } from "@/types";

// Einzige Quelle für das leere Termin-Formular. Sie stand zuvor wortgleich in
// components/event-form-modal.tsx und lib/use-event-management.ts — ein neues
// Feld musste an beiden Stellen ergänzt werden, sonst blieb es beim Öffnen des
// Formulars undefiniert und React wechselte auf ein uncontrolled input.
export const EMPTY_EVENT_FORM: NewEvent = {
  date: "",
  timeFrom: "",
  timeTo: "",
  location: "",
  title: "",
  description: "",
  latitude: "",
  longitude: "",
  type: "",
  cost: "",
  capacity: "",
  visible: true,
};
