import { generateMetadata } from "@/app/termine/[id]/metadata";
import { buildEvent } from "./helpers/factories";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () =>
  jest.requireActual<typeof import("./helpers/prisma-mock")>("./helpers/prisma-mock").prismaModuleMock,
);

function metadataFor(visibility: "PUBLIC" | "MEMBER" | "HIDDEN") {
  (prisma.event.findUnique as jest.Mock).mockResolvedValue(
    buildEvent({ title: "Vereinsabend intern", description: "<p>Nur intern</p>", visibility })
  );
  return generateMetadata({ params: Promise.resolve({ id: "event-1" }) });
}

describe("Termin-Metadaten", () => {
  it("describes a public event and allows indexing", async () => {
    const metadata = await metadataFor("PUBLIC");

    expect(metadata.title).toContain("Vereinsabend intern");
    expect(metadata.robots).toBeUndefined();
  });

  it.each(["MEMBER", "HIDDEN"] as const)("reveals nothing about a %s event", async (visibility) => {
    const metadata = await metadataFor(visibility);

    expect(metadata).toEqual({ title: "Termin", robots: "noindex, nofollow" });
  });
});
