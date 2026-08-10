-- Optionale Platzzahl am Termin; rein informativ, sie sperrt keine Anmeldung
ALTER TABLE "Event" ADD COLUMN "capacity" INTEGER;
