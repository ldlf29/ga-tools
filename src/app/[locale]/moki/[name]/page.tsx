import { redirect } from 'next/navigation';

// These pages have been removed. Redirect to home.
export default async function LocalizedMokiPage() {
  redirect('/');
}
