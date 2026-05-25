// app/page.tsx — redirect to /jobs
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/jobs')
}
