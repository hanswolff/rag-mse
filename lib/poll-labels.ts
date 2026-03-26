export function getPollTypeLabel(type: string): string {
  switch (type) {
    case "TERMIN": return "Termin";
    case "SONSTIGES": return "Sonstiges";
    default: return type;
  }
}

export function getPollStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT": return "Entwurf";
    case "LIVE": return "Live";
    case "CLOSED": return "Geschlossen";
    default: return status;
  }
}
