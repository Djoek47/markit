import { OpenReelEditorLoader } from '@/components/openreel/openreel-editor-loader'
import { EditorApp } from '@/components/editor-app'

export const metadata = {
  title: 'Markit — Editor (Beta) · Circe et Venus',
  description: 'Editor workspace — trim, export, Ariadne trace.',
}

// Next 16: searchParams is async
export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const { mode } = await searchParams
  if (mode === 'markit') return <EditorApp />
  return <OpenReelEditorLoader />
}
