# Database Backup Options (SQLite `prod.db`)

## Retention Policy Implemented

- Keep rolling last 7 daily backups (today plus previous 6 days).
- Keep every backup from day `01` of each month.
- Delete all older backups that are neither in the last 7 days nor monthly-first.

Backup filename format:

- `prod.db.YYYY-MM-DD.sqlite3.gz`

Script:

- `/zfs/git/beta-rag-mse/scripts/backup-sqlite.sh`

Default locations:

- DB: `/zfs/git/beta-rag-mse/data/prod.db`
- Backups: `/zfs/backups/beta-rag-mse`

---

## Option 1 (Recommended): `systemd` Service + Timer

Why:

- Most reliable on this host (`systemd` is present).
- Missed runs while server was off are caught up (`Persistent=true`).
- Clear logs in `journalctl`.

Files included:

- `/zfs/git/beta-rag-mse/ops/systemd/beta-rag-db-backup.service`
- `/zfs/git/beta-rag-mse/ops/systemd/beta-rag-db-backup.timer`

Install:

```bash
sudo cp /zfs/git/beta-rag-mse/ops/systemd/beta-rag-db-backup.service /etc/systemd/system/
sudo cp /zfs/git/beta-rag-mse/ops/systemd/beta-rag-db-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now beta-rag-db-backup.timer
```

Verify:

```bash
systemctl list-timers beta-rag-db-backup.timer
journalctl -u beta-rag-db-backup.service -n 50 --no-pager
```

---

## Option 2: `cron` Daily Job

Why:

- Simple and familiar.

Tradeoff:

- No native missed-run catch-up like `systemd` `Persistent=true`.

Install (root crontab):

```bash
sudo crontab -e
```

Add:

```cron
10 2 * * * /zfs/git/beta-rag-mse/scripts/backup-sqlite.sh >> /var/log/beta-rag-db-backup.log 2>&1
```

Verify:

```bash
sudo tail -n 50 /var/log/beta-rag-db-backup.log
```

---

## Option 3: ZFS Snapshots (Dataset-level)

Why:

- Very fast snapshots and easy rollback.

Tradeoffs:

- Snapshots cover the whole dataset, not just this DB file.
- Retention policy needs ZFS snapshot pruning logic (separate from file backups).
- Restore/export flow is less direct than a `.sqlite3.gz` file.

Use this if you want filesystem-level disaster recovery. Keep Option 1 or 2 for portable DB backup files.

---

## Restore Example

```bash
gunzip -c /zfs/backups/beta-rag-mse/prod.db.2026-02-01.sqlite3.gz > /zfs/git/beta-rag-mse/data/prod.db
```

If the app is running, stop writes first before replacing the live DB file.
