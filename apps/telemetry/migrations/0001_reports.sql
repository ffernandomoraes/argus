-- Um resumo por instalação e dia; mandar o mesmo dia de novo substitui.
CREATE TABLE reports (
  install_id TEXT NOT NULL,
  day TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  app_version TEXT NOT NULL,
  os TEXT NOT NULL,
  os_version TEXT NOT NULL,
  arch TEXT NOT NULL,
  language TEXT NOT NULL,
  active_minutes REAL NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (install_id, day)
);
CREATE INDEX reports_day ON reports (day);
