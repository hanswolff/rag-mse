"use client";

import { useEffect, useState } from "react";
import { LuCalendarPlus } from "react-icons/lu";
import { CopyLinkButton } from "@/components/copy-link-button";
import { siteUrl } from "@/lib/site-config";

export const CALENDAR_FEED_PATH = "/kalender.ics";

export function buildCalendarFeedUrls(origin: string) {
  const feedUrl = `${origin.replace(/\/+$/, "")}${CALENDAR_FEED_PATH}`;
  return { feedUrl, webcalUrl: feedUrl.replace(/^https?:/i, "webcal:") };
}

export function CalendarSubscribe() {
  const [origin, setOrigin] = useState(siteUrl);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const { feedUrl, webcalUrl } = buildCalendarFeedUrls(origin);

  return (
    <section className="calendar-subscribe" aria-labelledby="calendar-subscribe-title">
      <h2 id="calendar-subscribe-title" className="calendar-subscribe-title">
        <LuCalendarPlus className="h-5 w-5" aria-hidden="true" />
        Kalender abonnieren
      </h2>
      <p className="calendar-subscribe-text">
        Öffentliche Termine und Fremdtermine lassen sich in Kalender-Apps wie Outlook, Google Kalender oder
        Apple Kalender abonnieren und werden dort automatisch aktualisiert. Termine nur für Mitglieder und
        Abwesenheiten sind nicht enthalten.
      </p>
      <div className="calendar-subscribe-actions">
        <CopyLinkButton url={feedUrl} subject="Abo-Adresse" className="min-w-0" />
        <a href={webcalUrl} className="btn-outline">
          In Kalender-App öffnen
        </a>
      </div>
    </section>
  );
}
