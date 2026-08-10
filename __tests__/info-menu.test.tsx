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

describe("Badge für offene Ausschreibungen", () => {
  const renderDesktop = (openAusschreibungenCount?: number) => {
    const menuRef = createRef<HTMLDivElement>();
    return render(
      <DesktopInfoMenu
        isOpen
        onToggle={() => {}}
        onItemClick={() => {}}
        menuRef={menuRef}
        buttonClassName=""
        showMemberDocuments={false}
        openAusschreibungenCount={openAusschreibungenCount}
      />
    );
  };

  const renderMobile = (openAusschreibungenCount?: number) =>
    render(
      <MobileInfoMenu
        isOpen
        onToggle={() => {}}
        onItemClick={() => {}}
        showMemberDocuments={false}
        getLinkClasses={() => ""}
        openAusschreibungenCount={openAusschreibungenCount}
      />
    );

  it("Desktop: zeigt die Anzahl am Infos-Button und am Eintrag Ausschreibungen", () => {
    renderDesktop(3);

    const badges = screen.getAllByLabelText("3 offene Ausschreibungen");
    expect(badges).toHaveLength(2);
    expect(badges.every((badge) => badge.textContent === "3")).toBe(true);

    // Das zweite Badge muss im Ausschreibungen-Link stecken, nicht in einem anderen Eintrag.
    const ausschreibungenLink = screen.getByRole("link", { name: /Ausschreibungen/ });
    expect(within(ausschreibungenLink).getByLabelText("3 offene Ausschreibungen")).toBeInTheDocument();
  });

  it("Mobile: zeigt die Anzahl am Infos-Button und am Eintrag Ausschreibungen", () => {
    renderMobile(2);

    expect(screen.getAllByLabelText("2 offene Ausschreibungen")).toHaveLength(2);

    const ausschreibungenLink = screen.getByRole("link", { name: /Ausschreibungen/ });
    expect(within(ausschreibungenLink).getByLabelText("2 offene Ausschreibungen")).toBeInTheDocument();
  });

  it("zeigt ohne offene Ausschreibungen kein Badge", () => {
    const { unmount } = renderDesktop(0);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    unmount();

    renderMobile(0);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("bleibt ohne übergebene Anzahl badgefrei", () => {
    renderDesktop();

    const links = screen.getAllByRole("link").map((link) => link.textContent);
    expect(links).toEqual([
      "Ausschreibungen",
      "Formulare",
      "Schießsportordnung",
      "Leitfaden Waffenteile",
      "Waffentechnische Begriffe",
      "Sachkundeprüfung",
      "Sicherheitsbelehrung",
    ]);
  });

  it("hängt das Badge nur an Ausschreibungen, nicht an Formulare", () => {
    renderDesktop(5);

    const formulareLink = screen.getByRole("link", { name: "Formulare" });
    expect(within(formulareLink).queryByLabelText(/offene Ausschreibungen/)).not.toBeInTheDocument();
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
