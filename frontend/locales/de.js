export default {
  // General
  cancel:  'Abbrechen',
  done:    'Fertig',
  save:    'Speichern',
  delete:  'Löschen',
  rename:  'Umbenennen',
  abort:   'Abbrechen',
  reset:   'Zurücksetzen',

  // Navigation
  drills:      'Übungen',
  tab_basic:   'Basic',
  tab_advance: 'Advance',

  // Robot
  robot_connect:            'Roboter verbinden',
  robot_connecting:         'Verbinde…',
  robot_connected:          'Verbunden',
  robot_connection_label:   'Roboterverbindung',
  robot_disconnect_confirm: 'Vom Roboter trennen?',

  // Theme
  toggle_theme: 'Design wechseln',

  // Search
  search_placeholder:         'Übungen suchen…',
  search_advance_placeholder: 'Übungen suchen…',
  search_clear:               'Suche löschen',

  // Filter
  filter:              'Filter',
  filter_drills_aria:  'Übungen filtern',
  filter_title:        'Filter',
  filter_ball_type:    'Balltyp',
  filter_landing_mode: 'Landungsmodus',
  filter_source:       'Quelle',
  filter_official:     'Offiziell',
  filter_custom:       'Eigene',
  filter_favorites:    'Favoriten',
  filter_show_results: 'Ergebnisse anzeigen',

  // Drill list
  drill_empty:           'Keine Übungen entsprechen deinen Filtern.',
  drill_count_one:       '1 Übung',
  drill_count_many:      '{n} Übungen',
  drill_played:          'Gespielt {date}',
  drill_added:           'Hinzugefügt {date}',
  drill_source_custom:   'Eigen',
  drill_source_official: 'Offiziell',
  drill_copy_suffix:     '(Kopie)',

  // Date
  date_today:     'heute',
  date_yesterday: 'gestern',
  date_days_ago:  'vor {n} T',
  date_months_ago:'vor {n} Mo',
  date_years_ago: 'vor {n} J',

  // Editor
  editor_untitled:   'Ohne Titel',
  editor_new_drill:  'Neue Übung',
  btn_back:          'Zurück',
  btn_undo_aria:     'Rückgängig',
  btn_save_aria:     'Speichern',
  landing_mode_aria: 'Landungsmodus',
  fab_new_drill_aria:'Neue Übung',

  // Chips
  chip_ball:  'Ball',
  chip_spin:  'Spin',
  chip_power: 'Power',

  // Ball types
  ball_serve:     'Aufschlag',
  ball_normal:    'Normal',
  ball_lob:       'Lob',
  ball_serve_sub: 'Flache Flugbahn, Roboter hinter Grundlinie',
  ball_normal_sub:'Typischer Rallyeball',
  ball_lob_sub:   'Hochgewölbter Ball',

  // Spin types
  spin_max_topspin: 'Max. Topspin',
  spin_topspin:     'Topspin',
  spin_no_spin:     'Kein Spin',
  spin_backspin:    'Backspin',
  spin_max_backspin:'Max. Backspin',

  // Power types
  power_extreme:     'Extrem',
  power_strong:      'Stark',
  power_medium:      'Mittel',
  power_light:       'Leicht',
  power_extreme_sub: 'Schnellste Einstellung',
  power_strong_sub:  'Schnelles Tempo',
  power_medium_sub:  'Normales Rallytempo',
  power_light_sub:   'Sanft, ideal zum Aufwärmen',

  // Landing modes
  mode_single:        'Einzel',
  mode_sequence:      'Sequenz',
  mode_random:        'Zufällig',
  mode_hint_single:   'Eine Zone antippen. Jeder Ball landet an derselben Stelle.',
  mode_hint_sequence: 'Zonen in Reihenfolge antippen. Dieselbe Zone nochmals antippen, um sie mehrfach hinzuzufügen. Rückgängig oder Löschen zum Entfernen.',
  mode_hint_random:   'Beliebige Zonen antippen. Der Roboter wählt pro Schuss eine zufällig aus.',

  // Court
  court_far:  'Hinteres Feld · Roboterseite · ↓ Netz',
  court_near: 'Vorderes Feld · Deine Seite',
  court_cell: 'Feld {n}',

  // Editor controls
  btn_clear_court: 'Feld leeren',
  ball_timing:     'Ballfrequenz',
  timing_less:     'Seltener',
  timing_more:     'Öfter',
  ball_count:      'Ballanzahl',
  duration:        'Dauer',
  unit_balls:      'Bälle',

  // Action buttons
  btn_test: 'Test',
  btn_play: 'Spielen',
  btn_stop: 'Stop',

  // Picker
  picker_title_ball:  'Balltyp',
  picker_title_spin:  'Spin',
  picker_title_power: 'Power',
  picker_unavailable: 'Mit aktueller Kombination nicht verfügbar',

  // Actions sheet
  actions_title:     'Übungsaktionen',
  action_edit:       'Bearbeiten',
  action_duplicate:  'Duplizieren',
  action_rename:     'Umbenennen',
  action_favorite:   'Favorit',
  action_unfavorite: 'Favorit entfernen',
  action_delete:     'Löschen',

  // Training length dialog
  training_length: 'Trainingslänge',
  count_balls:     'Bälle',
  count_time:      'Zeit',
  unit_min_sec:    'min : sek',

  // Save dialog
  save_drill_title:     'Übung speichern',
  save_name_placeholder:'Übungsname',

  // Rename dialog
  rename_drill_title: 'Übung umbenennen',

  // Delete dialog
  delete_drill_title:    'Übung löschen?',
  delete_message_default:"Dieser Vorgang kann nicht rückgängig gemacht werden.",
  delete_message:        '"{name}" wird dauerhaft entfernt.',

  // Conflict dialog
  conflict_title:         'Platzierte Bälle entfernen?',
  conflict_message_one:   "1 platzierter Ball liegt in einem Bereich, der mit der neuen Einstellung nicht erreichbar ist, und wird entfernt.",
  conflict_message_many:  "{n} platzierte Bälle liegen in Bereichen, die mit der neuen Einstellung nicht erreichbar sind, und werden entfernt.",
  conflict_change_remove: 'Ändern & entfernen',

  // FAB sheet
  fab_add:           'Hinzufügen',
  fab_new_drill:     'Neue Übung',
  fab_import_backup: 'Backup importieren',

  // Toast messages
  toast_enter_name:       'Übungsname eingeben',
  toast_load_failed:      'Übungen konnten nicht geladen werden',
  toast_fav_failed:       'Favorit konnte nicht aktualisiert werden',
  toast_duplicated:       'Dupliziert',
  toast_duplicate_failed: 'Duplizieren fehlgeschlagen',
  toast_rename_failed:    'Umbenennen fehlgeschlagen',
  toast_deleted:          'Gelöscht',
  toast_delete_failed:    'Löschen fehlgeschlagen',
  toast_place_point:      'Mindestens einen Landepunkt platzieren',
  toast_playing:          'Spielt',
  toast_testing:          'Testet',
  toast_stopped:          'Gestoppt',
  toast_stop_failed:      'Roboter konnte nicht gestoppt werden',
  toast_saved:            'Übung gespeichert',
  toast_save_failed:      'Übung konnte nicht gespeichert werden',
  toast_send_failed:      'Senden an Roboter fehlgeschlagen',
  toast_robot_connected:  'Roboter verbunden',
  toast_connection_failed:'Verbindung fehlgeschlagen',
  toast_imported:         'Importiert: {list}',
  toast_import_failed:    'Import fehlgeschlagen: {message}',
  toast_connect_first:    '{mode}: Zuerst Roboter verbinden',

  // Settings
  settings_title:          'Einstellungen',
  settings_appearance:     'Darstellung',
  settings_dark_mode:      'Dunkelmodus',
  settings_language_label: 'Sprache',
  settings_data:           'Daten',
  settings_export:         'Übungen exportieren',
  settings_import:         'Übungen importieren',
  toast_exported:          'Export gestartet',
};
