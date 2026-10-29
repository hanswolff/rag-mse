// Schema.org-PostalAddress-Block für Impressum und Datenschutzerklärung.
interface PostalAddressProps {
  street: string;
  postalCode: string;
  locality: string;
  country?: string;
  // Rendert eine fette Überschriftszeile (z. B. "Adresse:") vor der Anschrift.
  label?: string;
}

export function PostalAddress({ street, postalCode, locality, country, label }: PostalAddressProps) {
  return (
    <div itemProp="address" itemScope itemType="https://schema.org/PostalAddress" className="space-y-0.5">
      {label && (
        <p><strong>{label}</strong></p>
      )}
      <p itemProp="streetAddress">{street}</p>
      <p>
        <span itemProp="postalCode">{postalCode}</span>{" "}
        <span itemProp="addressLocality">{locality}</span>
      </p>
      {country && <p itemProp="addressCountry">{country}</p>}
    </div>
  );
}
