import { OpenReelEditorLoader } from '@/components/openreel/openreel-editor-loader'

export const metadata = {
  title: 'Markit — Editor (Beta) · Circe et Venus',
  description: 'Editor workspace — trim, export, Ariadne trace.',
}

export default function EditorPage() {
  return <OpenReelEditorLoader />
}
