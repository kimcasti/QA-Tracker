const LEGACY_UNUSED_LOCAL_STORAGE_KEYS = [
  'qa_tracker_projects',
  'qa_tracker_functionalities',
  'qa_tracker_test_cases',
  'qa_tracker_executions',
  'qa_tracker_regression_cycles',
  'qa_tracker_smoke_cycles',
  'qa_tracker_test_plans',
  'qa_tracker_sprints',
  'qa_tracker_roles',
  'qa_tracker_modules',
  'qa_tracker_test_runs',
  'qa_tracker_meeting_notes',
  'qa_bugs',
  'qa_roles',
  'qa_epics',
  'qa_stories',
  'qa_story_functionality_links',
  'qa_story_task_order',
] as const;

const CLEANUP_MARKER_KEY = 'qa_tracker_cleanup_legacy_storage_v2';

export function cleanupUnusedLegacyLocalStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.localStorage.getItem(CLEANUP_MARKER_KEY) === 'done') {
    return;
  }

  LEGACY_UNUSED_LOCAL_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });

  window.localStorage.setItem(CLEANUP_MARKER_KEY, 'done');
}
