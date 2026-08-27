export interface GuardReport {
  removedStyleTags: number
  removedStylesheetLinks: number
  convertedUnits: number
  enforcedBodyStyle: boolean
  tablesProcessed: number
  mathMlNodesRemoved: number
}

export interface GuardResult {
  html: string
  report: GuardReport
}

