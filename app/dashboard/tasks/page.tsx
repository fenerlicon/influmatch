import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { getViewer } from '@/lib/viewer-role'
import { getTasksOverviewAs } from '@/lib/tasks'
import TasksBoard from '@/components/tasks/TasksBoard'

export const revalidate = 0

// Görevler (2026-10-18): influencer/UGC ve marka. Ödüller satış başlayınca hesaba işlenir.
export default async function TasksPage() {
  const viewer = await getViewer()
  if (!viewer) redirect('/login')
  if (viewer.role === 'admin') redirect('/admin/tasks')

  const result = await getTasksOverviewAs(viewer.user.id)

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Görevler"
        description="Görevleri tamamla, ödül kazan. Ödüller incelemeden sonra bekleyen ödüllerine eklenir ve satış başlayınca hesabına işlenir."
      />
      {result.success ? (
        <TasksBoard overview={result.overview} />
      ) : (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{result.error}</p>
      )}
    </div>
  )
}
