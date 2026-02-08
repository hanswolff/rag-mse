import "@testing-library/jest-dom";

jest.mock("ioredis", () => {
  const IORedisMock = require("ioredis-mock");
  return IORedisMock;
});

if (typeof TextEncoder === "undefined") {
  global.TextEncoder = class TextEncoder {
    encode(str) {
      return Buffer.from(str, "utf-8");
    }
  };
}
if (typeof TextDecoder === "undefined") {
  global.TextDecoder = class TextDecoder {
    decode(buf) {
      return Buffer.from(buf).toString("utf-8");
    }
  };
}

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
  default: jest.fn(),
}));

jest.mock("next/server", () => {
  const NextResponseImpl = class {
    constructor(body, init) {
      this._body = body;
      this._init = init || {};
      this.status = this._init.status || 200;
      this.headers = new Map(Object.entries(this._init.headers || {}));
    }

    static json(data, init) {
      const response = new NextResponseImpl(JSON.stringify(data), {
        ...init,
        headers: {
          ...init?.headers,
          "Content-Type": "application/json",
        },
      });
      response._jsonData = data;
      return response;
    }

    async text() {
      if (this._jsonData !== undefined) {
        return JSON.stringify(this._jsonData);
      }
      return typeof this._body === "string" ? this._body : String(this._body);
    }

    async json() {
      if (this._jsonData !== undefined) {
        return this._jsonData;
      }
      const text = await this.text();
      return JSON.parse(text);
    }

    get ok() {
      return this.status < 400;
    }
  };

  const NextRequestImpl = class {
    constructor(url, init = {}) {
      this.url = new URL(url);
      this._init = init;
      this.method = init.method || "GET";
      this.headers = new Map(Object.entries(init.headers || {}));
    }

    async json() {
      return this._init.body ? JSON.parse(this._init.body) : {};
    }
  };

  global.Request = NextRequestImpl;

  return {
    NextRequest: NextRequestImpl,
    NextResponse: NextResponseImpl,
  };
});

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
  useSession: jest.fn(),
  SessionProvider: ({ children }) => children,
}));

if (typeof HTMLFormElement !== "undefined") {
  Object.defineProperty(HTMLFormElement.prototype, "requestSubmit", {
    configurable: true,
    value() {
      this.submit();
    },
  });
}

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { implementation: HTMLFormElementImpl } = require("jsdom/lib/jsdom/living/nodes/HTMLFormElement-impl");
  if (HTMLFormElementImpl && HTMLFormElementImpl.prototype) {
    HTMLFormElementImpl.prototype.requestSubmit = function requestSubmit() {
      this.submit();
    };
  }
} catch {
  // Ignore when jsdom internals are unavailable.
}

const originalConsoleError = console.error;
console.error = (...args) => {
  const [firstArg] = args;
  const message = typeof firstArg === "string" ? firstArg : firstArg?.message;
  if (message && message.includes("requestSubmit")) {
    return;
  }
  originalConsoleError(...args);
};
