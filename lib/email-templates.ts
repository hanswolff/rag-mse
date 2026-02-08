import { promises as fs } from "fs";
import path from "path";

const TEMPLATE_DIR = path.join(process.cwd(), "emails", "templates");

export interface EmailTemplate {
  subject: string;
  body: string;
}

export async function loadEmailTemplate(templateName: string): Promise<EmailTemplate> {
  const filePath = path.join(TEMPLATE_DIR, `${templateName}.txt`);
  const raw = await fs.readFile(filePath, "utf8");
  const normalized = raw.replace(/\r\n/g, "\n").trimEnd();
  const [firstLine, ...restLines] = normalized.split("\n");

  if (!firstLine || !firstLine.startsWith("Subject:")) {
    throw new Error(`Ungültiges E-Mail-Template: ${templateName}`);
  }

  const subject = firstLine.replace(/^Subject:\s*/, "").trim();
  if (!subject) {
    throw new Error(`Betreff fehlt im E-Mail-Template: ${templateName}`);
  }

  const restText = restLines.join("\n").replace(/^\n+/, "");

  return {
    subject,
    body: restText,
  };
}

function applyPlaceholders(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export async function renderEmailTemplate(
  templateName: string,
  variables: Record<string, string>
): Promise<EmailTemplate> {
  const template = await loadEmailTemplate(templateName);

  return {
    subject: applyPlaceholders(template.subject, variables),
    body: applyPlaceholders(template.body, variables),
  };
}
