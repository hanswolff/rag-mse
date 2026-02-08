import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('HAProxy Configuration', () => {
  const haproxyConfigPath = join(__dirname, '../haproxy.cfg.example');

  describe('File existence and readability', () => {
    it('should have HAProxy configuration example file', () => {
      expect(existsSync(haproxyConfigPath)).toBe(true);
    });

    it('should be readable', () => {
      const content = readFileSync(haproxyConfigPath, 'utf-8');
      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('Required sections', () => {
    let configContent: string;

    beforeEach(() => {
      configContent = readFileSync(haproxyConfigPath, 'utf-8');
    });

    it('should have global section', () => {
      expect(configContent).toContain('global');
    });

    it('should have defaults section', () => {
      expect(configContent).toContain('defaults');
    });

    it('should have http-in frontend', () => {
      expect(configContent).toContain('frontend http-in');
      expect(configContent).toContain('bind *:80');
    });

    it('should have https-in frontend', () => {
      expect(configContent).toContain('frontend https-in');
      expect(configContent).toContain('bind *:443 ssl');
    });

    it('should have backend for rag-mse-app', () => {
      expect(configContent).toContain('backend rag-mse-app');
      expect(configContent).toContain('option httpchk GET /api/health');
    });

    it('should have stats section', () => {
      expect(configContent).toContain('listen stats');
      expect(configContent).toContain('stats enable');
    });
  });

  describe('Security settings', () => {
    let configContent: string;

    beforeEach(() => {
      configContent = readFileSync(haproxyConfigPath, 'utf-8');
    });

    it('should set HSTS header', () => {
      expect(configContent).toContain('Strict-Transport-Security');
    });

    it('should set X-Frame-Options header', () => {
      expect(configContent).toContain('X-Frame-Options');
    });

    it('should set X-Content-Type-Options header', () => {
      expect(configContent).toContain('X-Content-Type-Options');
    });

    it('should set X-XSS-Protection header', () => {
      expect(configContent).toContain('X-XSS-Protection');
    });

    it('should set Referrer-Policy header', () => {
      expect(configContent).toContain('Referrer-Policy');
    });
  });

  describe('NextAuth compatibility', () => {
    let configContent: string;

    beforeEach(() => {
      configContent = readFileSync(haproxyConfigPath, 'utf-8');
    });

    it('should set X-Forwarded-Proto header', () => {
      expect(configContent).toContain('X-Forwarded-Proto');
    });

    it('should set X-Forwarded-Host header', () => {
      expect(configContent).toContain('X-Forwarded-Host');
    });
  });

  describe('Health checks', () => {
    let configContent: string;

    beforeEach(() => {
      configContent = readFileSync(haproxyConfigPath, 'utf-8');
    });

    it('should configure health check endpoint', () => {
      expect(configContent).toContain('option httpchk GET /api/health');
      expect(configContent).toContain('http-check expect status 200');
    });
  });

  describe('Configuration placeholders', () => {
    let configContent: string;

    beforeEach(() => {
      configContent = readFileSync(haproxyConfigPath, 'utf-8');
    });

    it('should have placeholder for SSL certificate path', () => {
      expect(configContent).toContain('/etc/ssl/haproxy/rag-mse.pem');
    });

    it('should have placeholder for stats password', () => {
      expect(configContent).toContain('CHANGEME_PASSWORD');
    });

    it('should have comment about backend IP configuration', () => {
      expect(configContent).toMatch(/IP muss.*angepasst/i);
    });
  });
});
