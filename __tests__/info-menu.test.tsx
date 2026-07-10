import { render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { DesktopInfoMenu, MobileInfoMenu, TOP_INFO_ITEMS, INFO_ITEMS, MEMBER_DOCUMENTS_ITEM } from "@/components/nav/info-menu";

describe("Infos-Menü Gruppierung", () => {
  it("listet Ausschreibungen und Formulare in der oberen Gruppe", () => {
    expect(TOP_INFO_ITEMS.map((item) => item.label)).toEqual(["Ausschreibungen", "Formulare"]);
  });

  it("führt Formulare nicht mehr in der unteren Gruppe", () => {
    expect(INFO_ITEMS.map((item) => item.label)).not.toContain("Formulare");
  });

  it("verlinkt Ausschreibungen auf die öffentliche Seite", () => {
    const item = TOP_INFO_ITEMS.find((entry) => entry.label === "Ausschreibungen");
    expect(item?.href).toBe("/ausschreibungen");
  });

  it("Desktop: zeigt obere Gruppe, Trenner und untere Gruppe in der richtigen Reihenfolge", () => {
    const menuRef = createRef<HTMLDivElement>();
    render(
      <DesktopInfoMenu
        isOpen
        onToggle={() => {}}
        onItemClick={() => {}}
        menuRef={menuRef}
        buttonClassName=""
        showMemberDocuments
      />
    );

    const links = screen.getAllByRole("link").map((link) => link.textContent);
    expect(links).toEqual([
      "Ausschreibungen",
      "Formulare",
      "Dokumente für Mitglieder",
      "Schießsportordnung",
      "Leitfaden Waffenteile",
      "Waffentechnische Begriffe",
      "Sachkundeprüfung",
      "Sicherheitsbelehrung",
    ]);
  });

  it("Desktop: Ausschreibungen ist auch ohne Login sichtbar", () => {
    const menuRef = createRef<HTMLDivElement>();
    render(
      <DesktopInfoMenu
        isOpen
        onToggle={() => {}}
        onItemClick={() => {}}
        menuRef={menuRef}
        buttonClassName=""
        showMemberDocuments={false}
      />
    );

    expect(screen.getByText("Ausschreibungen")).toBeInTheDocument();
    expect(screen.queryByText("Dokumente für Mitglieder")).not.toBeInTheDocument();
  });

  it("Mobile: zeigt dieselbe Gruppierung und Reihenfolge wie Desktop", () => {
    render(
      <MobileInfoMenu
        isOpen
        onToggle={() => {}}
        onItemClick={() => {}}
        showMemberDocuments
        getLinkClasses={() => ""}
      />
    );

    const links = screen.getAllByRole("link").map((link) => link.textContent);
    expect(links).toEqual([
      "Ausschreibungen",
      "Formulare",
      "Dokumente für Mitglieder",
      "Schießsportordnung",
      "Leitfaden Waffenteile",
      "Waffentechnische Begriffe",
      "Sachkundeprüfung",
      "Sicherheitsbelehrung",
    ]);
  });
});

describe("MEMBER_DOCUMENTS_ITEM", () => {
  it("bleibt unverändert an /mitglieder-dokumente", () => {
    expect(MEMBER_DOCUMENTS_ITEM.href).toBe("/mitglieder-dokumente");
  });

  it("wird für nicht eingeloggte Besucher in beiden Menüs ausgeblendet", () => {
    const menuRef = createRef<HTMLDivElement>();
    const { unmount } = render(
      <DesktopInfoMenu
        isOpen
        onToggle={() => {}}
        onItemClick={() => {}}
        menuRef={menuRef}
        buttonClassName=""
        showMemberDocuments={false}
      />
    );
    expect(within(document.body).queryByText("Dokumente für Mitglieder")).not.toBeInTheDocument();
    unmount();
  });
});
