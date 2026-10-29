import AdminPage from "../app/admin/page";
import { redirect } from "next/navigation";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

describe("AdminPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects server-side to /admin/dashboard", () => {
    AdminPage();

    expect(redirect).toHaveBeenCalledWith("/admin/dashboard");
  });
});
