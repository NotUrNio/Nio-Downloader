/**
 * Application-level command identifiers.
 * Referenced from menus, keybindings, tray, renderer shortcut hook,
 * and (in the future) command palette / plugin contributions.
 *
 * Using reverse-DNS style: nio.<domain>.<verb>.
 */
export const CommandIds = {
  // App
  AppShowAbout: 'niodownloader.com.showAbout',
  AppOpenPreferences: 'niodownloader.com.openPreferences',
  AppCheckForUpdates: 'niodownloader.com.checkForUpdates',
  AppShowMain: 'niodownloader.com.showMain',
  AppQuit: 'niodownloader.com.quit',

  // Task
  TaskNew: 'nio.task.new',
  TaskNewBt: 'nio.task.newBt',
  TaskOpenFile: 'nio.task.openFile',
  TaskPause: 'nio.task.pause',
  TaskResume: 'nio.task.resume',
  TaskDelete: 'nio.task.delete',
  TaskMoveUp: 'nio.task.moveUp',
  TaskMoveDown: 'nio.task.moveDown',
  TaskPauseAll: 'nio.task.pauseAll',
  TaskResumeAll: 'nio.task.resumeAll',
  TaskSelectAll: 'nio.task.selectAll',
  TaskClearStopped: 'nio.task.clearStopped',

  // Navigation
  NavigateTaskList: 'nio.navigate.taskList',

  // Help
  HelpOpenWebsite: 'nio.help.openWebsite',
  HelpOpenManual: 'nio.help.openManual',
  HelpOpenChangelog: 'nio.help.openChangelog',
  HelpReportProblem: 'nio.help.reportProblem',
} as const

export type CommandId = (typeof CommandIds)[keyof typeof CommandIds]
