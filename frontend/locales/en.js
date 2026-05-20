export default {
  // General
  cancel:  'Cancel',
  done:    'Done',
  save:    'Save',
  delete:  'Delete',
  rename:  'Rename',
  abort:   'Abort',
  reset:   'Reset',

  // Navigation
  drills:      'Drills',
  tab_basic:   'Basic',
  tab_advance: 'Advance',

  // Robot
  robot_connect:           'Connect robot',
  robot_connecting:        'Connecting…',
  robot_connected:         'Connected',
  robot_connection_label:  'Robot connection',
  robot_disconnect_confirm: 'Disconnect from robot?',

  // Theme
  toggle_theme: 'Toggle theme',

  // Search
  search_placeholder:         'Search drills…',
  search_advance_placeholder: 'Search advance drills…',
  search_clear:               'Clear search',

  // Filter
  filter:              'Filter',
  filter_drills_aria:  'Filter drills',
  filter_title:        'Filter',
  filter_ball_type:    'Ball type',
  filter_landing_mode: 'Landing mode',
  filter_source:       'Source',
  filter_official:     'Official',
  filter_custom:       'Custom',
  filter_favorites:    'Favorites',
  filter_show_results: 'Show results',

  // Drill list
  drill_empty:          'No drills match your filters.',
  drill_count_one:      '1 drill',
  drill_count_many:     '{n} drills',
  drill_played:         'Played {date}',
  drill_added:          'Added {date}',
  drill_source_custom:  'Custom',
  drill_source_official:'Official',
  drill_copy_suffix:    '(Copy)',

  // Date
  date_today:     'today',
  date_yesterday: 'yesterday',
  date_days_ago:  '{n}d ago',
  date_months_ago:'{n}mo ago',
  date_years_ago: '{n}y ago',

  // Editor
  editor_untitled:   'Untitled',
  editor_new_drill:  'New Drill',
  btn_back:          'Back',
  btn_undo_aria:     'Undo',
  btn_save_aria:     'Save',
  landing_mode_aria: 'Landing mode',
  fab_new_drill_aria:'New drill',

  // Chips
  chip_ball:  'Ball',
  chip_spin:  'Spin',
  chip_power: 'Power',

  // Ball types
  ball_serve:     'Serve',
  ball_normal:    'Normal',
  ball_lob:       'Lob',
  ball_serve_sub: 'Flat trajectory, robot behind baseline',
  ball_normal_sub:'Everyday rally ball',
  ball_lob_sub:   'High arcing ball',

  // Spin types
  spin_max_topspin: 'Max Topspin',
  spin_topspin:     'Topspin',
  spin_no_spin:     'No Spin',
  spin_backspin:    'Backspin',
  spin_max_backspin:'Max Backspin',

  // Power types
  power_extreme:     'Extreme',
  power_strong:      'Strong',
  power_medium:      'Medium',
  power_light:       'Light',
  power_extreme_sub: 'Fastest setting',
  power_strong_sub:  'Firm pace',
  power_medium_sub:  'Typical rally speed',
  power_light_sub:   'Gentle, great for warm-up',

  // Landing modes
  mode_single:   'Single',
  mode_sequence: 'Sequence',
  mode_random:   'Random',
  mode_hint_single:   'Tap one zone. Each shot lands in the same spot.',
  mode_hint_sequence: 'Tap zones in order. Tap the same zone again to add it multiple times. Use Undo or Clear to remove.',
  mode_hint_random:   'Tap any zones. The robot picks one at random per shot.',

  // Court
  court_far:  'Far court · roboter side · ↓ Net',
  court_near: 'Near court · your side',
  court_cell: 'Cell {n}',

  // Editor controls
  btn_clear_court: 'Clear court',
  ball_timing:     'Ball timing',
  timing_less:     'Less often',
  timing_more:     'More often',
  ball_count:      'Ball count',
  duration:        'Duration',
  unit_balls:      'balls',

  // Action buttons
  btn_test: 'Test',
  btn_play: 'Play',
  btn_stop: 'Stop',

  // Picker
  picker_title_ball:  'Ball type',
  picker_title_spin:  'Spin',
  picker_title_power: 'Power',
  picker_unavailable: 'Unavailable with current combo',

  // Actions sheet
  actions_title:    'Drill actions',
  action_edit:      'Edit',
  action_duplicate: 'Duplicate',
  action_rename:    'Rename',
  action_favorite:  'Favorite',
  action_unfavorite:'Unfavorite',
  action_delete:    'Delete',

  // Training length dialog
  training_length: 'Training length',
  count_balls:     'Balls',
  count_time:      'Time',
  unit_min_sec:    'min : sec',

  // Save dialog
  save_drill_title:    'Save drill',
  save_name_placeholder:'Drill name',

  // Rename dialog
  rename_drill_title: 'Rename drill',

  // Delete dialog
  delete_drill_title:    'Delete drill?',
  delete_message_default:"This can't be undone.",
  delete_message:        '"{name}" will be permanently removed.',

  // Conflict dialog
  conflict_title:         'Remove placed balls?',
  conflict_message_one:   "1 placed ball is in an area that won't be reachable with the new setting and will be removed.",
  conflict_message_many:  "{n} placed balls are in areas that won't be reachable with the new setting and will be removed.",
  conflict_change_remove: 'Change & remove',

  // FAB sheet
  fab_add:           'Add',
  fab_new_drill:     'New drill',
  fab_import_backup: 'Import backup',

  // Toast messages
  toast_enter_name:      'Enter a drill name',
  toast_load_failed:     'Failed to load drills',
  toast_fav_failed:      'Failed to update favorite',
  toast_duplicated:      'Duplicated',
  toast_duplicate_failed:'Failed to duplicate',
  toast_rename_failed:   'Failed to rename',
  toast_deleted:         'Deleted',
  toast_delete_failed:   'Failed to delete',
  toast_place_point:     'Place at least one landing point',
  toast_playing:         'Playing',
  toast_testing:         'Testing',
  toast_stopped:         'Stopped',
  toast_stop_failed:     'Failed to stop robot',
  toast_saved:           'Drill saved',
  toast_save_failed:     'Failed to save drill',
  toast_send_failed:     'Failed to send to robot',
  toast_robot_connected: 'Robot connected',
  toast_connection_failed:'Connection failed',
  toast_imported:        'Imported: {list}',
  toast_import_failed:   'Import failed: {message}',
  toast_connect_first:   '{mode}: Connect robot first',
};
