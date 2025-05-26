// Shared state for processing jobs
export const processingJobs: Record<
  string,
  {
    id?: string
    status: "pending" | "processing" | "completed" | "failed"
    progress: number
    message: string
    startTime: number
    fileUrl?: string
    fileName?: string
    screenshots?: Array<{ image: string; label: string }>
    error?: string
  }
> = {}
