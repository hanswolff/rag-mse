import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Next.js Configuration', () => {
  const nextConfigPath = join(__dirname, '../next.config.mjs');

  describe('File existence and readability', () => {
    it('should have next.config.mjs file', () => {
      expect(existsSync(nextConfigPath)).toBe(true);
    });

    it('should be readable', () => {
      const content = readFileSync(nextConfigPath, 'utf-8');
      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('Required configuration', () => {
    let configContent: string;

    beforeEach(() => {
      configContent = readFileSync(nextConfigPath, 'utf-8');
    });

    it('should have standalone output configured', () => {
      expect(configContent).toContain("output: 'standalone'");
    });
  });

  describe('Security headers', () => {
    let configContent: string;

    beforeEach(() => {
      configContent = readFileSync(nextConfigPath, 'utf-8');
    });

    it('should define headers() function', () => {
      expect(configContent).toContain('async headers()');
    });

    it('should set X-Frame-Options to SAMEORIGIN', () => {
      expect(configContent).toContain('X-Frame-Options');
      expect(configContent).toContain('SAMEORIGIN');
    });

    it('should set X-Content-Type-Options to nosniff', () => {
      expect(configContent).toContain('X-Content-Type-Options');
      expect(configContent).toContain('nosniff');
    });

    it('should set Referrer-Policy to strict-origin-when-cross-origin', () => {
      expect(configContent).toContain('Referrer-Policy');
      expect(configContent).toContain('strict-origin-when-cross-origin');
    });

    it('should define Content-Security-Policy', () => {
      expect(configContent).toContain('Content-Security-Policy');
    });
  });

  describe('Content-Security-Policy directives', () => {
    let configContent: string;

    beforeEach(() => {
      configContent = readFileSync(nextConfigPath, 'utf-8');
    });

    it('should set default-src to self', () => {
      expect(configContent).toContain("default-src 'self'");
    });

    it('should use environment-aware script-src configuration', () => {
      expect(configContent).toContain("const isProduction = process.env.NODE_ENV === \"production\";");
      expect(configContent).toContain("const allowUnsafeInlineScripts = process.env.CSP_ALLOW_UNSAFE_INLINE_SCRIPTS === \"true\";");
      expect(configContent).toContain("? \"script-src 'self' 'unsafe-inline'\"");
      expect(configContent).toContain(": \"script-src 'self'\"");
      expect(configContent).toContain(": \"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com\"");
    });

    it('should allow style-src from self with inline', () => {
      expect(configContent).toContain("style-src 'self' 'unsafe-inline'");
    });

    it('should allow img-src from self, data, and OpenStreetMap', () => {
      expect(configContent).toContain("img-src 'self' data:");
      expect(configContent).toContain('*.tile.openstreetmap.org');
      expect(configContent).toContain('*.openstreetmap.org');
    });

    it('should allow font-src from self and data', () => {
      expect(configContent).toContain("font-src 'self' data:");
    });

    it('should allow connect-src from self and OpenStreetMap', () => {
      expect(configContent).toContain("connect-src 'self'");
      expect(configContent).toContain('https://*.openstreetmap.org');
    });

    it('should allow frame-src from self and OpenStreetMap', () => {
      expect(configContent).toContain("frame-src 'self'");
      expect(configContent).toContain('https://*.openstreetmap.org');
    });

    it('should include unpkg.com for non-production script loading', () => {
      expect(configContent).toContain('https://unpkg.com');
    });
  });

  describe('Header application scope', () => {
    let configContent: string;

    beforeEach(() => {
      configContent = readFileSync(nextConfigPath, 'utf-8');
    });

    it('should apply headers to all paths', () => {
      expect(configContent).toContain("source: '/:path*'");
    });
  });
});
